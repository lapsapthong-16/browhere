import { describe, expect, it, vi } from "vitest";
import { GroqClient } from "@/lib/ai/groq";
import type { SearchResult } from "@/lib/types";

describe("GroqClient", () => {
  it("falls back to original query without key", async () => {
    vi.stubEnv("GROQ_API_KEY", "");
    await expect(new GroqClient().plan("lizards")).resolves.toEqual({ queries: ["lizards"] });
    vi.unstubAllEnvs();
  });

  it("returns structured retrieval intent from planning", async () => {
    vi.stubEnv("GROQ_API_KEY", "key");
    vi.stubEnv("BROWHERE_MAX_RETRIEVAL_PASSES", "2");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  queries: ["receipt screenshot total"],
                  intent: {
                    fileTypes: ["png"],
                    folderHints: ["Receipts"],
                    visualIntent: true,
                    ocrIntent: true,
                    answerIntent: true,
                  },
                }),
              },
            },
          ],
        }),
      })),
    );

    const plan = await new GroqClient().plan("what total is visible in receipt screenshot png");

    expect(plan.queries).toEqual(["what total is visible in receipt screenshot png", "receipt screenshot total"]);
    expect(plan.intent?.fileTypes).toEqual(["png"]);
    expect(plan.intent?.folderHints).toEqual(["Receipts"]);
    expect(plan.intent?.ocrIntent).toBe(true);
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("reranks only known candidate identities", async () => {
    vi.stubEnv("GROQ_API_KEY", "key");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  results: [
                    { id: "b", reason: "Better match" },
                    { id: "unknown", reason: "Ignore" },
                  ],
                }),
              },
            },
          ],
        }),
      })),
    );
    const candidates: SearchResult[] = [
      result("a", 1),
      result("b", 2),
    ];

    const reranked = await new GroqClient().rerank("query", candidates);

    expect(reranked.map((item) => item.id)).toEqual(["b", "a"]);
    expect(reranked[0].matchContext.text).toBe("Better match");
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("generates grounded answers with citation labels", async () => {
    vi.stubEnv("GROQ_API_KEY", "key");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  status: "answered",
                  answer: "Lizards prefer warmth [E1].",
                  citations: ["E1"],
                }),
              },
            },
          ],
        }),
      })),
    );

    const answer = await new GroqClient().answer("what habitat?", [
      { label: "E1", text: "Lizards live in warm habitats.", filePath: "/tmp/lizards.md", provenance: "human-authored" },
    ]);

    expect(answer.status).toBe("answered");
    expect(answer.citationLabels).toEqual(["E1"]);
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });
});

function result(id: string, rank: number): SearchResult {
  return {
    id,
    rank,
    filePath: `/tmp/${id}.md`,
    displayName: `${id}.md`,
    fileType: "md",
    sizeBytes: 1,
    score: 1,
    matchContext: { kind: "extractedText", text: "snippet" },
    readiness: "ready",
  };
}
