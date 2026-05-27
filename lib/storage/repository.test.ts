import os from "node:os";
import path from "node:path";
import * as lancedb from "@lancedb/lancedb";
import fs from "node:fs/promises";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { IndexRepository } from "@/lib/storage/repository";
import type { ChunkRecord, FileMetadata, IndexedFileRecord } from "@/lib/types";

let root = "";
let repo: IndexRepository;

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "browhere-repo-"));
  repo = new IndexRepository(root);
  await repo.ensure();
});

afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

describe("IndexRepository", () => {
  it("stores folders, files, chunks, and vector search data", async () => {
    await repo.addFolder("/tmp/docs");
    expect(await repo.getFolders()).toHaveLength(1);

    const file: IndexedFileRecord = {
      id: "file-1",
      path: "/tmp/docs/lizards.md",
      displayName: "lizards.md",
      fileType: "md",
      sizeBytes: 10,
      modifiedMs: 1,
      contentMarker: "10:1",
      status: "indexed",
      indexedAt: 2,
      chunkCount: 1,
    };
    const chunk: ChunkRecord = {
      id: "file-1:0",
      fileId: "file-1",
      filePath: file.path,
      displayName: file.displayName,
      fileType: file.fileType,
      text: "lizard habitat notes",
      vector: [0.1, 0.2, 0.3, 0.4],
      kind: "text",
      status: "indexed",
      modifiedMs: 1,
      sizeBytes: 10,
      indexedAt: 2,
    };

    await repo.upsertFile(file);
    await repo.upsertChunks(file.id, [chunk]);

    expect(await repo.findFile(file.path)).toMatchObject({ id: file.id });
    expect(await repo.vectorSearch([0.1, 0.2, 0.3, 0.4], 5)).toHaveLength(1);
  });

  it("normalizes old chunk rows without record kind or context source", async () => {
    await repo.addFolder("/tmp/docs");
    const file: IndexedFileRecord = {
      id: "file-old",
      path: "/tmp/docs/old.png",
      displayName: "old.png",
      fileType: "png",
      sizeBytes: 10,
      modifiedMs: 1,
      contentMarker: "10:1",
      status: "indexed",
      indexedAt: 2,
      chunkCount: 1,
    };
    const oldChunk: ChunkRecord = {
      id: "file-old:0",
      fileId: file.id,
      filePath: file.path,
      displayName: file.displayName,
      fileType: file.fileType,
      text: "old image fallback",
      vector: [0.1, 0.2, 0.3, 0.4],
      kind: "image",
      status: "indexed",
      modifiedMs: 1,
      sizeBytes: 10,
      indexedAt: 2,
    };

    await repo.upsertFile(file);
    await repo.upsertChunks(file.id, [oldChunk]);

    const [candidate] = await repo.vectorSearch([0.1, 0.2, 0.3, 0.4], 5);
    expect(candidate.recordKind).toBe("rawImage");
    expect(candidate.contextSource).toBe("rawImageVector");
  });

  it("adds new metadata columns to existing LanceDB tables before writing", async () => {
    await repo.addFolder("/tmp/docs");
    const db = await lancedb.connect(root);
    await db.createTable("files", [
      {
        id: "legacy-file",
        path: "/tmp/docs/legacy.md",
        displayName: "legacy.md",
        fileType: "md",
        sizeBytes: 1,
        modifiedMs: 1,
        contentMarker: "1:1",
        status: "indexed",
        indexedAt: 1,
        chunkCount: 0,
      },
    ]);
    await db.createTable("chunks", [
      {
        id: "legacy-file:0",
        fileId: "legacy-file",
        filePath: "/tmp/docs/legacy.md",
        displayName: "legacy.md",
        fileType: "md",
        text: "legacy",
        vector: [0.1, 0.2, 0.3, 0.4],
        kind: "text",
        status: "indexed",
        modifiedMs: 1,
        sizeBytes: 1,
        indexedAt: 1,
      },
    ]);
    const metadata: FileMetadata = {
      displayName: "updated.md",
      extension: "md",
      mediaType: "text/markdown",
      sizeBytes: 2,
      sizeClass: "small",
      modifiedMs: 2,
      modifiedDate: new Date(2).toISOString(),
      approvedFolderRoot: "/tmp/docs",
      parentFolders: ["tmp", "docs"],
      indexedAt: 2,
    };
    const file: IndexedFileRecord = {
      id: "updated-file",
      path: "/tmp/docs/updated.md",
      displayName: "updated.md",
      fileType: "md",
      sizeBytes: 2,
      modifiedMs: 2,
      contentMarker: "2:2",
      status: "indexed",
      indexedAt: 2,
      chunkCount: 1,
      metadata,
      metadataContext: "file updated.md",
    };
    const chunk: ChunkRecord = {
      id: "updated-file:metadata",
      fileId: file.id,
      filePath: file.path,
      displayName: file.displayName,
      fileType: file.fileType,
      text: "file updated.md",
      vector: [0.1, 0.2, 0.3, 0.4],
      kind: "text",
      recordKind: "metadata",
      contextSource: "metadata",
      status: "indexed",
      modifiedMs: 2,
      sizeBytes: 2,
      indexedAt: 2,
      metadata,
      metadataContext: "file updated.md",
    };

    await repo.upsertFile(file);
    await repo.upsertChunks(file.id, [chunk]);

    expect(await repo.findFile(file.path)).toMatchObject({ metadataContext: "file updated.md" });
    const candidate = (await repo.vectorSearch([0.1, 0.2, 0.3, 0.4], 5)).find(
      (record) => record.id === "updated-file:metadata",
    );
    expect(candidate).toBeDefined();
    expect(candidate?.contextSource).toBe("metadata");
    expect(candidate?.metadata?.displayName).toBe("updated.md");
  });

  it("removes records when folder is removed without touching prefix siblings", async () => {
    await repo.addFolder("/tmp/docs");
    await repo.addFolder("/tmp/docs2");
    const file = {
      id: "file-1",
      path: "/tmp/docs/a.md",
      displayName: "a.md",
      fileType: "md",
      sizeBytes: 1,
      modifiedMs: 1,
      contentMarker: "1:1",
      status: "indexed",
      indexedAt: 1,
      chunkCount: 0,
    } as const;
    const sibling = {
      ...file,
      id: "file-2",
      path: "/tmp/docs2/b.md",
      displayName: "b.md",
    };
    const chunk = {
      id: "chunk-1",
      fileId: file.id,
      filePath: file.path,
      displayName: file.displayName,
      fileType: file.fileType,
      text: "delete me",
      vector: [0.1, 0.2, 0.3, 0.4],
      kind: "text",
      status: "indexed",
      modifiedMs: 1,
      sizeBytes: 1,
      indexedAt: 1,
    } satisfies ChunkRecord;
    const siblingChunk = {
      ...chunk,
      id: "chunk-2",
      fileId: sibling.id,
      filePath: sibling.path,
      displayName: sibling.displayName,
      text: "keep me",
    } satisfies ChunkRecord;
    const orphanChunk = {
      ...chunk,
      id: "chunk-orphan",
      fileId: "missing-file",
      text: "delete orphan too",
    } satisfies ChunkRecord;
    await repo.upsertFile(file);
    await repo.upsertFile(sibling);
    await repo.upsertChunks(file.id, [chunk]);
    await repo.upsertChunks(sibling.id, [siblingChunk]);
    await repo.upsertChunks(orphanChunk.fileId, [orphanChunk]);

    await repo.removeFolder("/tmp/docs");

    expect((await repo.getFolders()).map((folder) => folder.path)).toEqual(["/tmp/docs2"]);
    expect((await repo.getFiles()).map((record) => record.id)).toEqual(["file-2"]);
    expect(await repo.getCounts()).toMatchObject({ files: 1, chunks: 1 });
    expect((await repo.vectorSearch([0.1, 0.2, 0.3, 0.4], 5)).map((record) => record.id)).toEqual(["chunk-2"]);
  });

  it("prunes stale files and chunks outside approved folders", async () => {
    const file: IndexedFileRecord = {
      id: "stale-file",
      path: "/tmp/removed/a.md",
      displayName: "a.md",
      fileType: "md",
      sizeBytes: 1,
      modifiedMs: 1,
      contentMarker: "1:1",
      status: "indexed",
      indexedAt: 1,
      chunkCount: 1,
    };
    const chunk: ChunkRecord = {
      id: "stale-chunk",
      fileId: file.id,
      filePath: file.path,
      displayName: file.displayName,
      fileType: file.fileType,
      text: "stale",
      vector: [0.1, 0.2, 0.3, 0.4],
      kind: "text",
      status: "indexed",
      modifiedMs: 1,
      sizeBytes: 1,
      indexedAt: 1,
    };
    await repo.upsertFile(file);
    await repo.upsertChunks(file.id, [chunk]);

    expect(await repo.getCounts()).toMatchObject({ files: 0, chunks: 0 });
    expect(await repo.vectorSearch([0.1, 0.2, 0.3, 0.4], 5)).toEqual([]);
  });

  it("reports persisted failures and repair last errors in counts", async () => {
    await repo.addFolder("/tmp/docs");
    await repo.recordFailure("/tmp/docs/broken.md", "Embedding failed.");
    await repo.upsertRepairTask({
      id: "repair-1",
      fileId: "file-1",
      filePath: "/tmp/docs/image.png",
      contentMarker: "1:1",
      operation: "imageLabel",
      status: "cooldown",
      retryCount: 1,
      nextRetryAt: 123,
      lastError: "Quota exhausted.",
      errorKind: "quota",
    });

    const counts = await repo.getCounts();
    expect(counts.failures).toEqual([
      expect.objectContaining({ filePath: "/tmp/docs/broken.md", message: "Embedding failed." }),
    ]);
    expect(counts.repair).toMatchObject({
      cooldownCount: 1,
      nextRetryAt: 123,
      lastError: "Quota exhausted.",
    });
  });
});
