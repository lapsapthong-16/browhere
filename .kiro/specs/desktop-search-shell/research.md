# Research & Design Decisions

## Summary

- **Feature**: `desktop-search-shell`
- **Discovery Scope**: New Feature
- **Key Findings**:
  - The repository is effectively greenfield for implementation; only Kiro steering, roadmap, and the feature brief exist.
  - The shell needs a stable local search result contract before downstream indexing, extraction, OCR, embedding, and ranking systems exist.
  - A Tauri 2 + React + TypeScript shell is a compact fit for a Windows-first desktop utility while keeping platform actions behind a typed adapter.

## Research Log

### Existing Project Shape

- **Context**: The brief states there is no existing app shell.
- **Sources Consulted**: `.kiro/specs/desktop-search-shell/brief.md`, `.kiro/steering/roadmap.md`, repository file scan.
- **Findings**:
  - No `src/`, app package, desktop runtime, or UI components exist in the repository root at discovery time.
  - The roadmap defines a staged Windows MVP with this spec first, followed by local indexing, content extraction, semantic search, vision/OCR, and privacy/performance controls.
  - Core steering files `product.md`, `tech.md`, and `structure.md` are not present; roadmap is the available project steering source.
- **Implications**:
  - The design must include project scaffolding and runtime prerequisites.
  - Contracts must be explicit enough for later specs to consume without changing the user workflow.

### Desktop Runtime and File Actions

- **Context**: The shell must open files with default apps and reveal files in Explorer.
- **Sources Consulted**:
  - [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/)
  - [Tauri shell plugin reference](https://v2.tauri.app/reference/javascript/shell/)
  - [Electron shell API](https://www.electronjs.org/docs/api/shell/)
- **Findings**:
  - Tauri 2 on Windows requires Microsoft C++ Build Tools, Microsoft Edge WebView2, Rust, and Node.js for development.
  - Tauri's shell plugin can open paths through the system default application, with permission scoping through configuration.
  - Electron has direct `openPath` and `showItemInFolder` APIs, but carries a larger embedded runtime than a WebView2-based shell.
- **Implications**:
  - The design selects Tauri 2 as the runtime and isolates platform file operations behind a DesktopFileActions adapter.
  - Reveal-in-folder should be represented as a platform action in the adapter because Tauri's generic open capability is not the same as selecting a file in Explorer.

### UI Stack and Windows Utility Fit

- **Context**: The app should feel like a repeated-use Windows utility, not a landing page.
- **Sources Consulted**:
  - [Fluent UI documentation](https://developer.microsoft.com/en-us/fluentui/docs/en-us/fluentui)
  - [Microsoft Learn Fluent UI React overview](https://learn.microsoft.com/en-us/office/dev/add-ins/design/using-office-ui-fabric-react)
- **Findings**:
  - Fluent UI React provides accessible React components aligned with Microsoft product conventions.
  - A utility shell benefits from dense, predictable controls, keyboard focus states, and native-feeling command affordances.
- **Implications**:
  - The design uses React with TypeScript and Fluent UI React components for the search input, list, buttons, progress, and message states.
  - The first screen is the usable search experience; no marketing or onboarding surface is included.

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks / Limitations | Notes |
|--------|-------------|-----------|---------------------|-------|
| Tauri 2 + React + TypeScript | Web UI in a Windows WebView2 host with Rust-backed commands for desktop actions | Small desktop footprint, typed frontend, explicit command boundary | Requires Rust and Windows build prerequisites | Selected |
| Electron + React + TypeScript | Web UI in Chromium runtime with Electron shell APIs | Mature desktop shell APIs and direct reveal/open support | Larger runtime and broader Node/security surface | Rejected for first utility shell |
| Native WinUI | Windows-native desktop UI | Best native fidelity | Higher initial platform-specific investment and less direct reuse with web UI tooling | Deferred |

## Design Decisions

### Decision: Contract-First Search Provider

- **Context**: Downstream retrieval and indexing specs do not exist yet, but the UI needs to be implementable now.
- **Alternatives Considered**:
  1. Hard-code mock results directly in UI components.
  2. Define a search provider contract consumed by the UI and back it with mock or simple local data.
- **Selected Approach**: Define a typed SearchProvider contract and a LocalPlaceholderSearchProvider implementation for the first shell.
- **Rationale**: This keeps the result workflow stable while allowing later indexing and semantic providers to replace the provider without changing presentation components.
- **Trade-offs**: Adds a small interface layer now, but avoids coupling UI state to temporary data.
- **Follow-up**: Later specs should preserve the contract or version it deliberately.

### Decision: Platform Actions Behind an Adapter

- **Context**: Opening and revealing files require desktop capabilities and error handling.
- **Alternatives Considered**:
  1. Call runtime shell APIs directly from result UI controls.
  2. Route actions through a DesktopFileActions adapter exposed to the UI.
- **Selected Approach**: Use a typed adapter that returns success or a user-presentable failure.
- **Rationale**: The adapter centralizes path validation, permission constraints, and runtime-specific behavior.
- **Trade-offs**: Adds one boundary, but keeps UI components testable and prevents runtime details from leaking across the app.
- **Follow-up**: Verify Explorer reveal behavior during Windows implementation because generic file open APIs may not select the file.

### Decision: Minimal Shell State Machine

- **Context**: The shell must make initial, loading, results, empty, and error states clear.
- **Alternatives Considered**:
  1. Store several booleans such as `isLoading`, `hasError`, and `hasResults`.
  2. Use a discriminated SearchState union.
- **Selected Approach**: Use a single discriminated union for search state.
- **Rationale**: This makes impossible UI states unrepresentable and aligns with the requirement to preserve query text through loading and errors.
- **Trade-offs**: Requires explicit handling for each state, which is useful for test coverage.
- **Follow-up**: Keep new state variants versioned if downstream providers introduce indexing status later.

## Risks & Mitigations

- Runtime prerequisites are not yet present in the repository — include setup tasks for Tauri, React, TypeScript, tests, and Windows build configuration.
- Reveal-in-Explorer behavior may require a Windows-specific command rather than generic shell open — isolate it behind DesktopFileActions and validate on Windows.
- Placeholder search can accidentally become a dead-end mock — require it to implement the same SearchProvider contract as future search providers.
- Rich downstream metadata can tempt UI expansion beyond this spec — ignore unsupported fields and keep advanced previews out of boundary.

## References

- [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) — Windows development prerequisites and WebView2 dependency.
- [Tauri shell plugin reference](https://v2.tauri.app/reference/javascript/shell/) — path opening behavior and shell permission model.
- [Electron shell API](https://www.electronjs.org/docs/api/shell/) — comparison point for desktop open/reveal operations.
- [Fluent UI documentation](https://developer.microsoft.com/en-us/fluentui/docs/en-us/fluentui) — Windows-aligned React component system.
- [Microsoft Learn Fluent UI React overview](https://learn.microsoft.com/en-us/office/dev/add-ins/design/using-office-ui-fabric-react) — Fluent UI React positioning and accessibility-oriented component set.
