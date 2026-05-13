## 1. Baseline Verification

- [ ] 1.1 Run `npm run typecheck` and record any pre-existing failures.
- [ ] 1.2 Run `npm run test` and record any pre-existing failures.
- [ ] 1.3 Run `npm run build` and confirm the current Next.js production build behavior.
- [ ] 1.4 Run `npm run test:e2e` or document why e2e verification is blocked.

## 2. Tauri Scaffold

- [ ] 2.1 Install Tauri JavaScript and Rust dependencies required by the project.
- [ ] 2.2 Add `src-tauri/` with macOS app metadata, Rust entrypoint, and Tauri configuration.
- [ ] 2.3 Add npm scripts for Tauri development and production builds.
- [ ] 2.4 Configure Tauri dev mode to load the existing Next development server.
- [ ] 2.5 Verify `npm run tauri:dev` opens the current Browhere UI in a Tauri window.

## 3. Managed Next Runtime

- [ ] 3.1 Configure the Next production output for desktop packaging, preferring standalone output if compatible.
- [ ] 3.2 Add a Tauri-managed startup path for the bundled Next runtime or sidecar.
- [ ] 3.3 Implement runtime readiness checks before the desktop webview loads API-dependent UI.
- [ ] 3.4 Select or discover an available local runtime port instead of relying on a fixed packaged port.
- [ ] 3.5 Stop the managed runtime when the Tauri app quits.
- [ ] 3.6 Verify the packaged runtime serves `/api/index/status` inside the desktop app.

## 4. React UI Split

- [ ] 4.1 Extract the search form and query submission logic into a reusable component.
- [ ] 4.2 Extract ranked results rendering into a reusable component.
- [ ] 4.3 Extract folder/index management UI into a reusable component.
- [ ] 4.4 Add a compact search route or mode for the desktop search window.
- [ ] 4.5 Keep the existing browser page behavior passing after the refactor.

## 5. Spotlight-Style Search Window

- [ ] 5.1 Add a compact Tauri search window or window mode sized for quick search.
- [ ] 5.2 Register a default global shortcut such as `CommandOrControl+Shift+Space`.
- [ ] 5.3 Show, center, raise, and focus the compact search window when the shortcut is pressed.
- [ ] 5.4 Focus the search input immediately after the compact window opens.
- [ ] 5.5 Hide the compact search window when the user presses `Escape`.
- [ ] 5.6 Add keyboard navigation for compact-window result selection.
- [ ] 5.7 Keep the full management UI reachable while the compact search shortcut remains active.

## 6. Native Desktop Actions

- [ ] 6.1 Add a Tauri folder picker adapter for selecting approved folders.
- [ ] 6.2 Wire the native folder picker into the folder approval flow while preserving manual path entry.
- [ ] 6.3 Add desktop-only reveal in Finder action for approved search result paths.
- [ ] 6.4 Add desktop-only open with default app action for approved search result paths.
- [ ] 6.5 Add copy path action for search results.
- [ ] 6.6 Ensure native result actions are hidden or disabled when the UI runs outside Tauri.

## 7. Desktop Settings And Data Paths

- [ ] 7.1 Define an app-scoped default index directory for installed desktop builds.
- [ ] 7.2 Preserve `BROWHERE_INDEX_DIR` as a development or advanced override.
- [ ] 7.3 Add settings storage for Gemini API key, optional Groq API key, index path, and shortcut preference.
- [ ] 7.4 Ensure saved desktop settings are loaded by the managed Next runtime before indexing or search.
- [ ] 7.5 Verify settings and index data persist after quitting and relaunching the app.

## 8. Release Packaging

- [ ] 8.1 Configure app name, bundle identifier, version, category, and icon assets.
- [ ] 8.2 Ensure the Tauri bundle includes all Next runtime assets needed outside the source repository.
- [ ] 8.3 Build macOS release artifacts with the Tauri build command.
- [ ] 8.4 Launch the generated app bundle from Finder.
- [ ] 8.5 Move the app bundle to `/Applications` and verify it still launches.

## 9. Final Checks

- [ ] 9.1 Run `npm run typecheck`.
- [ ] 9.2 Run `npm run test`.
- [ ] 9.3 Run `npm run build`.
- [ ] 9.4 Run `npm run test:e2e`.
- [ ] 9.5 Run `npm run tauri:dev` and verify the desktop UI, index status, folder flow, and search behavior.
- [ ] 9.6 Run the Tauri production build and verify the packaged app launches without a terminal.
- [ ] 9.7 Verify the global shortcut opens the compact search window from another macOS app.
- [ ] 9.8 Verify `Escape` hides the compact search window and the background app remains running.
- [ ] 9.9 Verify folder picker, reveal in Finder, open with default app, and copy path actions.
- [ ] 9.10 Verify a clean-profile or fresh-machine install can configure keys, add a test folder, index, search, relaunch, and retain settings.
