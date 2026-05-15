import { beforeEach, describe, expect, it, vi } from "vitest";
import { searchFiles } from "@/lib/search/search";
import type { VectorCandidate } from "@/lib/storage/repository";

const { vectorSearch, getChunks, groqAnswer } = vi.hoisted(() => ({
  vectorSearch: vi.fn(),
  getChunks: vi.fn<() => Promise<VectorCandidate[]>>(async () => []),
  groqAnswer: vi.fn(),
}));

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
    answer: groqAnswer,
  },
}));

vi.mock("@/lib/storage/repository", () => ({
  repository: {
    getCounts: vi.fn(async () => ({ chunks: 1 })),
    vectorSearch,
    getChunks,
  },
}));

const CASES = [
  {
    query: "document about reptiles in warm habitats",
    expectedFile: "lizards",
    expectedSource: "extractedText",
    candidates: [
      candidate({
        id: "lizards:0",
        fileId: "lizards",
        filePath: "/fixtures/lizards.md",
        displayName: "lizards.md",
        text: "Lizards are reptiles that live in warm habitats.",
        contextSource: "extractedText",
        score: 0.9,
      }),
      candidate({
        id: "budget:0",
        fileId: "budget",
        filePath: "/fixtures/budget.pdf",
        displayName: "budget.pdf",
        text: "Quarterly finance plan.",
        contextSource: "extractedText",
        score: 0.5,
      }),
    ],
  },
  {
    query: "finance pdf from Reports folder",
    expectedFile: "budget",
    expectedSource: "metadata",
    candidates: [
      candidate({
        id: "budget:metadata",
        fileId: "budget",
        filePath: "/fixtures/Finance/Reports/budget.pdf",
        displayName: "budget.pdf",
        fileType: "pdf",
        text: "file budget.pdf. type pdf application/pdf. folders Finance Reports.",
        recordKind: "metadata",
        contextSource: "metadata",
        score: 0.75,
      }),
    ],
  },
  {
    query: "what words are visible on the menu screenshot",
    expectedFile: "menu",
    expectedSource: "imageOcrText",
    candidates: [
      candidate({
        id: "menu:ocr",
        fileId: "menu",
        filePath: "/fixtures/menu.png",
        displayName: "menu.png",
        fileType: "png",
        text: "Lunch special $12",
        recordKind: "imageOcrText",
        contextSource: "imageOcrText",
        score: 0.7,
      }),
    ],
  },
] satisfies Array<{
  query: string;
  expectedFile: string;
  expectedSource: string;
  candidates: VectorCandidate[];
}>;

beforeEach(() => {
  vectorSearch.mockReset();
  getChunks.mockReset();
  groqAnswer.mockReset();
  getChunks.mockResolvedValue([]);
  groqAnswer.mockResolvedValue({ status: "providerUnavailable", citationLabels: [] });
  vi.stubEnv("BROWHERE_GEMINI_EMBEDDING_DIMENSIONS", "4");
});

describe("retrieval evaluation fixtures", () => {
  it.each(CASES)("$query", async ({ query, expectedFile, expectedSource, candidates }) => {
    vectorSearch.mockResolvedValue(candidates);

    const response = await searchFiles(query, { finalLimit: 3 });

    expect(response.results[0].id).toBe(expectedFile);
    expect(response.results[0].matchContext.sources).toContain(expectedSource);
  });

  it("reports insufficient evidence when answer citation validation fails", async () => {
    vectorSearch.mockResolvedValue([CASES[0].candidates[0]]);
    groqAnswer.mockResolvedValue({ status: "answered", text: "Unsupported.", citationLabels: [] });

    const response = await searchFiles("answer: what habitat?", { answer: true });

    expect(response.answer?.status).toBe("insufficientEvidence");
  });
});

function candidate(overrides: Partial<VectorCandidate>): VectorCandidate {
  return {
    id: "file:0",
    fileId: "file",
    filePath: "/fixtures/file.md",
    displayName: "file.md",
    fileType: "md",
    text: "",
    vector: [0.1, 0.2, 0.3, 0.4],
    kind: "text",
    status: "indexed",
    modifiedMs: 1,
    sizeBytes: 20,
    indexedAt: 2,
    score: 1,
    ...overrides,
  };
}
