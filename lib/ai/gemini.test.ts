import { describe, expect, it, vi } from "vitest";
import { GeminiEmbeddingClient, ProviderUnavailableError } from "@/lib/ai/gemini";

describe("GeminiEmbeddingClient", () => {
  it("does not send content when key is missing", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    await expect(new GeminiEmbeddingClient().embedText("secret")).rejects.toBeInstanceOf(
      ProviderUnavailableError,
    );
    vi.unstubAllEnvs();
  });

  it("validates returned dimensions", async () => {
    vi.stubEnv("GEMINI_API_KEY", "key");
    vi.stubEnv("BROWHERE_GEMINI_EMBEDDING_DIMENSIONS", "3");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ embedding: { values: [1, 2] } }),
      })),
    );

    await expect(new GeminiEmbeddingClient().embedText("hello")).rejects.toThrow(
      "invalid vector dimensions",
    );
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });
});
