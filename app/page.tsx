"use client";

import React from "react";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import type { IndexedDocumentLog, IndexStatus, SearchResponse } from "@/lib/types";

function formatScore(value: number) {
  return `${Math.round(value * 1000) / 10}%`;
}

function formatIndexedAt(value: number) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function sourceLabel(kind: string) {
  if (kind === "filenamePath") return "filename/path";
  if (kind === "unconfirmedVisual") return "unconfirmed visual";
  if (kind === "rawImageVector") return "raw visual";
  if (kind === "imageLabel") return "image label";
  if (kind === "extractedText") return "text";
  return kind;
}

function labelState(document: IndexedDocumentLog) {
  if (!["png", "jpg", "jpeg"].includes(document.fileType)) return "Not image";
  if (document.labelStatus === "generated" && document.labelEmbedded) return "Label embedded";
  if (document.labelStatus === "generated") return "Label ready";
  if (document.labelStatus === "pending") return "Label pending";
  if (document.labelStatus === "failed") return "Label failed";
  return "No label";
}

export default function HomePage() {
  const [query, setQuery] = useState("");
  const [folderPath, setFolderPath] = useState("");
  const [status, setStatus] = useState<IndexStatus>();
  const [search, setSearch] = useState<SearchResponse>();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("Loading index.");

  async function refreshStatus() {
    const response = await fetch("/api/index/status", { cache: "no-store" });
    const value = (await response.json()) as IndexStatus;
    setStatus(value);
    setMessage(value.message);
  }

  useEffect(() => {
    void refreshStatus();
    const timer = window.setInterval(() => void refreshStatus(), 2500);
    return () => window.clearInterval(timer);
  }, []);

  async function submitSearch(event: FormEvent) {
    event.preventDefault();
    if (!query.trim()) return;
    setBusy(true);
    setMessage("Searching.");
    try {
      const response = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      const value = (await response.json()) as SearchResponse;
      setSearch(value);
      setMessage(value.readiness.message ?? "Search complete.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Search failed.");
    } finally {
      setBusy(false);
    }
  }

  async function addIndexFolder(event: FormEvent) {
    event.preventDefault();
    if (!folderPath.trim()) return;
    setBusy(true);
    try {
      const response = await fetch("/api/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: folderPath }),
      });
      const value = (await response.json()) as IndexStatus;
      setStatus(value);
      setMessage(value.message);
      setFolderPath("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not add folder.");
    } finally {
      setBusy(false);
    }
  }

  async function removeIndexFolder(path: string) {
    setBusy(true);
    try {
      const response = await fetch("/api/folders", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path }),
      });
      const value = (await response.json()) as IndexStatus;
      setStatus(value);
      setMessage(value.message);
    } finally {
      setBusy(false);
    }
  }

  const providerLabel = useMemo(() => {
    if (!status) return "Checking providers";
    return `Gemini ${status.providers.geminiReady ? "ready" : "missing"} | Groq ${
      status.providers.groqReady ? "ready" : "missing"
    }`;
  }, [status]);

  return (
    <main className="shell">
      <section className="searchPanel" aria-labelledby="app-title">
        <div className="titleRow">
          <div>
            <p className="kicker">Local RAG Search</p>
            <h1 id="app-title">Find files by memory</h1>
          </div>
          <span className="statePill">{status?.state ?? "loading"}</span>
        </div>

        <form className="searchForm" onSubmit={submitSearch}>
          <input
            aria-label="Search files"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="mcdonalds image, document about lizards..."
          />
          <button disabled={busy || !query.trim()} type="submit">
            Search
          </button>
        </form>

        <p className="statusLine" aria-live="polite">
          {message} {providerLabel}.
        </p>

        <div className="results" aria-label="Search results">
          {search?.results.length ? (
            search.results.map((result) => (
              <article className="result resultRow" key={result.id}>
                <div className="resultBody">
                  <div className="resultHeader">
                    <strong className="resultTitle">{result.displayName}</strong>
                    <span className="score">{formatScore(result.score)}</span>
                  </div>
                  <span className="filePath">{result.filePath}</span>
                  <p>{result.matchContext.text}</p>
                  <div className="resultMeta">
                    <span>#{result.rank}</span>
                    <span>{result.readiness}</span>
                    <span>{sourceLabel(result.matchContext.kind)}</span>
                    {result.matchContext.confirmed === false ? <span>unconfirmed</span> : null}
                  </div>
                </div>
              </article>
            ))
          ) : search ? (
            <p className="empty">No matching files found.</p>
          ) : null}
        </div>
      </section>

      <section className="indexPanel surfaceShell" aria-labelledby="index-title">
        <div className="surfaceCore indexCore">
          <div className="titleRow">
            <div>
              <p className="kicker">Index</p>
              <h2 id="index-title">Indexed folders</h2>
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
          <input
            aria-label="Folder path"
            value={folderPath}
            onChange={(event) => setFolderPath(event.target.value)}
            placeholder="/Users/name/Documents"
          />
          <button disabled={busy || !folderPath.trim()} type="submit">
            Add
          </button>
        </form>

        <ul className="folders">
          {status?.folders.length ? (
            status.folders.map((folder) => (
              <li key={folder.path}>
                <span>{folder.path}</span>
                <button disabled={busy} onClick={() => void removeIndexFolder(folder.path)} type="button">
                  Remove
                </button>
              </li>
            ))
          ) : (
            <li>No folders approved.</li>
          )}
        </ul>

        <div className="stats">
          <span>Files {status?.indexedFileCount ?? 0}</span>
          <span>Chunks {status?.indexedChunkCount ?? 0}</span>
          <span>Queued {status?.queuedCount ?? 0}</span>
          <span>Failed {status?.failedCount ?? 0}</span>
          <span>Partial {status?.partialCount ?? 0}</span>
          <span>Skipped {status?.skippedCount ?? 0}</span>
        </div>

        {status?.currentFilePath ? <p className="statusLine">Indexing {status.currentFilePath}</p> : null}
        {status?.lastIndexedAt ? (
          <p className="statusLine">Last indexed {new Date(status.lastIndexedAt).toLocaleString()}</p>
        ) : null}

          <details className="documentLog">
            <summary>
              <span>
                <strong>Indexed documents</strong>
                <small>{status?.documents.length ?? 0} records</small>
              </span>
              <span className="chevron" aria-hidden="true" />
            </summary>

            {status?.documents.length ? (
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
                    {status.documents.map((document) => (
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

          {!hasFolders ? (
            <div className="setupHint">
              <strong>Start with one narrow folder.</strong>
              <span>Smaller scopes make the first index easier to verify before adding larger archives.</span>
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}
