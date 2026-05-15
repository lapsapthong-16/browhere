# Browhere Tauri App Migration Plan

## Goal

Rework Browhere from a local Next.js web app into a deployable macOS desktop app with a Spotlight-like search experience.

The final app should:

- Run as a native macOS app.
- Keep the existing React search/index UI working.
- Support a global keyboard shortcut to show a compact search window.
- Run in the background or menu bar so the shortcut works without an open browser.
- Keep approved-folder indexing local to the machine.
- Preserve the existing Next.js API behavior until or unless specific backend pieces are moved into Tauri commands.
- Produce a distributable `.app` and installer artifact through Tauri.

## Current Project State

Browhere is currently a Next.js App Router project with:

- React 19 UI in `app/page.tsx`.
- API-backed UI calls to:
  - `/api/folders`
  - `/api/index/status`
  - `/api/search`
- Local file indexing through Node APIs.
- LanceDB local persistence.
- Chokidar file watching.
- Gemini and optional Groq provider calls.
- Tests through Vitest and Playwright.

This matters because the app is not a static React-only frontend. The desktop version must provide both:

1. A webview window for the React UI.
2. A runtime for the server-side indexing/search APIs.

## Recommended Architecture

Use Tauri as the native desktop shell around the existing React/Next app.

Initial architecture:

```text
macOS global shortcut
  |
  v
Tauri app process
  |
  |-- main/search window management
  |-- menu bar/background app behavior
  |-- native filesystem dialogs and reveal/open actions later
  |
  v
Embedded or sidecar Next.js server
  |
  v
Existing React UI + Next API routes
  |
  v
Local indexer, LanceDB, Gemini, Groq
```

This is the lowest-risk route because it preserves the existing product behavior while adding native macOS capabilities around it.

## Important Technical Decision

There are two realistic ways to combine Next.js and Tauri.

### Option A: Next.js Server Sidecar

Build the Next.js app in production mode and run it as a bundled sidecar process from Tauri.

Pros:

- Least rewrite.
- Existing API routes keep working.
- Existing Node dependencies keep working.
- Fastest path to a usable desktop app.

Cons:

- Packaging is more complex because the app must include the Next build output, runtime dependencies, and a local server process.
- App startup must manage a local port or IPC.
- Need shutdown handling for the sidecar process.

### Option B: Move Backend Logic Into Tauri Commands

Keep React as the frontend, but move indexing/search/file APIs from Next API routes into Rust or Node-compatible Tauri commands.

Pros:

- Cleaner long-term desktop architecture.
- No local HTTP server required.
- Better native control over file permissions, dialogs, app lifecycle, and background tasks.

Cons:

- Larger rewrite.
- LanceDB, document extraction, Gemini/Groq clients, and chokidar behavior must be ported or bridged.
- Higher regression risk.

### Decision

Use Option A first. Ship a working Tauri app around the current Next implementation, then selectively move desktop-specific features into Tauri commands.

Do not begin by rewriting the backend. The core indexing/search behavior is the product; preserve it while adding the native shell.

## Phase 1: Baseline Web App Verification

Before adding Tauri, verify the current web app is healthy.

Tasks:

- Run dependency install if needed.
- Run TypeScript checks.
- Run unit tests.
- Run the Next production build.
- Run Playwright tests if the app already has stable e2e coverage.
- Document any existing failures before Tauri work starts.

Commands:

```bash
npm i
npm run typecheck
npm run test
npm run build
npm run test:e2e
```

Exit criteria:

- Existing web app builds.
- Existing tests either pass or known failures are documented.
- No Tauri changes are mixed with unrelated web app fixes unless required.

## Phase 2: Add Tauri Scaffold

Add Tauri without changing the product UI yet.

Tasks:

- Install Tauri dependencies.
- Add `src-tauri/`.
- Configure Tauri for macOS.
- Add npm scripts:
  - `tauri`
  - `tauri:dev`
  - `tauri:build`
- Configure development mode to load `http://localhost:3000`.
- Configure production mode to load the bundled local Next server URL.
- Keep app identity stable:
  - app name: `Browhere`
  - bundle identifier: choose a reverse-DNS identifier, for example `com.browhere.app`

Expected files:

```text
src-tauri/
  Cargo.toml
  tauri.conf.json
  src/
    main.rs
```

Exit criteria:

- `npm run tauri:dev` opens the current Browhere UI in a Tauri window.
- The UI can call the existing Next API routes.
- The app can be closed without leaving unmanaged dev processes behind.

