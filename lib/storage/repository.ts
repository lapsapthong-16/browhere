import fs from "node:fs/promises";
import path from "node:path";
import * as lancedb from "@lancedb/lancedb";
import { getIndexDir } from "@/lib/config";
import type {
  ChunkRecord,
  ContextSource,
  EvidenceProvenance,
  FileMetadata,
  IndexedFileRecord,
  IndexedFolder,
  IndexedDocumentLog,
  IndexFailure,
  RepairTask,
  RecordKind,
} from "@/lib/types";

const FILES_TABLE = "files";
const CHUNKS_TABLE = "chunks";
const META_FILE = "metadata.json";
const FILE_STRING_COLUMNS = ["metadata", "metadataContext", "labelStatus", "labelReason", "ocrStatus", "ocrReason"] as const;
const CHUNK_STRING_COLUMNS = [
  "recordKind",
  "contextSource",
  "metadata",
  "metadataContext",
  "provider",
  "model",
  "evidenceId",
  "provenance",
  "location",
  "scoreComponents",
] as const;

interface Metadata {
  schemaVersion: number;
  folders: IndexedFolder[];
  failures: IndexFailure[];
  documents: IndexedDocumentLog[];
  repairTasks: RepairTask[];
  documentLogInitialized: boolean;
  skippedCount: number;
  unsupportedCount: number;
  lastIndexedAt?: number;
}

const DEFAULT_METADATA: Metadata = {
  schemaVersion: 2,
  folders: [],
  failures: [],
  documents: [],
  repairTasks: [],
  documentLogInitialized: false,
  skippedCount: 0,
  unsupportedCount: 0,
};

export interface VectorCandidate extends ChunkRecord {
  score: number;
}

export class IndexRepository {
  constructor(private readonly indexDir = getIndexDir()) {}

  async ensure() {
    await fs.mkdir(this.indexDir, { recursive: true });
    await this.readMetadata();
  }

  async reset() {
    await fs.rm(this.indexDir, { recursive: true, force: true });
    await this.ensure();
  }

  async getFolders(): Promise<IndexedFolder[]> {
    return (await this.readMetadata()).folders;
  }

  async addFolder(folderPath: string) {
    const metadata = await this.readMetadata();
    const normalized = path.resolve(folderPath);
    if (!metadata.folders.some((folder) => folder.path === normalized)) {
      metadata.folders.push({ path: normalized, addedAt: Date.now() });
      await this.writeMetadata(metadata);
    }
  }

  async removeFolder(folderPath: string) {
    const normalized = path.resolve(folderPath);
    const metadata = await this.readMetadata();
    metadata.folders = metadata.folders.filter((folder) => folder.path !== normalized);
    metadata.documents = metadata.documents.filter((document) => !isWithinFolder(document.filePath, normalized));
    metadata.repairTasks = metadata.repairTasks.filter((task) => !isWithinFolder(task.filePath, normalized));
    await this.writeMetadata(metadata);
    await this.deleteByFolder(normalized);
  }

  async getFiles(): Promise<IndexedFileRecord[]> {
    const table = await this.openTable<IndexedFileRecord>(FILES_TABLE);
    if (!table) return [];
    const rows = (await table.query().limit(100_000).toArray()) as IndexedFileRecord[];
    return rows.map(normalizeFileRecord);
  }

  async findFile(filePath: string): Promise<IndexedFileRecord | undefined> {
    return (await this.getFiles()).find((file) => file.path === filePath);
  }

  async upsertFile(file: IndexedFileRecord) {
    await this.deleteFile(file.id);
    const table = await this.openTable<IndexedFileRecord>(FILES_TABLE);
    if (table) {
      await this.ensureStringColumns(table, FILE_STRING_COLUMNS);
      await table.add([normalizeFileRow(file) as unknown as IndexedFileRecord]);
      await this.recordDocument(file);
      return;
    }
    await this.createTable(FILES_TABLE, [normalizeFileRow(file) as unknown as IndexedFileRecord]);
    await this.recordDocument(file);
  }

