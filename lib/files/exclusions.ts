import path from "node:path";

const EXCLUDED_NAMES = new Set([
  ".git",
  "node_modules",
  ".next",
  "dist",
  "build",
  "coverage",
  ".cache",
  ".turbo",
  "target",
  "Library",
]);

const EXCLUDED_FILENAMES = new Set([".env", ".env.local", ".env.production"]);
const EXCLUDED_EXTENSIONS = new Set([".key", ".pem", ".p12", ".pfx"]);

export function isExcludedPath(inputPath: string): boolean {
  const normalized = path.normalize(inputPath);
  const parts = normalized.split(path.sep).filter(Boolean);
  const basename = path.basename(normalized);
  const ext = path.extname(normalized).toLowerCase();

  return (
    parts.some((part) => EXCLUDED_NAMES.has(part)) ||
    EXCLUDED_FILENAMES.has(basename) ||
    basename.startsWith(".env.") ||
    EXCLUDED_EXTENSIONS.has(ext)
  );
}
