import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";

export type AiProviderKind = "googleGemini";

export interface PublicAiSettings {
  provider: AiProviderKind;
  endpoint: string;
  model: string;
  embeddingDimension: number;
  hasApiKey: boolean;
  apiKeyMask?: string;
}

export interface AiSettingsInput {
  provider: AiProviderKind;
  endpoint: string;
  model: string;
  embeddingDimension: number;
  apiKey?: string;
}

export interface SettingsResponse {
  ai: PublicAiSettings;
}

export interface ProviderStatus {
  ok: boolean;
  message: string;
}

export type IndexState =
  | "notConfigured"
  | "ready"
  | "indexing"
  | "stale"
  | "failed";

export interface IndexStatus {
  state: IndexState;
  indexedFolders: string[];
  indexedFileCount: number;
  indexedChunkCount: number;
  lastError?: string;
  message: string;
  currentFilePath?: string;
  failedFileCount: number;
  skippedFileCount: number;
  canCancel: boolean;
  lastIndexedAt?: number;
}

export interface IndexErrorEntry {
  filePath: string;
  message: string;
}

export interface RuntimeConfigStatus {
  embeddingModel: string;
  embeddingDimensions: number;
  geminiKeyPresent: boolean;
  groqEndpoint: string;
  groqModel: string;
  groqKeyPresent: boolean;
}

export type FileIndexState =
  | "indexed"
  | "new"
  | "changed"
  | "missing"
  | "failed"
  | "partial"
  | "unsupported";

export interface FileIndexStatus {
  path: string;
  displayName: string;
  fileType: string;
  sizeBytes?: number;
  modifiedAt?: number;
  status: FileIndexState;
  reason?: string;
  indexedAt?: number;
  chunkCount: number;
}

export interface NativeSettingsBridge {
  getSettings(): Promise<SettingsResponse>;
  saveAiSettings(settings: AiSettingsInput): Promise<SettingsResponse>;
  testAiProvider(settings: AiSettingsInput): Promise<ProviderStatus>;
  getIndexStatus(): Promise<IndexStatus>;
  getIndexErrors(limit?: number): Promise<IndexErrorEntry[]>;
  getRuntimeConfigStatus(): Promise<RuntimeConfigStatus>;
  chooseIndexFolder(): Promise<string | null>;
  getFolderFileStatus(folder?: string): Promise<FileIndexStatus[]>;
  getFileIndexStatus(path: string): Promise<FileIndexStatus>;
  clearApiKey(provider: AiProviderKind): Promise<SettingsResponse>;
  addIndexFolder(path: string): Promise<IndexStatus>;
  removeIndexFolder(path: string): Promise<IndexStatus>;
  cancelIndexing(): Promise<IndexStatus>;
  startIndexing(): Promise<IndexStatus>;
}

export const tauriSettingsBridge: NativeSettingsBridge = {
  getSettings() {
    return invoke("get_settings");
  },
  saveAiSettings(settings) {
    return invoke("save_ai_settings", { settings });
  },
  testAiProvider(settings) {
    return invoke("test_ai_provider", { settings });
  },
  getIndexStatus() {
    return invoke("get_index_status");
  },
  getIndexErrors(limit) {
    return invoke("get_index_errors", { limit });
  },
  getRuntimeConfigStatus() {
    return invoke("get_runtime_config_status");
  },
  async chooseIndexFolder() {
    const selected = await open({
      directory: true,
      multiple: false,
      title: "Choose folder to index",
    });
    return Array.isArray(selected) ? (selected[0] ?? null) : selected;
  },
  getFolderFileStatus(folder) {
    return invoke("get_folder_file_status", { folder });
  },
  getFileIndexStatus(path) {
    return invoke("get_file_index_status", { path });
  },
  clearApiKey(provider) {
    return invoke("clear_api_key", { provider });
  },
  addIndexFolder(path) {
    return invoke("add_index_folder", { path });
  },
  removeIndexFolder(path) {
    return invoke("remove_index_folder", { path });
  },
  cancelIndexing() {
    return invoke("cancel_indexing");
  },
  startIndexing() {
    return invoke("start_indexing");
  },
};

const placeholderStatus: IndexStatus = {
  state: "ready",
  indexedFolders: ["C:\\Docs"],
  indexedFileCount: 3,
  indexedChunkCount: 3,
  failedFileCount: 0,
  skippedFileCount: 0,
  canCancel: false,
  message: "Placeholder index ready.",
};

const placeholderSettings: SettingsResponse = {
  ai: {
    provider: "googleGemini",
    endpoint: "https://generativelanguage.googleapis.com/v1beta",
    model: "gemini-embedding-2",
    embeddingDimension: 3072,
    hasApiKey: true,
  },
};

const placeholderConfig: RuntimeConfigStatus = {
  embeddingModel: "gemini-embedding-2",
  embeddingDimensions: 3072,
  geminiKeyPresent: true,
  groqEndpoint: "https://api.groq.com/openai/v1/chat/completions",
  groqModel: "llama-3.3-70b-versatile",
  groqKeyPresent: true,
};

const placeholderFiles: FileIndexStatus[] = [
  {
    path: "C:\\Docs\\final_report_v7.docx",
    displayName: "final_report_v7.docx",
    fileType: "docx",
    sizeBytes: 42000,
    modifiedAt: 1_724_000_000,
    status: "indexed",
    indexedAt: 1_724_000_500,
    chunkCount: 4,
  },
  {
    path: "C:\\Docs\\receipt.png",
    displayName: "receipt.png",
    fileType: "png",
    sizeBytes: 98000,
    modifiedAt: 1_724_000_100,
    status: "new",
    chunkCount: 0,
  },
];

export const placeholderSettingsBridge: NativeSettingsBridge = {
  async getSettings() {
    return placeholderSettings;
  },
  async saveAiSettings() {
    return placeholderSettings;
  },
  async testAiProvider() {
    return { ok: true, message: "Gemini Embedding 2 ready." };
  },
  async getIndexStatus() {
    return placeholderStatus;
  },
  async getIndexErrors() {
    return [];
  },
  async getRuntimeConfigStatus() {
    return placeholderConfig;
  },
  async chooseIndexFolder() {
    return "C:\\Docs";
  },
  async getFolderFileStatus() {
    return placeholderFiles;
  },
  async getFileIndexStatus(path) {
    return placeholderFiles.find((file) => file.path === path) ?? {
      path,
      displayName: path,
      fileType: "",
      status: "new",
      chunkCount: 0,
    };
  },
  async clearApiKey() {
    return placeholderSettings;
  },
  async addIndexFolder() {
    return placeholderStatus;
  },
  async removeIndexFolder() {
    return { ...placeholderStatus, indexedFolders: [] };
  },
  async cancelIndexing() {
    return { ...placeholderStatus, state: "failed", canCancel: false, message: "Indexing canceled." };
  },
  async startIndexing() {
    return placeholderStatus;
  },
};

type TauriRuntimeWindow = Window & {
  __TAURI_INTERNALS__?: unknown;
};

export function createDefaultSettingsBridge(): NativeSettingsBridge {
  if (typeof window !== "undefined" && (window as TauriRuntimeWindow).__TAURI_INTERNALS__) {
    return tauriSettingsBridge;
  }

  return placeholderSettingsBridge;
}
