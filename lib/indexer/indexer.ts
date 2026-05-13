import crypto from "node:crypto";
import fs from "node:fs/promises";
import type { Stats } from "node:fs";
import path from "node:path";
import chokidar, { type FSWatcher } from "chokidar";
import { gemini, ProviderUnavailableError } from "@/lib/ai/gemini";
import { IMAGE_EXTENSIONS } from "@/lib/config";
import { discoverSupportedFiles, extensionFor, isSupportedFile } from "@/lib/files/discovery";
import { isExcludedPath } from "@/lib/files/exclusions";
import { extractContent } from "@/lib/files/extraction";
import { runtimeState } from "@/lib/indexer/state";
import { repository } from "@/lib/storage/repository";
import type { ChunkRecord, FileMetadata, IndexedFileRecord, RepairErrorKind, RepairOperation, RepairTask } from "@/lib/types";

const watchers = new Map<string, FSWatcher>();
const timers = new Map<string, NodeJS.Timeout>();
let running = false;
let repairing = false;
const MAX_REPAIR_TASKS_PER_RUN = 3;

export async function addFolder(folderPath: string) {
  const stats = await fs.stat(folderPath);
  if (!stats.isDirectory()) {
    throw new Error("Folder does not exist or is not readable.");
  }
  await repository.addFolder(folderPath);
  await watchFolder(path.resolve(folderPath));
  void enqueueFolder(path.resolve(folderPath));
  void runRepairQueue();
}

export async function removeFolder(folderPath: string) {
  const normalized = path.resolve(folderPath);
  await repository.removeFolder(normalized);
  for (const filePath of runtimeState.queued) {
    if (isWithinFolder(filePath, normalized)) {
      runtimeState.queued.delete(filePath);
    }
  }
  for (const [filePath, timer] of timers) {
    if (isWithinFolder(filePath, normalized)) {
      clearTimeout(timer);
      timers.delete(filePath);
    }
  }
  await watchers.get(normalized)?.close();
  watchers.delete(normalized);
}

export async function ensureWatchers() {
  const folders = await repository.getFolders();
  await Promise.all(folders.map((folder) => watchFolder(folder.path)));
  void runRepairQueue();
}

export async function enqueueFolder(folderPath: string) {
  const files = await discoverSupportedFiles(folderPath);
  await repository.deleteMissing(new Set(files.map((file) => file.path)), folderPath);
  for (const file of files) {
    runtimeState.queued.add(file.path);
  }
  void drainQueue();
}

export function enqueueFile(filePath: string) {
  if (isExcludedPath(filePath)) return;
  if (!isSupportedFile(filePath)) {
    void repository.incrementSkipped("unsupported");
    return;
  }
  clearTimeout(timers.get(filePath));
  timers.set(
    filePath,
    setTimeout(() => {
      runtimeState.queued.add(filePath);
      void drainQueue();
    }, 250),
  );
}

async function watchFolder(folderPath: string) {
  if (watchers.has(folderPath)) return;
  const watcher = chokidar.watch(folderPath, {
    ignored: (targetPath) => isExcludedPath(targetPath),
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 500, pollInterval: 100 },
  });
  watcher.on("add", enqueueFile);
  watcher.on("change", enqueueFile);
  watcher.on("unlink", (filePath) => {
    void repository.deleteByPath(filePath);
  });
  watchers.set(folderPath, watcher);
}

async function drainQueue() {
  if (running) return;
  running = true;
  runtimeState.state = "indexing";
  try {
    while (runtimeState.queued.size > 0) {
      const [filePath] = runtimeState.queued;
      runtimeState.queued.delete(filePath);
      runtimeState.processing.add(filePath);
      runtimeState.currentFilePath = filePath;
      try {
        await indexFile(filePath);
      } catch {
      } finally {
        runtimeState.processing.delete(filePath);
      }
    }
    runtimeState.state = "ready";
    runtimeState.currentFilePath = undefined;
    await repository.setLastIndexedAt();
    void runRepairQueue();
  } catch (error) {
    runtimeState.state = "failed";
  } finally {
    running = false;
  }
}

