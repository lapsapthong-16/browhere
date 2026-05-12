import { describe, expect, it } from "vitest";
import { chunkText } from "@/lib/files/extraction";

describe("chunkText", () => {
  it("splits text into overlapping chunks", () => {
    const chunks = chunkText("a".repeat(1300), 1000, 100);
    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toHaveLength(1000);
    expect(chunks[1].length).toBeGreaterThan(300);
  });

  it("ignores empty text", () => {
    expect(chunkText(" \n\t ")).toEqual([]);
  });
});
