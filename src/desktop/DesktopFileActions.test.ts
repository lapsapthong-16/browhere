import type { SearchResult } from "../search/SearchProvider";
import {
  createTauriDesktopFileActions,
  type FileActionNativeBridge,
} from "./tauriFileActions";

const baseResult: SearchResult = {
  id: "result-1",
  rank: 1,
  filePath: "C:\\Users\\edw\\Documents\\report.pdf",
  displayName: "report.pdf",
  fileType: "pdf",
  actions: {
    canOpen: true,
    canReveal: true,
  },
};

describe("DesktopFileActions", () => {
  it("does not invoke native open behavior when the result is not eligible", async () => {
    const bridge = createMockBridge();
    const actions = createTauriDesktopFileActions(bridge);

    const response = await actions.openFile({
      ...baseResult,
      actions: { ...baseResult.actions, canOpen: false },
    });

    expect(response).toEqual({
      ok: false,
      error: {
        kind: "notAllowed",
        message: "Opening is not available for report.pdf.",
      },
    });
    expect(bridge.openFile).not.toHaveBeenCalled();
  });

  it("maps native not-found failures to typed reveal errors", async () => {
    const bridge = createMockBridge({
      revealInFolder: vi.fn().mockResolvedValue({
        ok: false,
        error: {
          kind: "notFound",
          message: "The file could not be accessed.",
        },
      }),
    });
    const actions = createTauriDesktopFileActions(bridge);

    const response = await actions.revealInFolder(baseResult);

    expect(response).toEqual({
      ok: false,
      error: {
        kind: "notFound",
        message: "The file could not be accessed.",
      },
    });
    expect(bridge.revealInFolder).toHaveBeenCalledWith(baseResult.filePath);
  });

  it("returns typed OS failures instead of throwing through UI state", async () => {
    const bridge = createMockBridge({
      openFile: vi.fn().mockRejectedValue(new Error("ShellExecute failed")),
    });
    const actions = createTauriDesktopFileActions(bridge);

    await expect(actions.openFile(baseResult)).resolves.toEqual({
      ok: false,
      error: {
        kind: "osFailure",
        message: "ShellExecute failed",
      },
    });
  });
});

function createMockBridge(
  overrides: Partial<FileActionNativeBridge> = {},
): FileActionNativeBridge {
  return {
    openFile: vi.fn().mockResolvedValue({ ok: true, value: undefined }),
    revealInFolder: vi.fn().mockResolvedValue({ ok: true, value: undefined }),
    ...overrides,
  };
}