export async function indexFile(filePath: string) {
  if (!(await isApprovedFile(filePath))) {
    await repository.deleteByPath(filePath);
    return;
  }
  const stats = await fs.stat(filePath);
  const ext = extensionFor(filePath);
  const marker = `${stats.size}:${stats.mtimeMs}`;
  const existing = await repository.findFile(filePath);
  const unchanged = existing?.contentMarker === marker;
  const imageFile = IMAGE_EXTENSIONS.has(ext);
  const hasCurrentMetadata = Boolean(existing?.metadataContext && existing.metadata);
  const hasHandledImageLabel = !imageFile || existing?.labelStatus === "generated";
  if (unchanged && hasCurrentMetadata && hasHandledImageLabel) {
    return;
  }
  if (unchanged && hasCurrentMetadata && imageFile && existing) {
    await queueImageLabelRepair(existing, existing.labelReason || "Image caption pending.");
    void runRepairQueue();
    return;
  }
  const existingChunks = unchanged && existing ? await repository.getChunksForFile(existing.id) : [];

  const extracted = await extractContent(filePath);
  const fileId = stableId(filePath);
  const indexedAt = Date.now();
  const metadata = await buildFileMetadata(filePath, stats, indexedAt);
  const metadataContext = buildMetadataContext(metadata);
  const chunks: ChunkRecord[] = [];
  let status: IndexedFileRecord["status"] = extracted.status;
  let reason = extracted.reason;
  let labelStatus: IndexedFileRecord["labelStatus"] = imageFile ? "failed" : "notApplicable";
  let labelReason: string | undefined;
  let labelError: unknown;
  let rawImageError: unknown;
  let metadataError: unknown;

  for (let index = 0; index < extracted.chunks.length; index += 1) {
    const chunk = extracted.chunks[index];
    try {
      const vector =
        chunk.kind === "image" && chunk.rawImage && chunk.mimeType && IMAGE_EXTENSIONS.has(ext)
          ? await gemini.embedImage(chunk.rawImage, chunk.mimeType, chunk.text)
          : await gemini.embedText(chunk.text);
      chunks.push({
        id: `${fileId}:${index}`,
        fileId,
        filePath,
        displayName: path.basename(filePath),
        fileType: ext,
        text: chunk.text,
        vector,
        kind: chunk.kind,
        recordKind: chunk.kind === "image" ? "rawImage" : "text",
        contextSource: chunk.kind === "image" ? "rawImageVector" : "extractedText",
        status,
        reason,
        modifiedMs: stats.mtimeMs,
        sizeBytes: stats.size,
        indexedAt,
        metadata,
        metadataContext,
      });
    } catch (error) {
      if (chunk.kind === "image" && !(error instanceof ProviderUnavailableError)) {
        const vector = await gemini.embedText(chunk.text);
        chunks.push({
          id: `${fileId}:${index}`,
          fileId,
          filePath,
          displayName: path.basename(filePath),
          fileType: ext,
          text: chunk.text,
          vector,
          kind: "image",
          recordKind: "rawImage",
          contextSource: "rawImageVector",
          status: "partial",
          reason: `Raw image embedding unavailable: ${errorMessage(error)}`,
          modifiedMs: stats.mtimeMs,
          sizeBytes: stats.size,
          indexedAt,
          metadata,
          metadataContext,
        });
        status = "partial";
        reason = "Raw image embedding unavailable.";
        rawImageError = error;
        continue;
      }
      throw error;
    }
  }

  if (imageFile) {
    const imageChunk = extracted.chunks.find((chunk) => chunk.kind === "image" && chunk.rawImage && chunk.mimeType);
    if (imageChunk?.rawImage && imageChunk.mimeType) {
      try {
        const cachedLabel = existingChunks.find((chunk) => chunk.contextSource === "imageLabel")?.text.trim();
        const label = cachedLabel || (await gemini.labelImage(imageChunk.rawImage, imageChunk.mimeType));
        labelStatus = "generated";
        const vector = await gemini.embedText(label);
        chunks.push({
          id: `${fileId}:label`,
          fileId,
          filePath,
          displayName: path.basename(filePath),
          fileType: ext,
          text: label,
          vector,
          kind: "text",
          recordKind: "imageLabel",
          contextSource: "imageLabel",
          status,
          reason,
          modifiedMs: stats.mtimeMs,
          sizeBytes: stats.size,
          indexedAt,
          metadata,
          metadataContext,
          provider: "gemini",
          model: process.env.BROWHERE_GEMINI_VISION_MODEL ?? "gemini-2.0-flash",
        });
      } catch (error) {
        labelError = error;
        labelStatus = "pending";
        labelReason = labelReasonFor(error);
        status = chunks.length > 0 ? "partial" : status;
        reason = reason ?? "Image label unavailable; retry scheduled.";
      }
    }
  }

  if (metadataContext) {
    try {
      chunks.push({
        id: `${fileId}:metadata`,
        fileId,
        filePath,
        displayName: path.basename(filePath),
        fileType: ext,
        text: metadataContext,
        vector: await gemini.embedText(metadataContext),
        kind: "text",
        recordKind: "metadata",
        contextSource: "metadata",
        status,
        reason,
        modifiedMs: stats.mtimeMs,
        sizeBytes: stats.size,
        indexedAt,
        metadata,
        metadataContext,
      });
    } catch (error) {
      status = chunks.length > 0 ? "partial" : status;
      reason = reason ?? `Metadata context embedding unavailable: ${errorMessage(error)}`;
      metadataError = error;
    }
  }

  const file: IndexedFileRecord = {
    id: fileId,
    path: filePath,
    displayName: path.basename(filePath),
    fileType: ext,
    sizeBytes: stats.size,
    modifiedMs: stats.mtimeMs,
    contentMarker: marker,
    status,
    reason,
    indexedAt,
    chunkCount: chunks.length,
    metadata,
    metadataContext,
    labelStatus,
    labelReason,
  };
  if (!(await isApprovedFile(filePath))) {
    await repository.deleteByPath(filePath);
    return;
  }
  await repository.upsertFile(file);
  await repository.upsertChunks(fileId, chunks);
  if (imageFile && labelError) {
    await queueRepairTask(file, "imageLabel", labelError);
    void runRepairQueue();
  }
  if (imageFile && rawImageError) {
    await queueRepairTask(file, "rawImageEmbedding", rawImageError);
    void runRepairQueue();
  }
  if (metadataError) {
    await queueRepairTask(file, "metadataEmbedding", metadataError);
    void runRepairQueue();
  }
}

