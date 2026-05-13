import { gemini, ProviderUnavailableError } from "@/lib/ai/gemini";
import { groq } from "@/lib/ai/groq";
import { getGroqConfig } from "@/lib/config";
import { repository, type VectorCandidate } from "@/lib/storage/repository";
import type { ChunkRecord, ContextSource, MatchKind, SearchResponse, SearchResult } from "@/lib/types";

type RankedCandidate = VectorCandidate & { lexicalKind?: "filenamePath" };
const UNCONFIRMED_VISUAL_TEXT =
  "Unconfirmed visual match. Matched by image embedding; caption pending/unavailable.";

export async function searchFiles(query: string, limit = 20): Promise<SearchResponse> {
  const trimmed = query.trim();
  if (!trimmed) {
    return { results: [], readiness: { kind: "ready" }, agentic: false };
  }

  try {
    const counts = await repository.getCounts();
    if (counts.chunks === 0) {
      return {
        results: [],
        readiness: { kind: "notReady", reason: "notIndexedYet", message: "Index is empty." },
        agentic: false,
      };
    }

    const plan = await groq.plan(trimmed).catch(() => ({ queries: [trimmed] }));
    const queries = plan.queries.slice(0, getGroqConfig().maxRetrievalPasses);
    const candidates: RankedCandidate[] = [];
    for (const plannedQuery of queries) {
      const vector = await gemini.embedText(plannedQuery);
      candidates.push(...(await repository.vectorSearch(vector, limit * 4)));
    }
    candidates.push(...(await lexicalSearch(trimmed, limit * 4)));
    const grouped = groupCandidates(candidates, limit);
    const reranked = preserveUnconfirmedVisual(
      await groq.rerank(trimmed, grouped).catch(() => grouped),
      grouped,
    );
    return {
      results: reranked.slice(0, limit),
      readiness: { kind: "ready" },
      agentic: Boolean(process.env.GROQ_API_KEY),
    };
  } catch (error) {
    if (error instanceof ProviderUnavailableError) {
      return {
        results: [],
        readiness: {
          kind: "notReady",
          reason: "providerUnavailable",
          message: error.message,
        },
        agentic: false,
      };
    }
    throw error;
  }
}

async function lexicalSearch(query: string, limit: number): Promise<RankedCandidate[]> {
  const chunks = await repository.getChunks();
  return chunks
    .flatMap((chunk) => {
      const score = lexicalScore(query, chunk);
      if (score <= 0) return [];
      const pathText = `${chunk.displayName} ${chunk.filePath}`.toLowerCase();
      return [{
        ...chunk,
        score,
        lexicalKind: pathText.includes(query.toLowerCase()) ? "filenamePath" : undefined,
      } satisfies RankedCandidate];
    })
    .sort((left, right) => right.score - left.score)
    .slice(0, limit);
}

function lexicalScore(query: string, candidate: ChunkRecord): number {
  const normalized = query.toLowerCase().trim();
  const tokens = normalized.split(/\s+/).filter(Boolean);
  if (!tokens.length) return 0;
  const pathText = `${candidate.displayName} ${candidate.filePath}`.toLowerCase();
  const bodyText = `${candidate.text} ${candidate.metadataContext ?? ""}`.toLowerCase();
  if (pathText.includes(normalized)) return 1.15;
  if (bodyText.includes(normalized)) return candidate.contextSource === "metadata" ? 0.85 : 0.95;
  const pathMatches = tokens.filter((token) => pathText.includes(token)).length;
  const bodyMatches = tokens.filter((token) => bodyText.includes(token)).length;
  if (pathMatches) return 0.75 + pathMatches / tokens.length / 5;
  if (bodyMatches) return 0.55 + bodyMatches / tokens.length / 5;
  return 0;
}

