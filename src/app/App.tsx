import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { SearchBox } from "../components/SearchBox";
import { createLocalPlaceholderSearchProvider } from "../search/LocalPlaceholderSearchProvider";
import { createSearchController } from "../search/SearchController";
import type { SearchProvider, SearchState } from "../search/SearchProvider";

interface AppProps {
  searchProvider?: SearchProvider;
}

export function App({ searchProvider }: AppProps) {
  const queryInputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [searchState, setSearchState] = useState<SearchState>({
    status: "initial",
    query: "",
  });
  const activeSearchIdRef = useRef(0);
  const provider = useMemo(
    () => searchProvider ?? createLocalPlaceholderSearchProvider(),
    [searchProvider],
  );
  const controller = useMemo(() => createSearchController(provider), [provider]);

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
    setSearchState({ status: "loading", query: activeQuery });

    void controller.submit({ text: activeQuery }).then((nextState) => {
      if (activeSearchIdRef.current === searchId) {
        setSearchState(nextState);
        queryInputRef.current?.focus();
      }
    });
  }, [controller, query]);

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
        <SearchFeedback state={searchState} />
      </section>
    </main>
  );
}

function SearchFeedback({ state }: { state: SearchState }) {
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
      <p id="search-feedback" className="search-feedback" aria-live="polite">
        No results found for "{state.query}".
      </p>
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
