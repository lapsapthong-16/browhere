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

  async labelImage(buffer: Buffer, mimeType: string): Promise<string> {
    const config = getGeminiConfig();
    if (!config.apiKey) {
      throw new ProviderUnavailableError();
    }

    const response = await fetch(
      `${config.endpoint}/models/${config.visionModel}:generateContent?key=${config.apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                { text: IMAGE_LABEL_PROMPT },
                { inlineData: { mimeType, data: buffer.toString("base64") } },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 160,
          },
        }),
      },
    );
    if (!response.ok) {
      throw new Error(`Gemini image labeling failed: ${response.status} ${await response.text()}`);
    }
    const data = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = data.candidates?.[0]?.content?.parts
      ?.map((part) => part.text)
      .filter((part): part is string => typeof part === "string")
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    if (!text) {
      throw new Error("Gemini image labeling returned no label.");
    }
    return text.slice(0, 900);
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

export const IMAGE_LABEL_PROMPT =
  "Describe only visible evidence in this image for file search. Include recognizable objects, logos, readable text, scene type, visual layout, and location-like clues when visible. If content is unclear, say so. Do not infer private facts or anything not visible. Keep it concise.";
