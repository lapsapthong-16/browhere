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
export const DEFAULT_FINAL_RESULT_LIMIT = 20;
export const DEFAULT_SEMANTIC_TOP_K = 80;
export const DEFAULT_LEXICAL_TOP_K = 80;
export const DEFAULT_ANSWER_CONTEXT_BUDGET = 6_000;

export function getIndexDir(): string {
  const configured = process.env.BROWHERE_INDEX_DIR;
  if (configured && configured.trim().length > 0) {
    return path.resolve(configured);
  }
  const desktopDataDir = process.env.BROWHERE_APP_DATA_DIR;
  if (desktopDataDir && desktopDataDir.trim().length > 0) {
    return path.join(desktopDataDir, "index");
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
    visionModel: process.env.BROWHERE_GEMINI_VISION_MODEL ?? "gemini-2.0-flash",
    dimensions: Number(
      process.env.BROWHERE_GEMINI_EMBEDDING_DIMENSIONS ??
        DEFAULT_VECTOR_DIMENSIONS,
    ),
  };
}

export function getHuggingFaceConfig() {
  return {
    apiKey: process.env.HUGGINGFACE_API_KEY ?? process.env.HF_TOKEN ?? "",
    endpoint:
      process.env.BROWHERE_HUGGINGFACE_ENDPOINT ??
      "https://router.huggingface.co/v1/chat/completions",
    imageCaptionModel:
      process.env.BROWHERE_HUGGINGFACE_IMAGE_CAPTION_MODEL ??
      "google/gemma-3n-E4B-it:together",
  };
}

export function getImageLabelProvider() {
  const provider = process.env.BROWHERE_IMAGE_LABEL_PROVIDER?.toLowerCase().trim();
  return provider === "huggingface" ? "huggingface" : "gemini";
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

export function getRetrievalConfig() {
  return {
    finalLimit: numberFromEnv("BROWHERE_FINAL_RESULT_LIMIT", DEFAULT_FINAL_RESULT_LIMIT),
    maxFinalLimit: numberFromEnv("BROWHERE_MAX_FINAL_RESULT_LIMIT", 50),
    semanticTopK: numberFromEnv("BROWHERE_SEMANTIC_TOP_K", DEFAULT_SEMANTIC_TOP_K),
    maxSemanticTopK: numberFromEnv("BROWHERE_MAX_SEMANTIC_TOP_K", 200),
    lexicalTopK: numberFromEnv("BROWHERE_LEXICAL_TOP_K", DEFAULT_LEXICAL_TOP_K),
    maxLexicalTopK: numberFromEnv("BROWHERE_MAX_LEXICAL_TOP_K", 200),
    maxRetrievalPasses: numberFromEnv("BROWHERE_MAX_RETRIEVAL_PASSES", DEFAULT_MAX_RETRIEVAL_PASSES),
    answerContextBudget: numberFromEnv("BROWHERE_ANSWER_CONTEXT_BUDGET", DEFAULT_ANSWER_CONTEXT_BUDGET),
    maxAnswerContextBudget: numberFromEnv("BROWHERE_MAX_ANSWER_CONTEXT_BUDGET", 20_000),
  };
}

function numberFromEnv(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}
