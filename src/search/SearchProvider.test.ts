import {
  isSearchResult,
  type ProviderSearchResult,
  type SearchProvider,
  type SearchResponse,
  type SearchResult,
  type SearchState,
} from "./SearchProvider";

describe("SearchProvider contracts", () => {
  const requiredResult: SearchResult = {
    id: "result-1",
    rank: 1,
    filePath: "C:\\Users\\edw\\Documents\\Budget.xlsx",
    displayName: "Budget.xlsx",
    fileType: "xlsx",
    modifiedAt: "2026-05-01T12:00:00.000Z",
    actions: {
      canOpen: true,
      canReveal: true,
    },
  };

  it("accepts results with required fields and optional metadata combinations", () => {
    const combinations: SearchResult[] = [
      requiredResult,
      {
        ...requiredResult,
        id: "result-2",
        rank: 2,
        sizeBytes: 12400,
        matchContext: { kind: "snippet", text: "Quarterly budget notes" },
      },
      {
        ...requiredResult,
        id: "result-3",
        rank: 3,
        matchContext: { kind: "caption", text: "Screenshot of budget dashboard" },
        availabilityHint: {
          kind: "partial",
          reason: "visualLimited",
        },
      },
      {
        ...requiredResult,
        id: "result-4",
        rank: 4,
        modifiedAt: undefined,
        matchContext: {
          kind: "explanation",
          text: "The provider matched the user's plain-language memory.",
        },
        availabilityHint: {
          kind: "unavailable",
          reason: "providerUnavailable",
        },
        actions: {
          canOpen: false,
          canReveal: false,
        },
      },
    ];

    expect(combinations.every(isSearchResult)).toBe(true);
  });

  it("rejects missing required result fields and unbounded metadata values", () => {
    expect(
      isSearchResult({
        ...requiredResult,
        displayName: undefined,
      }),
    ).toBe(false);
    expect(
      isSearchResult({
        ...requiredResult,
        availabilityHint: {
          kind: "partial",
          reason: "embeddingBackfillQueued",
        },
      }),
    ).toBe(false);
  });

  it("carries readiness through result-bearing and empty search states", () => {
    const responseWithResults: SearchResponse = {
      readiness: { kind: "ready" },
      results: [requiredResult],
    };
    const notReadyResponse: SearchResponse = {
      readiness: { kind: "notReady", reason: "notIndexedYet" },
      results: [],
    };

    const resultState: SearchState = {
      status: "results",
      query: "budget spreadsheet",
      results: responseWithResults.results,
      readiness: responseWithResults.readiness,
      selectedId: "result-1",
    };
    const emptyState: SearchState = {
      status: "empty",
      query: "old team offsite photo",
      readiness: notReadyResponse.readiness,
    };

    expect(resultState.readiness).toEqual({ kind: "ready" });
    expect(emptyState.readiness).toEqual({
      kind: "notReady",
      reason: "notIndexedYet",
    });
  });

  it("allows providers to return unsupported enrichment without changing the shell contract", async () => {
    type EnrichedProviderResult = ProviderSearchResult & {
      semanticScore: number;
      providerTraceId: string;
    };

    const provider: SearchProvider<EnrichedProviderResult> = {
      async search() {
        return {
          ok: true,
          value: {
            readiness: { kind: "ready" },
            results: [
              {
                ...requiredResult,
                semanticScore: 0.87,
                providerTraceId: "internal-123",
              },
            ],
          },
        };
      },
    };

    const response = await provider.search({ text: "budget" });

    expect(response.ok).toBe(true);
    if (response.ok) {
      expect(isSearchResult(response.value.results[0])).toBe(true);
      expect(response.value.results[0].displayName).toBe("Budget.xlsx");
    }
  });
});
