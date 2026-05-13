import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { indexFile, runRepairQueue } from "@/lib/indexer/indexer";
import { IndexRepository, repository } from "@/lib/storage/repository";

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
  await repository.reset();
  await repository.addFolder(root);
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
  it("skips files outside approved folders", async () => {
    await repository.removeFolder(root);
    const filePath = path.join(root, "outside.md");
    await fs.writeFile(filePath, "outside content");

    await indexFile(filePath);

    expect(await repository.findFile(filePath)).toBeUndefined();
    expect(await repository.getCounts()).toMatchObject({ files: 0, chunks: 0 });
  });

  it("indexes text fixture chunks", async () => {
    const filePath = path.join(root, "lizards.md");
    await fs.writeFile(filePath, "lizards live in warm habitats");

    await indexFile(filePath);

    const repo = await getMockedRepository();
    const file = await repo.findFile(filePath);
    expect(file?.status).toBe("indexed");
    expect(file?.chunkCount).toBe(2);
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

  it("stores image labels and metadata context without failing raw image indexing", async () => {
    const filePath = path.join(root, "mcdonalds.png");
    await fs.writeFile(
      filePath,
      Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d, 0x49, 0x48, 0x44, 0x52, 0, 0, 0, 2, 0, 0, 0, 3,
      ]),
    );
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("generateContent")) {
          return {
            ok: true,
            json: async () => ({ candidates: [{ content: { parts: [{ text: "McDonald's logo on a sign" }] } }] }),
          };
        }
        return {
          ok: true,
          json: async () => ({ embedding: { values: [0.1, 0.2, 0.3, 0.4] } }),
        };
      }),
    );

    await indexFile(filePath);

    const repo = await getMockedRepository();
    const file = await repo.findFile(filePath);
    expect(file?.labelStatus).toBe("generated");
    expect(file?.metadataContext).toContain("mcdonalds.png");
    expect(file?.metadata?.imageWidth).toBe(2);
    expect(file?.chunkCount).toBe(3);
  });

  it("does not relabel unchanged images", async () => {
    const filePath = path.join(root, "cached.png");
    await fs.writeFile(
      filePath,
      Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d, 0x49, 0x48, 0x44, 0x52, 0, 0, 0, 1, 0, 0, 0, 1,
      ]),
    );
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("generateContent")) {
        return {
          ok: true,
          json: async () => ({ candidates: [{ content: { parts: [{ text: "Cached image label" }] } }] }),
        };
      }
      return {
        ok: true,
        json: async () => ({ embedding: { values: [0.1, 0.2, 0.3, 0.4] } }),
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    await indexFile(filePath);
    await indexFile(filePath);

    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes("generateContent"))).toHaveLength(1);
  });

  it("keeps image indexing partial when label generation fails", async () => {
    const filePath = path.join(root, "sign.jpeg");
    await fs.writeFile(filePath, Buffer.from([0xff, 0xd8, 0xff, 0xd9]));
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("generateContent")) {
          return { ok: false, text: async () => "vision unavailable" };
        }
        return {
          ok: true,
          json: async () => ({ embedding: { values: [0.1, 0.2, 0.3, 0.4] } }),
        };
      }),
    );

    await indexFile(filePath);

    const repo = await getMockedRepository();
    const file = await repo.findFile(filePath);
    expect(file?.status).toBe("partial");
    expect(file?.labelStatus).toBe("pending");
    expect(file?.labelReason).toContain("Retry scheduled");
    expect(await repo.getRepairTasks()).toHaveLength(1);
    expect(file?.chunkCount).toBeGreaterThanOrEqual(2);
  });

  it("repairs a failed image label later without duplicating chunks", async () => {
    const filePath = path.join(root, "dog.png");
    await fs.writeFile(
      filePath,
      Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d, 0x49, 0x48, 0x44, 0x52, 0, 0, 0, 1, 0, 0, 0, 1,
      ]),
    );
    let labelCalls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("generateContent")) {
          labelCalls += 1;
          if (labelCalls === 1) {
            return { ok: false, text: async () => "429 quota retryDelay 1s" };
          }
          return {
            ok: true,
            json: async () => ({ candidates: [{ content: { parts: [{ text: "Brown dog on grass" }] } }] }),
          };
        }
        return {
          ok: true,
          json: async () => ({ embedding: { values: [0.1, 0.2, 0.3, 0.4] } }),
        };
      }),
    );

    await indexFile(filePath);
    const repo = await getMockedRepository();
    const [task] = await repo.getRepairTasks();
    await repo.upsertRepairTask({ ...task, status: "queued", nextRetryAt: Date.now() - 1 });
    await runRepairQueue();

    const file = await repo.findFile(filePath);
    const chunks = await repo.getChunksForFile(file!.id);
    expect(file?.labelStatus).toBe("generated");
    expect(chunks.filter((chunk) => chunk.contextSource === "imageLabel")).toHaveLength(1);
    expect(await repo.getRepairTasks()).toHaveLength(0);
  });
});

async function getMockedRepository(): Promise<IndexRepository> {
  const module = await import("@/lib/storage/repository");
  return module.repository;
}
