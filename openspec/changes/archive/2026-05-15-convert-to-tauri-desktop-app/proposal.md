## Why

Browhere currently requires the user to run and open a local web app manually, which blocks the intended Spotlight-like workflow for fast personal file search from anywhere on macOS. Converting the app to a deployable Tauri desktop app preserves the existing local-first search engine while adding native launch, shortcut, window, and packaging behavior.

## What Changes

- Add a Tauri macOS desktop shell for the existing Next.js and React application.
- Package the existing server-side Next API behavior through a managed local runtime or sidecar so indexing, search, LanceDB, and file watching keep working.
- Add a global keyboard shortcut that opens a focused compact search window.
- Keep the full index/folder management UI available in the desktop app.
- Add native desktop affordances for selecting folders and opening or revealing search results.
- Move installed-app configuration toward app data/settings storage instead of requiring source-repository `.env.local` files.
- Add release checks for dev mode, bundled app launch, production packaging, shortcut behavior, persistence, and clean shutdown.

## Capabilities

### New Capabilities

- `tauri-desktop-shell`: Defines the native macOS app shell, managed Next runtime, lifecycle, packaging, and release launch behavior.
- `spotlight-search-window`: Defines the global-shortcut-driven compact search window and keyboard-focused search flow.
- `desktop-native-actions`: Defines native folder selection, file reveal/open/copy actions, and desktop-safe configuration/data persistence.

### Modified Capabilities

- `agentic-semantic-search`: Search results must remain browser-compatible while also supporting optional desktop-native result actions when the app is running inside Tauri.

## Impact

- Adds Tauri/Rust project files under `src-tauri/`.
- Updates `package.json` scripts and build flow for Tauri development and release builds.
- May update `next.config.ts` for standalone production output and server-side package handling.
- Refactors React UI into reusable search, results, and index-management components for multi-window or route-specific desktop views.
- Adds Tauri frontend integration for events, shortcut focus, native dialogs, and file actions.
- Adds persistent installed-app settings and data-path handling for API keys, index data, and shortcut configuration.
- Adds or updates tests and manual release checks for web behavior, Tauri dev behavior, packaged app behavior, and macOS shortcut/window workflows.