export async function runRepairQueue() {
  if (repairing || running) return;
  repairing = true;
  try {
    const now = Date.now();
    const tasks = (await repository.getRepairTasks())
      .filter((task) => task.status !== "running" && (task.nextRetryAt ?? 0) <= now)
      .slice(0, MAX_REPAIR_TASKS_PER_RUN);
    for (const task of tasks) {
      await runRepairTask(task);
    }
  } finally {
    repairing = false;
  }
}

async function runRepairTask(task: RepairTask) {
  const started: RepairTask = { ...task, status: "running", lastAttemptAt: Date.now() };
  await repository.upsertRepairTask(started);
  try {
    const file = await repository.findFile(task.filePath);
    if (!file || file.contentMarker !== task.contentMarker || !(await isApprovedFile(task.filePath))) {
      await repository.completeRepairTask(task.id);
      return;
    }
    switch (task.operation) {
      case "imageLabel":
      case "imageLabelEmbedding":
        await repairImageLabel(file);
        break;
      case "rawImageEmbedding":
        await repairRawImageEmbedding(file);
        break;
      case "metadataEmbedding":
        await repairMetadataEmbedding(file);
        break;
      case "textEmbedding":
        break;
    }
    await repository.completeRepairTask(task.id);
  } catch (error) {
    const next = nextRepairTask(started, error);
    await repository.upsertRepairTask(next);
    const file = await repository.findFile(task.filePath);
    if (file) {
      await repository.updateFile({
        ...file,
        status: file.status === "indexed" ? "partial" : file.status,
        reason: file.reason ?? "Repair retry scheduled.",
        labelStatus: task.operation === "imageLabel" ? "pending" : file.labelStatus,
        labelReason: labelReasonFor(error),
      });
    }
  }
}

async function repairImageLabel(file: IndexedFileRecord) {
  const ext = extensionFor(file.path);
  if (!IMAGE_EXTENSIONS.has(ext)) return;
  const rawImage = await fs.readFile(file.path);
  const mimeType = ext === "png" ? "image/png" : "image/jpeg";
  const label = await gemini.labelImage(rawImage, mimeType);
  const vector = await gemini.embedText(label);
  const indexedAt = Date.now();
  const metadata = file.metadata ?? (await buildFileMetadata(file.path, await fs.stat(file.path), indexedAt));
  const metadataContext = file.metadataContext ?? buildMetadataContext(metadata);
  await repository.upsertChunk({
    id: `${file.id}:label`,
    fileId: file.id,
    filePath: file.path,
    displayName: file.displayName,
    fileType: file.fileType,
    text: label,
    vector,
    kind: "text",
    recordKind: "imageLabel",
    contextSource: "imageLabel",
    status: "indexed",
    modifiedMs: file.modifiedMs,
    sizeBytes: file.sizeBytes,
    indexedAt,
    metadata,
    metadataContext,
    provider: "gemini",
    model: process.env.BROWHERE_GEMINI_VISION_MODEL ?? "gemini-2.0-flash",
  });
  const chunkCount = (await repository.getChunksForFile(file.id)).length;
  await repository.updateFile({
    ...file,
    status: file.reason === "Image label unavailable; retry scheduled." ? "indexed" : file.status,
    reason: file.reason === "Image label unavailable; retry scheduled." ? undefined : file.reason,
    indexedAt,
    chunkCount,
    metadata,
    metadataContext,
    labelStatus: "generated",
    labelReason: undefined,
  });
}

