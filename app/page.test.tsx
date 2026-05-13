// @vitest-environment jsdom
import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import HomePage from "@/app/page";

describe("HomePage", () => {
  it("shows search and folder controls", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        json: async () => ({
          state: "notConfigured",
          folders: [],
          queuedCount: 0,
          processingCount: 0,
          indexedFileCount: 0,
          indexedChunkCount: 0,
          skippedCount: 0,
          failedCount: 0,
          unsupportedCount: 0,
          failures: [],
          documents: [],
          message: "Add a folder.",
          providers: { geminiReady: false, groqReady: false },
        }),
      })),
    );

    render(<HomePage />);

    expect(await screen.findByLabelText("Search files")).toBeVisible();
    expect(screen.getByRole("heading", { name: "Approved folders" })).toBeVisible();
    expect(screen.getByLabelText("Folder path")).toBeVisible();
    vi.unstubAllGlobals();
  });
});
