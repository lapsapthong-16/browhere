import { invoke } from "@tauri-apps/api/core";

export type AiProviderKind =
  | "googleGemini"
  | "huggingFace"
  | "openAiCompatible"
  | "ollama"
  | "localPlaceholder";

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
}

export interface NativeSettingsBridge {
  getSettings(): Promise<SettingsResponse>;
  saveAiSettings(settings: AiSettingsInput): Promise<SettingsResponse>;
  testAiProvider(settings: AiSettingsInput): Promise<ProviderStatus>;
  getIndexStatus(): Promise<IndexStatus>;
  addIndexFolder(path: string): Promise<IndexStatus>;
  removeIndexFolder(path: string): Promise<IndexStatus>;
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
  addIndexFolder(path) {
    return invoke("add_index_folder", { path });
  },
  removeIndexFolder(path) {
    return invoke("remove_index_folder", { path });
  },
  startIndexing() {
    return invoke("start_indexing");
  },
};

const placeholderStatus: IndexStatus = {
  state: "ready",
  indexedFolders: [],
  indexedFileCount: 3,
  indexedChunkCount: 3,
  message: "Placeholder index ready.",
};

const placeholderSettings: SettingsResponse = {
  ai: {
    provider: "localPlaceholder",
    endpoint: "",
    model: "placeholder",
    embeddingDimension: 64,
    hasApiKey: false,
  },
};

export const placeholderSettingsBridge: NativeSettingsBridge = {
  async getSettings() {
    return placeholderSettings;
  },
  async saveAiSettings() {
    return placeholderSettings;
  },
  async testAiProvider() {
    return { ok: true, message: "Placeholder provider ready." };
  },
  async getIndexStatus() {
    return placeholderStatus;
  },
  async addIndexFolder() {
    return placeholderStatus;
  },
  async removeIndexFolder() {
    return placeholderStatus;
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
