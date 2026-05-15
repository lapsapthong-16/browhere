import { gemini, ProviderUnavailableError } from "@/lib/ai/gemini";
import { groq } from "@/lib/ai/groq";
import { getGroqConfig, getRetrievalConfig, SUPPORTED_EXTENSIONS } from "@/lib/config";
import { repository, type VectorCandidate } from "@/lib/storage/repository";
import type { AnswerCitation, ChunkRecord, ContextSource, EvidenceProvenance, MatchKind, QueryInterpretation, ScoreComponents, SearchAnswer, SearchOptions, SearchResponse, SearchResult } from "@/lib/types";

type RankedCandidate = VectorCandidate & { lexicalKind?: "filenamePath"; scoreComponents?: ScoreComponents };
const UNCONFIRMED_VISUAL_TEXT =
  "Unconfirmed visual match. Matched by image embedding; caption pending/unavailable.";

export async function searchFiles(query: string, limitOrOptions: number | SearchOptions = 20): Promise<SearchResponse> {
  const trimmed = query.trim();
  const options = resolveSearchOptions(limitOrOptions);
  let interpretation = interpretQuery(trimmed);
  if (!trimmed) {
    return {
      results: [],
      readiness: { kind: "ready" },
      agentic: false,
      queryInterpretation: interpretation,
      diagnostics: emptyDiagnostics(options),
    };
  }

  try {
    const counts = await repository.getCounts();
    if (counts.chunks === 0) {
      return {
        results: [],
        readiness: { kind: "notReady", reason: "notIndexedYet", message: "Index is empty." },
        agentic: false,
        queryInterpretation: interpretation,
        diagnostics: emptyDiagnostics(options),
      };
    }

    const plan = await groq.plan(trimmed).catch(() => ({ queries: [trimmed], intent: undefined }));
    interpretation = mergeQueryIntent(interpretation, plan.intent);
    const queries = [...new Set([trimmed, ...plan.queries])].slice(0, options.maxRetrievalPasses);
    const candidates: RankedCandidate[] = [];
    const retrievalPasses: NonNullable<SearchResponse["diagnostics"]>["retrievalPasses"] = [];
    for (const plannedQuery of queries) {
      const vector = await gemini.embedText(plannedQuery);
      const semanticCandidates = await repository.vectorSearch(vector, options.semanticTopK);
      retrievalPasses.push({ query: plannedQuery, semanticCandidateCount: semanticCandidates.length });
      candidates.push(...semanticCandidates.map((candidate) => scoreCandidate(trimmed, candidate, interpretation)));
    }
    const lexicalCandidates = (await lexicalSearch(trimmed, options.lexicalTopK))
      .map((candidate) => scoreCandidate(trimmed, candidate, interpretation));
    candidates.push(...lexicalCandidates);
    const capped = capCandidatesBySource(candidates, options.sourceCaps);
    const grouped = groupCandidates(capped, options.finalLimit);
    const reranked = preserveUnconfirmedVisual(
      await groq.rerank(trimmed, grouped).catch(() => grouped),
      grouped,
    );
    const answer = options.answer || interpretation.answerIntent
      ? await generateAnswer(trimmed, reranked.slice(0, options.finalLimit), options.answerContextBudget)
      : undefined;
    return {
      results: reranked.slice(0, options.finalLimit),
      readiness: { kind: "ready" },
      agentic: Boolean(process.env.GROQ_API_KEY),
      queryInterpretation: interpretation,
      diagnostics: {
        retrievalPasses,
        lexicalCandidateCount: lexicalCandidates.length,
        groupedResultCount: grouped.length,
        omittedCandidateCount: candidates.length - capped.length,
        options,
      },
      answer,
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
        queryInterpretation: interpretation,
        diagnostics: emptyDiagnostics(options),
      };
    }
    throw error;
  }
}

