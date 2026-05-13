"use client";

import React from "react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import type { IndexStatus, SearchResponse } from "@/lib/types";

const examples = ["receipt from oak market", "deck with retention chart", "photo of yellow packaging"];

function formatCount(value: number | undefined) {
  return new Intl.NumberFormat("en", { notation: "compact" }).format(value ?? 0);
}

function formatScore(value: number) {
  return `${Math.round(value * 1000) / 10}%`;
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
    return `Gemini ${status.providers.geminiReady ? "ready" : "missing"} / Groq ${
      status.providers.groqReady ? "ready" : "missing"
    }`;
  }, [status]);

  const totalWork = (status?.queuedCount ?? 0) + (status?.processingCount ?? 0);
  const hasFolders = Boolean(status?.folders.length);
  const state = status?.state ?? "loading";

  return (
    <main className="shell">
      <section className="heroPanel" aria-labelledby="app-title">
        <div className="heroCopy">
          <p className="kicker">Local RAG Search</p>
          <h1 id="app-title">Find files by memory</h1>
          <p className="lede">
            Ask in plain language across approved folders. Browhere ranks documents, images, and metadata with
            local index context.
          </p>
        </div>

        <div className="signalBoard" aria-label="Index overview">
          <div className="signalBoardHeader">
            <span className={`statePill state-${state}`}>{state}</span>
            <span>{providerLabel}</span>
          </div>
          <div className="metricStack">
            <div>
              <strong>{formatCount(status?.indexedFileCount)}</strong>
              <span>files</span>
            </div>
            <div>
              <strong>{formatCount(status?.indexedChunkCount)}</strong>
              <span>chunks</span>
            </div>
            <div>
              <strong>{formatCount(totalWork)}</strong>
              <span>active</span>
            </div>
          </div>
        </div>
      </section>

      <section className="searchPanel" aria-label="Search workspace">
        <form className="searchForm" onSubmit={submitSearch}>
          <label>
            <span>Search memory</span>
            <input
              aria-label="Search files"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="mcdonalds image, document about lizards..."
            />
          </label>
          <button className="primaryButton" disabled={busy || !query.trim()} type="submit">
            {busy ? "Working" : "Search"}
          </button>
        </form>

        <div className="promptRail" aria-label="Example searches">
          {examples.map((example) => (
            <button key={example} onClick={() => setQuery(example)} type="button">
              {example}
            </button>
          ))}
        </div>

        <p className="statusLine" aria-live="polite">
          {message}
        </p>

        <div className="results" aria-label="Search results">
          {busy ? (
            Array.from({ length: 3 }, (_, index) => (
              <div className="result skeletonResult" key={index}>
                <span />
                <span />
                <span />
              </div>
            ))
          ) : search?.results.length ? (
            search.results.map((result) => (
              <article className="result" key={result.id}>
                <div className="resultHeader">
                  <strong className="resultTitle">
                    {result.rank}. {result.displayName}
                  </strong>
                  <span className="score">{formatScore(result.score)}</span>
                </div>
                <span className="filePath">{result.filePath}</span>
                <p>{result.matchContext.text}</p>
                <div className="resultMeta">
                  <span>{result.fileType}</span>
                  <span>{result.readiness}</span>
                  <span>evidence {result.matchContext.kind}</span>
                </div>
              </article>
            ))
          ) : search ? (
            <div className="empty">
              <strong>No matching files found.</strong>
              <span>Try a visual detail, filename fragment, or phrase from a document.</span>
            </div>
          ) : (
            <div className="empty initialEmpty">
              <strong>Search is ready when your folders are.</strong>
              <span>Add an approved folder, then search by concept instead of exact filename.</span>
            </div>
          )}
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
        </form>

        <ul className="folders">
          {status?.folders.length ? (
            status.folders.map((folder) => (
              <li key={folder.path}>
                <span>{folder.path}</span>
                <button className="ghostButton" disabled={busy} onClick={() => void removeIndexFolder(folder.path)} type="button">
                  Remove
                </button>
              </li>
            ))
          ) : (
            <li className="folderEmpty">No folders approved.</li>
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

        {!hasFolders ? (
          <div className="setupHint">
            <strong>Start with one narrow folder.</strong>
            <span>Smaller scopes make the first index easier to verify before adding larger archives.</span>
          </div>
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
