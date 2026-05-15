## 1. Baseline Verification

- [x] 1.1 Run `npm run typecheck` and record any pre-existing failures.
- [x] 1.2 Run `npm run test` and record any pre-existing failures.
- [x] 1.3 Run `npm run build` and confirm the current Next.js production build behavior.
- [x] 1.4 Run `npm run test:e2e` or document why e2e verification is blocked.

## 2. Tauri Scaffold

- [x] 2.1 Install Tauri JavaScript and Rust dependencies required by the project.
- [x] 2.2 Add `src-tauri/` with macOS app metadata, Rust entrypoint, and Tauri configuration.
- [x] 2.3 Add npm scripts for Tauri development and production builds.
- [x] 2.4 Configure Tauri dev mode to load the existing Next development server.
- [x] 2.5 Verify `npm run tauri:dev` opens the current Browhere UI in a Tauri window.

## 3. Managed Next Runtime

- [x] 3.1 Configure the Next production output for desktop packaging, preferring standalone output if compatible.
- [x] 3.2 Add a Tauri-managed startup path for the bundled Next runtime or sidecar.
- [x] 3.3 Implement runtime readiness checks before the desktop webview loads API-dependent UI.
- [x] 3.4 Select or discover an available local runtime port instead of relying on a fixed packaged port.
- [x] 3.5 Stop the managed runtime when the Tauri app quits.
- [x] 3.6 Verify the packaged runtime serves `/api/index/status` inside the desktop app.

## 4. React UI Split

- [x] 4.1 Extract the search form and query submission logic into a reusable component.
- [x] 4.2 Extract ranked results rendering into a reusable component.
- [x] 4.3 Extract folder/index management UI into a reusable component.
- [x] 4.4 Add a compact search route or mode for the desktop search window.
- [x] 4.5 Keep the existing browser page behavior passing after the refactor.

## 5. Spotlight-Style Search Window

- [x] 5.1 Add a compact Tauri search window or window mode sized for quick search.
- [x] 5.2 Register a default global shortcut such as `CommandOrControl+Shift+Space`.
- [x] 5.3 Show, center, raise, and focus the compact search window when the shortcut is pressed.
- [x] 5.4 Focus the search input immediately after the compact window opens.
- [x] 5.5 Hide the compact search window when the user presses `Escape`.
- [x] 5.6 Add keyboard navigation for compact-window result selection.
- [x] 5.7 Keep the full management UI reachable while the compact search shortcut remains active.

## 6. Native Desktop Actions

- [x] 6.1 Add a Tauri folder picker adapter for selecting approved folders.
- [x] 6.2 Wire the native folder picker into the folder approval flow while preserving manual path entry.
- [x] 6.3 Add desktop-only reveal in Finder action for approved search result paths.
- [x] 6.4 Add desktop-only open with default app action for approved search result paths.
- [x] 6.5 Add copy path action for search results.
- [x] 6.6 Ensure native result actions are hidden or disabled when the UI runs outside Tauri.

## 7. Desktop Settings And Data Paths

- [x] 7.1 Define an app-scoped default index directory for installed desktop builds.
- [x] 7.2 Preserve `BROWHERE_INDEX_DIR` as a development or advanced override.
- [x] 7.3 Add settings storage for Gemini API key, optional Groq API key, index path, and shortcut preference.
- [x] 7.4 Ensure saved desktop settings are loaded by the managed Next runtime before indexing or search.
- [x] 7.5 Verify settings and index data persist after quitting and relaunching the app.

## 8. Release Packaging

- [x] 8.1 Configure app name, bundle identifier, version, category, and icon assets.
- [x] 8.2 Ensure the Tauri bundle includes all Next runtime assets needed outside the source repository.
- [x] 8.3 Build macOS release artifacts with the Tauri build command.
- [x] 8.4 Launch the generated app bundle from Finder.
- [x] 8.5 Move the app bundle to `/Applications` and verify it still launches.

## 9. Final Checks

- [x] 9.1 Run `npm run typecheck`.
- [x] 9.2 Run `npm run test`.
- [x] 9.3 Run `npm run build`.
- [x] 9.4 Run `npm run test:e2e`.
- [x] 9.5 Run `npm run tauri:dev` and verify the desktop UI, index status, folder flow, and search behavior.
- [x] 9.6 Run the Tauri production build and verify the packaged app launches without a terminal.
- [x] 9.7 Verify the global shortcut opens the compact search window from another macOS app.
- [x] 9.8 Verify `Escape` hides the compact search window and the background app remains running.
- [x] 9.9 Verify folder picker, reveal in Finder, open with default app, and copy path actions.
- [x] 9.10 Verify a clean-profile or fresh-machine install can configure keys, add a test folder, index, search, relaunch, and retain settings.
