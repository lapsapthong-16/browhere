import { gemini, ProviderUnavailableError } from "@/lib/ai/gemini";
import { groq } from "@/lib/ai/groq";
import { getGroqConfig } from "@/lib/config";
import { repository, type VectorCandidate } from "@/lib/storage/repository";
import type { ContextSource, SearchResponse, SearchResult } from "@/lib/types";

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
    const candidates: VectorCandidate[] = [];
    for (const plannedQuery of queries) {
      const vector = await gemini.embedText(plannedQuery);
      candidates.push(...(await repository.vectorSearch(vector, limit * 4)));
    }
    const grouped = groupCandidates(candidates, limit);
    const reranked = await groq.rerank(trimmed, grouped).catch(() => grouped);
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

function groupCandidates(candidates: VectorCandidate[], limit: number): SearchResult[] {
  const best = new Map<string, { candidate: VectorCandidate; sources: Set<ContextSource>; contexts: VectorCandidate[] }>();
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
      const text = contextText(candidate, contexts);
      return {
        id: candidate.fileId,
        rank: index + 1,
        filePath: candidate.filePath,
        displayName: candidate.displayName,
        fileType: candidate.fileType,
        sizeBytes: candidate.sizeBytes,
        score: candidate.score,
        matchContext: {
          kind: sourceFor(candidate),
          text,
          sources: [...sources],
        },
        metadata: safeMetadata(candidate),
        readiness: candidate.status === "partial" ? "partial" : "ready",
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

function contextText(best: VectorCandidate, contexts: VectorCandidate[]): string {
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