async function repairRawImageEmbedding(file: IndexedFileRecord) {
  const ext = extensionFor(file.path);
  if (!IMAGE_EXTENSIONS.has(ext)) return;
  const rawImage = await fs.readFile(file.path);
  const mimeType = ext === "png" ? "image/png" : "image/jpeg";
  const fallbackText = `${path.basename(file.path)} ${path.dirname(file.path)}`;
  const vector = await gemini.embedImage(rawImage, mimeType, fallbackText);
  const indexedAt = Date.now();
  const metadata = file.metadata ?? (await buildFileMetadata(file.path, await fs.stat(file.path), indexedAt));
  const metadataContext = file.metadataContext ?? buildMetadataContext(metadata);
  await repository.upsertChunk({
    id: `${file.id}:0`,
    fileId: file.id,
    filePath: file.path,
    displayName: file.displayName,
    fileType: file.fileType,
    text: fallbackText,
    vector,
    kind: "image",
    recordKind: "rawImage",
    contextSource: "rawImageVector",
    status: "indexed",
    modifiedMs: file.modifiedMs,
    sizeBytes: file.sizeBytes,
    indexedAt,
    metadata,
    metadataContext,
  });
  await updateFileAfterRepair(file, metadata, metadataContext);
}

async function repairMetadataEmbedding(file: IndexedFileRecord) {
  const indexedAt = Date.now();
  const metadata = file.metadata ?? (await buildFileMetadata(file.path, await fs.stat(file.path), indexedAt));
  const metadataContext = file.metadataContext ?? buildMetadataContext(metadata);
  const vector = await gemini.embedText(metadataContext);
  await repository.upsertChunk({
    id: `${file.id}:metadata`,
    fileId: file.id,
    filePath: file.path,
    displayName: file.displayName,
    fileType: file.fileType,
    text: metadataContext,
    vector,
    kind: "text",
    recordKind: "metadata",
    contextSource: "metadata",
    status: "indexed",
    modifiedMs: file.modifiedMs,
    sizeBytes: file.sizeBytes,
    indexedAt,
    metadata,
    metadataContext,
  });
  await updateFileAfterRepair(file, metadata, metadataContext);
}

async function updateFileAfterRepair(file: IndexedFileRecord, metadata: FileMetadata, metadataContext: string) {
  const chunkCount = (await repository.getChunksForFile(file.id)).length;
  await repository.updateFile({
    ...file,
    indexedAt: Date.now(),
    chunkCount,
    metadata,
    metadataContext,
  });
}

async function queueImageLabelRepair(file: IndexedFileRecord, reason: string) {
  await repository.updateFile({
    ...file,
    status: file.status === "indexed" ? "partial" : file.status,
    reason: file.reason ?? "Image label unavailable; retry scheduled.",
    labelStatus: "pending",
    labelReason: reason,
  });
  await queueRepairTask(file, "imageLabel", new Error(reason));
}

async function queueRepairTask(file: IndexedFileRecord, operation: RepairOperation, error: unknown) {
  const task = nextRepairTask(
    {
      id: `${file.id}:${operation}`,
      fileId: file.id,
      filePath: file.path,
      contentMarker: file.contentMarker,
      operation,
      status: "queued",
      retryCount: 0,
    },
    error,
  );
  await repository.upsertRepairTask(task);
}

function nextRepairTask(task: RepairTask, error: unknown): RepairTask {
  const kind = repairErrorKind(error);
  const now = Date.now();
  const retryCount = task.retryCount + 1;
  const delay = repairDelayMs(error, retryCount, kind);
  return {
    ...task,
    status: "cooldown",
    retryCount,
    lastAttemptAt: now,
    nextRetryAt: now + delay,
    lastError: errorMessage(error),
    errorKind: kind,
  };
}

