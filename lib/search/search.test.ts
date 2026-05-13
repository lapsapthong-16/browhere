import { beforeEach, describe, expect, it, vi } from "vitest";
import { searchFiles } from "@/lib/search/search";
import type { VectorCandidate } from "@/lib/storage/repository";

vi.mock("@/lib/ai/gemini", () => ({
  ProviderUnavailableError: class ProviderUnavailableError extends Error {},
  gemini: {
    embedText: vi.fn(async () => [0.1, 0.2, 0.3, 0.4]),
  },
}));

vi.mock("@/lib/ai/groq", () => ({
  groq: {
    plan: vi.fn(async (query: string) => ({ queries: [query] })),
    rerank: vi.fn(async (_query: string, candidates) => candidates),
  },
}));

const { vectorSearch } = vi.hoisted(() => ({
  vectorSearch: vi.fn(),
}));

vi.mock("@/lib/storage/repository", () => ({
  repository: {
    getCounts: vi.fn(async () => ({ chunks: 1 })),
    vectorSearch,
  },
}));

beforeEach(() => {
  vectorSearch.mockReset();
  vi.stubEnv("BROWHERE_GEMINI_EMBEDDING_DIMENSIONS", "4");
});

describe("searchFiles", () => {
  it("uses generated image labels as snippet context for image results", async () => {
    vectorSearch.mockResolvedValue([
      candidate({
        id: "image:raw",
        text: "mcdonalds.png /tmp",
        recordKind: "rawImage",
        contextSource: "rawImageVector",
        score: 0.7,
      }),
      candidate({
        id: "image:label",
        text: "McDonald's logo on a storefront sign",
        recordKind: "imageLabel",
        contextSource: "imageLabel",
        score: 0.6,
      }),
    ]);

    const response = await searchFiles("mcdonalds image", 5);

    expect(response.results[0].matchContext.text).toBe("McDonald's logo on a storefront sign");
    expect(response.results[0].matchContext.sources).toContain("rawImageVector");
    expect(response.results[0].matchContext.sources).toContain("imageLabel");
  });

  it("can return metadata context when content text is missing", async () => {
    vectorSearch.mockResolvedValue([
      candidate({
        id: "file:metadata",
        text: "file budget.pdf. type pdf application/pdf. folders Finance Reports. size medium",
        recordKind: "metadata",
        contextSource: "metadata",
        score: 0.9,
      }),
    ]);

    const response = await searchFiles("finance pdf", 5);

    expect(response.results[0].matchContext.kind).toBe("metadata");
    expect(response.results[0].matchContext.text).toContain("budget.pdf");
  });
});

function candidate(overrides: Partial<VectorCandidate>): VectorCandidate {
  return {
    id: "file:0",
    fileId: "file",
    filePath: "/tmp/Finance/Reports/budget.pdf",
    displayName: "budget.pdf",
    fileType: "pdf",
    text: "",
    vector: [0.1, 0.2, 0.3, 0.4],
    kind: "text",
    status: "indexed",
    modifiedMs: 1,
    sizeBytes: 20,
    indexedAt: 2,
    score: 1,
    metadata: {
      displayName: "budget.pdf",
      extension: "pdf",
      mediaType: "application/pdf",
      sizeBytes: 20,
      sizeClass: "small",
      modifiedMs: 1,
      modifiedDate: "2026-05-12T00:00:00.000Z",
      approvedFolderRoot: "/tmp",
      parentFolders: ["Finance", "Reports"],
      indexedAt: 2,
    },
    ...overrides,
  };
}