export function resolveSearchOptions(input: number | SearchOptions = {}): Required<Omit<SearchOptions, "sourceCaps" | "answer">> & Pick<SearchOptions, "sourceCaps" | "answer"> {
  const config = getRetrievalConfig();
  const requested = typeof input === "number" ? { finalLimit: input } : input;
  return {
    finalLimit: clampInt(requested.finalLimit, 1, config.maxFinalLimit, config.finalLimit),
    semanticTopK: clampInt(requested.semanticTopK, 1, config.maxSemanticTopK, config.semanticTopK),
    lexicalTopK: clampInt(requested.lexicalTopK, 1, config.maxLexicalTopK, config.lexicalTopK),
    maxRetrievalPasses: clampInt(requested.maxRetrievalPasses, 1, getGroqConfig().maxRetrievalPasses, config.maxRetrievalPasses),
    answerContextBudget: clampInt(
      requested.answerContextBudget,
      500,
      config.maxAnswerContextBudget,
      config.answerContextBudget,
    ),
    sourceCaps: requested.sourceCaps,
    answer: requested.answer,
  };
}

export function interpretQuery(query: string): QueryInterpretation {
  const lower = query.toLowerCase();
  const quotedTerms = [...query.matchAll(/"([^"]+)"/g)].map((match) => match[1]).filter(Boolean);
  const fileTypes = [...SUPPORTED_EXTENSIONS].filter((ext) =>
    new RegExp(`\\b(?:${ext}|\\.${ext})\\b`, "i").test(query),
  );
  const folderHints = [...query.matchAll(/\b(?:from|in|under)\s+([a-z0-9._ -]+?)\s+(?:folder|directory)\b/gi)]
    .map((match) => match[1]?.trim())
    .filter((value): value is string => Boolean(value));
  const visualIntent = /\b(image|photo|picture|screenshot|logo|scene|visual|looks like)\b/i.test(query);
  const ocrIntent = /\b(readable text|text visible|sign|label|menu|receipt|screenshot|ocr|words?)\b/i.test(query);
  const answerIntent = /\b(what|why|how|when|where|who|summari[sz]e|answer|explain)\b/i.test(query) || lower.startsWith("answer:");
  const semanticQuery = query.replace(/^answer:\s*/i, "").trim();
  return {
    originalQuery: query,
    semanticQueries: semanticQuery ? [semanticQuery] : [],
    fileTypes: fileTypes.length ? fileTypes : undefined,
    folderHints: folderHints.length ? folderHints : undefined,
    quotedTerms: quotedTerms.length ? quotedTerms : undefined,
    dateHint: /\b(?:today|yesterday|last week|last month|\d{4}-\d{2}-\d{2})\b/i.exec(query)?.[0],
    visualIntent,
    ocrIntent,
    answerIntent,
  };
}

function clampInt(value: number | undefined, min: number, max: number, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return Math.min(max, Math.max(min, Math.trunc(fallback)));
  return Math.min(max, Math.max(min, Math.trunc(value)));
}

function emptyDiagnostics(options: ReturnType<typeof resolveSearchOptions>): NonNullable<SearchResponse["diagnostics"]> {
  return {
    retrievalPasses: [],
    lexicalCandidateCount: 0,
    groupedResultCount: 0,
    options,
  };
}

function mergeQueryIntent(
  local: QueryInterpretation,
  agentIntent: Partial<QueryInterpretation> | undefined,
): QueryInterpretation {
  if (!agentIntent) return local;
  return {
    ...local,
    fileTypes: mergeStrings(local.fileTypes, agentIntent.fileTypes),
    folderHints: mergeStrings(local.folderHints, agentIntent.folderHints),
    quotedTerms: mergeStrings(local.quotedTerms, agentIntent.quotedTerms),
    dateHint: local.dateHint ?? agentIntent.dateHint,
    visualIntent: local.visualIntent || Boolean(agentIntent.visualIntent),
    ocrIntent: local.ocrIntent || Boolean(agentIntent.ocrIntent),
    answerIntent: local.answerIntent || Boolean(agentIntent.answerIntent),
  };
}

