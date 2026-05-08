import type { Result, SearchResult } from "../search/SearchProvider";

export type FileActionError =
  | { kind: "notAllowed"; message: string }
  | { kind: "notFound"; message: string }
  | { kind: "osFailure"; message: string };

export type FileActionResult = Result<void, FileActionError>;

export interface DesktopFileActions {
  openFile(result: SearchResult): Promise<FileActionResult>;
  revealInFolder(result: SearchResult): Promise<FileActionResult>;
}

