# Implementation Plan

- [ ] 1. Scaffold the Windows desktop app foundation
- [x] 1.1 Create the Tauri, React, TypeScript, and Vite project shell
  - Establish the desktop runtime, frontend entrypoint, compiler settings, and package scripts required to run and build the shell.
  - Configure the first app window to load the React search experience.
  - The app starts locally and renders a React root without runtime setup errors.
  - _Requirements: 1.1, 6.1_

- [x] 1.2 Add UI library and test infrastructure
  - Install and configure Fluent UI React, Vitest, React Testing Library, and Playwright.
  - Add shared test setup so components can be rendered with the same providers used by the app.
  - A baseline render test and a smoke UI test can run from package scripts.
  - _Requirements: 6.1, 6.3_

- [ ] 2. Define core contracts and placeholder data
- [x] 2.1 Create the search result and search state contracts
  - Define the typed result, match context, query, provider error, and search state shapes.
  - Add bounded `availabilityHint` support for UI-safe partial indexing and unavailability metadata.
  - Add query-level `SearchResponse.readiness` support and carry readiness through empty and result-bearing search states.
  - Ensure optional metadata and unsupported provider enrichment can be handled without breaking the shell.
  - Contract tests verify required result fields, readiness handling, and accepted optional metadata combinations.
  - _Requirements: 2.2, 2.3, 2.4, 4.3, 4.4, 5.1, 5.3, 5.4_
  - _Boundary: SearchProvider_
  - _Touches: src/search/SearchProvider.ts_

- [x] 2.2 (P) Build the placeholder search provider
  - Provide fixture or simple local result data that conforms to the same provider contract future search systems will implement.
  - Return ranked results for representative natural language queries and an empty result for unmatched queries.
  - The provider can be exercised in tests without any indexing, OCR, embedding, or vector database dependency.
  - _Requirements: 2.1, 5.2, 5.4_
  - _Boundary: LocalPlaceholderSearchProvider_
  - _Depends: 2.1_

- [x] 2.3 (P) Build the desktop file action contract and Tauri bridge
  - Define open and reveal action outcomes, including not allowed, not found, and operating system failure cases.
  - Add native command handling needed to open a file with the default app and reveal it in Explorer.
  - A mocked adapter test proves failures return typed errors instead of clearing or throwing through UI state.
  - _Requirements: 3.1, 3.2, 3.3, 3.4_
  - _Boundary: DesktopFileActions_
  - _Depends: 2.1_

- [ ] 3. Implement search coordination
- [x] 3.1 Build query submission and state transitions
  - Handle non-empty submissions by entering loading state and invoking the provider with the user's query text.
  - Keep empty or whitespace-only submissions local and avoid provider calls.
  - Preserve provider `SearchResponse.readiness` on result and empty states so not-ready semantic searches do not collapse into generic no-match UI.
  - Tests show loading, results, ready empty, not-ready empty, and provider error states preserve the active query correctly.
  - _Requirements: 1.2, 1.3, 1.4, 1.5, 4.2, 4.3, 4.4, 4.5, 4.6_
  - _Boundary: SearchController_
  - _Depends: 2.1, 2.2_

- [ ] 4. Build the desktop search UI
- [x] 4.1 (P) Build the app shell and search input experience
  - Present the search input as the primary first-screen control with no blocking marketing or onboarding surface.
  - Support mouse and keyboard submission for repeated searches from the same window.
  - Initial render shows a focused utility search surface ready for user input.
  - _Requirements: 1.1, 1.2, 1.5, 4.1, 6.1, 6.2_
  - _Boundary: AppShell, SearchBox_
  - _Depends: 3.1_
  - _Touches: src/app/App.tsx_

- [x] 4.2 (P) Build ranked result list and result item presentation
  - Display results in ranked order with filename, type, path context, modified date when available, and optional match context.
  - Preserve usable rows when optional size, date, or match context are absent.
  - The selected or focused result is visually distinct and can be reached by keyboard.
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 6.3, 6.4_
  - _Boundary: ResultList, ResultItem_
  - _Depends: 3.1_

- [x] 4.3 (P) Build search status views
  - Render initial, loading, empty, and error states from the search state model.
  - Empty and error states reference the active query and avoid exposing indexing, OCR, embedding, or AI provider internals.
  - Distinguish ready empty states from query-level not-ready states using only the bounded readiness reason.
  - Submitting a new query replaces prior empty or error feedback with current progress and results.
  - _Requirements: 1.4, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 5.4_
  - _Boundary: SearchStatusView_
  - _Depends: 3.1_

- [ ] 5. Integrate file actions into result workflows
- [x] 5.1 Wire open and reveal controls into result items
  - Enable result actions only when the result contract marks them eligible.
  - Invoke the desktop file action adapter from explicit user activation on a displayed result.
  - Open and reveal controls are available from pointer and keyboard workflows.
  - _Requirements: 3.1, 3.2, 6.3, 6.5_
  - _Boundary: ResultItem, DesktopFileActions_
  - _Depends: 2.3, 4.2_

- [ ] 5.2 Preserve results while showing action failures
  - Display actionable open or reveal failure messages without clearing the current query or result list.
  - Explain inaccessible files when the adapter reports not found or operating system failure.
  - Tests verify action errors do not reorder, remove, or replace current results.
  - _Requirements: 3.3, 3.4, 6.4_
  - _Boundary: ResultItem, SearchStatusView_
  - _Depends: 5.1_

- [ ] 6. Validate the complete shell workflow
- [ ] 6.1 Add end-to-end search workflow coverage
  - Cover app launch, natural language query submission, loading feedback, ranked results, empty state, and provider error state.
  - Verify repeated searches work from the same app window without stale state.
  - The E2E suite demonstrates the shell workflow without depending on a real indexer or semantic backend.
  - _Requirements: 1.1, 1.2, 1.4, 1.5, 2.1, 4.1, 4.2, 4.3, 4.4, 4.5, 5.2_

- [ ] 6.2 Add end-to-end keyboard and file action coverage
  - Cover keyboard movement between search input, results, and primary result actions.
  - Verify open and reveal success paths through a mocked or test-safe desktop action boundary.
  - Verify action failure feedback keeps the current results visible.
  - _Requirements: 2.5, 3.1, 3.2, 3.3, 3.4, 6.3, 6.5_

- [ ] 6.3 Run contract and boundary validation
  - Confirm every displayed result comes through the documented SearchProvider contract.
  - Confirm partial indexing metadata is represented only through the bounded `availabilityHint` enum.
  - Confirm unsupported enrichment fields do not appear in or break the shell UI.
  - Confirm the completed shell exposes only in-scope desktop search workflow controls.
  - _Requirements: 2.2, 2.3, 2.4, 5.1, 5.3, 5.4, 5.5, 6.4, 6.5_
