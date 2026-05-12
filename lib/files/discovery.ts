import fs from "node:fs/promises";
import path from "node:path";
import { SUPPORTED_EXTENSIONS } from "@/lib/config";
import { isExcludedPath } from "@/lib/files/exclusions";

export interface DiscoveredFile {
  path: string;
  extension: string;
  sizeBytes: number;
  modifiedMs: number;
}

export function extensionFor(filePath: string): string {
  return path.extname(filePath).replace(".", "").toLowerCase();
}

export function isSupportedFile(filePath: string): boolean {
  return SUPPORTED_EXTENSIONS.has(extensionFor(filePath));
}

export async function discoverSupportedFiles(root: string): Promise<DiscoveredFile[]> {
  const normalizedRoot = path.resolve(root);
  const results: DiscoveredFile[] = [];
  await walk(normalizedRoot, results);
  return results;
}

async function walk(dir: string, results: DiscoveredFile[]) {
  if (isExcludedPath(dir)) {
    return;
  }

  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (isExcludedPath(fullPath)) {
      continue;
    }
    if (entry.isDirectory()) {
      await walk(fullPath, results);
      continue;
    }
    if (!entry.isFile() || !isSupportedFile(fullPath)) {
      continue;
    }
    const stats = await fs.stat(fullPath);
    results.push({
      path: fullPath,
      extension: extensionFor(fullPath),
      sizeBytes: stats.size,
      modifiedMs: stats.mtimeMs,
    });
  }
}
