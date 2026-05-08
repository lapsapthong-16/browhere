import type {
  SearchError,
  SearchProvider,
  SearchQuery,
  SearchState,
} from "./SearchProvider";

export interface SearchController {
  readonly state: SearchState;
  submit(query: SearchQuery): Promise<SearchState>;
  selectResult(resultId: string): SearchState;
}

export function createSearchController(
  provider: SearchProvider,
): SearchController {
  return new ProviderSearchController(provider);
}

class ProviderSearchController implements SearchController {
  #state: SearchState = { status: "initial", query: "" };

  constructor(private readonly provider: SearchProvider) {}

  get state(): SearchState {
    return this.#state;
  }

  async submit(query: SearchQuery): Promise<SearchState> {
    if (query.text.trim().length === 0) {
      return this.#state;
    }

    const activeQuery = query.text;
    this.#state = { status: "loading", query: activeQuery };

    try {
      const response = await this.provider.search({ text: activeQuery });

      if (!response.ok) {
        this.#state = this.toErrorState(activeQuery, response.error);
        return this.#state;
      }

      if (response.value.results.length === 0) {
        this.#state = {
          status: "empty",
          query: activeQuery,
          readiness: response.value.readiness,
        };
        return this.#state;
      }

      this.#state = {
        status: "results",
        query: activeQuery,
        results: response.value.results,
        readiness: response.value.readiness,
        selectedId: response.value.results[0]?.id,
      };
      return this.#state;
    } catch (error) {
      this.#state = {
        status: "error",
        query: activeQuery,
        message:
          error instanceof Error ? error.message : "Search request failed.",
      };
      return this.#state;
    }
  }

  selectResult(resultId: string): SearchState {
    if (
      this.#state.status !== "results" ||
      !this.#state.results.some((result) => result.id === resultId)
    ) {
      return this.#state;
    }

    this.#state = {
      ...this.#state,
      selectedId: resultId,
    };
    return this.#state;
  }

  private toErrorState(query: string, error: SearchError): SearchState {
    return {
      status: "error",
      query,
      message: error.message,
    };
  }
}
