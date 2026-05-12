import { NextResponse } from "next/server";
import { z } from "zod";
import { addFolder, removeFolder } from "@/lib/indexer/indexer";
import { runtimeState } from "@/lib/indexer/state";

const FolderInput = z.object({ path: z.string().min(1) });

export async function GET() {
  return NextResponse.json(await runtimeState.status());
}

export async function POST(request: Request) {
  const body = FolderInput.parse(await request.json());
  await addFolder(body.path);
  return NextResponse.json(await runtimeState.status("Folder added. Indexing queued."));
}

export async function DELETE(request: Request) {
  const body = FolderInput.parse(await request.json());
  await removeFolder(body.path);
  return NextResponse.json(await runtimeState.status("Folder removed."));
}
