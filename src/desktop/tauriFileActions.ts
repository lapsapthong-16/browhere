import { invoke } from "@tauri-apps/api/core";

import type { SearchResult } from "../search/SearchProvider";
import type {
  DesktopFileActions,
  FileActionError,
  FileActionResult,
} from "./DesktopFileActions";

type NativeFileActionResult =
  | { ok: true; error?: never }
  | { ok: false; error: FileActionError };

export interface FileActionNativeBridge {
  openFile(filePath: string): Promise<NativeFileActionResult>;
  revealInFolder(filePath: string): Promise<NativeFileActionResult>;
}

const tauriBridge: FileActionNativeBridge = {
  openFile(filePath) {
    return invoke<NativeFileActionResult>("open_file", { filePath });
  },
  revealInFolder(filePath) {
    return invoke<NativeFileActionResult>("reveal_in_folder", { filePath });
  },
};

export function createTauriDesktopFileActions(
  bridge: FileActionNativeBridge = tauriBridge,
): DesktopFileActions {
  return {
    async openFile(result) {
      if (!result.actions.canOpen) {
        return fileActionFailure({
          kind: "notAllowed",
          message: `Opening is not available for ${result.displayName}.`,
        });
      }

      return runNativeAction(() => bridge.openFile(result.filePath));
    },

    async revealInFolder(result) {
      if (!result.actions.canReveal) {
        return fileActionFailure({
          kind: "notAllowed",
          message: `Reveal in folder is not available for ${result.displayName}.`,
        });
      }

      return runNativeAction(() => bridge.revealInFolder(result.filePath));
    },
  };
}

async function runNativeAction(
  action: () => Promise<NativeFileActionResult>,
): Promise<FileActionResult> {
  try {
    const response = await action();

    if (response.ok) {
      return { ok: true, value: undefined };
    }

    return fileActionFailure(response.error);
  } catch (error) {
    return fileActionFailure({
      kind: "osFailure",
      message: error instanceof Error ? error.message : "The operating system action failed.",
    });
  }
}

function fileActionFailure(error: FileActionError): FileActionResult {
  return { ok: false, error };
}