function repairDelayMs(error: unknown, retryCount: number, kind: RepairErrorKind): number {
  const explicitSeconds = retrySeconds(errorMessage(error));
  if (explicitSeconds) return Math.min(24 * 60 * 60 * 1000, explicitSeconds * 1000);
  const base = kind === "quota" ? 60_000 : 15_000;
  const cap = kind === "quota" || kind === "providerUnavailable" ? 24 * 60 * 60 * 1000 : 6 * 60 * 60 * 1000;
  return Math.min(cap, base * 2 ** Math.min(retryCount - 1, 10));
}

function repairErrorKind(error: unknown): RepairErrorKind {
  const message = errorMessage(error).toLowerCase();
  if (error instanceof ProviderUnavailableError || message.includes("api key")) return "providerUnavailable";
  if (message.includes("429") || message.includes("quota") || message.includes("resource_exhausted")) return "quota";
  return "transient";
}

function retrySeconds(message: string): number | undefined {
  const seconds = message.match(/retry(?:Delay| in)?["\s:]*([0-9.]+)s/i)?.[1];
  return seconds ? Number(seconds) : undefined;
}

function labelReasonFor(error: unknown): string {
  const kind = repairErrorKind(error);
  if (kind === "quota") return "Caption delayed by Gemini quota. Retry scheduled.";
  if (kind === "providerUnavailable") return "Caption pending until Gemini API key is available.";
  return "Caption failed. Retry scheduled.";
}

async function buildFileMetadata(filePath: string, stats: Stats, indexedAt: number): Promise<FileMetadata> {
  const ext = extensionFor(filePath);
  const dimensions = IMAGE_EXTENSIONS.has(ext) ? await readImageDimensions(filePath, ext).catch(() => ({})) : {};
  return {
    displayName: path.basename(filePath),
    extension: ext,
    mediaType: mediaTypeFor(ext),
    sizeBytes: stats.size,
    sizeClass: sizeClass(stats.size),
    modifiedMs: stats.mtimeMs,
    modifiedDate: new Date(stats.mtimeMs).toISOString(),
    approvedFolderRoot: await approvedRootFor(filePath),
    parentFolders: path.dirname(filePath).split(path.sep).filter(Boolean).slice(-3),
    indexedAt,
    ...dimensions,
  };
}

function buildMetadataContext(metadata: FileMetadata): string {
  const dimensions =
    metadata.imageWidth && metadata.imageHeight ? `dimensions ${metadata.imageWidth}x${metadata.imageHeight}` : "";
  return [
    `file ${metadata.displayName}`,
    `type ${metadata.extension} ${metadata.mediaType}`,
    `folders ${metadata.parentFolders.join(" ")}`,
    `size ${metadata.sizeClass}`,
    `modified ${metadata.modifiedDate.slice(0, 10)}`,
    dimensions,
  ]
    .filter(Boolean)
    .join(". ");
}

async function approvedRootFor(filePath: string): Promise<string> {
  const folders = await repository.getFolders();
  return folders.find((folder) => isWithinFolder(filePath, folder.path))?.path ?? path.dirname(filePath);
}

async function isApprovedFile(filePath: string): Promise<boolean> {
  const folders = await repository.getFolders();
  return folders.some((folder) => isWithinFolder(filePath, folder.path));
}

function isWithinFolder(filePath: string, folderPath: string): boolean {
  const relative = path.relative(path.resolve(folderPath), path.resolve(filePath));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function mediaTypeFor(ext: string): string {
  if (ext === "png") return "image/png";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "pdf") return "application/pdf";
  if (ext === "docx") return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (ext === "md") return "text/markdown";
  return "text/plain";
}

function sizeClass(size: number): string {
  if (size < 10_000) return "small";
  if (size < 1_000_000) return "medium";
  return "large";
}

async function readImageDimensions(filePath: string, ext: string): Promise<Pick<FileMetadata, "imageWidth" | "imageHeight">> {
  const buffer = await fs.readFile(filePath);
  if (ext === "png" && buffer.length >= 24 && buffer.toString("ascii", 1, 4) === "PNG") {
    return { imageWidth: buffer.readUInt32BE(16), imageHeight: buffer.readUInt32BE(20) };
  }
  if ((ext === "jpg" || ext === "jpeg") && buffer[0] === 0xff && buffer[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < buffer.length) {
      if (buffer[offset] !== 0xff) break;
      const marker = buffer[offset + 1];
      const length = buffer.readUInt16BE(offset + 2);
      if (marker >= 0xc0 && marker <= 0xc3) {
        return { imageHeight: buffer.readUInt16BE(offset + 5), imageWidth: buffer.readUInt16BE(offset + 7) };
      }
      offset += 2 + length;
    }
  }
  return {};
}

function stableId(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Indexing failed.";
}
