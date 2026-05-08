import { placeholderResults } from "../data/placeholderResults";
import { isSearchResult } from "./SearchProvider";
import { createLocalPlaceholderSearchProvider } from "./LocalPlaceholderSearchProvider";

describe("LocalPlaceholderSearchProvider", () => {
  it("keeps fixture data compatible with the shared SearchProvider contract", () => {
    expect(placeholderResults.length).toBeGreaterThan(0);
    expect(placeholderResults.every(isSearchResult)).toBe(true);
  });

  it("returns ranked results for representative natural language file queries", async () => {
    const provider = createLocalPlaceholderSearchProvider();

    const response = await provider.search({
      text: "quarterly budget spreadsheet from March",
    });

    expect(response.ok).toBe(true);
    if (!response.ok) {
      throw new Error(response.error.message);
    }

    expect(response.value.readiness).toEqual({ kind: "ready" });
    expect(response.value.results.map((result) => result.rank)).toEqual([1, 2]);
    expect(response.value.results[0]).toMatchObject({
      displayName: "Q1 Budget Forecast.xlsx",
      fileType: "xlsx",
      matchContext: {
        kind: "snippet",
        text: expect.stringContaining("March budget"),
      },
      actions: {
        canOpen: true,
        canReveal: true,
      },
    });
  });

  it("returns bounded availability hints without exposing provider internals", async () => {
    const provider = createLocalPlaceholderSearchProvider();

    const response = await provider.search({
      text: "team offsite photo from whiteboard",
    });

    expect(response.ok).toBe(true);
    if (!response.ok) {
      throw new Error(response.error.message);
    }

    expect(response.value.results[0]).toMatchObject({
      displayName: "Team Offsite Whiteboard.png",
      availabilityHint: {
        kind: "partial",
        reason: "visualLimited",
      },
      matchContext: {
        kind: "caption",
        text: expect.stringContaining("whiteboard"),
      },
    });
  });

  it("returns a ready empty response for unmatched queries", async () => {
    const provider = createLocalPlaceholderSearchProvider();

    const response = await provider.search({
      text: "invoice for submarine parts",
    });

    expect(response.ok).toBe(true);
    if (!response.ok) {
      throw new Error(response.error.message);
    }

    expect(response.value).toEqual({
      readiness: { kind: "ready" },
      results: [],
    });
  });
});
