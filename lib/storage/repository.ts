import fs from "node:fs/promises";
import path from "node:path";
import * as lancedb from "@lancedb/lancedb";
import { getIndexDir } from "@/lib/config";
import type { ChunkRecord, IndexedFileRecord, IndexedFolder, IndexFailure } from "@/lib/types";

const FILES_TABLE = "files";
const CHUNKS_TABLE = "chunks";
const META_FILE = "metadata.json";

interface Metadata {
  schemaVersion: number;
  folders: IndexedFolder[];
  failures: IndexFailure[];
  skippedCount: number;
  unsupportedCount: number;
  lastIndexedAt?: number;
}

const DEFAULT_METADATA: Metadata = {
  schemaVersion: 1,
  folders: [],
  failures: [],
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
    await this.writeMetadata(metadata);
    await this.deleteByFolder(normalized);
  }

  async getFiles(): Promise<IndexedFileRecord[]> {
    const table = await this.openTable<IndexedFileRecord>(FILES_TABLE);
    if (!table) return [];
    return (await table.query().limit(100_000).toArray()) as IndexedFileRecord[];
  }

  async findFile(filePath: string): Promise<IndexedFileRecord | undefined> {
    return (await this.getFiles()).find((file) => file.path === filePath);
  }

  async upsertFile(file: IndexedFileRecord) {
    await this.deleteFile(file.id);
    const table = await this.openTable<IndexedFileRecord>(FILES_TABLE);
    if (table) {
      await table.add([normalizeRow(file) as unknown as IndexedFileRecord]);
      return;
    }
    await this.createTable(FILES_TABLE, [normalizeRow(file) as unknown as IndexedFileRecord]);
  }

  async upsertChunks(fileId: string, chunks: ChunkRecord[]) {
    await this.deleteChunksForFile(fileId);
    if (chunks.length === 0) return;
    const table = await this.openTable<ChunkRecord>(CHUNKS_TABLE);
    if (table) {
      await table.add(chunks.map((chunk) => normalizeRow(chunk) as unknown as ChunkRecord));
      return;
    }
    await this.createTable(CHUNKS_TABLE, chunks.map((chunk) => normalizeRow(chunk) as unknown as ChunkRecord));
  }

  async deleteFile(fileId: string) {
    const table = await this.openTable<IndexedFileRecord>(FILES_TABLE);
    if (table) {
      await table.delete(`id = '${escapeSql(fileId)}'`);
    }
    await this.deleteChunksForFile(fileId);
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
    const table = await this.openTable<ChunkRecord>(CHUNKS_TABLE);
    if (!table) return [];
    const rows = (await table.search(vector).limit(limit).toArray()) as Array<ChunkRecord & { _distance?: number }>;
    return rows.map((row) => ({
      ...row,
      score: typeof row._distance === "number" ? 1 / (1 + row._distance) : 0,
    }));
  }

  async getCounts() {
    const files = await this.getFiles();
    const chunksTable = await this.openTable<ChunkRecord>(CHUNKS_TABLE);
    const chunks = chunksTable ? await chunksTable.countRows() : 0;
    const metadata = await this.readMetadata();
    return {
      files: files.length,
      chunks,
      failed: files.filter((file) => file.status === "failed").length,
      partial: files.filter((file) => file.status === "partial").length,
      skipped: metadata.skippedCount,
      unsupported: metadata.unsupportedCount,
      failures: metadata.failures,
      lastIndexedAt: metadata.lastIndexedAt,
    };
  }

  async recordFailure(filePath: string, message: string) {
    const metadata = await this.readMetadata();
    metadata.failures.unshift({ filePath, message, at: Date.now() });
    metadata.failures = metadata.failures.slice(0, 50);
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

  private async deleteChunksForFile(fileId: string) {
    const table = await this.openTable<ChunkRecord>(CHUNKS_TABLE);
    if (table) {
      await table.delete(`"fileId" = '${escapeSql(fileId)}'`);
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
      search(vector: number[]): { limit(count: number): { toArray(): Promise<unknown[]> } };
      countRows(): Promise<number>;
    }>;
  }

  private async createTable<T>(name: string, rows: T[]) {
    const db = await this.db();
    return db.createTable(
      name,
      rows as Array<Record<string, unknown>>,
    ) as Promise<unknown> as Promise<NonNullable<Awaited<ReturnType<IndexRepository["openTable"]>>>>;
  }

  private async readMetadata(): Promise<Metadata> {
    await fs.mkdir(this.indexDir, { recursive: true });
    const filePath = path.join(this.indexDir, META_FILE);
    try {
      const text = await fs.readFile(filePath, "utf8");
      return { ...DEFAULT_METADATA, ...JSON.parse(text) };
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
      value === undefined ? "" : value,
    ]),
  );
}

function isWithinFolder(filePath: string, folderPath: string): boolean {
  const relative = path.relative(path.resolve(folderPath), path.resolve(filePath));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}
