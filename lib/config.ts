import path from "node:path";

export const SUPPORTED_EXTENSIONS = new Set([
  "txt",
  "md",
  "pdf",
  "docx",
  "png",
  "jpg",
  "jpeg",
]);

export const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg"]);
export const TEXT_EXTENSIONS = new Set(["txt", "md"]);
export const DOCUMENT_EXTENSIONS = new Set(["pdf", "docx"]);

export const DEFAULT_VECTOR_DIMENSIONS = 3072;
export const DEFAULT_MAX_RETRIEVAL_PASSES = 2;

export function getIndexDir(): string {
  const configured = process.env.BROWHERE_INDEX_DIR;
  if (configured && configured.trim().length > 0) {
    return path.resolve(configured);
  }
  return path.join(process.cwd(), ".browhere", "index");
}

export function getGeminiConfig() {
  return {
    apiKey: process.env.GEMINI_API_KEY ?? "",
    endpoint:
      process.env.BROWHERE_GEMINI_ENDPOINT ??
      "https://generativelanguage.googleapis.com/v1beta",
    embeddingModel:
      process.env.BROWHERE_GEMINI_EMBEDDING_MODEL ?? "gemini-embedding-2",
    dimensions: Number(
      process.env.BROWHERE_GEMINI_EMBEDDING_DIMENSIONS ??
        DEFAULT_VECTOR_DIMENSIONS,
    ),
  };
}

export function getGroqConfig() {
  return {
    apiKey: process.env.GROQ_API_KEY ?? "",
    endpoint:
      process.env.BROWHERE_GROQ_ENDPOINT ??
      "https://api.groq.com/openai/v1/chat/completions",
    model: process.env.BROWHERE_GROQ_MODEL ?? "llama-3.3-70b-versatile",
    maxRetrievalPasses: Number(
      process.env.BROWHERE_MAX_RETRIEVAL_PASSES ??
        DEFAULT_MAX_RETRIEVAL_PASSES,
    ),
  };
}
