import { gemini, ProviderUnavailableError } from "@/lib/ai/gemini";
import { groq } from "@/lib/ai/groq";
import { getGroqConfig } from "@/lib/config";
import { repository, type VectorCandidate } from "@/lib/storage/repository";
import type { SearchResponse, SearchResult } from "@/lib/types";

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
  const best = new Map<string, VectorCandidate>();
  for (const candidate of candidates) {
    const previous = best.get(candidate.fileId);
    if (!previous || candidate.score > previous.score) {
      best.set(candidate.fileId, candidate);
    }
  }
  return [...best.values()]
    .sort((left, right) => right.score - left.score)
    .slice(0, limit)
    .map((candidate, index) => ({
      id: candidate.fileId,
      rank: index + 1,
      filePath: candidate.filePath,
      displayName: candidate.displayName,
      fileType: candidate.fileType,
      sizeBytes: candidate.sizeBytes,
      score: candidate.score,
      matchContext: {
        kind: candidate.kind === "image" ? "caption" : "snippet",
        text: candidate.text,
      },
      readiness: candidate.status === "partial" ? "partial" : "ready",
    }));
}