## Phase 3: Production Next Runtime Strategy

Make the desktop app run without manually starting `npm run start`.

Tasks:

- Decide the production runtime format:
  - preferred: Next standalone output
  - fallback: bundled Node sidecar with `.next`, `public`, and required runtime files
- Update `next.config.ts` if needed:

```ts
const nextConfig = {
  output: "standalone",
  serverExternalPackages: ["@lancedb/lancedb", "pdf-parse", "mammoth"],
};
```

- Add a sidecar startup flow in Tauri:
  - start the local Next server on app launch
  - wait until the health URL responds
  - load the Tauri webview after the server is ready
  - stop the sidecar when the app exits
- Avoid hard-coding a port that can easily conflict.
- Store the chosen port in Tauri state and load that URL.
- Ensure `.env.local` values are available in dev.
- Add a production-safe configuration path for API keys and index directory.

Exit criteria:

- A built Tauri app can launch the UI without a separate terminal.
- `/api/index/status` responds inside the desktop app.
- The app shuts down its local server cleanly.

## Phase 4: Spotlight-Style Window Behavior

Create the native Mac search experience.

Tasks:

- Add a compact search window separate from the full management window, or make the main window resize/reposition into search mode.
- Register a global shortcut, for example:
  - default: `CommandOrControl+Shift+Space`
  - avoid stealing macOS Spotlight's default `Cmd+Space` unless the user explicitly configures it.
- On shortcut:
  - show the search window
  - center it on the active display
  - focus the search input
  - bring it above normal windows
- On `Esc`:
  - hide the search window
  - preserve or clear query based on product decision
- On result selection:
  - support keyboard navigation
  - optionally reveal/open the selected file in Finder
  - hide the search window after action if appropriate
- Keep the full folder/index management UI accessible from menu bar or a secondary window.

Implementation notes:

- Tauri handles global shortcut registration and window show/hide.
- React renders the search UI.
- React can listen for Tauri events such as `show-search`.
- The current `app/page.tsx` should likely be split into reusable components:
  - `SearchPanel`
  - `ResultsList`
  - `IndexPanel`
  - `DocumentLog`
- Add a dedicated search-only route or view if that makes the Tauri window simpler.

Exit criteria:

- Global shortcut opens the search UI from another app.
- Search input is focused immediately.
- `Esc` dismisses the search window.
- The full management UI is still reachable.

## Phase 5: Native Folder and File Actions

Replace fragile path-entry workflows with native desktop actions where useful.

Tasks:

- Add a native folder picker through Tauri.
- Keep manual path entry as an advanced fallback.
- Add result actions:
  - reveal file in Finder
  - open file with default app
  - copy path
- Validate selected folders before indexing.
- Keep the existing approved-folder privacy model.
- Make permission and provider errors visible in the UI.

Exit criteria:

- User can add a folder without typing an absolute path.
- Search results can be opened or revealed from the desktop app.
- Removing a folder still stops watching it and excludes records.

## Phase 6: App Settings and Local Data Paths

Move desktop configuration out of ad hoc environment-only setup.

Tasks:

- Define where desktop app data lives:
  - default index directory should move from project-local `.browhere/index` to an app data directory.
  - preserve `BROWHERE_INDEX_DIR` override for development or advanced use.
- Add settings UI for:
  - Gemini API key
  - optional Groq API key
  - index directory override, if needed
  - global shortcut
- Store settings using a secure or appropriate local mechanism:
  - API keys should not be committed or stored in plain project files.
  - evaluate macOS Keychain or Tauri secure storage plugins for secrets.
- Add migration handling for existing `.browhere/index` data if needed.

Exit criteria:

- Fresh installed app can be configured without editing `.env.local`.
- Existing local development config still works.
- Index data persists between app launches.

## Phase 7: Packaging, Signing, and Distribution

Make the app deployable.

Tasks:

- Configure Tauri bundle metadata:
  - app name
  - bundle identifier
  - version
  - icon set
  - macOS category
- Create production icons.
- Build release artifacts:
  - `.app`
  - `.dmg` or another installer format supported by Tauri
- Decide signing/notarization path:
  - unsigned local build for internal testing
  - Apple Developer ID signing for broader distribution
  - notarization for a smooth install experience on macOS
- Document install/update flow.
- Decide whether auto-update is in scope for this release.

Exit criteria:

- `npm run tauri:build` produces a macOS app bundle.
- The app launches from Finder.
- The app can be moved to `/Applications`.
- macOS security behavior is understood and documented.

