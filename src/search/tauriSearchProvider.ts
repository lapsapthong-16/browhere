import { invoke } from "@tauri-apps/api/core";

import {
  isSearchReadiness,
  isSearchResult,
  type Result,
  type SearchError,
  type SearchProvider,
  type SearchQuery,
  type SearchResponse,
} from "./SearchProvider";

type NativeSearchResponse = SearchResponse;

export interface SearchNativeBridge {
  searchFiles(query: string, limit?: number): Promise<NativeSearchResponse>;
}

const tauriBridge: SearchNativeBridge = {
  searchFiles(query, limit) {
    return invoke<NativeSearchResponse>("search_files", { query, limit });
  },
};

export function createTauriSearchProvider(
  bridge: SearchNativeBridge = tauriBridge,
): SearchProvider {
  return {
    async search(query: SearchQuery): Promise<Result<SearchResponse, SearchError>> {
      try {
        const response = await bridge.searchFiles(query.text, 20);

        if (
          !Array.isArray(response.results) ||
          !response.results.every(isSearchResult) ||
          !isSearchReadiness(response.readiness)
        ) {
          return {
            ok: false,
            error: {
              kind: "unknown",
              message: "Native search returned an invalid response.",
            },
          };
        }

        return { ok: true, value: response };
      } catch (error) {
        return {
          ok: false,
          error: {
            kind: "providerUnavailable",
            message:
              error instanceof Error
                ? error.message
                : "Native search is unavailable.",
          },
        };
      }
    },
  };
}
