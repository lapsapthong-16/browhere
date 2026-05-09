import { placeholderResultEntries } from "../data/placeholderResults";
import type {
  Result,
  SearchError,
  SearchProvider,
  SearchQuery,
  SearchResponse,
  SearchResult,
} from "./SearchProvider";

type ScoredResult = {
  result: SearchResult;
  score: number;
};

const tokenPattern = /[a-z0-9]+/g;
const ignoredTokens = new Set(["a", "an", "and", "for", "from", "of", "the", "to"]);
export const placeholderProviderErrorQuery = "__provider_error__";

interface LocalPlaceholderSearchProviderOptions {
  delayMs?: number;
}

export function createLocalPlaceholderSearchProvider(
  options: LocalPlaceholderSearchProviderOptions = {},
): SearchProvider {
  return new LocalPlaceholderSearchProvider(options);
}

export class LocalPlaceholderSearchProvider implements SearchProvider {
  constructor(
    private readonly options: LocalPlaceholderSearchProviderOptions = {},
  ) {}

  async search(
    query: SearchQuery,
  ): Promise<Result<SearchResponse, SearchError>> {
    if (this.options.delayMs !== undefined) {
      await new Promise((resolve) => {
        setTimeout(resolve, this.options.delayMs);
      });
    }

    if (query.text.trim() === placeholderProviderErrorQuery) {
      return {
        ok: false,
        error: {
          kind: "providerUnavailable",
          message: "Search is temporarily unavailable.",
        },
      };
    }

    const tokens = tokenize(query.text);

    if (tokens.length === 0) {
      return {
        ok: false,
        error: {
          kind: "invalidQuery",
          message: "Enter a search query before searching.",
        },
      };
    }

    const results = placeholderResultEntries
      .map(({ result, searchTerms }) => ({
        result,
        score: scoreResult(tokens, result, searchTerms),
      }))
      .filter((entry): entry is ScoredResult => entry.score > 0)
      .sort((left, right) => right.score - left.score || left.result.rank - right.result.rank)
      .map(({ result }, index) => ({
        ...result,
        actions: { ...result.actions },
        matchContext: result.matchContext ? { ...result.matchContext } : undefined,
        availabilityHint: result.availabilityHint
          ? { ...result.availabilityHint }
          : undefined,
        rank: index + 1,
      }));

    return {
      ok: true,
      value: {
        readiness: { kind: "ready" },
        results,
      },
    };
  }
}

function scoreResult(
  queryTokens: readonly string[],
  result: SearchResult,
  searchTerms: readonly string[],
): number {
  const searchableText = [
    result.displayName,
    result.fileType,
    result.filePath,
    result.matchContext?.text,
    ...searchTerms,
  ]
    .filter((value): value is string => typeof value === "string")
    .join(" ")
    .toLowerCase();

  return queryTokens.reduce((score, token) => {
    return searchableText.includes(token) ? score + 1 : score;
  }, 0);
}

function tokenize(query: string): string[] {
  return [...query.toLowerCase().matchAll(tokenPattern)]
    .map(([token]) => token)
    .filter((token) => !ignoredTokens.has(token));
}
