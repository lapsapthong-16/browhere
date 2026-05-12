"use client";

import React from "react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import type { IndexStatus, SearchResponse } from "@/lib/types";

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
              <article className="result" key={result.id}>
                <div>
                  <strong>
                    {result.rank}. {result.displayName}
                  </strong>
                  <span>{result.filePath}</span>
                </div>
                <p>{result.matchContext.text}</p>
                <small>
                  {result.fileType} | {result.readiness} | score {result.score.toFixed(3)}
                </small>
              </article>
            ))
          ) : search ? (
            <p className="empty">No matching files found.</p>
          ) : null}
        </div>
      </section>

      <section className="indexPanel" aria-labelledby="index-title">
        <div className="titleRow">
          <div>
            <p className="kicker">Index</p>
            <h2 id="index-title">Approved folders</h2>
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
          <span>Skipped {status?.skippedCount ?? 0}</span>
        </div>

        {status?.currentFilePath ? <p className="statusLine">Indexing {status.currentFilePath}</p> : null}
        {status?.lastIndexedAt ? (
          <p className="statusLine">Last indexed {new Date(status.lastIndexedAt).toLocaleString()}</p>
        ) : null}

        {status?.failures.length ? (
          <ul className="failures">
            {status.failures.slice(0, 5).map((failure) => (
              <li key={`${failure.filePath}-${failure.at}`}>
                <strong>{failure.filePath}</strong>
                <span>{failure.message}</span>
              </li>
            ))}
          </ul>
        ) : null}

        <p className="privacy">
          Selected-folder text, documents, and images are sent to Gemini for embeddings.
          Search queries plus candidate snippets and metadata are sent to Groq when reranking is available.
        </p>
      </section>
    </main>
  );
}