  async upsertChunks(fileId: string, chunks: ChunkRecord[]) {
    await this.deleteChunksForFile(fileId);
    if (chunks.length === 0) {
      await this.updateDocumentChunkCount(fileId, 0);
      return;
    }
    const table = await this.openTable<ChunkRecord>(CHUNKS_TABLE);
    if (table) {
      await this.ensureStringColumns(table, CHUNK_STRING_COLUMNS);
      await table.add(chunks.map((chunk) => normalizeChunkRow(chunk) as unknown as ChunkRecord));
      await this.updateDocumentChunkCount(fileId, chunks.length);
      return;
    }
    await this.createTable(CHUNKS_TABLE, chunks.map((chunk) => normalizeChunkRow(chunk) as unknown as ChunkRecord));
    await this.updateDocumentChunkCount(fileId, chunks.length);
  }

  async upsertChunk(chunk: ChunkRecord) {
    const table = await this.openTable<ChunkRecord>(CHUNKS_TABLE);
    if (table) {
      await this.ensureStringColumns(table, CHUNK_STRING_COLUMNS);
      await table.delete(`id = '${escapeSql(chunk.id)}'`);
      await table.add([normalizeChunkRow(chunk) as unknown as ChunkRecord]);
    } else {
      await this.createTable(CHUNKS_TABLE, [normalizeChunkRow(chunk) as unknown as ChunkRecord]);
    }
    await this.updateDocumentChunkCount(chunk.fileId, await this.countChunksForFile(chunk.fileId));
  }

  async getChunksForFile(fileId: string): Promise<ChunkRecord[]> {
    const table = await this.openTable<ChunkRecord>(CHUNKS_TABLE);
    if (!table) return [];
    const rows = (await table.query().limit(100_000).toArray()) as ChunkRecord[];
    return rows.filter((row) => row.fileId === fileId).map(normalizeChunkRecord);
  }

  async getChunks(limit = 100_000): Promise<ChunkRecord[]> {
    await this.pruneUnapprovedRecords();
    const table = await this.openTable<ChunkRecord>(CHUNKS_TABLE);
    if (!table) return [];
    const rows = (await table.query().limit(limit).toArray()) as ChunkRecord[];
    return rows.map(normalizeChunkRecord);
  }

  async updateFile(file: IndexedFileRecord) {
    const table = await this.openTable<IndexedFileRecord>(FILES_TABLE);
    if (table) {
      await this.ensureStringColumns(table, FILE_STRING_COLUMNS);
      await table.delete(`id = '${escapeSql(file.id)}'`);
      await table.add([normalizeFileRow(file) as unknown as IndexedFileRecord]);
    } else {
      await this.createTable(FILES_TABLE, [normalizeFileRow(file) as unknown as IndexedFileRecord]);
    }
    await this.recordDocument(file);
  }

  async deleteFile(fileId: string) {
    const table = await this.openTable<IndexedFileRecord>(FILES_TABLE);
    if (table) {
      await table.delete(`id = '${escapeSql(fileId)}'`);
    }
    await this.deleteChunksForFile(fileId);
    await this.deleteDocumentLog(fileId);
    await this.deleteRepairTasksForFile(fileId);
  }

  async deleteByPath(filePath: string) {
    const file = await this.findFile(filePath);
    if (file) {
      await this.deleteFile(file.id);
    }
  }

  async deleteByFolder(folderPath: string) {
    const files = await this.getFiles();
    for (const file of files.filter((file) => isWithinFolder(file.path, folderPath))) {
      await this.deleteFile(file.id);
    }
    await this.deleteChunksByFolder(folderPath);
  }

  async deleteMissing(knownPaths: Set<string>, folderPath: string) {
    const files = await this.getFiles();
    for (const file of files.filter(
      (file) => isWithinFolder(file.path, folderPath) && !knownPaths.has(file.path),
    )) {
      await this.deleteFile(file.id);
    }
  }

