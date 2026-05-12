import fs from "node:fs/promises";
import path from "node:path";
import mammoth from "mammoth";
import pdf from "pdf-parse";
import { DOCUMENT_EXTENSIONS, IMAGE_EXTENSIONS, TEXT_EXTENSIONS } from "@/lib/config";
import { extensionFor } from "@/lib/files/discovery";

export interface ExtractedContent {
  chunks: Array<{ text: string; kind: "text" | "image"; rawImage?: Buffer; mimeType?: string }>;
  status: "indexed" | "partial" | "failed";
  reason?: string;
}

export async function extractContent(filePath: string): Promise<ExtractedContent> {
  const ext = extensionFor(filePath);
  if (TEXT_EXTENSIONS.has(ext)) {
    const text = await fs.readFile(filePath, "utf8");
    return { chunks: chunkText(text).map((text) => ({ text, kind: "text" })), status: "indexed" };
  }
  if (ext === "pdf") {
    try {
      const data = await fs.readFile(filePath);
      const parsed = await pdf(data);
      const chunks = chunkText(parsed.text);
      return chunks.length
        ? { chunks: chunks.map((text) => ({ text, kind: "text" })), status: "indexed" }
        : fallback(filePath, "PDF text was empty.");
    } catch (error) {
      return fallback(filePath, errorMessage(error));
    }
  }
  if (ext === "docx") {
    try {
      const result = await mammoth.extractRawText({ path: filePath });
      const chunks = chunkText(result.value);
      return chunks.length
        ? { chunks: chunks.map((text) => ({ text, kind: "text" })), status: "indexed" }
        : fallback(filePath, "DOCX text was empty.");
    } catch (error) {
      return fallback(filePath, errorMessage(error));
    }
  }
  if (IMAGE_EXTENSIONS.has(ext)) {
    const rawImage = await fs.readFile(filePath);
    const mimeType = ext === "png" ? "image/png" : "image/jpeg";
    return {
      chunks: [{ text: imageFallbackText(filePath), kind: "image", rawImage, mimeType }],
      status: "indexed",
    };
  }
  if (DOCUMENT_EXTENSIONS.has(ext)) {
    return fallback(filePath, `${ext} extraction unavailable.`);
  }
  return fallback(filePath, `${ext} unsupported.`);
}

export function chunkText(text: string, size = 1200, overlap = 120): string[] {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return [];
  }
  const chunks: string[] = [];
  let start = 0;
  while (start < normalized.length) {
    chunks.push(normalized.slice(start, start + size));
    start += Math.max(1, size - overlap);
  }
  return chunks;
}

function fallback(filePath: string, reason: string): ExtractedContent {
  return {
    chunks: [{ text: imageFallbackText(filePath), kind: "text" }],
    status: "partial",
    reason,
  };
}

function imageFallbackText(filePath: string): string {
  return `${path.basename(filePath)} ${path.dirname(filePath)}`;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Extraction failed.";
}
