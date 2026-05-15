import { NextResponse } from "next/server";
import { z } from "zod";
import { runRepairQueue } from "@/lib/indexer/indexer";
import { searchFiles } from "@/lib/search/search";

const SearchInput = z.object({
  query: z.string().min(1),
  limit: z.number().int().positive().max(50).optional(),
  retrieval: z.object({
    finalLimit: z.number().int().positive().optional(),
    semanticTopK: z.number().int().positive().optional(),
    lexicalTopK: z.number().int().positive().optional(),
    maxRetrievalPasses: z.number().int().positive().optional(),
    answerContextBudget: z.number().int().positive().optional(),
    sourceCaps: z.record(z.number().int().positive()).optional(),
    answer: z.boolean().optional(),
  }).optional(),
  answer: z.boolean().optional(),
});

export async function POST(request: Request) {
  void runRepairQueue();
  const input = SearchInput.parse(await request.json());
  return NextResponse.json(await searchFiles(input.query, {
    ...input.retrieval,
    finalLimit: input.retrieval?.finalLimit ?? input.limit,
    answer: input.answer ?? input.retrieval?.answer,
  }));
}
