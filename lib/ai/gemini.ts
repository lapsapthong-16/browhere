import { getGeminiConfig, getHuggingFaceConfig, getImageLabelProvider } from "@/lib/config";

type GeminiPart =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } };

export class ProviderUnavailableError extends Error {
  constructor(message = "Gemini API key is missing.") {
    super(message);
  }
}

export interface ImageLabelResult {
  text: string;
  provider: "gemini" | "huggingface";
  model: string;
}

export interface ImageOcrResult {
  text: string;
  provider: "gemini";
  model: string;
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

  async labelImage(buffer: Buffer, mimeType: string): Promise<ImageLabelResult> {
    const preferredProvider = getImageLabelProvider();
    if (preferredProvider === "huggingface") {
      return this.labelImageWithHuggingFace(buffer, mimeType);
    }

    try {
      return await this.labelImageWithGemini(buffer, mimeType);
    } catch (error) {
      const hfConfig = getHuggingFaceConfig();
      if (!hfConfig.apiKey) throw error;
      return this.labelImageWithHuggingFace(buffer, mimeType);
    }
  }

  async readImageText(buffer: Buffer, mimeType: string): Promise<ImageOcrResult | undefined> {
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
                { text: IMAGE_OCR_PROMPT },
                { inlineData: { mimeType, data: buffer.toString("base64") } },
              ],
            },
          ],
          generationConfig: {
            temperature: 0,
            maxOutputTokens: 240,
          },
        }),
      },
    );
    if (!response.ok) {
      throw new Error(`Gemini image OCR failed: ${response.status} ${await response.text()}`);
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
    if (!text || /^no readable text\.?$/i.test(text)) {
      return undefined;
    }
    return { text: text.slice(0, 1200), provider: "gemini", model: config.visionModel };
  }

  private async labelImageWithGemini(buffer: Buffer, mimeType: string): Promise<ImageLabelResult> {
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
    return { text: text.slice(0, 900), provider: "gemini", model: config.visionModel };
  }

  private async labelImageWithHuggingFace(buffer: Buffer, mimeType: string): Promise<ImageLabelResult> {
    const config = getHuggingFaceConfig();
    if (!config.apiKey) {
      throw new ProviderUnavailableError("Hugging Face API key is missing.");
    }

    const response = await fetch(config.endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        model: config.imageCaptionModel,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: IMAGE_LABEL_PROMPT },
              {
                type: "image_url",
                image_url: { url: `data:${mimeType};base64,${buffer.toString("base64")}` },
              },
            ],
          },
        ],
        max_tokens: 160,
        temperature: 0.1,
      }),
    });
    if (!response.ok) {
      throw new Error(`Hugging Face image labeling failed: ${response.status} ${await response.text()}`);
    }
    const data = (await response.json()) as
      | Array<{ generated_text?: string }>
      | { generated_text?: string; error?: string; choices?: Array<{ message?: { content?: string } }> };
    const text = Array.isArray(data) ? data[0]?.generated_text : data.choices?.[0]?.message?.content ?? data.generated_text;
    if (!text) {
      const error = !Array.isArray(data) ? data.error : undefined;
      throw new Error(error ? `Hugging Face image labeling returned no label: ${error}` : "Hugging Face image labeling returned no label.");
    }
    return {
      text: text.replace(/\s+/g, " ").trim().slice(0, 900),
      provider: "huggingface",
      model: config.imageCaptionModel,
    };
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

export const IMAGE_OCR_PROMPT =
  "Extract only readable text visible in this image for file search. Preserve short phrases, signs, labels, menus, receipts, UI text, or document text. If no readable text is visible, return exactly: No readable text.";
