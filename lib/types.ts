export type IndexState = "notConfigured" | "ready" | "indexing" | "stale" | "failed";
export type FileStatus = "indexed" | "new" | "changed" | "missing" | "failed" | "partial" | "unsupported";
export type RecordKind = "text" | "rawImage" | "imageLabel" | "metadata";
export type ContextSource = "extractedText" | "rawImageVector" | "imageLabel" | "metadata";
export type MatchKind = ContextSource | "explanation";

export interface FileMetadata {
  displayName: string;
  extension: string;
  mediaType: string;
  sizeBytes: number;
  sizeClass: string;
  modifiedMs: number;
  modifiedDate: string;
  approvedFolderRoot: string;
  parentFolders: string[];
  indexedAt: number;
  imageWidth?: number;
  imageHeight?: number;
}

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
  metadata?: FileMetadata;
  metadataContext?: string;
  labelStatus?: "notApplicable" | "generated" | "failed";
  labelReason?: string;
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
  recordKind?: RecordKind;
  contextSource?: ContextSource;
  status: FileStatus;
  reason?: string;
  modifiedMs: number;
  sizeBytes: number;
  indexedAt: number;
  metadata?: FileMetadata;
  metadataContext?: string;
  provider?: string;
  model?: string;
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
  partialCount: number;
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
    sources?: ContextSource[];
  };
  metadata?: Pick<FileMetadata, "displayName" | "extension" | "mediaType" | "sizeBytes" | "modifiedDate" | "parentFolders" | "imageWidth" | "imageHeight">;
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