## Phase 8: Testing Strategy

Add coverage for the desktop-specific behavior.

Tasks:

- Keep existing tests:
  - `npm run typecheck`
  - `npm run test`
  - `npm run test:e2e`
- Add tests for split React components after refactor.
- Add manual verification checklist for Tauri behavior that is hard to automate:
  - global shortcut registration
  - window focus
  - background/menu bar lifecycle
  - app quit behavior
  - Finder reveal/open actions
- Add a smoke test script if practical:
  - start Tauri dev app
  - assert local server readiness
  - assert `/api/index/status` response

Exit criteria:

- Web behavior remains covered.
- Desktop behavior has a repeatable manual checklist.
- Release cannot be considered complete without passing final checks below.

## Phase 9: Final Checking Before Release

Run these checks before calling the Tauri migration complete.

### Static and Unit Checks

```bash
npm run typecheck
npm run test
```

Pass criteria:

- TypeScript reports no errors.
- Unit tests pass.

### Web Build Check

```bash
npm run build
```

Pass criteria:

- Next production build succeeds.
- No server-only package bundling errors.
- LanceDB, `pdf-parse`, and `mammoth` remain compatible with the build output.

### Web E2E Check

```bash
npm run test:e2e
```

Pass criteria:

- Playwright can load the app.
- Search and folder-management UI are visible.
- Any expected provider-missing states are handled cleanly.

### Tauri Dev Check

```bash
npm run tauri:dev
```

Manual pass criteria:

- Tauri window opens.
- React UI renders.
- `/api/index/status` loads.
- Folder can be added through the current UI.
- Search request completes or returns a clear provider/key message.
- Closing the window does not leave broken background state.

### Native Shortcut Check

Manual pass criteria:

- Launch the app.
- Switch to another macOS app.
- Press the configured shortcut.
- Browhere search window appears centered and focused.
- Typing immediately enters text in the search field.
- Pressing `Esc` hides the search window.
- Pressing the shortcut again brings it back.

### Native Folder and File Action Check

Manual pass criteria:

- Add a folder through the native picker.
- Indexed files appear in status/log views.
- Search returns a known file from the approved folder.
- Reveal in Finder opens the correct file location.
- Open with default app opens the selected file.
- Removing the folder removes it from future search scope.

### Production Bundle Check

```bash
npm run tauri:build
```

Manual pass criteria:

- Build produces a macOS app artifact.
- App launches from the generated bundle, not only from dev mode.
- App starts its internal Next runtime automatically.
- No terminal command is required after install.
- App can be moved to `/Applications` and still launches.
- App quits cleanly.
- Relaunch preserves settings and index data.

### Fresh Machine or Clean Profile Check

Manual pass criteria:

- Install the app on a clean macOS user profile or test machine.
- Configure provider keys through the intended settings path.
- Add a small test folder.
- Index and search work.
- Global shortcut works after relaunch.
- No dependency on the source repository path exists.

## Risks and Mitigations

### Risk: Next.js API Routes Are Not Static

Browhere depends on server-side Node behavior, so a simple static export is not enough.

Mitigation:

- Use a Next standalone/sidecar runtime first.
- Only migrate backend APIs into Tauri commands after the desktop shell is stable.

### Risk: Local Port Conflicts

A sidecar server needs a local URL.

Mitigation:

- Choose an available port at runtime.
- Pass it to the Tauri webview.
- Add readiness checks before showing the UI.

### Risk: Bundling Native Node Dependencies

LanceDB and document extraction packages may need special handling in a packaged app.

Mitigation:

- Verify production builds early.
- Keep `serverExternalPackages` configured.
- Test the packaged `.app`, not only dev mode.

### Risk: Secrets in Desktop App

`.env.local` is acceptable for development but not a good installed-app UX.

Mitigation:

- Add settings UI.
- Store secrets through macOS Keychain or a secure Tauri-compatible storage path.
- Do not bundle user API keys into the app.

### Risk: Global Shortcut Collision

`Cmd+Space` is already used by Spotlight on most Macs.

Mitigation:

- Default to a non-conflicting shortcut.
- Let users customize it later.
- Clearly report if registration fails.

## Release Definition of Done

The migration is complete when:

- The app can be launched as a macOS desktop app.
- The existing Browhere search and indexing workflows still work.
- A global shortcut opens a focused search interface.
- The app can run without a browser.
- The app can be built into a distributable macOS artifact.
- Settings and index data persist outside the source repository.
- Final checking in Phase 9 passes.

