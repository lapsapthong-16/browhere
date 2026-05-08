export type Result<TValue, TError> =
  | { ok: true; value: TValue }
  | { ok: false; error: TError };

export interface SearchQuery {
  text: string;
}

export type MatchContext =
  | { kind: "snippet"; text: string }
  | { kind: "caption"; text: string }
  | { kind: "explanation"; text: string };

export type AvailabilityHint =
  | {
      kind: "partial";
      reason:
        | "indexingPending"
        | "contentLimited"
        | "visualLimited"
        | "providerLimited";
    }
  | {
      kind: "unavailable";
      reason: "notIndexedYet" | "providerUnavailable" | "policyBlocked";
    };

export type SearchReadiness =
  | { kind: "ready" }
  | {
      kind: "notReady";
      reason: "notIndexedYet" | "providerUnavailable" | "policyBlocked";
    };

export interface SearchResult {
  id: string;
  rank: number;
  filePath: string;
  displayName: string;
  fileType: string;
  modifiedAt?: string;
  sizeBytes?: number;
  matchContext?: MatchContext;
  availabilityHint?: AvailabilityHint;
  actions: {
    canOpen: boolean;
    canReveal: boolean;
  };
}

export type ProviderSearchResult = SearchResult & {
  readonly [unsupportedProviderField: string]: unknown;
};

export interface SearchResponse<
  TResult extends SearchResult = SearchResult,
> {
  results: TResult[];
  readiness: SearchReadiness;
}

export type SearchError =
  | { kind: "providerUnavailable"; message: string }
  | { kind: "invalidQuery"; message: string }
  | { kind: "unknown"; message: string };

export type SearchState =
  | { status: "initial"; query: "" }
  | { status: "loading"; query: string }
  | {
      status: "results";
      query: string;
      results: SearchResult[];
      readiness: SearchReadiness;
      selectedId?: string;
    }
  | { status: "empty"; query: string; readiness: SearchReadiness }
  | { status: "error"; query: string; message: string };

export interface SearchProvider<
  TResult extends SearchResult = SearchResult,
> {
  search(query: SearchQuery): Promise<Result<SearchResponse<TResult>, SearchError>>;
}

const partialAvailabilityReasons = new Set([
  "indexingPending",
  "contentLimited",
  "visualLimited",
  "providerLimited",
]);

const unavailableReasons = new Set([
  "notIndexedYet",
  "providerUnavailable",
  "policyBlocked",
]);

export function isMatchContext(value: unknown): value is MatchContext {
  if (!isRecord(value) || typeof value.text !== "string") {
    return false;
  }

  return (
    value.kind === "snippet" ||
    value.kind === "caption" ||
    value.kind === "explanation"
  );
}

export function isAvailabilityHint(value: unknown): value is AvailabilityHint {
  if (!isRecord(value) || typeof value.reason !== "string") {
    return false;
  }

  if (value.kind === "partial") {
    return partialAvailabilityReasons.has(value.reason);
  }

  if (value.kind === "unavailable") {
    return unavailableReasons.has(value.reason);
  }

  return false;
}

export function isSearchReadiness(value: unknown): value is SearchReadiness {
  if (!isRecord(value)) {
    return false;
  }

  if (value.kind === "ready") {
    return true;
  }

  return (
    value.kind === "notReady" &&
    typeof value.reason === "string" &&
    unavailableReasons.has(value.reason)
  );
}

export function isSearchResult(value: unknown): value is SearchResult {
  if (!isRecord(value) || !isRecord(value.actions)) {
    return false;
  }

  const hasRequiredFields =
    typeof value.id === "string" &&
    typeof value.rank === "number" &&
    Number.isFinite(value.rank) &&
    typeof value.filePath === "string" &&
    typeof value.displayName === "string" &&
    typeof value.fileType === "string" &&
    typeof value.actions.canOpen === "boolean" &&
    typeof value.actions.canReveal === "boolean";

  if (!hasRequiredFields) {
    return false;
  }

  return (
    isOptionalString(value.modifiedAt) &&
    isOptionalNumber(value.sizeBytes) &&
    isOptional(value.matchContext, isMatchContext) &&
    isOptional(value.availabilityHint, isAvailabilityHint)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isOptional<TValue>(
  value: unknown,
  guard: (value: unknown) => value is TValue,
): value is TValue | undefined {
  return value === undefined || guard(value);
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === "string";
}

function isOptionalNumber(value: unknown): value is number | undefined {
  return value === undefined || typeof value === "number";
}