function mergeStrings(left: string[] | undefined, right: string[] | undefined): string[] | undefined {
  const merged = [...new Set([...(left ?? []), ...(right ?? [])])];
  return merged.length ? merged : undefined;
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

function scoreCandidate(query: string, candidate: RankedCandidate, interpretation: QueryInterpretation): RankedCandidate {
  const vector = candidate.lexicalKind ? 0 : Math.max(0, Math.min(1, candidate.score));
  const lexical = lexicalScore(query, candidate);
  const filenamePath = candidate.lexicalKind ? lexical : filenamePathScore(query, candidate);
  const metadata = metadataScore(query, candidate, interpretation);
  const sourceConfidence = sourceConfidenceScore(sourceFor(candidate));
  const filter = filterScore(candidate, interpretation);
  const boost = intentBoost(candidate, interpretation);
  const final =
    vector * 0.55 +
    lexical * 0.2 +
    filenamePath * 0.12 +
    metadata * 0.08 +
    sourceConfidence * 0.03 +
    filter +
    boost;
  return {
    ...candidate,
    score: final,
    scoreComponents: {
      vector,
      lexical,
      filenamePath,
      metadata,
      sourceConfidence,
      filter,
      boost,
      final,
    },
  };
}

function filenamePathScore(query: string, candidate: ChunkRecord): number {
  const normalized = query.toLowerCase().trim();
  const text = `${candidate.displayName} ${candidate.filePath}`.toLowerCase();
  if (text.includes(normalized)) return 1;
  const tokens = normalized.split(/\s+/).filter(Boolean);
  if (!tokens.length) return 0;
  return tokens.filter((token) => text.includes(token)).length / tokens.length;
}

function metadataScore(query: string, candidate: ChunkRecord, interpretation: QueryInterpretation): number {
  const metadataText = `${candidate.metadataContext ?? ""} ${candidate.metadata?.parentFolders?.join(" ") ?? ""}`.toLowerCase();
  const tokens = [
    ...query.toLowerCase().split(/\s+/).filter(Boolean),
    ...(interpretation.folderHints ?? []).map((hint) => hint.toLowerCase()),
  ];
  if (!tokens.length) return 0;
  return Math.min(1, tokens.filter((token) => metadataText.includes(token)).length / tokens.length);
}

function sourceConfidenceScore(source: ContextSource): number {
  if (source === "extractedText") return 1;
  if (source === "imageOcrText") return 0.85;
  if (source === "imageVisualCaption" || source === "imageLabel") return 0.75;
  if (source === "metadata") return 0.65;
  return 0.45;
}

function filterScore(candidate: ChunkRecord, interpretation: QueryInterpretation): number {
  let score = 0;
  if (interpretation.fileTypes?.includes(candidate.fileType)) score += 0.12;
  if (interpretation.folderHints?.some((hint) => candidate.filePath.toLowerCase().includes(hint.toLowerCase()))) {
    score += 0.12;
  }
  return score;
}

function intentBoost(candidate: RankedCandidate, interpretation: QueryInterpretation): number {
  const source = sourceFor(candidate);
  if (interpretation.ocrIntent && source === "imageOcrText") return 0.15;
  if (interpretation.visualIntent && (source === "imageVisualCaption" || source === "rawImageVector")) return 0.1;
  return 0;
}

function capCandidatesBySource(candidates: RankedCandidate[], caps: SearchOptions["sourceCaps"]): RankedCandidate[] {
  if (!caps) return candidates;
  const counts = new Map<ContextSource, number>();
  return candidates
    .sort((left, right) => right.score - left.score)
    .filter((candidate) => {
      const source = sourceFor(candidate);
      const cap = caps[source];
      if (!cap) return true;
      const count = counts.get(source) ?? 0;
      if (count >= cap) return false;
      counts.set(source, count + 1);
      return true;
    });
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
          evidenceId: candidate.evidenceId ?? candidate.id,
          provenance: candidate.provenance,
          location: candidate.location,
        },
        evidence: contexts.slice(0, 5).map((item) => ({
          evidenceId: item.evidenceId ?? item.id,
          text: item.text,
          source: sourceFor(item),
          provenance: item.provenance ?? provenanceForSource(sourceFor(item)),
          location: item.location,
          scoreComponents: item.scoreComponents,
        })),
        scoreComponents: candidate.scoreComponents,
        metadata: safeMetadata(candidate),
        readiness: candidate.status === "partial" ? "partial" : "ready",
      };
    });
}

