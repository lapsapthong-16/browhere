import { createSearchController } from "./SearchController";
import type {
  Result,
  SearchError,
  SearchProvider,
  SearchResponse,
  SearchResult,
} from "./SearchProvider";

const result: SearchResult = {
  id: "budget",
  rank: 1,
  filePath: "C:\\Users\\edw\\Documents\\Q1 Budget Forecast.xlsx",
  displayName: "Q1 Budget Forecast.xlsx",
  fileType: "xlsx",
  modifiedAt: "2026-05-01T12:00:00.000Z",
  matchContext: {
    kind: "snippet",
    text: "March budget forecast notes",
  },
  actions: {
    canOpen: true,
    canReveal: true,
  },
};

function createDeferredProvider(
  response: Result<SearchResponse, SearchError>,
): SearchProvider & {
  calls: string[];
  resolve: () => void;
} {
  const calls: string[] = [];
  let resolveSearch: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => {
    resolveSearch = resolve;
  });

  return {
    calls,
    resolve: resolveSearch,
    async search(query) {
      calls.push(query.text);
      await gate;
      return response;
    },
  };
}

describe("SearchController", () => {
  it("keeps empty submissions local without calling the provider", async () => {
    const provider = createDeferredProvider({
      ok: true,
      value: {
        readiness: { kind: "ready" },
        results: [result],
      },
    });
    const controller = createSearchController(provider);

    await expect(controller.submit({ text: "   " })).resolves.toEqual({
      status: "initial",
      query: "",
    });

    expect(controller.state).toEqual({ status: "initial", query: "" });
    expect(provider.calls).toEqual([]);
  });

  it("enters loading immediately and passes the exact non-empty query to the provider", async () => {
    const provider = createDeferredProvider({
      ok: true,
      value: {
        readiness: { kind: "ready" },
        results: [result],
      },
    });
    const controller = createSearchController(provider);
    const submission = controller.submit({ text: "  March budget forecast  " });

    expect(controller.state).toEqual({
      status: "loading",
      query: "  March budget forecast  ",
    });
    expect(provider.calls).toEqual(["  March budget forecast  "]);

    provider.resolve();

    await expect(submission).resolves.toMatchObject({
      status: "results",
      query: "  March budget forecast  ",
      results: [result],
      readiness: { kind: "ready" },
      selectedId: "budget",
    });
  });

  it("keeps prior results intact when a whitespace-only submission follows a completed search", async () => {
    const provider = createDeferredProvider({
      ok: true,
      value: {
        readiness: { kind: "ready" },
        results: [result],
      },
    });
    const controller = createSearchController(provider);
    const submission = controller.submit({ text: "budget forecast" });
    provider.resolve();
    const priorState = await submission;

    await expect(controller.submit({ text: "   " })).resolves.toBe(priorState);

    expect(controller.state).toBe(priorState);
    expect(provider.calls).toEqual(["budget forecast"]);
  });

  it("preserves active query and readiness on ready empty responses", async () => {
    const provider = createDeferredProvider({
      ok: true,
      value: {
        readiness: { kind: "ready" },
        results: [],
      },
    });
    const controller = createSearchController(provider);
    const submission = controller.submit({ text: "invoice for submarine parts" });

    expect(controller.state).toEqual({
      status: "loading",
      query: "invoice for submarine parts",
    });

    provider.resolve();

    await expect(submission).resolves.toEqual({
      status: "empty",
      query: "invoice for submarine parts",
      readiness: { kind: "ready" },
    });
  });

  it("preserves active query and not-ready readiness on empty responses", async () => {
    const provider = createDeferredProvider({
      ok: true,
      value: {
        readiness: { kind: "notReady", reason: "notIndexedYet" },
        results: [],
      },
    });
    const controller = createSearchController(provider);
    const submission = controller.submit({ text: "old team offsite photo" });

    expect(controller.state).toEqual({
      status: "loading",
      query: "old team offsite photo",
    });

    provider.resolve();

    await expect(submission).resolves.toEqual({
      status: "empty",
      query: "old team offsite photo",
      readiness: { kind: "notReady", reason: "notIndexedYet" },
    });
  });

  it("preserves active query when the provider returns an error", async () => {
    const provider = createDeferredProvider({
      ok: false,
      error: {
        kind: "providerUnavailable",
        message: "Search provider is unavailable.",
      },
    });
    const controller = createSearchController(provider);
    const submission = controller.submit({ text: "team roadmap deck" });

    expect(controller.state).toEqual({
      status: "loading",
      query: "team roadmap deck",
    });

    provider.resolve();

    await expect(submission).resolves.toEqual({
      status: "error",
      query: "team roadmap deck",
      message: "Search provider is unavailable.",
    });
  });
});
