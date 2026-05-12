import { getGroqConfig } from "@/lib/config";
import type { SearchResult } from "@/lib/types";

interface Plan {
  queries: string[];
}

export class GroqClient {
  async plan(query: string): Promise<Plan> {
    const config = getGroqConfig();
    if (!config.apiKey) return { queries: [query] };
    const parsed = await this.chatJson({
      system: "Return JSON only. Rewrite user search into up to two concise semantic retrieval queries.",
      user: JSON.stringify({ query }),
    });
    const queries = Array.isArray(parsed.queries)
      ? parsed.queries.filter((item): item is string => typeof item === "string")
      : [];
    return { queries: [query, ...queries].slice(0, config.maxRetrievalPasses) };
  }

  async rerank(query: string, candidates: SearchResult[]): Promise<SearchResult[]> {
    const config = getGroqConfig();
    if (!config.apiKey || candidates.length === 0) return candidates;
    const parsed = await this.chatJson({
      system:
        "Return JSON only. Rerank candidate file results for query. Output {results:[{id,reason}]} using only provided ids.",
      user: JSON.stringify({
        query,
        candidates: candidates.map((candidate) => ({
          id: candidate.id,
          filePath: candidate.filePath,
          displayName: candidate.displayName,
          fileType: candidate.fileType,
          snippet: candidate.matchContext.text.slice(0, 900),
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
        },
      });
      byId.delete(item.id);
    }
    return [...reranked, ...byId.values()].map((result, index) => ({
      ...result,
      rank: index + 1,
    }));
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
