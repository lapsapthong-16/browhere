import { useEffect, useMemo, useState } from "react";

import {
  createDefaultSettingsBridge,
  type AiProviderKind,
  type AiSettingsInput,
  type IndexStatus,
  type NativeSettingsBridge,
  type PublicAiSettings,
} from "../desktop/nativeSettings";

interface IndexSettingsPanelProps {
  bridge?: NativeSettingsBridge;
}

const providerOptions: { value: AiProviderKind; label: string }[] = [
  { value: "googleGemini", label: "Google Gemini" },
  { value: "huggingFace", label: "Hugging Face" },
  { value: "openAiCompatible", label: "OpenAI compatible" },
  { value: "ollama", label: "Ollama endpoint" },
  { value: "localPlaceholder", label: "Local placeholder" },
];

export function IndexSettingsPanel({
  bridge = createDefaultSettingsBridge(),
}: IndexSettingsPanelProps) {
  const [settings, setSettings] = useState<AiSettingsInput>(defaultSettings);
  const [publicSettings, setPublicSettings] = useState<PublicAiSettings>();
  const [indexStatus, setIndexStatus] = useState<IndexStatus>();
  const [folderPath, setFolderPath] = useState("");
  const [message, setMessage] = useState("Loading index settings.");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let mounted = true;
    void Promise.all([bridge.getSettings(), bridge.getIndexStatus()])
      .then(([settingsResponse, status]) => {
        if (!mounted) {
          return;
        }
        setPublicSettings(settingsResponse.ai);
        setSettings({
          provider: settingsResponse.ai.provider,
          endpoint: settingsResponse.ai.endpoint,
          model: settingsResponse.ai.model,
          embeddingDimension: settingsResponse.ai.embeddingDimension,
          apiKey: "",
        });
        setIndexStatus(status);
        setMessage(status.message);
      })
      .catch((error) => {
        if (mounted) {
          setMessage(error instanceof Error ? error.message : "Settings unavailable.");
        }
      });

    return () => {
      mounted = false;
    };
  }, [bridge]);

  const providerLabel = useMemo(
    () =>
      providerOptions.find((option) => option.value === settings.provider)?.label ??
      "Provider",
    [settings.provider],
  );

  const saveSettings = async () => {
    setBusy(true);
    try {
      const response = await bridge.saveAiSettings(settings);
      const status = await bridge.getIndexStatus();
      setPublicSettings(response.ai);
      setIndexStatus(status);
      setMessage("AI settings saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save settings.");
    } finally {
      setBusy(false);
    }
  };

  const testProvider = async () => {
    setBusy(true);
    try {
      const status = await bridge.testAiProvider(settings);
      setMessage(status.message);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Provider test failed.");
    } finally {
      setBusy(false);
    }
  };

  const addFolder = async () => {
    if (folderPath.trim().length === 0) {
      return;
    }
    setBusy(true);
    try {
      const status = await bridge.addIndexFolder(folderPath.trim());
      setIndexStatus(status);
      setFolderPath("");
      setMessage(status.message);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not add folder.");
    } finally {
      setBusy(false);
    }
  };

  const removeFolder = async (path: string) => {
    setBusy(true);
    try {
      const status = await bridge.removeIndexFolder(path);
      setIndexStatus(status);
      setMessage(status.message);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not remove folder.");
    } finally {
      setBusy(false);
    }
  };

  const startIndexing = async () => {
    setBusy(true);
    try {
      const status = await bridge.startIndexing();
      setIndexStatus(status);
      setMessage(status.message);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Indexing failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="settings-panel" aria-labelledby="settings-title">
      <div className="settings-heading">
        <div>
          <p className="settings-kicker">Index</p>
          <h2 id="settings-title">Provider and folders</h2>
        </div>
        <span className="index-state">{formatState(indexStatus?.state)}</span>
      </div>

      <div className="settings-grid">
        <fieldset className="provider-picker">
          <legend>Provider</legend>
          {providerOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              disabled={busy}
              data-selected={settings.provider === option.value ? "true" : "false"}
              aria-pressed={settings.provider === option.value}
              onClick={() =>
                setSettings((current) => ({
                  ...current,
                  provider: option.value,
                }))
              }
            >
              {option.label}
            </button>
          ))}
        </fieldset>
        <label>
          Model
          <input
            value={settings.model}
            disabled={busy}
            onChange={(event) =>
              setSettings((current) => ({ ...current, model: event.target.value }))
            }
          />
        </label>
        <label>
          Endpoint
          <input
            value={settings.endpoint}
            disabled={busy}
            onChange={(event) =>
              setSettings((current) => ({ ...current, endpoint: event.target.value }))
            }
          />
        </label>
        <label>
          Dimensions
          <input
            type="number"
            min={1}
            value={settings.embeddingDimension}
            disabled={busy}
            onChange={(event) =>
              setSettings((current) => ({
                ...current,
                embeddingDimension: Number(event.target.value),
              }))
            }
          />
        </label>
        <label className="settings-wide">
          API key
          <input
            type="password"
            value={settings.apiKey ?? ""}
            disabled={busy}
            placeholder={publicSettings?.apiKeyMask ?? "Required for API providers"}
            onChange={(event) =>
              setSettings((current) => ({ ...current, apiKey: event.target.value }))
            }
          />
        </label>
      </div>

      <div className="settings-actions">
        <button type="button" disabled={busy} onClick={saveSettings}>
          Save provider
        </button>
        <button type="button" disabled={busy} onClick={testProvider}>
          Test provider
        </button>
      </div>

      <div className="folder-controls">
        <label>
          Folder path
          <input
            value={folderPath}
            disabled={busy}
            placeholder="C:\\Users\\you\\Documents"
            onChange={(event) => setFolderPath(event.target.value)}
          />
        </label>
        <button type="button" disabled={busy} onClick={addFolder}>
          Add folder
        </button>
        <button type="button" disabled={busy} onClick={startIndexing}>
          Rebuild index
        </button>
      </div>

      {indexStatus?.indexedFolders.length ? (
        <ul className="indexed-folders" aria-label="Indexed folders">
          {indexStatus.indexedFolders.map((path) => (
            <li key={path}>
              <span>{path}</span>
              <button type="button" disabled={busy} onClick={() => removeFolder(path)}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <p className="settings-message" aria-live="polite">
        {providerLabel}: {message}
        {indexStatus
          ? ` Files ${indexStatus.indexedFileCount}, chunks ${indexStatus.indexedChunkCount}.`
          : ""}
      </p>
      {settings.provider !== "localPlaceholder" ? (
        <p className="settings-warning">
          API mode sends extracted file text to the selected embedding provider.
        </p>
      ) : null}
    </section>
  );
}

const defaultSettings: AiSettingsInput = {
  provider: "googleGemini",
  endpoint: "https://generativelanguage.googleapis.com/v1beta",
  model: "text-embedding-004",
  embeddingDimension: 768,
  apiKey: "",
};

function formatState(state?: string): string {
  if (!state) {
    return "Loading";
  }
  return state.replace(/[A-Z]/g, (match) => ` ${match}`).trim();
}