  async vectorSearch(vector: number[], limit: number): Promise<VectorCandidate[]> {
    await this.pruneUnapprovedRecords();
    const table = await this.openTable<ChunkRecord>(CHUNKS_TABLE);
    if (!table) return [];
    const rows = (await table.search(vector).nprobes(20).limit(limit).toArray()) as Array<
      ChunkRecord & { _distance?: number }
    >;
    return rows.map((row) => ({
      ...normalizeChunkRecord(row),
      score: typeof row._distance === "number" ? 1 / (1 + row._distance) : 0,
    }));
  }

  async getCounts() {
    const metadata = await this.readMetadata();
    const documents = await this.getApprovedDocumentLogs(metadata);
    const repair = repairCounts(metadata.repairTasks);
    return {
      files: documents.length,
      chunks: documents.reduce((total, document) => total + document.chunkCount, 0),
      failed: documents.filter((document) => document.status === "failed").length,
      partial: documents.filter((document) => document.status === "partial").length,
      skipped: metadata.skippedCount,
      unsupported: metadata.unsupportedCount,
      failures: [],
      lastIndexedAt: metadata.lastIndexedAt,
      documents,
      repair,
    };
  }

  async getRepairTasks(): Promise<RepairTask[]> {
    const metadata = await this.readMetadata();
    const approved = metadata.repairTasks.filter((task) =>
      metadata.folders.some((folder) => isWithinFolder(task.filePath, folder.path)),
    );
    if (approved.length !== metadata.repairTasks.length) {
      metadata.repairTasks = approved;
      await this.writeMetadata(metadata);
    }
    return approved;
  }

  async upsertRepairTask(task: RepairTask) {
    const metadata = await this.readMetadata();
    metadata.repairTasks = [
      task,
      ...metadata.repairTasks.filter((existing) => existing.id !== task.id),
    ].sort((left, right) => (left.nextRetryAt ?? 0) - (right.nextRetryAt ?? 0));
    await this.writeMetadata(metadata);
  }

  async completeRepairTask(taskId: string) {
    const metadata = await this.readMetadata();
    const nextTasks = metadata.repairTasks.filter((task) => task.id !== taskId);
    if (nextTasks.length === metadata.repairTasks.length) return;
    metadata.repairTasks = nextTasks;
    await this.writeMetadata(metadata);
  }

  async recordFailure(_filePath: string, _message: string) {
    await this.clearFailures();
  }

  async clearFailures() {
    const metadata = await this.readMetadata();
    if (metadata.failures.length === 0) return;
    metadata.failures = [];
    await this.writeMetadata(metadata);
  }

  async incrementSkipped(kind: "skipped" | "unsupported") {
    const metadata = await this.readMetadata();
    if (kind === "skipped") metadata.skippedCount += 1;
    if (kind === "unsupported") metadata.unsupportedCount += 1;
    await this.writeMetadata(metadata);
  }

  async setLastIndexedAt(value = Date.now()) {
    const metadata = await this.readMetadata();
    metadata.lastIndexedAt = value;
    await this.writeMetadata(metadata);
  }

  private async recordDocument(file: IndexedFileRecord) {
    const metadata = await this.readMetadata();
    const folders = metadata.folders;
    const folderPath =
      file.metadata?.approvedFolderRoot ??
      folders.find((folder) => isWithinFolder(file.path, folder.path))?.path ??
      path.dirname(file.path);
    const document: IndexedDocumentLog = {
      id: file.id,
      displayName: file.displayName,
      filePath: file.path,
      folderPath,
      fileType: file.fileType,
      indexedAt: file.indexedAt ?? Date.now(),
      chunkCount: file.chunkCount,
      status: file.status,
      labelStatus: file.labelStatus,
      labelEmbedded: file.labelStatus === "generated",
    };
    metadata.documents = [
      document,
      ...metadata.documents.filter((existing) => existing.id !== file.id && existing.filePath !== file.path),
    ].sort((left, right) => right.indexedAt - left.indexedAt);
    metadata.documentLogInitialized = true;
    await this.writeMetadata(metadata);
  }

