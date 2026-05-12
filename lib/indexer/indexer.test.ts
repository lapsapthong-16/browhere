import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { indexFile } from "@/lib/indexer/indexer";
import { IndexRepository } from "@/lib/storage/repository";

vi.mock("@/lib/storage/repository", async () => {
  const actual = await vi.importActual<typeof import("@/lib/storage/repository")>(
    "@/lib/storage/repository",
  );
  const testDir = await fs.mkdtemp(path.join(os.tmpdir(), "browhere-indexer-repo-"));
  return {
    ...actual,
    repository: new actual.IndexRepository(testDir),
  };
});

let root = "";

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "browhere-indexer-"));
  vi.stubEnv("GEMINI_API_KEY", "key");
  vi.stubEnv("BROWHERE_GEMINI_EMBEDDING_DIMENSIONS", "4");
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      json: async () => ({ embedding: { values: [0.1, 0.2, 0.3, 0.4] } }),
    })),
  );
});

afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("indexFile", () => {
  it("indexes text fixture chunks", async () => {
    const filePath = path.join(root, "lizards.md");
    await fs.writeFile(filePath, "lizards live in warm habitats");

    await indexFile(filePath);

    const repo = await getMockedRepository();
    const file = await repo.findFile(filePath);
    expect(file?.status).toBe("indexed");
    expect(file?.chunkCount).toBe(1);
  });

  it("tries raw image embedding and stores image chunk", async () => {
    const filePath = path.join(root, "mcdonalds.jpeg");
    await fs.writeFile(filePath, Buffer.from([1, 2, 3]));

    await indexFile(filePath);

    const fetchMock = vi.mocked(fetch);
    expect(JSON.stringify(fetchMock.mock.calls[0][1]?.body)).toContain("inlineData");
    const repo = await getMockedRepository();
    const file = await repo.findFile(filePath);
    expect(file?.fileType).toBe("jpeg");
  });
});

async function getMockedRepository(): Promise<IndexRepository> {
  const module = await import("@/lib/storage/repository");
  return module.repository;
}
