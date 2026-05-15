import { beforeEach, describe, expect, it, vi } from "vitest";
import { interpretQuery, resolveSearchOptions, searchFiles } from "@/lib/search/search";
import type { VectorCandidate } from "@/lib/storage/repository";

vi.mock("@/lib/ai/gemini", () => ({
  ProviderUnavailableError: class ProviderUnavailableError extends Error {},
  gemini: {
    embedText: vi.fn(async () => [0.1, 0.2, 0.3, 0.4]),
  },
}));

const { vectorSearch, getChunks, groqAnswer } = vi.hoisted(() => ({
  vectorSearch: vi.fn(),
  getChunks: vi.fn<() => Promise<VectorCandidate[]>>(async () => []),
  groqAnswer: vi.fn(),
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

beforeEach(() => {
  vectorSearch.mockReset();
  getChunks.mockReset();
  groqAnswer.mockReset();
  getChunks.mockResolvedValue([]);
  groqAnswer.mockResolvedValue({ status: "providerUnavailable", citationLabels: [] });
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
        recordKind: "imageVisualCaption",
        contextSource: "imageVisualCaption",
        score: 0.6,
      }),
    ]);

    const response = await searchFiles("mcdonalds image", 5);

    expect(response.results[0].matchContext.text).toBe("McDonald's logo on a storefront sign");
    expect(response.results[0].matchContext.sources).toContain("rawImageVector");
    expect(response.results[0].matchContext.sources).toContain("imageVisualCaption");
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

  it("keeps unlabeled raw image hits as unconfirmed visual matches", async () => {
    vectorSearch.mockResolvedValue([
      candidate({
        id: "dog:raw",
        fileId: "dog",
        filePath: "/tmp/photos/dog.png",
        displayName: "dog.png",
        fileType: "png",
        kind: "image",
        recordKind: "rawImage",
        contextSource: "rawImageVector",
        score: 0.8,
      }),
    ]);

    const response = await searchFiles("dog", 5);

    expect(response.results[0].matchContext.kind).toBe("unconfirmedVisual");
    expect(response.results[0].matchContext.confirmed).toBe(false);
    expect(response.results[0].matchContext.text).toContain("Unconfirmed visual match");
  });

  it("uses local lexical matches for filename and path boosts", async () => {
    vectorSearch.mockResolvedValue([]);
    getChunks.mockResolvedValue([
      candidate({
        id: "signal:metadata",
        fileId: "signal",
        filePath: "/tmp/docs/signal-plan.pdf",
        displayName: "signal-plan.pdf",
        text: "file signal-plan.pdf",
        recordKind: "metadata",
        contextSource: "metadata",
        score: 0,
      }),
    ]);

    const response = await searchFiles("signal", 5);

    expect(response.results[0].id).toBe("signal");
    expect(response.results[0].matchContext.kind).toBe("filenamePath");
  });

  it("clamps retrieval options and returns diagnostics", async () => {
    vectorSearch.mockResolvedValue([]);

    const response = await searchFiles("signal pdf", {
      finalLimit: 500,
      semanticTopK: 500,
      lexicalTopK: 500,
      maxRetrievalPasses: 500,
    });

    expect(response.diagnostics?.options?.finalLimit).toBe(50);
    expect(response.diagnostics?.options?.semanticTopK).toBe(200);
    expect(response.diagnostics?.options?.lexicalTopK).toBe(200);
    expect(response.queryInterpretation?.fileTypes).toContain("pdf");
  });

  it("interprets answer, visual, OCR, folder, and quoted-term intent locally", () => {
    const interpretation = interpretQuery('answer: what text is visible in "menu" from Receipts folder screenshot png');

    expect(interpretation.answerIntent).toBe(true);
    expect(interpretation.visualIntent).toBe(true);
    expect(interpretation.ocrIntent).toBe(true);
    expect(interpretation.fileTypes).toContain("png");
    expect(interpretation.folderHints).toContain("Receipts");
    expect(interpretation.quotedTerms).toContain("menu");
  });

  it("resolves default retrieval options without Groq", () => {
    const options = resolveSearchOptions({});

    expect(options.finalLimit).toBe(20);
    expect(options.semanticTopK).toBe(80);
    expect(options.lexicalTopK).toBe(80);
  });

  it("uses hybrid ranking components and metadata boosts", async () => {
    vectorSearch.mockResolvedValue([
      candidate({
        id: "a:0",
        fileId: "a",
        filePath: "/tmp/Random/a.md",
        displayName: "a.md",
        text: "general budget note",
        score: 0.7,
      }),
      candidate({
        id: "b:metadata",
        fileId: "b",
        filePath: "/tmp/Finance/Reports/budget.pdf",
        displayName: "budget.pdf",
        text: "file budget.pdf. type pdf application/pdf. folders Finance Reports.",
        recordKind: "metadata",
        contextSource: "metadata",
        score: 0.66,
      }),
    ]);

    const response = await searchFiles("finance pdf from Reports folder", 5);

    expect(response.results[0].id).toBe("b");
    expect(response.results[0].scoreComponents?.metadata).toBeGreaterThan(0);
    expect(response.results[0].matchContext.evidenceId).toBe("b:metadata");
  });

  it("boosts OCR evidence for readable-text intent", async () => {
    vectorSearch.mockResolvedValue([
      candidate({
        id: "img:caption",
        fileId: "img",
        filePath: "/tmp/menu.png",
        displayName: "menu.png",
        fileType: "png",
        text: "restaurant menu board",
        recordKind: "imageVisualCaption",
        contextSource: "imageVisualCaption",
        score: 0.8,
      }),
      candidate({
        id: "img:ocr",
        fileId: "img",
        filePath: "/tmp/menu.png",
        displayName: "menu.png",
        fileType: "png",
        text: "Lunch special $12",
        recordKind: "imageOcrText",
        contextSource: "imageOcrText",
        score: 0.6,
      }),
    ]);

    const response = await searchFiles("what words are visible on the menu screenshot", 5);

    expect(response.results[0].matchContext.text).toBe("Lunch special $12");
    expect(response.results[0].evidence?.some((item) => item.source === "imageOcrText")).toBe(true);
  });

  it("applies source caps before grouping", async () => {
    vectorSearch.mockResolvedValue([
      candidate({ id: "a:0", fileId: "a", contextSource: "metadata", recordKind: "metadata", score: 0.9 }),
      candidate({ id: "b:0", fileId: "b", contextSource: "metadata", recordKind: "metadata", score: 0.8 }),
    ]);

    const response = await searchFiles("budget", { finalLimit: 5, sourceCaps: { metadata: 1 } });

    expect(response.results).toHaveLength(1);
    expect(response.diagnostics?.omittedCandidateCount).toBeGreaterThanOrEqual(1);
  });

  it("generates cited answers from bounded evidence", async () => {
    groqAnswer.mockResolvedValue({ status: "answered", text: "Lizards prefer warmth [E1].", citationLabels: ["E1"] });
    vectorSearch.mockResolvedValue([
      candidate({
        id: "lizard:0",
        fileId: "lizard",
        filePath: "/tmp/lizards.md",
        displayName: "lizards.md",
        text: "Lizards live in warm habitats.",
        score: 0.9,
      }),
    ]);

    const response = await searchFiles("what habitats do lizards prefer?", { answer: true });

    expect(response.answer?.status).toBe("answered");
    expect(response.answer?.citations[0]).toMatchObject({
      label: "E1",
      filePath: "/tmp/lizards.md",
      evidenceId: "lizard:0",
    });
  });

  it("rejects answers that omit valid citations", async () => {
    groqAnswer.mockResolvedValue({ status: "answered", text: "Unsupported answer.", citationLabels: ["bad"] });
    vectorSearch.mockResolvedValue([
      candidate({
        id: "lizard:0",
        fileId: "lizard",
        filePath: "/tmp/lizards.md",
        displayName: "lizards.md",
        text: "Lizards live in warm habitats.",
        score: 0.9,
      }),
    ]);

    const response = await searchFiles("what habitats do lizards prefer?", { answer: true });

    expect(response.answer?.status).toBe("insufficientEvidence");
    expect(response.answer?.message).toContain("omitted valid citations");
  });

  it("returns provider-unavailable answer status with ranked results", async () => {
    vectorSearch.mockResolvedValue([
      candidate({
        id: "lizard:0",
        fileId: "lizard",
        filePath: "/tmp/lizards.md",
        displayName: "lizards.md",
        text: "Lizards live in warm habitats.",
        score: 0.9,
      }),
    ]);

    const response = await searchFiles("what habitats do lizards prefer?", { answer: true });

    expect(response.results).toHaveLength(1);
    expect(response.answer?.status).toBe("providerUnavailable");
  });

  it("budgets answer context before provider call", async () => {
    groqAnswer.mockResolvedValue({ status: "answered", text: "First evidence [E1].", citationLabels: ["E1"] });
    vectorSearch.mockResolvedValue([
      candidate({
        id: "a:0",
        fileId: "a",
        filePath: "/tmp/a.md",
        displayName: "a.md",
        text: "A".repeat(900),
        score: 0.9,
      }),
      candidate({
        id: "b:0",
        fileId: "b",
        filePath: "/tmp/b.md",
        displayName: "b.md",
        text: "B".repeat(900),
        score: 0.8,
      }),
    ]);

    await searchFiles("answer with budget", { answer: true, answerContextBudget: 500 });

    expect(groqAnswer.mock.calls[0][1]).toHaveLength(1);
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
