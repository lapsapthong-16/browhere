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

  it("generates constrained image labels with the configured vision model", async () => {
    vi.stubEnv("GEMINI_API_KEY", "key");
    vi.stubEnv("BROWHERE_GEMINI_VISION_MODEL", "gemini-test-vision");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ candidates: [{ content: { parts: [{ text: "Visible logo and red sign" }] } }] }),
      })),
    );

    await expect(new GeminiEmbeddingClient().labelImage(Buffer.from([1]), "image/png")).resolves.toMatchObject({
      text: "Visible logo and red sign",
      provider: "gemini",
      model: "gemini-test-vision",
    });
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(String(url)).toContain("gemini-test-vision:generateContent");
    expect(String(init?.body)).toContain("Do not infer private facts");
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("uses Hugging Face when configured as the image label provider", async () => {
    vi.stubEnv("BROWHERE_IMAGE_LABEL_PROVIDER", "huggingface");
    vi.stubEnv("HUGGINGFACE_API_KEY", "hf-key");
    vi.stubEnv("BROWHERE_HUGGINGFACE_IMAGE_CAPTION_MODEL", "caption-model");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ choices: [{ message: { content: "a screenshot with a chart" } }] }),
      })),
    );

    await expect(new GeminiEmbeddingClient().labelImage(Buffer.from([1]), "image/png")).resolves.toMatchObject({
      text: "a screenshot with a chart",
      provider: "huggingface",
      model: "caption-model",
    });
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(String(url)).toContain("chat/completions");
    expect(String(init?.body)).toContain("caption-model");
    expect(String(init?.body)).toContain("data:image/png;base64");
    expect(init?.headers).toMatchObject({ Authorization: "Bearer hf-key" });
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });
});
