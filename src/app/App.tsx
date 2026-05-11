import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ResultList } from "../components/ResultList";
import { IndexSettingsPanel } from "../components/IndexSettingsPanel";
import type { ResultActionFailure } from "../components/ResultItem";
import { SearchBox } from "../components/SearchBox";
import { SearchStatusView } from "../components/SearchStatusView";
import type { SearchActionFailure } from "../components/SearchStatusView";
import { createTauriDesktopFileActions } from "../desktop/tauriFileActions";
import { createLocalPlaceholderSearchProvider } from "../search/LocalPlaceholderSearchProvider";
import { createSearchController } from "../search/SearchController";
import { createTauriSearchProvider } from "../search/tauriSearchProvider";
import type { DesktopFileActions } from "../desktop/DesktopFileActions";
import type { SearchProvider, SearchState } from "../search/SearchProvider";

interface AppProps {
  searchProvider?: SearchProvider;
  desktopFileActions?: DesktopFileActions;
}

export function App({ searchProvider, desktopFileActions }: AppProps) {
  const queryInputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [searchState, setSearchState] = useState<SearchState>({
    status: "initial",
    query: "",
  });
  const [actionFailure, setActionFailure] = useState<SearchActionFailure>();
  const activeSearchIdRef = useRef(0);
  const provider = useMemo(
    () => searchProvider ?? createDefaultSearchProvider(),
    [searchProvider],
  );
  const controller = useMemo(() => createSearchController(provider), [provider]);
  const fileActions = useMemo(
    () => desktopFileActions ?? createDefaultDesktopFileActions(),
    [desktopFileActions],
  );

  useEffect(() => {
    queryInputRef.current?.focus();
  }, []);

  const submitSearch = useCallback(() => {
    queryInputRef.current?.focus();

    if (query.trim().length === 0) {
      return;
    }

    const activeQuery = query;
    const searchId = activeSearchIdRef.current + 1;
    activeSearchIdRef.current = searchId;
    setActionFailure(undefined);
    setSearchState({ status: "loading", query: activeQuery });

    void controller.submit({ text: activeQuery }).then((nextState) => {
      if (activeSearchIdRef.current === searchId) {
        setSearchState(nextState);
        queryInputRef.current?.focus();
      }
    });
  }, [controller, query]);

  const selectResult = useCallback(
    (resultId: string) => {
      setSearchState(controller.selectResult(resultId));
    },
    [controller],
  );

  const handleActionFailure = useCallback((failure: ResultActionFailure) => {
    setActionFailure({
      action: failure.action,
      resultName: failure.result.displayName,
      error: failure.error,
    });
  }, []);

  return (
    <main className="app-shell" aria-labelledby="app-title">
      <section className="search-surface">
        <p className="app-kicker">Desktop Search</p>
        <h1 id="app-title">Search your files</h1>
        <SearchBox
          inputRef={queryInputRef}
          query={query}
          disabled={searchState.status === "loading"}
          onQueryChange={setQuery}
          onSubmit={submitSearch}
        />
        <SearchStatusView state={searchState} actionFailure={actionFailure} />
        {searchState.status === "results" ? (
          <ResultList
            results={searchState.results}
            selectedId={searchState.selectedId}
            fileActions={fileActions}
            onActionFailure={handleActionFailure}
            onSelectResult={selectResult}
          />
        ) : null}
        <IndexSettingsPanel />
      </section>
    </main>
  );
}

type TauriRuntimeWindow = Window & {
  __TAURI_INTERNALS__?: unknown;
};

function createDefaultSearchProvider(): SearchProvider {
  if (typeof window !== "undefined" && (window as TauriRuntimeWindow).__TAURI_INTERNALS__) {
    return createTauriSearchProvider();
  }

  return createLocalPlaceholderSearchProvider({ delayMs: 75 });
}

type TestDesktopFileActionsWindow = Window & {
  __browhereDesktopFileActions?: DesktopFileActions;
};

function createDefaultDesktopFileActions(): DesktopFileActions {
  if (import.meta.env.DEV && typeof window !== "undefined") {
    const testActions = (window as TestDesktopFileActionsWindow)
      .__browhereDesktopFileActions;

    if (testActions) {
      return testActions;
    }
  }

  return createTauriDesktopFileActions();
}