function groupCandidates(candidates: RankedCandidate[], limit: number): SearchResult[] {
  const best = new Map<string, { candidate: RankedCandidate; sources: Set<ContextSource>; contexts: RankedCandidate[] }>();
  for (const candidate of candidates) {
    const source = sourceFor(candidate);
    const previous = best.get(candidate.fileId);
    if (!previous) {
      best.set(candidate.fileId, { candidate, sources: new Set([source]), contexts: [candidate] });
    } else {
      previous.sources.add(source);
      previous.contexts.push(candidate);
      if (candidate.score > previous.candidate.score) {
        previous.candidate = candidate;
      }
    }
  }
  return [...best.values()]
    .sort((left, right) => right.candidate.score - left.candidate.score)
    .slice(0, limit)
    .map(({ candidate, sources, contexts }, index) => {
      const unconfirmedVisual = isUnconfirmedVisual(candidate, contexts);
      const text = contextText(candidate, contexts);
      const kind = matchKindFor(candidate, unconfirmedVisual);
      return {
        id: candidate.fileId,
        rank: index + 1,
        filePath: candidate.filePath,
        displayName: candidate.displayName,
        fileType: candidate.fileType,
        sizeBytes: candidate.sizeBytes,
        score: candidate.score,
        matchContext: {
          kind,
          text,
          sources: [...sources],
          confirmed: !unconfirmedVisual,
          unconfirmedReason: unconfirmedVisual ? "Image caption is pending or unavailable." : undefined,
        },
        metadata: safeMetadata(candidate),
        readiness: candidate.status === "partial" ? "partial" : "ready",
      };
    });
}

function preserveUnconfirmedVisual(reranked: SearchResult[], original: SearchResult[]): SearchResult[] {
  const originals = new Map(original.map((result) => [result.id, result]));
  return reranked.map((result, index) => {
    const prior = originals.get(result.id);
    const isUnconfirmed = prior?.matchContext.kind === "unconfirmedVisual";
    const text = result.matchContext.text.toLowerCase();
    const falseNegative =
      text.includes("no relevance") || text.includes("not analyzed") || text.includes("cannot determine");
    if (!isUnconfirmed || !falseNegative) {
      return { ...result, rank: index + 1 };
    }
    return {
      ...result,
      rank: index + 1,
      matchContext: prior.matchContext,
    };
  });
}

function sourceFor(candidate: VectorCandidate): ContextSource {
  if (candidate.contextSource) return candidate.contextSource;
  if (candidate.recordKind === "rawImage" || candidate.kind === "image") return "rawImageVector";
  if (candidate.recordKind === "imageLabel") return "imageLabel";
  if (candidate.recordKind === "metadata") return "metadata";
  return "extractedText";
}

function matchKindFor(candidate: RankedCandidate, unconfirmedVisual: boolean): MatchKind {
  if (unconfirmedVisual) return "unconfirmedVisual";
  if (candidate.lexicalKind) return candidate.lexicalKind;
  return sourceFor(candidate);
}

function isUnconfirmedVisual(best: RankedCandidate, contexts: RankedCandidate[]): boolean {
  return sourceFor(best) === "rawImageVector" && !contexts.some((item) => sourceFor(item) === "imageLabel");
}

function contextText(best: RankedCandidate, contexts: RankedCandidate[]): string {
  if (isUnconfirmedVisual(best, contexts)) return UNCONFIRMED_VISUAL_TEXT;
  const preferred =
    nonEmpty(contexts.find((item) => sourceFor(item) === "imageLabel")?.text) ??
    nonEmpty(best.text) ??
    nonEmpty(contexts.find((item) => sourceFor(item) === "metadata")?.text) ??
    nonEmpty(best.metadataContext) ??
    best.displayName;
  return preferred;
}

function nonEmpty(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function safeMetadata(candidate: VectorCandidate): SearchResult["metadata"] {
  const metadata = candidate.metadata;
  if (!metadata) return undefined;
  return {
    displayName: metadata.displayName,
    extension: metadata.extension,
    mediaType: metadata.mediaType,
    sizeBytes: metadata.sizeBytes,
    modifiedDate: metadata.modifiedDate,
    parentFolders: metadata.parentFolders,
    imageWidth: metadata.imageWidth,
    imageHeight: metadata.imageHeight,
  };
}
