import type { SearchReadiness, SearchState } from "../search/SearchProvider";

interface SearchStatusViewProps {
  state: SearchState;
}

export function SearchStatusView({ state }: SearchStatusViewProps) {
  if (state.status === "loading") {
    return (
      <p id="search-feedback" className="search-feedback" aria-live="polite">
        Searching for "{state.query}"...
      </p>
    );
  }

  if (state.status === "results") {
    return (
      <p id="search-feedback" className="search-feedback" aria-live="polite">
        Showing results for "{state.query}".
      </p>
    );
  }

  if (state.status === "empty") {
    return (
      <div id="search-feedback" className="search-feedback" aria-live="polite">
        <p>{getEmptyMessage(state.query, state.readiness)}</p>
        {state.readiness.kind === "notReady" ? (
          <p>{getReadinessReason(state.readiness.reason)}</p>
        ) : null}
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <p id="search-feedback" className="search-feedback" role="alert">
        Search failed for "{state.query}": {state.message}
      </p>
    );
  }

  return (
    <p id="search-feedback" className="search-feedback" aria-live="polite">
      Ready for a local file search.
    </p>
  );
}

function getEmptyMessage(query: string, readiness: SearchReadiness): string {
  if (readiness.kind === "ready") {
    return `No matches for "${query}".`;
  }

  return `No available matches for "${query}".`;
}

function getReadinessReason(reason: SearchReadinessReason): string {
  if (reason === "notIndexedYet") {
    return "Some file information is still being prepared for search.";
  }

  if (reason === "providerUnavailable") {
    return "Search data is temporarily unavailable.";
  }

  return "Some results are unavailable because access is restricted.";
}

type SearchReadinessReason = Extract<
  SearchReadiness,
  { kind: "notReady" }
>["reason"];
