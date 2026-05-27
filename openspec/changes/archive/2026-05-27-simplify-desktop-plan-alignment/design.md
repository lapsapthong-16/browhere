## Context

Browhere is a local-first Next.js semantic search app wrapped by Tauri for macOS. The active plan chooses a conservative desktop migration: keep the existing Next API/indexing pipeline intact, package it as a managed local runtime, and add native shell behavior around it. The current codebase already has most pieces, but the review found mismatches that make the app harder to trust: a failing image-label repair test, swallowed indexing failures, host-Node dependency in packaged mode, renderer-trusted native file actions, incomplete settings behavior, and global Escape registration.

The change should make the existing direction boring and reliable before adding more retrieval or UI surface. The core design principle is to preserve the Next server as the product runtime for now and harden the desktop boundary around it.

## Goals / Non-Goals

**Goals:**

- Restore a passing baseline for typecheck, build, and unit tests.
- Make image-label/OCR repair behavior deterministic and idempotent.
- Persist file indexing failures so the status UI reflects actual failures.
- Package and launch the Next runtime in a way that does not require a source checkout or manually started server.
- Gate native open/reveal actions against approved indexed folders in Tauri.
- Make desktop settings behavior clear: app-scoped index data, development overrides, applied shortcut setting, and safer provider-secret storage.
- Keep Escape behavior scoped to the compact search window.
- Align README and manual verification with the implemented desktop V1.

**Non-Goals:**

- Rewriting the indexer/search backend into Rust or Tauri commands.
- Adding new file formats, hosted sync, user accounts, or remote vector storage.
- Replacing LanceDB, Gemini, or Groq provider behavior.
- Solving signing/notarization beyond documenting and preserving a testable local build path.

## Decisions

1. Keep Option A as the release architecture: Tauri manages a Next standalone runtime.

   Rationale: This preserves the API routes, LanceDB integration, extraction libraries, and existing tests. Moving backend logic into Rust would be a larger architecture change and would distract from the current reliability gaps.

   Alternative considered: port indexing/search APIs into Tauri commands. Rejected for this change because it increases regression risk and is explicitly listed as a later option in the migration plan.

2. Make packaged runtime self-containment explicit.

   The packaged app must include the Next standalone output and the runtime needed to execute it, or fail with a clear setup error during development only. Production app launch must not rely on the source repository path, `npm run start`, or a terminal process. Runtime assets should be copied as part of the Tauri bundle inputs or a deterministic post-build step that is covered by verification.

3. Validate native actions in Rust using approved-folder state.

   The renderer may show actions only for search results, but Tauri commands are the security boundary. `open_path` and `reveal_in_finder` must reject paths that are not inside an approved folder known to the packaged runtime/settings. They must also reject missing paths.

4. Treat settings as runtime-affecting state, not cosmetic UI.

   Saving provider keys, index directory, or shortcut preference must either apply immediately or clearly require a restart. Shortcut registration must use the saved shortcut and report registration failure in the UI/status path. Provider secrets should move out of plain tracked files and avoid casual project-local storage; where a secure secret store is not implemented yet, the UI and docs must label the storage behavior.

5. Repair tasks are idempotent state transitions.

   A repair operation should upsert the missing evidence chunk by stable id, update file label/OCR status, clear the matching repair task, and not duplicate existing evidence. If provider quota or missing key prevents repair, the task stays scheduled with a visible reason.

6. Failure reporting is part of the product contract.

   Per-file extraction, embedding, persistence, or permission errors should be recorded with file path, message, and timestamp. The queue should continue processing other files, but status must not silently report success after ignored failures.

## Risks / Trade-offs

- Packaged Node/runtime complexity -> Keep the implementation narrow, document the exact runtime asset layout, and verify by launching the generated `.app` outside the source checkout.
- Native action authorization can drift from Next repository state -> Centralize approved-folder reading through app-scoped metadata/settings and add tests or manual checks for allowed and denied paths.
- Secret storage may require a plugin or platform-specific code -> Stage this behind a small settings abstraction so the UI and runtime are not tied to the storage backend.
- Repair scheduling could become noisy or expensive -> Keep small batch limits, preserve cooldowns, and trigger scheduled repair from status/search/startup without spinning continuously.
- Existing indexes may contain stale metadata -> Normalize on read and avoid destructive migration; repair and prune paths should handle old records incrementally.

## Migration Plan

1. Fix current failing tests and repair-state logic first.
2. Add/adjust unit tests for repair success, repair retry, failure recording, and duplicate prevention.
3. Harden Tauri commands for native action authorization and scoped Escape behavior.
4. Make shortcut/settings behavior functional and visible.
5. Rework packaging so runtime assets are deterministic and production launch does not depend on source checkout state.
6. Update README/current-scope language and add a short desktop manual verification checklist.
7. Run `npm run typecheck`, `npm run test`, `npm run build`, `npm run test:e2e`, and manual Tauri checks before considering the change complete.
