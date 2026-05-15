"use client";

export interface DesktopSettings {
  geminiApiKey: string;
  groqApiKey: string;
  indexDir: string;
  shortcut: string;
}

export function isTauriRuntime() {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export async function pickDesktopFolder() {
  if (!isTauriRuntime()) return undefined;
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<string | null>("pick_folder");
}

export async function revealDesktopPath(path: string) {
  if (!isTauriRuntime()) return false;
  const { invoke } = await import("@tauri-apps/api/core");
  await invoke("reveal_in_finder", { path });
  return true;
}

export async function openDesktopPath(path: string) {
  if (!isTauriRuntime()) return false;
  const { invoke } = await import("@tauri-apps/api/core");
  await invoke("open_path", { path });
  return true;
}

export async function loadDesktopSettings() {
  if (!isTauriRuntime()) return undefined;
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<DesktopSettings>("load_settings");
}

export async function saveDesktopSettings(settings: DesktopSettings) {
  if (!isTauriRuntime()) return false;
  const { invoke } = await import("@tauri-apps/api/core");
  await invoke("save_settings", { settings });
  return true;
}

export async function hideCurrentDesktopWindow() {
  if (!isTauriRuntime()) return false;
  const { invoke } = await import("@tauri-apps/api/core");
  await invoke("hide_search_window");
  return true;
}

export async function listenForDesktopSearchFocus(callback: () => void) {
  if (!isTauriRuntime()) return () => {};
  const { listen } = await import("@tauri-apps/api/event");
  return listen("browhere://focus-search", callback);
}