function provenanceForSource(source: ContextSource) {
  if (source === "rawImageVector") return "raw-visual";
  if (source === "imageOcrText") return "ocr";
  if (source === "imageLabel" || source === "imageVisualCaption") return "ai-visual-caption";
  if (source === "metadata") return "metadata";
  return "human-authored";
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

async function generateAnswer(query: string, results: SearchResult[], budget: number): Promise<SearchAnswer> {
  const contextPack = buildAnswerContextPack(results, budget);
  if (contextPack.evidence.length === 0) {
    return {
      status: "insufficientEvidence",
      citations: [],
      evidenceIds: [],
      message: "No retrieved evidence was available for answer generation.",
    };
  }
  const answer = await groq.answer(query, contextPack.evidence).catch(() => ({
    status: "providerUnavailable" as const,
    citationLabels: [],
  }));
  if (answer.status === "providerUnavailable") {
    return {
      status: "providerUnavailable",
      citations: [],
      evidenceIds: contextPack.evidence.map((item) => item.evidenceId),
      message: "Answer generation is unavailable.",
    };
  }
  if (answer.status === "insufficientEvidence" || !answer.text) {
    return {
      status: "insufficientEvidence",
      citations: [],
      evidenceIds: contextPack.evidence.map((item) => item.evidenceId),
      message: "Retrieved evidence did not support an answer.",
    };
  }
  const citations = mapCitationLabels(answer.citationLabels, contextPack.citations);
  if (citations.length === 0) {
    return {
      status: "insufficientEvidence",
      citations: [],
      evidenceIds: contextPack.evidence.map((item) => item.evidenceId),
      message: "Answer omitted valid citations.",
    };
  }
  return {
    status: "answered",
    text: answer.text,
    citations,
    evidenceIds: citations.map((citation) => citation.evidenceId),
  };
}

function buildAnswerContextPack(results: SearchResult[], budget: number): {
  evidence: Array<{ label: string; evidenceId: string; text: string; filePath: string; provenance: EvidenceProvenance }>;
  citations: AnswerCitation[];
} {
  const evidence: Array<{ label: string; evidenceId: string; text: string; filePath: string; provenance: EvidenceProvenance }> = [];
  const citations: AnswerCitation[] = [];
  const seen = new Set<string>();
  let used = 0;
  for (const result of results) {
    for (const item of result.evidence ?? []) {
      if (seen.has(item.evidenceId)) continue;
      const text = item.text.slice(0, 900);
      if (!text.trim()) continue;
      if (used + text.length > budget && evidence.length > 0) continue;
      const label = `E${evidence.length + 1}`;
      seen.add(item.evidenceId);
      used += text.length;
      evidence.push({
        label,
        evidenceId: item.evidenceId,
        text,
        filePath: result.filePath,
        provenance: item.provenance,
      });
      citations.push({
        label,
        filePath: result.filePath,
        evidenceId: item.evidenceId,
        provenance: item.provenance,
        location: item.location,
        snippet: text,
      });
    }
  }
  return { evidence, citations };
}

function mapCitationLabels(labels: string[], citations: AnswerCitation[]): AnswerCitation[] {
  const byLabel = new Map(citations.map((citation) => [citation.label, citation]));
  return [...new Set(labels)].flatMap((label) => {
    const citation = byLabel.get(label);
    return citation ? [citation] : [];
  });
}

function sourceFor(candidate: VectorCandidate): ContextSource {
  if (candidate.contextSource) return candidate.contextSource;
  if (candidate.recordKind === "rawImage" || candidate.kind === "image") return "rawImageVector";
  if (candidate.recordKind === "imageLabel" || candidate.recordKind === "imageVisualCaption") {
    return "imageVisualCaption";
  }
  if (candidate.recordKind === "imageOcrText") return "imageOcrText";
  if (candidate.recordKind === "metadata") return "metadata";
  return "extractedText";
}

function matchKindFor(candidate: RankedCandidate, unconfirmedVisual: boolean): MatchKind {
  if (unconfirmedVisual) return "unconfirmedVisual";
  if (candidate.lexicalKind) return candidate.lexicalKind;
  return sourceFor(candidate);
}

function isUnconfirmedVisual(best: RankedCandidate, contexts: RankedCandidate[]): boolean {
  return (
    sourceFor(best) === "rawImageVector" &&
    !contexts.some((item) => sourceFor(item) === "imageVisualCaption" || sourceFor(item) === "imageLabel")
  );
}

function contextText(best: RankedCandidate, contexts: RankedCandidate[]): string {
  if (isUnconfirmedVisual(best, contexts)) return UNCONFIRMED_VISUAL_TEXT;
  const preferred =
    nonEmpty(contexts.find((item) => sourceFor(item) === "imageOcrText")?.text) ??
    nonEmpty(contexts.find((item) => sourceFor(item) === "imageVisualCaption" || sourceFor(item) === "imageLabel")?.text) ??
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
