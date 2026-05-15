import { getGroqConfig } from "@/lib/config";
import type { QueryInterpretation, SearchAnswer, SearchResult } from "@/lib/types";

interface Plan {
  queries: string[];
  intent?: Partial<QueryInterpretation>;
}

export class GroqClient {
  async plan(query: string): Promise<Plan> {
    const config = getGroqConfig();
    if (!config.apiKey) return { queries: [query] };
    const parsed = await this.chatJson({
      system:
        "Return JSON only. Rewrite user search into up to two concise semantic retrieval queries and identify intent. Output {queries:string[], intent:{fileTypes?:string[], folderHints?:string[], quotedTerms?:string[], dateHint?:string, visualIntent?:boolean, ocrIntent?:boolean, answerIntent?:boolean}}. Preserve original query meaning. Do not request more than two rewritten queries.",
      user: JSON.stringify({ query }),
    });
    const queries = Array.isArray(parsed.queries)
      ? parsed.queries.filter((item): item is string => typeof item === "string")
      : [];
    return {
      queries: [query, ...queries].slice(0, config.maxRetrievalPasses),
      intent: parseIntent(parsed.intent),
    };
  }

  async rerank(query: string, candidates: SearchResult[]): Promise<SearchResult[]> {
    const config = getGroqConfig();
    if (!config.apiKey || candidates.length === 0) return candidates;
    const parsed = await this.chatJson({
      system:
        "Return JSON only. Rerank candidate file results for query. Output {results:[{id,reason}]} using only provided ids. Use contextSource to distinguish extracted text, AI visual captions, OCR text, raw image vectors, filename/path, and metadata. Do not imply AI-generated or OCR-derived evidence is human-authored. If a candidate is an unconfirmed visual match, you cannot inspect pixels; do not claim no relevance solely because no caption exists. Keep it as an unconfirmed visual match when its vector score/source supports retrieval.",
      user: JSON.stringify({
        query,
        candidates: candidates.map((candidate) => ({
          id: candidate.id,
          filePath: candidate.filePath,
          displayName: candidate.displayName,
          fileType: candidate.fileType,
          contextSource: candidate.matchContext.kind,
          contextSources: candidate.matchContext.sources ?? [candidate.matchContext.kind],
          score: candidate.score,
          scoreComponents: candidate.scoreComponents,
          confirmed: candidate.matchContext.confirmed ?? true,
          unconfirmedReason: candidate.matchContext.unconfirmedReason,
          snippet: candidate.matchContext.text.slice(0, 900),
          metadata: candidate.metadata,
        })),
      }),
    });
    const order = Array.isArray(parsed.results) ? parsed.results : [];
    const byId = new Map(candidates.map((candidate) => [candidate.id, candidate]));
    const reranked: SearchResult[] = [];
    for (const item of order) {
      if (!item || typeof item.id !== "string") continue;
      const candidate = byId.get(item.id);
      if (!candidate) continue;
      reranked.push({
        ...candidate,
        matchContext: {
          kind: "explanation",
          text:
            typeof item.reason === "string" && item.reason.trim()
              ? item.reason.trim()
              : candidate.matchContext.text,
          sources: candidate.matchContext.sources,
          confirmed: candidate.matchContext.confirmed,
          unconfirmedReason: candidate.matchContext.unconfirmedReason,
        },
      });
      byId.delete(item.id);
    }
    return [...reranked, ...byId.values()].map((result, index) => ({
      ...result,
      rank: index + 1,
    }));
  }

  async answer(
    query: string,
    evidence: Array<{ label: string; text: string; filePath: string; provenance: string }>,
  ): Promise<Pick<SearchAnswer, "status" | "text"> & { citationLabels: string[] }> {
    const config = getGroqConfig();
    if (!config.apiKey) {
      return { status: "providerUnavailable", citationLabels: [] };
    }
    if (evidence.length === 0) {
      return { status: "insufficientEvidence", citationLabels: [] };
    }
    const parsed = await this.chatJson({
      system:
        "Return JSON only. Answer using only provided evidence. If evidence is insufficient, output {status:\"insufficientEvidence\", answer:\"\", citations:[]}. Otherwise output {status:\"answered\", answer:string, citations:string[]} where citations are evidence labels like E1. Every factual claim must be supported by citations. Do not use outside knowledge.",
      user: JSON.stringify({ query, evidence }),
    });
    const status = parsed.status === "answered" ? "answered" : "insufficientEvidence";
    const text = typeof parsed.answer === "string" ? parsed.answer.trim() : undefined;
    const citationLabels = Array.isArray(parsed.citations)
      ? parsed.citations.filter((item): item is string => typeof item === "string")
      : [];
    return { status, text, citationLabels };
  }

  private async chatJson(input: { system: string; user: string }): Promise<Record<string, unknown>> {
    const config = getGroqConfig();
    const response = await fetch(config.endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: config.model,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: input.system },
          { role: "user", content: input.user },
        ],
      }),
    });
    if (!response.ok) {
      throw new Error(`Groq request failed: ${response.status} ${await response.text()}`);
    }
    const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = data.choices?.[0]?.message?.content ?? "{}";
    return JSON.parse(content) as Record<string, unknown>;
  }
}

export const groq = new GroqClient();

function parseIntent(value: unknown): Partial<QueryInterpretation> | undefined {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  return {
    fileTypes: stringArray(record.fileTypes),
    folderHints: stringArray(record.folderHints),
    quotedTerms: stringArray(record.quotedTerms),
    dateHint: typeof record.dateHint === "string" ? record.dateHint : undefined,
    visualIntent: typeof record.visualIntent === "boolean" ? record.visualIntent : undefined,
    ocrIntent: typeof record.ocrIntent === "boolean" ? record.ocrIntent : undefined,
    answerIntent: typeof record.answerIntent === "boolean" ? record.answerIntent : undefined,
  };
}

function stringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const strings = value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  return strings.length ? strings : undefined;
}
