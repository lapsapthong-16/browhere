import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import chokidar, { type FSWatcher } from "chokidar";
import { gemini, ProviderUnavailableError } from "@/lib/ai/gemini";
import { IMAGE_EXTENSIONS } from "@/lib/config";
import { discoverSupportedFiles, extensionFor, isSupportedFile } from "@/lib/files/discovery";
import { isExcludedPath } from "@/lib/files/exclusions";
import { extractContent } from "@/lib/files/extraction";
import { runtimeState } from "@/lib/indexer/state";
import { repository } from "@/lib/storage/repository";
import type { ChunkRecord, IndexedFileRecord } from "@/lib/types";

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
  if (existing?.contentMarker === marker) {
    return;
  }

  const extracted = await extractContent(filePath);
  const fileId = stableId(filePath);
  const indexedAt = Date.now();
  const chunks: ChunkRecord[] = [];
  let status: IndexedFileRecord["status"] = extracted.status;
  let reason = extracted.reason;

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
        status,
        reason,
        modifiedMs: stats.mtimeMs,
        sizeBytes: stats.size,
        indexedAt,
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
          status: "partial",
          reason: `Raw image embedding unavailable: ${errorMessage(error)}`,
          modifiedMs: stats.mtimeMs,
          sizeBytes: stats.size,
          indexedAt,
        });
        status = "partial";
        reason = "Raw image embedding unavailable.";
        continue;
      }
      throw error;
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
  };
  await repository.upsertFile(file);
  await repository.upsertChunks(fileId, chunks);
}

function stableId(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Indexing failed.";
}
