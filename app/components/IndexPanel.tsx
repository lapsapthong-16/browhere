"use client";

import React from "react";
import type { IndexedDocumentLog } from "@/lib/types";
import type { BrowhereController } from "@/app/useBrowhereController";
import { formatIndexedAt } from "@/app/useBrowhereController";

interface IndexPanelProps {
  controller: BrowhereController;
}

export function IndexPanel({ controller }: IndexPanelProps) {
  const {
    status,
    busy,
    folderPath,
    setFolderPath,
    providerLabel,
    repairLabel,
    desktopReady,
    settings,
    addIndexFolder,
    chooseFolder,
    removeIndexFolder,
    updateSettings,
  } = controller;

  const hasFolders = Boolean(status?.folders.length);
  const state = status?.state ?? "loading";

  return (
    <section className="indexPanel surfaceShell" aria-labelledby="index-title">
      <div className="surfaceCore indexCore">
        <div className="titleRow">
          <div>
            <p className="kicker">Index</p>
            <h2 id="index-title">Approved folders</h2>
          </div>
          <span className={`statePill state-${state}`}>{state}</span>
        </div>

        <div className="providerLine">{providerLabel}</div>
        <div className="providerLine">{repairLabel}</div>

        <div className="stats" aria-label="Index statistics">
          <div>
            <strong>{status?.indexedFileCount ?? 0}</strong>
            <span>Files</span>
          </div>
          <div>
            <strong>{status?.indexedChunkCount ?? 0}</strong>
            <span>Chunks</span>
          </div>
          <div>
            <strong>{status?.queuedCount ?? 0}</strong>
            <span>Queued</span>
          </div>
          <div>
            <strong>{status?.failedCount ?? 0}</strong>
            <span>Failed</span>
          </div>
          <div>
            <strong>{status?.partialCount ?? 0}</strong>
            <span>Partial</span>
          </div>
          <div>
            <strong>{status?.skippedCount ?? 0}</strong>
            <span>Skipped</span>
          </div>
        </div>

        <form className="folderForm" onSubmit={addIndexFolder}>
          <label>
            <span>Folder path</span>
            <input
              aria-label="Folder path"
              value={folderPath}
              onChange={(event) => setFolderPath(event.target.value)}
              placeholder="/Users/name/Documents"
            />
          </label>
          <button className="secondaryButton" disabled={busy || !folderPath.trim()} type="submit">
            Add
          </button>
          {desktopReady ? (
            <button className="secondaryButton" disabled={busy} onClick={() => void chooseFolder()} type="button">
              Choose
            </button>
          ) : null}
        </form>

        <ul className="folders">
          {status?.folders.length ? (
            status.folders.map((folder) => (
              <li key={folder.path}>
                <span className="folderPath">{folder.path}</span>
                <button
                  className="ghostButton"
                  disabled={busy}
                  onClick={() => void removeIndexFolder(folder.path)}
                  type="button"
                >
                  Remove
                </button>
              </li>
            ))
          ) : (
            <li className="folderEmpty">No folders approved.</li>
          )}
        </ul>

        {status?.currentFilePath ? <p className="statusLine">Indexing {status.currentFilePath}</p> : null}
        {status?.lastIndexedAt ? (
          <p className="statusLine">Last indexed {new Date(status.lastIndexedAt).toLocaleString()}</p>
        ) : null}

        <DocumentLog documents={status?.documents ?? []} />

        {desktopReady ? (
          <details className="documentLog">
            <summary>
              <span>
                <strong>Desktop settings</strong>
                <small>{settings.shortcut}</small>
              </span>
              <span className="chevron" aria-hidden="true" />
            </summary>
            <form
              className="settingsForm"
              onSubmit={(event) => {
                event.preventDefault();
                const data = new FormData(event.currentTarget);
                void updateSettings({
                  geminiApiKey: String(data.get("geminiApiKey") ?? ""),
                  groqApiKey: String(data.get("groqApiKey") ?? ""),
                  indexDir: String(data.get("indexDir") ?? ""),
                  shortcut: String(data.get("shortcut") ?? settings.shortcut),
                });
              }}
            >
              <label>
                <span>Gemini key</span>
                <input name="geminiApiKey" type="password" defaultValue={settings.geminiApiKey} />
              </label>
              <label>
                <span>Groq key</span>
                <input name="groqApiKey" type="password" defaultValue={settings.groqApiKey} />
              </label>
              <label>
                <span>Index directory</span>
                <input name="indexDir" defaultValue={settings.indexDir} placeholder="App data default" />
              </label>
              <label>
                <span>Shortcut</span>
                <input name="shortcut" defaultValue={settings.shortcut} />
              </label>
              <button className="secondaryButton" type="submit">
                Save
              </button>
            </form>
          </details>
        ) : null}

        {!hasFolders ? (
          <div className="setupHint">
            <strong>Start with one narrow folder.</strong>
            <span>Smaller scopes make the first index easier to verify before adding larger archives.</span>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function DocumentLog({ documents }: { documents: IndexedDocumentLog[] }) {
  return (
    <details className="documentLog">
      <summary>
        <span>
          <strong>Indexed documents</strong>
          <small>{documents.length} records</small>
        </span>
        <span className="chevron" aria-hidden="true" />
      </summary>

      {documents.length ? (
        <div className="logTableWrap">
          <table className="logTable">
            <thead>
              <tr>
                <th>Document</th>
                <th>Folder</th>
                <th>Image label</th>
                <th>Indexed</th>
                <th>Chunks</th>
              </tr>
            </thead>
            <tbody>
              {documents.map((document) => (
                <tr key={`${document.id}-${document.indexedAt}`}>
                  <td>
                    <strong>{document.displayName}</strong>
                    <span>{document.filePath}</span>
                  </td>
                  <td>{document.folderPath}</td>
                  <td>
                    <span className={`labelState labelState-${document.labelStatus ?? "none"}`}>
                      {labelState(document)}
                    </span>
                  </td>
                  <td>{formatIndexedAt(document.indexedAt)}</td>
                  <td>{document.chunkCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="logEmpty">No indexed documents yet.</div>
      )}
    </details>
  );
}

function labelState(document: IndexedDocumentLog) {
  if (!["png", "jpg", "jpeg"].includes(document.fileType)) return "Not image";
  if (document.labelStatus === "generated" && document.labelEmbedded) return "Label embedded";
  if (document.labelStatus === "generated") return "Label ready";
  if (document.labelStatus === "pending" || document.labelStatus === "retrying") return "Label pending";
  if (document.labelStatus === "failed") return "Label failed";
  return "No label";
}
