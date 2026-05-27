## Why

Browhere has accumulated useful semantic-search and desktop-shell work, but the current implementation is ahead of its release contract in some places and behind it in others. The next change should reduce that mismatch by fixing the known failing repair path, tightening desktop-native safety, and making the Tauri migration match the plan's "preserve Next first, package correctly, then add native affordances" direction.

## What Changes

- Fix image evidence repair so failed visual-caption and OCR tasks reliably transition to generated or empty states without duplicating chunks.
- Make indexing failures visible and persistent instead of swallowing or clearing them.
- Simplify desktop runtime packaging around a deliberate Next sidecar strategy that does not depend on the source checkout or an unmanaged terminal process.
- Enforce approved-folder scope for native open/reveal actions at the Tauri command boundary.
- Make desktop settings honest and coherent: persist app data in app-scoped paths, keep development overrides, apply shortcut settings, and avoid storing provider secrets in tracked or casual project files.
- Remove global Escape interception and keep Escape behavior local to the compact search window.
- Update documentation and verification so the README, tests, and manual checks describe the actual desktop V1 behavior.
- Defer nonessential expansion work until the desktop baseline is reliable.

## Capabilities

### New Capabilities

- `desktop-release-hardening`: Covers packaged desktop runtime self-containment, native action authorization, desktop settings behavior, shortcut registration, and release verification.

### Modified Capabilities

- `tauri-desktop-shell`: Clarify packaged runtime expectations, shutdown behavior, app-scoped data paths, and no source-checkout dependency.
- `spotlight-search-window`: Clarify configurable shortcut behavior and Escape handling only while the compact search window is focused.
- `desktop-native-actions`: Require Tauri-side approved-folder authorization for reveal/open actions and safer settings persistence.
- `folder-indexing`: Require persistent indexing failure records and reliable repair retry behavior.
- `image-labeling`: Require repair completion semantics for generated labels/OCR and no duplicate evidence records.

## Impact

- Tauri shell code in `src-tauri/src/lib.rs`, `src-tauri/tauri.conf.json`, capabilities, bundle configuration, and runtime packaging scripts.
- Desktop bridge and UI code in `app/desktop.ts`, `app/useBrowhereController.ts`, `app/components/SearchPanel.tsx`, and `app/components/IndexPanel.tsx`.
- Indexing, repair, and persistence code in `lib/indexer/*`, `lib/storage/repository.ts`, and related tests.
- Documentation in `README.md`, `PLAN.md`, and any manual verification checklist added for desktop release checks.
- Test coverage across Vitest, Playwright smoke checks, and manual Tauri verification.
