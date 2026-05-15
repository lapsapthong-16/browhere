// @vitest-environment jsdom
import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SearchPanel } from "@/app/components/SearchPanel";
import HomePage from "@/app/page";
import type { BrowhereController } from "@/app/useBrowhereController";

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

  it("shows result evidence provenance", () => {
    const controller = {
      query: "menu",
      setQuery: vi.fn(),
      search: {
        readiness: { kind: "ready" },
        agentic: false,
        answer: {
          status: "answered",
          text: "Lunch costs $12 [E1].",
          citations: [
            {
              label: "E1",
              filePath: "/tmp/menu.png",
              evidenceId: "file:ocr",
              provenance: "ocr",
            },
          ],
          evidenceIds: ["file:ocr"],
        },
        results: [
          {
            id: "file",
            rank: 1,
            filePath: "/tmp/menu.png",
            displayName: "menu.png",
            fileType: "png",
            sizeBytes: 1,
            score: 0.9,
            matchContext: {
              kind: "imageOcrText",
              text: "Lunch special $12",
              provenance: "ocr",
            },
            evidence: [
              {
                evidenceId: "file:ocr",
                text: "Lunch special $12",
                source: "imageOcrText",
                provenance: "ocr",
              },
            ],
            readiness: "ready",
          },
        ],
      },
      busy: false,
      message: "Search complete.",
      desktopReady: false,
      submitSearch: vi.fn(),
      revealResult: vi.fn(),
      openResult: vi.fn(),
      copyResultPath: vi.fn(),
    } as unknown as BrowhereController;

    render(<SearchPanel controller={controller} />);

    expect(screen.getByText("OCR-derived")).toBeVisible();
    expect(screen.getByText("1 evidence")).toBeVisible();
    expect(screen.getByText("Lunch costs $12 [E1].")).toBeVisible();
  });
});
