import { describe, expect, it, vi } from "vitest";
import { GroqClient } from "@/lib/ai/groq";
import type { SearchResult } from "@/lib/types";

describe("GroqClient", () => {
  it("falls back to original query without key", async () => {
    vi.stubEnv("GROQ_API_KEY", "");
    await expect(new GroqClient().plan("lizards")).resolves.toEqual({ queries: ["lizards"] });
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
