import { describe, expect, it } from "vitest";
import { isExcludedPath } from "@/lib/files/exclusions";

describe("isExcludedPath", () => {
  it("skips sensitive and noisy paths", () => {
    expect(isExcludedPath("/work/project/.env")).toBe(true);
    expect(isExcludedPath("/work/project/.git/config")).toBe(true);
    expect(isExcludedPath("/work/project/node_modules/pkg/index.js")).toBe(true);
    expect(isExcludedPath("/work/secret.pem")).toBe(true);
  });

  it("allows normal supported file paths", () => {
    expect(isExcludedPath("/Users/me/Documents/lizards.docx")).toBe(false);
  });
});
