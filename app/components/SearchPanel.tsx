"use client";

import React from "react";
import { useEffect, useRef, useState } from "react";
import { hideCurrentDesktopWindow, listenForDesktopSearchFocus } from "@/app/desktop";
import type { BrowhereController } from "@/app/useBrowhereController";
import { formatScore, sourceLabel } from "@/app/useBrowhereController";

interface SearchPanelProps {
  controller: BrowhereController;
  compact?: boolean;
}

export function SearchPanel({ controller, compact = false }: SearchPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const {
    query,
    setQuery,
    search,
    busy,
    message,
    desktopReady,
    submitSearch,
    revealResult,
    openResult,
    copyResultPath,
  } = controller;

  useEffect(() => {
    if (!compact) return;
    inputRef.current?.focus();
    return undefined;
  }, [compact]);

  useEffect(() => {
    if (!compact) return;
    let unlisten: (() => void) | undefined;
    void listenForDesktopSearchFocus(() => inputRef.current?.focus()).then((value) => {
      unlisten = value;
      inputRef.current?.focus();
    });
    return () => unlisten?.();
  }, [compact]);

  useEffect(() => {
    if (!compact) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") void hideCurrentDesktopWindow();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [compact]);

  return (
    <section className="searchPanel surfaceShell" aria-label="Search workspace">
      <div className={`surfaceCore searchCore ${compact ? "compactSearchCore" : ""}`}>
        <h1 id="app-title" className="srOnly">
          Find files by memory
        </h1>
        <form className="searchForm" onSubmit={submitSearch}>
          <label>
            <div className="spotlightInput">
              <span aria-hidden="true" className="searchGlyph" />
              <input
                ref={inputRef}
                aria-label="Search files"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search files, images, receipts, documents..."
              />
            </div>
          </label>
          <button className="primaryButton" disabled={busy || !query.trim()} type="submit">
            {busy ? "Working" : "Search"}
          </button>
        </form>

        <p className="statusLine" aria-live="polite">
          {message}
        </p>

        <SearchResults
          busy={busy}
          compact={compact}
          desktopReady={desktopReady}
          search={search}
          onCopyPath={copyResultPath}
          onOpen={openResult}
          onReveal={revealResult}
        />
      </div>
    </section>
  );
}

interface SearchResultsProps {
  search: BrowhereController["search"];
  busy: boolean;
  desktopReady: boolean;
  compact: boolean;
  onReveal: (path: string) => Promise<void>;
  onOpen: (path: string) => Promise<void>;
  onCopyPath: (path: string) => Promise<void>;
}

function SearchResults({ search, busy, desktopReady, compact, onReveal, onOpen, onCopyPath }: SearchResultsProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const results = search?.results ?? [];

  useEffect(() => {
    setSelectedIndex(0);
  }, [results.length]);

  useEffect(() => {
    if (!compact || !results.length) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setSelectedIndex((value) => Math.min(value + 1, results.length - 1));
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setSelectedIndex((value) => Math.max(value - 1, 0));
      }
      if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        const result = results[selectedIndex];
        if (result) {
          if (desktopReady) {
            void onOpen(result.filePath);
          } else {
            void onCopyPath(result.filePath);
          }
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [compact, desktopReady, onCopyPath, onOpen, results, selectedIndex]);

  return (
    <div className="results spotlightResults" aria-label="Search results">
      {busy ? (
        Array.from({ length: 3 }, (_, index) => (
          <div className="result resultRow skeletonResult" key={index}>
            <span />
            <span />
            <span />
          </div>
        ))
      ) : results.length ? (
        results.map((result, index) => (
          <article
            className={`result resultRow ${compact && index === selectedIndex ? "selectedResult" : ""}`}
            key={result.id}
            aria-current={compact && index === selectedIndex ? "true" : undefined}
          >
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
              <div className="resultActions">
                {desktopReady ? (
                  <>
                    <button type="button" className="ghostButton" onClick={() => void onReveal(result.filePath)}>
                      Reveal
                    </button>
                    <button type="button" className="ghostButton" onClick={() => void onOpen(result.filePath)}>
                      Open
                    </button>
                  </>
                ) : null}
                <button type="button" className="ghostButton" onClick={() => void onCopyPath(result.filePath)}>
                  Copy path
                </button>
              </div>
            </div>
            {compact && index === 0 ? <span className="srOnly">Top result</span> : null}
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
  );
}
