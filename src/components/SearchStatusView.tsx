import type { FileActionError } from "../desktop/DesktopFileActions";
import type { SearchReadiness, SearchState } from "../search/SearchProvider";

interface SearchStatusViewProps {
  state: SearchState;
  actionFailure?: SearchActionFailure;
}

export interface SearchActionFailure {
  action: "open" | "reveal";
  resultName: string;
  error: FileActionError;
}

export function SearchStatusView({ state, actionFailure }: SearchStatusViewProps) {
  const fileActionAlert = actionFailure ? (
    <p className="action-failure" role="alert">
      {getFileActionFailureMessage(actionFailure)}
    </p>
  ) : null;

  if (state.status === "loading") {
    return (
      <div id="search-feedback" className="search-feedback" aria-live="polite">
        <p>Searching for "{state.query}"...</p>
        {fileActionAlert}
      </div>
    );
  }

  if (state.status === "results") {
    return (
      <div id="search-feedback" className="search-feedback" aria-live="polite">
        <p>Showing results for "{state.query}".</p>
        {fileActionAlert}
      </div>
    );
  }

  if (state.status === "empty") {
    return (
      <div id="search-feedback" className="search-feedback" aria-live="polite">
        <p>{getEmptyMessage(state.query, state.readiness)}</p>
        {state.readiness.kind === "notReady" ? (
          <p>{getReadinessReason(state.readiness.reason)}</p>
        ) : null}
        {fileActionAlert}
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
    <div id="search-feedback" className="search-feedback" aria-live="polite">
      <p>Ready for a local file search.</p>
      {fileActionAlert}
    </div>
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

function getFileActionFailureMessage(failure: SearchActionFailure): string {
  const actionText = failure.action === "open" ? "open" : "show";
  const recovery = getFileActionRecovery(failure.error);

  return `Could not ${actionText} ${failure.resultName}: ${failure.error.message} ${recovery}`;
}

function getFileActionRecovery(error: FileActionError): string {
  if (error.kind === "notFound") {
    return "Check whether the file moved, then search again.";
  }

  if (error.kind === "notAllowed") {
    return "Choose another available action for this result.";
  }

  return "Try again or open the containing folder manually.";
}