  private async deleteDocumentLog(fileId: string) {
    const metadata = await this.readMetadata();
    const nextDocuments = metadata.documents.filter((document) => document.id !== fileId);
    if (nextDocuments.length === metadata.documents.length) return;
    metadata.documents = nextDocuments;
    await this.writeMetadata(metadata);
  }

  private async updateDocumentChunkCount(fileId: string, chunkCount: number) {
    const metadata = await this.readMetadata();
    const document = metadata.documents.find((entry) => entry.id === fileId);
    if (!document || document.chunkCount === chunkCount) return;
    document.chunkCount = chunkCount;
    await this.writeMetadata(metadata);
  }

  private async countChunksForFile(fileId: string): Promise<number> {
    const table = await this.openTable<ChunkRecord>(CHUNKS_TABLE);
    if (!table) return 0;
    const rows = (await table.query().limit(100_000).toArray()) as ChunkRecord[];
    return rows.filter((row) => row.fileId === fileId).length;
  }

  private async deleteRepairTasksForFile(fileId: string) {
    const metadata = await this.readMetadata();
    const nextTasks = metadata.repairTasks.filter((task) => task.fileId !== fileId);
    if (nextTasks.length === metadata.repairTasks.length) return;
    metadata.repairTasks = nextTasks;
    await this.writeMetadata(metadata);
  }

  private async getApprovedDocumentLogs(metadata: Metadata): Promise<IndexedDocumentLog[]> {
    if (metadata.documentLogInitialized) {
      return this.enrichDocumentLogs(metadata);
    }

    const files = await this.getFiles();
    metadata.documents = files
      .filter((file) => file.status === "indexed" || file.status === "partial" || file.status === "failed")
      .map((file) => documentLogFor(file, metadata.folders))
      .sort((left, right) => right.indexedAt - left.indexedAt);
    metadata.documentLogInitialized = true;
    await this.writeMetadata(metadata);
    return this.pruneDocumentLogs(metadata);
  }

  private async enrichDocumentLogs(metadata: Metadata): Promise<IndexedDocumentLog[]> {
    let changed = false;
    const byId = new Map((await this.getFiles()).map((file) => [file.id, file]));
    metadata.documents = metadata.documents.map((document) => {
      const file = byId.get(document.id);
      if (!file) return document;
      const next = documentLogFor(file, metadata.folders);
      next.chunkCount = document.chunkCount;
      const needsUpdate =
        document.fileType !== next.fileType ||
        document.labelStatus !== next.labelStatus ||
        document.labelEmbedded !== next.labelEmbedded ||
        document.chunkCount !== next.chunkCount ||
        document.status !== next.status;
      if (needsUpdate) changed = true;
      return needsUpdate ? next : document;
    });
    if (changed) {
      await this.writeMetadata(metadata);
    }
    return this.pruneDocumentLogs(metadata);
  }

  private async pruneDocumentLogs(metadata: Metadata): Promise<IndexedDocumentLog[]> {
    const approved = metadata.documents.filter((document) =>
      metadata.folders.some((folder) => isWithinFolder(document.filePath, folder.path)),
    );
    if (approved.length !== metadata.documents.length) {
      metadata.documents = approved;
      await this.writeMetadata(metadata);
    }
    return approved;
  }

