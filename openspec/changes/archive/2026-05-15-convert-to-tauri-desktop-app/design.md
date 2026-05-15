## Context

Browhere is currently a local-first Next.js app that serves both the React UI and the API routes used for folder approval, indexing status, and search. The backend relies on Node APIs, LanceDB, Chokidar file watching, document extraction packages, and provider credentials for Gemini and optional Groq.

The desktop conversion must not treat Browhere as a static React app. The installed macOS app needs a native shell for shortcuts, windows, dialogs, and packaging, while still providing the server-side runtime required by the existing indexing and search implementation.

## Goals / Non-Goals

**Goals:**

- Add a Tauri macOS shell that can run Browhere without opening a browser.
- Preserve the existing Next.js API behavior during the first desktop migration.
- Provide a Spotlight-like compact search window opened by a global shortcut.
- Keep the full folder/index management UI available in the desktop app.
- Add native folder picking and native file result actions.
- Package Browhere into a launchable macOS app artifact with repeatable final checks.
- Move installed-app data and settings toward app-scoped persistence rather than source-repository-only environment files.

**Non-Goals:**

- Rewrite the full indexing/search backend in Rust during the initial migration.
- Remove browser development support.
- Add hosted sync, multi-user accounts, or remote vector storage.
- Claim full Apple Developer ID signing and notarization are complete unless those credentials and release steps are explicitly configured.

## Decisions

### Use Tauri as the native shell

Tauri provides macOS app packaging, native window control, global shortcuts, menus, dialogs, and shell/open integrations while allowing the existing React UI to continue rendering in a webview.

Alternative considered: Electron. Electron would support the same high-level behavior but ships a larger Chromium/Node runtime and generally consumes more memory for this use case.

Alternative considered: native Swift. Swift would provide the most native UI but would require rebuilding the React UI and duplicating the current product surface.

### Preserve Next.js through a managed local runtime first

The initial desktop app will run the existing Next.js backend through a managed local runtime or sidecar. Tauri will launch it, wait for readiness, load the webview, and stop it during app shutdown.

Alternative considered: move API routes directly into Tauri commands immediately. That is cleaner long term but too much rewrite risk because LanceDB, Chokidar, PDF/DOCX extraction, provider clients, and repair/indexing behavior already work in Node.

### Prefer standalone production output for packaging

The build should use Next standalone output if compatible with the current server-side packages. This gives the Tauri bundle a smaller, clearer runtime payload than shipping the full project tree.

Alternative considered: package the whole source tree and run `next start`. That is simpler for early experiments but is less suitable for an installed app because it depends too much on source-layout assumptions.

### Split the UI into reusable search and management surfaces

The current `app/page.tsx` combines search, results, folder management, status, and document log UI. The desktop app needs a compact search window and a full management view, so shared React components should be extracted before wiring native window behavior deeply.

Alternative considered: keep one page and resize it for every mode. That is faster initially but makes focus behavior, keyboard navigation, and compact window layout harder to maintain.

### Keep desktop native actions optional from the web UI

The browser version should continue to display results without requiring native file actions. When running in Tauri, the same results can expose additional actions such as reveal in Finder, open with default app, and copy path.

Alternative considered: replace the existing browser result UI with desktop-only actions. That would break the current web workflow and make tests less portable.

## Risks / Trade-offs

- Local port conflicts for the managed Next runtime -> choose an available port at startup, store it in Tauri state, and load the webview only after readiness succeeds.
- Native Node dependency bundling issues -> verify `next build`, standalone output, LanceDB loading, PDF/DOCX extraction, and packaged `.app` launch early.
- Sidecar process leaks -> centralize process ownership in Tauri lifecycle code and add quit/shutdown checks.
- API keys in installed app configuration -> keep `.env.local` for development, then add app settings backed by an appropriate app data or secure storage path before release.
- Global shortcut collision -> default to a safer shortcut such as `CommandOrControl+Shift+Space` and report registration failure.
- Desktop code complicates browser tests -> isolate Tauri calls behind small adapters that degrade safely when `window.__TAURI__` is unavailable.

## Migration Plan

1. Verify the existing web app with typecheck, unit tests, production build, and e2e tests.
2. Add the Tauri scaffold and dev wiring to load the existing Next dev server.
3. Add a production runtime strategy using Next standalone output or a documented fallback sidecar.
4. Extract React search/results/index components so compact and full desktop windows can share behavior.
5. Add global shortcut registration, compact search window show/hide, focus behavior, and Escape dismissal.
6. Add native folder picker and result actions through Tauri adapters.
7. Add app data/settings storage for provider keys, index directory defaults, and shortcut configuration.
8. Build release artifacts and run the final verification checklist against the packaged app.

Rollback strategy:

- Keep the browser workflow and existing npm scripts working throughout the migration.
- If the packaged runtime proves unstable, keep the Tauri dev shell disabled from release scripts while preserving the web app.
- Tauri-specific code should be isolated so it can be removed or replaced without changing core search/indexing modules.

## Open Questions

- Which bundle identifier should be used for release builds?
- Should the first release be unsigned/internal-only, or should signing and notarization be included in this change?
- Should the compact search window clear the query after each result action or preserve the last query?
- Which secure storage mechanism should be selected for provider keys on macOS?
