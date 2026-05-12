import { useEffect, useMemo, useState } from "react";

import {
  createDefaultSettingsBridge,
  type FileIndexState,
  type FileIndexStatus,
  type IndexErrorEntry,
  type IndexStatus,
  type NativeSettingsBridge,
  type RuntimeConfigStatus,
} from "../desktop/nativeSettings";

interface IndexSettingsPanelProps {
  bridge?: NativeSettingsBridge;
}

type FileFilter = "all" | "needsIndexing" | "indexed" | "failed";

export function IndexSettingsPanel({
  bridge = createDefaultSettingsBridge(),
}: IndexSettingsPanelProps) {
  const [config, setConfig] = useState<RuntimeConfigStatus>();
  const [indexStatus, setIndexStatus] = useState<IndexStatus>();
  const [files, setFiles] = useState<FileIndexStatus[]>([]);
  const [message, setMessage] = useState("Loading index.");
  const [indexErrors, setIndexErrors] = useState<IndexErrorEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<FileFilter>("all");

  const refresh = async () => {
    const [runtimeConfig, status, errors, fileStatuses] = await Promise.all([
      bridge.getRuntimeConfigStatus(),
      bridge.getIndexStatus(),
      bridge.getIndexErrors(5),
      bridge.getFolderFileStatus(),
    ]);
    setConfig(runtimeConfig);
    setIndexStatus(status);
    setIndexErrors(errors);
    setFiles(fileStatuses);
    setMessage(status.message);
  };

  useEffect(() => {
    let mounted = true;
    void refresh().catch((error) => {
      if (mounted) {
        setMessage(error instanceof Error ? error.message : "Index unavailable.");
      }
    });
    return () => {
      mounted = false;
    };
  }, [bridge]);

  const visibleFiles = useMemo(
    () => files.filter((file) => matchesFilter(file.status, filter)),
    [files, filter],
  );

  const chooseFolder = async () => {
    setBusy(true);
    try {
      const path = await bridge.chooseIndexFolder();
      if (!path) {
        setMessage("Folder selection canceled.");
        return;
      }
      const status = await bridge.addIndexFolder(path);
      setIndexStatus(status);
      setMessage(status.message);
      await refresh();
    } catch (error) {
      setMessage(errorMessage(error, "Could not add folder."));
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
      await refresh();
    } catch (error) {
      setMessage(errorMessage(error, "Could not remove folder."));
    } finally {
      setBusy(false);
    }
  };

  const startIndexing = async () => {
    setBusy(true);
    try {
      const status = await bridge.startIndexing();
      const errors = await bridge.getIndexErrors(5);
      const fileStatuses = await bridge.getFolderFileStatus();
      setIndexStatus(status);
      setIndexErrors(errors);
      setFiles(fileStatuses);
      setMessage(status.message);
    } catch (error) {
      setMessage(errorMessage(error, "Indexing failed."));
    } finally {
      setBusy(false);
    }
  };

  const cancelIndexing = async () => {
    setBusy(true);
    try {
      const status = await bridge.cancelIndexing();
      setIndexStatus(status);
      setMessage(status.message);
    } catch (error) {
      setMessage(errorMessage(error, "Could not cancel indexing."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="settings-panel" aria-labelledby="settings-title">
      <div className="settings-heading">
        <div>
          <p className="settings-kicker">Index</p>
          <h2 id="settings-title">Folders allowed for indexing</h2>
        </div>
        <span className="index-state">{formatState(indexStatus?.state)}</span>
      </div>

      <div className="runtime-config" aria-label="AI runtime">
        <span>
          Embeddings: {config?.embeddingModel ?? "gemini-embedding-2"}{" "}
          ({config?.embeddingDimensions ?? 3072}d)
        </span>
        <span data-ready={config?.geminiKeyPresent ? "true" : "false"}>
          Gemini key {config?.geminiKeyPresent ? "ready" : "missing"}
        </span>
        <span data-ready={config?.groqKeyPresent ? "true" : "false"}>
          Groq {config?.groqModel ?? "llama-3.3-70b-versatile"}{" "}
          {config?.groqKeyPresent ? "ready" : "missing"}
        </span>
      </div>

      <div className="folder-controls">
        <button type="button" disabled={busy} onClick={chooseFolder}>
          Add folder
        </button>
        <button type="button" disabled={busy} onClick={startIndexing}>
          Update index
        </button>
        <button type="button" disabled={busy || !indexStatus?.canCancel} onClick={cancelIndexing}>
          Cancel
        </button>
      </div>

      {indexStatus?.indexedFolders.length ? (
        <ul className="indexed-folders" aria-label="Allowed folders">
          {indexStatus.indexedFolders.map((path) => (
            <li key={path}>
              <span>{path}</span>
              <button type="button" disabled={busy} onClick={() => removeFolder(path)}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="settings-message">No folders allowed yet.</p>
      )}

      <p className="settings-message" aria-live="polite">
        {message}
        {indexStatus
          ? ` Files ${indexStatus.indexedFileCount}, chunks ${indexStatus.indexedChunkCount}, skipped ${indexStatus.skippedFileCount}, failed ${indexStatus.failedFileCount}.`
          : ""}
      </p>
      {indexStatus?.currentFilePath ? (
        <p className="settings-message">Indexing {indexStatus.currentFilePath}</p>
      ) : null}
      {indexStatus?.lastIndexedAt ? (
        <p className="settings-message">
          Last indexed {new Date(indexStatus.lastIndexedAt * 1000).toLocaleString()}.
        </p>
      ) : null}

      <div className="file-status-toolbar" aria-label="File status filters">
        {(["all", "needsIndexing", "indexed", "failed"] as const).map((value) => (
          <button
            key={value}
            type="button"
            data-selected={filter === value ? "true" : "false"}
            onClick={() => setFilter(value)}
          >
            {formatFilter(value)}
          </button>
        ))}
      </div>

      <div className="file-status-table" role="table" aria-label="File index status">
        <div role="row" className="file-status-row file-status-head">
          <span role="columnheader">File</span>
          <span role="columnheader">Status</span>
          <span role="columnheader">Chunks</span>
        </div>
        {visibleFiles.length ? (
          visibleFiles.map((file) => (
            <div role="row" className="file-status-row" key={file.path}>
              <span role="cell">
                <strong>{file.displayName}</strong>
                <small>{file.path}</small>
                {file.reason ? <small>{file.reason}</small> : null}
              </span>
              <span role="cell" data-status={file.status}>
                {formatFileStatus(file.status)}
              </span>
              <span role="cell">{file.chunkCount}</span>
            </div>
          ))
        ) : (
          <div role="row" className="file-status-row">
            <span role="cell">No files found.</span>
            <span role="cell">-</span>
            <span role="cell">-</span>
          </div>
        )}
      </div>

      {indexErrors.length ? (
        <ul className="index-errors" aria-label="Indexing errors">
          {indexErrors.map((error) => (
            <li key={`${error.filePath}-${error.message}`}>
              <span>{error.filePath}</span>
              <span>{error.message}</span>
            </li>
          ))}
        </ul>
      ) : null}
      <p className="settings-warning">
        Indexed file content is sent to Google Gemini Embedding 2. Search queries are sent to
        the same embedding API.
      </p>
    </section>
  );
}

function matchesFilter(status: FileIndexState, filter: FileFilter): boolean {
  if (filter === "all") {
    return true;
  }
  if (filter === "needsIndexing") {
    return ["new", "changed", "missing"].includes(status);
  }
  if (filter === "failed") {
    return ["failed", "partial", "unsupported"].includes(status);
  }
  return status === "indexed";
}

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string" && error.trim()) {
    return error;
  }
  return fallback;
}

function formatFilter(filter: FileFilter): string {
  return filter.replace(/[A-Z]/g, (match) => ` ${match}`).trim();
}

function formatFileStatus(status: FileIndexState): string {
  return status.replace(/[A-Z]/g, (match) => ` ${match}`).trim();
}

function formatState(state?: string): string {
  if (!state) {
    return "Loading";
  }
  return state.replace(/[A-Z]/g, (match) => ` ${match}`).trim();
}