  async pruneUnapprovedRecords() {
    const folders = await this.getFolders();
    const isApproved = (filePath: string) => folders.some((folder) => isWithinFolder(filePath, folder.path));
    const files = await this.getFiles();
    for (const file of files.filter((file) => !isApproved(file.path))) {
      await this.deleteFile(file.id);
    }
    const metadata = await this.readMetadata();
    const nextRepairTasks = metadata.repairTasks.filter((task) => isApproved(task.filePath));
    if (nextRepairTasks.length !== metadata.repairTasks.length) {
      metadata.repairTasks = nextRepairTasks;
      await this.writeMetadata(metadata);
    }

    const table = await this.openTable<ChunkRecord>(CHUNKS_TABLE);
    if (!table) return;
    const rows = (await table.query().limit(100_000).toArray()) as ChunkRecord[];
    const staleChunkIds = rows.filter((row) => !isApproved(row.filePath)).map((row) => row.id);
    for (const chunkId of staleChunkIds) {
      await table.delete(`id = '${escapeSql(chunkId)}'`);
    }
  }

  private async deleteChunksForFile(fileId: string) {
    const table = await this.openTable<ChunkRecord>(CHUNKS_TABLE);
    if (table) {
      await table.delete(`"fileId" = '${escapeSql(fileId)}'`);
    }
  }

  private async deleteChunksByFolder(folderPath: string) {
    const table = await this.openTable<ChunkRecord>(CHUNKS_TABLE);
    if (!table) return;
    const rows = (await table.query().limit(100_000).toArray()) as ChunkRecord[];
    const chunkIds = rows
      .filter((row) => isWithinFolder(row.filePath, folderPath))
      .map((row) => row.id);
    for (const chunkId of chunkIds) {
      await table.delete(`id = '${escapeSql(chunkId)}'`);
    }
  }

  private async db() {
    await fs.mkdir(this.indexDir, { recursive: true });
    return lancedb.connect(this.indexDir);
  }

  private async openTable<T>(name: string) {
    const db = await this.db();
    const tables = await db.tableNames();
    if (!tables.includes(name)) {
      return undefined;
    }
    return db.openTable(name) as Promise<unknown> as Promise<{
      add(rows: T[]): Promise<void>;
      delete(predicate: string): Promise<void>;
      query(): { limit(count: number): { toArray(): Promise<unknown[]> } };
      search(vector: number[]): { nprobes(count: number): { limit(count: number): { toArray(): Promise<unknown[]> } } };
      countRows(): Promise<number>;
      schema(): Promise<{ fields: Array<{ name: string }> }>;
      addColumns(columns: Array<{ name: string; valueSql: string }>): Promise<unknown>;
    }>;
  }

  private async createTable<T>(name: string, rows: T[]) {
    const db = await this.db();
    return db.createTable(
      name,
      rows as Array<Record<string, unknown>>,
    ) as Promise<unknown> as Promise<NonNullable<Awaited<ReturnType<IndexRepository["openTable"]>>>>;
  }

  private async ensureStringColumns(
    table: NonNullable<Awaited<ReturnType<IndexRepository["openTable"]>>>,
    columns: readonly string[],
  ) {
    const schema = await table.schema();
    const existing = new Set(schema.fields.map((field) => field.name));
    const missing = columns.filter((column) => !existing.has(column));
    if (missing.length === 0) return;
    await table.addColumns(missing.map((name) => ({ name, valueSql: "''" })));
  }

  private async readMetadata(): Promise<Metadata> {
    await fs.mkdir(this.indexDir, { recursive: true });
    const filePath = path.join(this.indexDir, META_FILE);
    try {
      const text = await fs.readFile(filePath, "utf8");
      const metadata = {
        ...DEFAULT_METADATA,
        ...JSON.parse(text),
        schemaVersion: DEFAULT_METADATA.schemaVersion,
        failures: [],
      };
      metadata.repairTasks = normalizeRepairTasks(metadata.repairTasks);
      await this.writeMetadata(metadata);
      return metadata;
    } catch {
      await this.writeMetadata(DEFAULT_METADATA);
      return { ...DEFAULT_METADATA };
    }
  }

