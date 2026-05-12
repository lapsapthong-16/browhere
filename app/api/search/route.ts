import { NextResponse } from "next/server";
import { z } from "zod";
import { searchFiles } from "@/lib/search/search";

const SearchInput = z.object({
  query: z.string().min(1),
  limit: z.number().int().positive().max(50).optional(),
});

export async function POST(request: Request) {
  const input = SearchInput.parse(await request.json());
  return NextResponse.json(await searchFiles(input.query, input.limit ?? 20));
}
