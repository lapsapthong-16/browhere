"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import type { IndexStatus, SearchResponse } from "@/lib/types";
import {
  isTauriRuntime,
  loadDesktopSettings,
  openDesktopPath,
  pickDesktopFolder,
  revealDesktopPath,
  saveDesktopSettings,
  type DesktopSettings,
} from "@/app/desktop";

const DEFAULT_SETTINGS: DesktopSettings = {
  geminiApiKey: "",
  groqApiKey: "",
  indexDir: "",
  shortcut: "CommandOrControl+Shift+Space",
};

export function useBrowhereController() {
  const [query, setQuery] = useState("");
  const [folderPath, setFolderPath] = useState("");
  const [status, setStatus] = useState<IndexStatus>();
  const [search, setSearch] = useState<SearchResponse>();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("Loading index.");
  const [desktopReady, setDesktopReady] = useState(false);
  const [settings, setSettings] = useState<DesktopSettings>(DEFAULT_SETTINGS);

  const refreshStatus = useCallback(async () => {
    const response = await fetch("/api/index/status", { cache: "no-store" });
    const value = (await response.json()) as IndexStatus;
    setStatus(value);
    setMessage(value.message);
  }, []);

  useEffect(() => {
    setDesktopReady(isTauriRuntime());
    void loadDesktopSettings().then((value) => {
      if (value) setSettings(value);
    });
  }, []);

  useEffect(() => {
    void refreshStatus();
    const timer = window.setInterval(() => void refreshStatus(), 2500);
    return () => window.clearInterval(timer);
  }, [refreshStatus]);

  async function submitSearch(event?: FormEvent) {
    event?.preventDefault();
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

  async function addIndexFolder(event?: FormEvent, explicitPath = folderPath) {
    event?.preventDefault();
    if (!explicitPath.trim()) return;
    setBusy(true);
    try {
      const response = await fetch("/api/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: explicitPath }),
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

  async function chooseFolder() {
    const selected = await pickDesktopFolder();
    if (selected) await addIndexFolder(undefined, selected);
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

  async function revealResult(path: string) {
    await revealDesktopPath(path);
  }

  async function openResult(path: string) {
    await openDesktopPath(path);
  }

  async function copyResultPath(path: string) {
    await navigator.clipboard.writeText(path);
    setMessage("Path copied.");
  }

  async function updateSettings(next: DesktopSettings) {
    setSettings(next);
    const saved = await saveDesktopSettings(next);
    setMessage(saved ? "Desktop settings saved." : "Settings are available in the desktop app.");
  }

  const providerLabel = useMemo(() => {
    if (!status) return "Checking providers";
    return `Gemini ${status.providers.geminiReady ? "ready" : "missing"} / Groq ${
      status.providers.groqReady ? "ready" : "missing"
    }`;
  }, [status]);

  const repairLabel = useMemo(() => {
    const repair = status?.repair;
    if (!repair) return "Repair queue unavailable";
    const nextRetry = repair.nextRetryAt ? ` / next ${formatIndexedAt(repair.nextRetryAt)}` : "";
    return `Repair ${repair.queuedCount} queued / ${repair.cooldownCount} cooldown / ${repair.runningCount} running${nextRetry}`;
  }, [status]);

  return {
    query,
    setQuery,
    folderPath,
    setFolderPath,
    status,
    search,
    busy,
    message,
    desktopReady,
    settings,
    providerLabel,
    repairLabel,
    submitSearch,
    addIndexFolder,
    chooseFolder,
    removeIndexFolder,
    revealResult,
    openResult,
    copyResultPath,
    updateSettings,
  };
}

export type BrowhereController = ReturnType<typeof useBrowhereController>;

export function formatScore(value: number) {
  return `${Math.round(value * 1000) / 10}%`;
}

export function formatIndexedAt(value: number) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export function sourceLabel(kind: string) {
  if (kind === "filenamePath") return "filename/path";
  if (kind === "unconfirmedVisual") return "unconfirmed visual";
  if (kind === "rawImageVector") return "raw visual";
  if (kind === "imageLabel") return "image label";
  if (kind === "extractedText") return "text";
  return kind;
}