  private async writeMetadata(metadata: Metadata) {
    await fs.mkdir(this.indexDir, { recursive: true });
    await fs.writeFile(
      path.join(this.indexDir, META_FILE),
      JSON.stringify(metadata, null, 2),
      "utf8",
    );
  }
}

export const repository = new IndexRepository();

function escapeSql(value: string): string {
  return value.replaceAll("'", "''");
}

function normalizeRow<T>(row: T): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(row as Record<string, unknown>).map(([key, value]) => [
      key,
      value === undefined
        ? ""
        : (key === "metadata" || key === "location" || key === "scoreComponents") && value
          ? JSON.stringify(value)
          : value,
    ]),
  );
}

function normalizeFileRow(file: IndexedFileRecord): Record<string, unknown> {
  return normalizeRow({
    ...file,
    metadata: file.metadata ?? "",
    metadataContext: file.metadataContext ?? "",
    labelStatus: file.labelStatus ?? "",
    labelReason: file.labelReason ?? "",
    ocrStatus: file.ocrStatus ?? "",
    ocrReason: file.ocrReason ?? "",
  });
}

function normalizeChunkRow(chunk: ChunkRecord): Record<string, unknown> {
  const recordKind = normalizeRecordKind(chunk.recordKind, chunk.kind);
  const contextSource = normalizeContextSource(chunk.contextSource, recordKind);
  return normalizeRow({
    ...chunk,
    recordKind,
    contextSource,
    metadata: chunk.metadata ?? "",
    metadataContext: chunk.metadataContext ?? "",
    provider: chunk.provider ?? "",
    model: chunk.model ?? "",
    evidenceId: chunk.evidenceId || chunk.id,
    provenance: normalizeProvenance(chunk.provenance, contextSource),
    location: chunk.location ?? defaultLocation(chunk.id),
    scoreComponents: chunk.scoreComponents ?? "",
  });
}

function normalizeFileRecord(row: IndexedFileRecord): IndexedFileRecord {
  return {
    ...row,
    metadata: parseMetadata(row.metadata),
    metadataContext: row.metadataContext ?? "",
    labelStatus:
      row.labelStatus === "notApplicable" ||
      row.labelStatus === "generated" ||
      row.labelStatus === "failed" ||
      row.labelStatus === "pending" ||
      row.labelStatus === "retrying"
        ? row.labelStatus
        : undefined,
    labelReason: row.labelReason || undefined,
    ocrStatus:
      row.ocrStatus === "notApplicable" ||
      row.ocrStatus === "generated" ||
      row.ocrStatus === "empty" ||
      row.ocrStatus === "failed" ||
      row.ocrStatus === "pending" ||
      row.ocrStatus === "retrying"
        ? row.ocrStatus
        : undefined,
    ocrReason: row.ocrReason || undefined,
  };
}

function normalizeChunkRecord(row: ChunkRecord): ChunkRecord {
  const recordKind = normalizeRecordKind(row.recordKind, row.kind);
  const contextSource = normalizeContextSource(row.contextSource, recordKind);
  return {
    ...row,
    recordKind,
    contextSource,
    metadata: parseMetadata(row.metadata),
    metadataContext: row.metadataContext ?? "",
    provider: row.provider || undefined,
    model: row.model || undefined,
    evidenceId: row.evidenceId || row.id,
    provenance: normalizeProvenance(row.provenance, contextSource),
    location: parseJsonObject(row.location) ?? defaultLocation(row.id),
    scoreComponents: parseJsonObject(row.scoreComponents),
  };
}

