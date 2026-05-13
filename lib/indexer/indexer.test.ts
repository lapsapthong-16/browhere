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
    expect(file?.labelStatus).toBe("failed");
    expect(file?.chunkCount).toBeGreaterThanOrEqual(2);
  });
});

async function getMockedRepository(): Promise<IndexRepository> {
  const module = await import("@/lib/storage/repository");
  return module.repository;
}
