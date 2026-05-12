import { NextResponse } from "next/server";
import { ensureWatchers } from "@/lib/indexer/indexer";
import { runtimeState } from "@/lib/indexer/state";

export async function GET() {
  await ensureWatchers();
  return NextResponse.json(await runtimeState.status());
}
