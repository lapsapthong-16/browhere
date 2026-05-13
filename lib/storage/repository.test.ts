import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { IndexRepository } from "@/lib/storage/repository";
import type { ChunkRecord, IndexedFileRecord } from "@/lib/types";

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

  it("removes records when folder is removed without touching prefix siblings", async () => {
    await repo.addFolder("/tmp/docs");
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
    await repo.upsertFile(file);
    await repo.upsertFile(sibling);

    await repo.removeFolder("/tmp/docs");

    expect(await repo.getFolders()).toEqual([]);
    expect((await repo.getFiles()).map((record) => record.id)).toEqual(["file-2"]);
  });
});
