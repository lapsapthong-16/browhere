import { getGeminiConfig } from "@/lib/config";

type GeminiPart =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } };

export class ProviderUnavailableError extends Error {
  constructor(message = "Gemini API key is missing.") {
    super(message);
  }
}

export class GeminiEmbeddingClient {
  async embedText(text: string): Promise<number[]> {
    return this.embedParts([{ text }]);
  }

  async embedImage(buffer: Buffer, mimeType: string, fallbackText: string): Promise<number[]> {
    return this.embedParts([
      { text: fallbackText },
      { inlineData: { mimeType, data: buffer.toString("base64") } },
    ]);
  }

  private async embedParts(parts: GeminiPart[]): Promise<number[]> {
    const config = getGeminiConfig();
    if (!config.apiKey) {
      throw new ProviderUnavailableError();
    }

    const response = await fetch(
      `${config.endpoint}/models/${config.embeddingModel}:embedContent?key=${config.apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: `models/${config.embeddingModel}`,
          content: { parts },
          outputDimensionality: config.dimensions,
        }),
      },
    );
    if (!response.ok) {
      throw new Error(`Gemini embedding failed: ${response.status} ${await response.text()}`);
    }
    const data = (await response.json()) as { embedding?: { values?: number[] } };
    const vector = data.embedding?.values;
    if (!Array.isArray(vector) || vector.length !== config.dimensions) {
      throw new Error(`Gemini returned invalid vector dimensions.`);
    }
    return vector;
  }
}

export const gemini = new GeminiEmbeddingClient();
