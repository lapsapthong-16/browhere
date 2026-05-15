export type IndexState = "notConfigured" | "ready" | "indexing" | "failed";
export type FileStatus = "indexed" | "failed" | "partial";
export type RecordKind = "text" | "rawImage" | "imageLabel" | "imageVisualCaption" | "imageOcrText" | "metadata";
export type ContextSource =
  | "extractedText"
  | "rawImageVector"
  | "imageLabel"
  | "imageVisualCaption"
  | "imageOcrText"
  | "metadata";
export type MatchKind = ContextSource | "filenamePath" | "unconfirmedVisual" | "explanation";
export type EvidenceProvenance =
  | "human-authored"
  | "raw-visual"
  | "ai-visual-caption"
  | "ocr"
  | "metadata"
  | "llm-explanation";
export type RepairOperation =
  | "rawImageEmbedding"
  | "imageLabel"
  | "imageOcr"
  | "imageLabelEmbedding"
  | "imageOcrEmbedding"
  | "metadataEmbedding"
  | "textEmbedding";
export type RepairTaskStatus = "queued" | "running" | "cooldown";
export type RepairErrorKind = "quota" | "providerUnavailable" | "transient";

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
  labelStatus?: "notApplicable" | "generated" | "failed" | "pending" | "retrying";
  labelReason?: string;
  ocrStatus?: "notApplicable" | "generated" | "empty" | "failed" | "pending" | "retrying";
  ocrReason?: string;
}

export interface ChunkLocation {
  chunkIndex?: number;
  page?: number;
  heading?: string;
  section?: string;
}

export interface EvidenceMetadata {
  evidenceId: string;
  provenance: EvidenceProvenance;
  location?: ChunkLocation;
  provider?: string;
  model?: string;
}

export interface ScoreComponents {
  vector?: number;
  lexical?: number;
  filenamePath?: number;
  metadata?: number;
  sourceConfidence?: number;
  filter?: number;
  recency?: number;
  boost?: number;
  final?: number;
}

export interface QueryInterpretation {
  originalQuery: string;
  semanticQueries: string[];
  fileTypes?: string[];
  folderHints?: string[];
  quotedTerms?: string[];
  dateHint?: string;
  visualIntent?: boolean;
  ocrIntent?: boolean;
  answerIntent?: boolean;
}

export interface RetrievalDiagnostics {
  retrievalPasses: Array<{ query: string; semanticCandidateCount: number }>;
  lexicalCandidateCount: number;
  groupedResultCount: number;
  omittedCandidateCount?: number;
  options?: SearchOptions;
}

export interface SearchOptions {
  finalLimit?: number;
  semanticTopK?: number;
  lexicalTopK?: number;
  maxRetrievalPasses?: number;
  answerContextBudget?: number;
  sourceCaps?: Partial<Record<ContextSource, number>>;
  answer?: boolean;
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
  evidenceId?: string;
  provenance?: EvidenceProvenance;
  location?: ChunkLocation;
  scoreComponents?: ScoreComponents;
}

export interface IndexFailure {
  filePath: string;
  message: string;
  at: number;
}

export interface RepairTask {
  id: string;
  fileId: string;
  filePath: string;
  contentMarker: string;
  operation: RepairOperation;
  status: RepairTaskStatus;
  retryCount: number;
  lastAttemptAt?: number;
  nextRetryAt?: number;
  lastError?: string;
  errorKind?: RepairErrorKind;
}

export interface IndexedDocumentLog {
  id: string;
  displayName: string;
  filePath: string;
  folderPath: string;
  fileType: string;
  indexedAt: number;
  chunkCount: number;
  status: FileStatus;
  labelStatus?: IndexedFileRecord["labelStatus"];
  labelEmbedded?: boolean;
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
  documents: IndexedDocumentLog[];
  repair: {
    queuedCount: number;
    cooldownCount: number;
    runningCount: number;
    nextRetryAt?: number;
  };
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
    confirmed?: boolean;
    unconfirmedReason?: string;
    evidenceId?: string;
    provenance?: EvidenceProvenance;
    location?: ChunkLocation;
  };
  evidence?: Array<{
    evidenceId: string;
    text: string;
    source: ContextSource;
    provenance: EvidenceProvenance;
    location?: ChunkLocation;
    scoreComponents?: ScoreComponents;
  }>;
  scoreComponents?: ScoreComponents;
  metadata?: Pick<FileMetadata, "displayName" | "extension" | "mediaType" | "sizeBytes" | "modifiedDate" | "parentFolders" | "imageWidth" | "imageHeight">;
  readiness: "ready" | "partial";
}

export interface AnswerCitation {
  label: string;
  filePath: string;
  evidenceId: string;
  provenance: EvidenceProvenance;
  location?: ChunkLocation;
  snippet?: string;
}

export interface SearchAnswer {
  status: "answered" | "insufficientEvidence" | "providerUnavailable";
  text?: string;
  citations: AnswerCitation[];
  evidenceIds: string[];
  message?: string;
}

export interface SearchResponse {
  results: SearchResult[];
  readiness: {
    kind: "ready" | "notReady";
    reason?: "notIndexedYet" | "providerUnavailable";
    message?: string;
  };
  agentic: boolean;
  queryInterpretation?: QueryInterpretation;
  diagnostics?: RetrievalDiagnostics;
  answer?: SearchAnswer;
}
