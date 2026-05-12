import type { IndexStatus } from "@/lib/types";
import { getGeminiConfig, getGroqConfig } from "@/lib/config";
import { repository } from "@/lib/storage/repository";

export class IndexRuntimeState {
  queued = new Set<string>();
  processing = new Set<string>();
  currentFilePath?: string;
  state: IndexStatus["state"] = "notConfigured";

  async status(message?: string): Promise<IndexStatus> {
    const folders = await repository.getFolders();
    const counts = await repository.getCounts();
    const hasFolders = folders.length > 0;
    const active = this.queued.size > 0 || this.processing.size > 0;
    const state = active ? "indexing" : hasFolders ? this.state === "failed" ? "failed" : "ready" : "notConfigured";
    return {
      state,
      folders,
      queuedCount: this.queued.size,
      processingCount: this.processing.size,
      indexedFileCount: counts.files,
      indexedChunkCount: counts.chunks,
      skippedCount: counts.skipped,
      failedCount: counts.failed,
      unsupportedCount: counts.unsupported,
      currentFilePath: this.currentFilePath,
      lastIndexedAt: counts.lastIndexedAt,
      failures: counts.failures,
      providers: {
        geminiReady: Boolean(getGeminiConfig().apiKey),
        groqReady: Boolean(getGroqConfig().apiKey),
      },
      message:
        message ??
        (active
          ? "Indexing files."
          : hasFolders
            ? "Index ready."
            : "Add a folder to start indexing."),
    };
  }
}

export const runtimeState = new IndexRuntimeState();