function parseMetadata(value: unknown): FileMetadata | undefined {
  if (!value) return undefined;
  if (typeof value === "object") return value as FileMetadata;
  if (typeof value !== "string") return undefined;
  try {
    const parsed = JSON.parse(value) as FileMetadata;
    return parsed && typeof parsed.displayName === "string" ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function normalizeRecordKind(value: unknown, legacyKind: ChunkRecord["kind"]): RecordKind {
  if (
    value === "text" ||
    value === "rawImage" ||
    value === "imageLabel" ||
    value === "imageVisualCaption" ||
    value === "imageOcrText" ||
    value === "metadata"
  ) {
    return value;
  }
  return legacyKind === "image" ? "rawImage" : "text";
}

function normalizeContextSource(value: unknown, recordKind: RecordKind): ContextSource {
  if (
    value === "extractedText" ||
    value === "rawImageVector" ||
    value === "imageLabel" ||
    value === "imageVisualCaption" ||
    value === "imageOcrText" ||
    value === "metadata"
  ) {
    return value;
  }
  if (recordKind === "rawImage") return "rawImageVector";
  if (recordKind === "imageLabel" || recordKind === "imageVisualCaption") return "imageVisualCaption";
  if (recordKind === "imageOcrText") return "imageOcrText";
  if (recordKind === "metadata") return "metadata";
  return "extractedText";
}

function normalizeProvenance(value: unknown, contextSource: ContextSource): EvidenceProvenance {
  if (
    value === "human-authored" ||
    value === "raw-visual" ||
    value === "ai-visual-caption" ||
    value === "ocr" ||
    value === "metadata" ||
    value === "llm-explanation"
  ) {
    return value;
  }
  if (contextSource === "rawImageVector") return "raw-visual";
  if (contextSource === "imageLabel" || contextSource === "imageVisualCaption") return "ai-visual-caption";
  if (contextSource === "imageOcrText") return "ocr";
  if (contextSource === "metadata") return "metadata";
  return "human-authored";
}

function defaultLocation(id: string) {
  const chunkIndexText = id.split(":").at(-1);
  const chunkIndex = chunkIndexText && /^\d+$/.test(chunkIndexText) ? Number(chunkIndexText) : undefined;
  return chunkIndex === undefined ? undefined : { chunkIndex };
}

function parseJsonObject<T extends object>(value: unknown): T | undefined {
  if (!value) return undefined;
  if (typeof value === "object") return value as T;
  if (typeof value !== "string") return undefined;
  try {
    const parsed = JSON.parse(value) as T;
    return parsed && typeof parsed === "object" ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function documentLogFor(file: IndexedFileRecord, folders: IndexedFolder[]): IndexedDocumentLog {
  return {
    id: file.id,
    displayName: file.displayName,
    filePath: file.path,
    folderPath:
      file.metadata?.approvedFolderRoot ??
      folders.find((folder) => isWithinFolder(file.path, folder.path))?.path ??
      path.dirname(file.path),
    fileType: file.fileType,
    indexedAt: file.indexedAt ?? file.metadata?.indexedAt ?? Date.now(),
    chunkCount: file.chunkCount,
    status: file.status,
    labelStatus: file.labelStatus,
    labelEmbedded: file.labelStatus === "generated",
  };
}

function normalizeRepairTasks(value: unknown): RepairTask[] {
  if (!Array.isArray(value)) return [];
  return value.filter((task): task is RepairTask => {
    if (!task || typeof task !== "object") return false;
    const record = task as Partial<RepairTask>;
    return (
      typeof record.id === "string" &&
      typeof record.fileId === "string" &&
      typeof record.filePath === "string" &&
      typeof record.contentMarker === "string" &&
      typeof record.operation === "string" &&
      typeof record.status === "string"
    );
  });
}

function repairCounts(tasks: RepairTask[]) {
  const nextRetryAt = tasks
    .map((task) => task.nextRetryAt)
    .filter((value): value is number => typeof value === "number")
    .sort((left, right) => left - right)[0];
  return {
    queuedCount: tasks.filter((task) => task.status === "queued").length,
    cooldownCount: tasks.filter((task) => task.status === "cooldown").length,
    runningCount: tasks.filter((task) => task.status === "running").length,
    nextRetryAt,
  };
}

function isWithinFolder(filePath: string, folderPath: string): boolean {
  const relative = path.relative(path.resolve(folderPath), path.resolve(filePath));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}
