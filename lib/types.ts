export type IndexState = "notConfigured" | "ready" | "indexing" | "stale" | "failed";
export type FileStatus = "indexed" | "new" | "changed" | "missing" | "failed" | "partial" | "unsupported";
export type MatchKind = "snippet" | "caption" | "explanation";

export interface IndexedFolder {
  path: string;
  addedAt: number;
}

export interface IndexedFileRecord {
  id: string;
  path: string;
  displayName: string;
  fileType: string;
  sizeBytes: number;
  modifiedMs: number;
  contentMarker: string;
  status: FileStatus;
  reason?: string;
  indexedAt?: number;
  chunkCount: number;
}

export interface ChunkRecord {
  id: string;
  fileId: string;
  filePath: string;
  displayName: string;
  fileType: string;
  text: string;
  vector: number[];
  kind: "text" | "image";
  status: FileStatus;
  reason?: string;
  modifiedMs: number;
  sizeBytes: number;
  indexedAt: number;
}

export interface IndexFailure {
  filePath: string;
  message: string;
  at: number;
}

export interface IndexStatus {
  state: IndexState;
  folders: IndexedFolder[];
  queuedCount: number;
  processingCount: number;
  indexedFileCount: number;
  indexedChunkCount: number;
  skippedCount: number;
  failedCount: number;
  unsupportedCount: number;
  currentFilePath?: string;
  lastIndexedAt?: number;
  failures: IndexFailure[];
  message: string;
  providers: {
    geminiReady: boolean;
    groqReady: boolean;
  };
}

export interface SearchResult {
  id: string;
  rank: number;
  filePath: string;
  displayName: string;
  fileType: string;
  sizeBytes: number;
  score: number;
  matchContext: {
    kind: MatchKind;
    text: string;
  };
  readiness: "ready" | "partial";
}

export interface SearchResponse {
  results: SearchResult[];
  readiness: {
    kind: "ready" | "notReady";
    reason?: "notIndexedYet" | "providerUnavailable";
    message?: string;
  };
  agentic: boolean;
}
