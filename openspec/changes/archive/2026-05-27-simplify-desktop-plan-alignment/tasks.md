## 1. Baseline Repair And Failure Visibility

- [x] 1.1 Reproduce and fix the failing image-label repair test so repaired labels transition from `pending` to `generated`.
- [x] 1.2 Make image-label, OCR, raw-image, and metadata repair operations idempotently upsert stable evidence chunk ids without duplicates.
- [x] 1.3 Persist per-file indexing failures with file path, message, and timestamp instead of swallowing or clearing them.
- [x] 1.4 Expose failure and repair last-error details through index status without breaking existing status consumers.
- [x] 1.5 Add focused Vitest coverage for repair success, repair retry, duplicate prevention, and failure reporting.

## 2. Repair Queue Reliability

- [x] 2.1 Add a due-repair trigger that runs on startup/status/search and does not require manual reindexing unchanged files.
- [x] 2.2 Preserve cooldown and batch limits so repair attempts do not spin or hammer providers.
- [x] 2.3 Update UI status copy to explain queued, cooldown, running, and next retry states clearly.

## 3. Desktop Native Boundary

- [x] 3.1 Add Tauri-side approved-folder authorization for `open_path` and `reveal_in_finder`.
- [x] 3.2 Reject missing or unapproved native action paths with clear errors.
- [x] 3.3 Remove global Escape shortcut registration and keep Escape handling inside the focused compact search window.
- [x] 3.4 Wire shortcut registration to the saved desktop shortcut preference or document and display restart requirements.
- [x] 3.5 Report shortcut registration failures in a UI-visible status path.

## 4. Runtime Packaging And App Data

- [x] 4.1 Define the packaged Next runtime asset layout and make `npm run tauri:build` produce a launchable `.app` without source-checkout dependency.
- [x] 4.2 Remove or clearly isolate host-Node dependency in packaged mode by bundling a runtime or documenting a deliberate development-only fallback.
- [x] 4.3 Ensure the packaged app uses app-scoped index/settings data by default while preserving `BROWHERE_INDEX_DIR` for development.
- [x] 4.4 Add a packaged-app smoke check or documented manual check for `/api/index/status` from the generated `.app`.
- [x] 4.5 Ensure app quit stops the managed Next runtime without orphaned processes.

## 5. Settings And Secrets

- [x] 5.1 Introduce a small settings abstraction separating safe preferences from provider secrets.
- [x] 5.2 Store provider keys outside tracked source files and document the storage security level if Keychain or secure storage is not implemented in this change.
- [x] 5.3 Apply settings to runtime launch and make restart requirements visible when live reload is not supported.
- [x] 5.4 Update settings UI validation for index directory and shortcut inputs.

## 6. Documentation And Scope Cleanup

- [x] 6.1 Update README desktop usage and current-scope sections so they match implemented folder picker, open/reveal, shortcut, app-data, and settings behavior.
- [x] 6.2 Add or update a desktop manual verification checklist covering launch, shortcut, focus, Escape, folder picker, open/reveal, quit, and packaged app relocation.
- [x] 6.3 Keep PLAN.md aligned with completed versus pending phases and avoid claiming unfinished release criteria are complete.

## 7. Verification

- [x] 7.1 Run `npm run typecheck` and fix any TypeScript errors.
- [x] 7.2 Run `npm run test` and fix any failing unit tests.
- [x] 7.3 Run `npm run build` and fix any production build issues.
- [x] 7.4 Run `npm run test:e2e` and fix any browser regression.
- [x] 7.5 Perform the manual Tauri dev and packaged app checks from the verification checklist.
