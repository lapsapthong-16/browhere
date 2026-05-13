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
import type { ChunkRecord, FileMetadata, IndexedFileRecord } from "@/lib/types";

const watchers = new Map<string, FSWatcher>();
const timers = new Map<string, NodeJS.Timeout>();
let running = false;

export async function addFolder(folderPath: string) {
  const stats = await fs.stat(folderPath);
  if (!stats.isDirectory()) {
    throw new Error("Folder does not exist or is not readable.");
  }
  await repository.addFolder(folderPath);
  await watchFolder(path.resolve(folderPath));
  void enqueueFolder(path.resolve(folderPath));
}

export async function removeFolder(folderPath: string) {
  const normalized = path.resolve(folderPath);
  await repository.removeFolder(normalized);
  await watchers.get(normalized)?.close();
  watchers.delete(normalized);
}

export async function ensureWatchers() {
  const folders = await repository.getFolders();
  await Promise.all(folders.map((folder) => watchFolder(folder.path)));
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
      } catch (error) {
        await repository.recordFailure(filePath, errorMessage(error));
      } finally {
        runtimeState.processing.delete(filePath);
      }
    }
    runtimeState.state = "ready";
    runtimeState.currentFilePath = undefined;
    await repository.setLastIndexedAt();
  } catch (error) {
    runtimeState.state = "failed";
    await repository.recordFailure(runtimeState.currentFilePath ?? "indexer", errorMessage(error));
  } finally {
    running = false;
  }
}

export async function indexFile(filePath: string) {
  const stats = await fs.stat(filePath);
  const ext = extensionFor(filePath);
  const marker = `${stats.size}:${stats.mtimeMs}`;
  const existing = await repository.findFile(filePath);
  const unchanged = existing?.contentMarker === marker;
  const imageFile = IMAGE_EXTENSIONS.has(ext);
  const hasCurrentMetadata = Boolean(existing?.metadataContext && existing.metadata);
  const hasHandledImageLabel = !imageFile || existing?.labelStatus === "generated" || existing?.labelStatus === "failed";
  if (unchanged && hasCurrentMetadata && hasHandledImageLabel) {
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
        continue;
      }
      throw error;
    }
  }

  if (imageFile) {
    const imageChunk = extracted.chunks.find((chunk) => chunk.kind === "image" && chunk.rawImage && chunk.mimeType);
    if (imageChunk?.rawImage && imageChunk.mimeType) {
      if (unchanged && existing?.labelStatus === "failed") {
        labelStatus = "failed";
        labelReason = existing.labelReason || "Image label unavailable.";
      } else {
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
          labelStatus = "failed";
          labelReason = `Image label unavailable: ${errorMessage(error)}`;
          status = chunks.length > 0 ? "partial" : status;
          reason = reason ?? "Image label unavailable.";
        }
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
  await repository.upsertFile(file);
  await repository.upsertChunks(fileId, chunks);
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
