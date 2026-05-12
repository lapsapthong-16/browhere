import { fireEvent, screen, waitFor, within } from "../test/test-utils";
import { renderWithAppProviders } from "../test/test-utils";

import { IndexSettingsPanel } from "./IndexSettingsPanel";
import type {
  AiSettingsInput,
  FileIndexStatus,
  IndexStatus,
  NativeSettingsBridge,
  SettingsResponse,
} from "../desktop/nativeSettings";

describe("IndexSettingsPanel", () => {
  it("renders fixed Gemini/Groq runtime and folder-first controls", async () => {
    const bridge = new MockSettingsBridge();
    renderWithAppProviders(<IndexSettingsPanel bridge={bridge} />);

    expect(await screen.findByText(/gemini-embedding-2/i)).toBeInTheDocument();
    expect(screen.getByText(/llama-3\.3-70b-versatile/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/api key/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/save provider/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /add folder/i }));

    await waitFor(() => {
      expect(bridge.addedFolder).toBe("C:\\Docs");
    });
  });

  it("shows per-file index status and cancel state", async () => {
    const bridge = new MockSettingsBridge({
      indexStatus: {
        ...defaultIndexStatus,
        state: "indexing",
        failedFileCount: 1,
        skippedFileCount: 2,
        canCancel: true,
        currentFilePath: "C:\\Docs\\scan.png",
      },
      files: [
        indexedFile,
        {
          path: "C:\\Docs\\scan.png",
          displayName: "scan.png",
          fileType: "png",
          status: "changed",
          reason: "File changed since last index.",
          chunkCount: 0,
        },
      ],
    });
    renderWithAppProviders(<IndexSettingsPanel bridge={bridge} />);

    expect(await screen.findByText(/failed 1/i)).toBeInTheDocument();
    expect(screen.getByText(/skipped 2/i)).toBeInTheDocument();
    expect(screen.getByText(/indexing c:\\docs\\scan\.png/i)).toBeInTheDocument();
    expect(screen.getByText("final_report_v7.docx")).toBeInTheDocument();
    expect(screen.getByText("scan.png")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /needs indexing/i }));
    const table = screen.getByRole("table", { name: /file index status/i });
    expect(within(table).queryByText("final_report_v7.docx")).not.toBeInTheDocument();
    expect(within(table).getByText("scan.png")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^cancel$/i }));

    await waitFor(() => {
      expect(bridge.cancelCalled).toBe(true);
    });
  });
});

const defaultSettings: SettingsResponse = {
  ai: {
    provider: "googleGemini",
    endpoint: "https://generativelanguage.googleapis.com/v1beta",
    model: "gemini-embedding-2",
    embeddingDimension: 3072,
    hasApiKey: true,
  },
};

const defaultIndexStatus: IndexStatus = {
  state: "ready",
  indexedFolders: ["C:\\Docs"],
  indexedFileCount: 4,
  indexedChunkCount: 9,
  failedFileCount: 0,
  skippedFileCount: 0,
  canCancel: false,
  message: "Index ready.",
};

const indexedFile: FileIndexStatus = {
  path: "C:\\Docs\\final_report_v7.docx",
  displayName: "final_report_v7.docx",
  fileType: "docx",
  status: "indexed",
  indexedAt: 1_724_000_000,
  chunkCount: 4,
};

class MockSettingsBridge implements NativeSettingsBridge {
  addedFolder?: string;
  cancelCalled = false;
  private readonly indexStatus: IndexStatus;
  private readonly files: FileIndexStatus[];

  constructor(
    options: {
      indexStatus?: IndexStatus;
      files?: FileIndexStatus[];
    } = {},
  ) {
    this.indexStatus = options.indexStatus ?? defaultIndexStatus;
    this.files = options.files ?? [indexedFile];
  }

  async getSettings() {
    return defaultSettings;
  }

  async saveAiSettings(_settings: AiSettingsInput) {
    return defaultSettings;
  }

  async testAiProvider() {
    return { ok: true, message: "Provider returned 3072 dimensions." };
  }

  async getIndexStatus() {
    return this.indexStatus;
  }

  async getIndexErrors() {
    return [];
  }

  async getRuntimeConfigStatus() {
    return {
      embeddingModel: "gemini-embedding-2",
      embeddingDimensions: 3072,
      geminiKeyPresent: true,
      groqEndpoint: "https://api.groq.com/openai/v1/chat/completions",
      groqModel: "llama-3.3-70b-versatile",
      groqKeyPresent: true,
    };
  }

  async chooseIndexFolder() {
    return "C:\\Docs";
  }

  async getFolderFileStatus() {
    return this.files;
  }

  async getFileIndexStatus(path: string) {
    return this.files.find((file) => file.path === path) ?? {
      path,
      displayName: path,
      fileType: "",
      status: "new" as const,
      chunkCount: 0,
    };
  }

  async clearApiKey() {
    return defaultSettings;
  }

  async addIndexFolder(path: string) {
    this.addedFolder = path;
    return this.indexStatus;
  }

  async removeIndexFolder() {
    return this.indexStatus;
  }

  async cancelIndexing() {
    this.cancelCalled = true;
    return {
      ...this.indexStatus,
      state: "failed" as const,
      canCancel: false,
      message: "Indexing canceled.",
    };
  }

  async startIndexing() {
    return this.indexStatus;
  }
}
