import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { discoverSupportedFiles } from "@/lib/files/discovery";

let root = "";

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "browhere-discovery-"));
});

afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

describe("discoverSupportedFiles", () => {
  it("finds supported files and skips excluded paths", async () => {
    await fs.writeFile(path.join(root, "notes.md"), "lizards");
    await fs.writeFile(path.join(root, "photo.jpeg"), "fake");
    await fs.writeFile(path.join(root, ".env"), "GEMINI_API_KEY=secret");
    await fs.mkdir(path.join(root, "node_modules"));
    await fs.writeFile(path.join(root, "node_modules", "ignored.txt"), "skip");

    const files = await discoverSupportedFiles(root);

    expect(files.map((file) => path.basename(file.path)).sort()).toEqual([
      "notes.md",
      "photo.jpeg",
    ]);
  });
});
