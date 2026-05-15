## Requirements

### Requirement: Launch Browhere As A macOS App
The system SHALL provide a Tauri-based macOS app shell that launches Browhere without requiring the user to open a browser manually.

#### Scenario: App is launched from Finder
- **WHEN** the user opens the packaged Browhere app from Finder
- **THEN** the system MUST start the native Tauri app shell
- **AND** the system MUST display the Browhere UI in a desktop window.

#### Scenario: App is launched in development
- **WHEN** the developer runs the Tauri development command
- **THEN** the system MUST load the local Next development server in the Tauri webview
- **AND** the existing browser development workflow MUST remain available.

### Requirement: Manage The Next Runtime
The system SHALL manage the server-side runtime required by the existing Next.js API routes when running as a desktop app.

#### Scenario: Desktop app starts
- **WHEN** the Tauri app starts in packaged mode
- **THEN** the system MUST start the bundled Next runtime or sidecar
- **AND** the system MUST wait for runtime readiness before loading API-dependent UI.

#### Scenario: Runtime port is selected
- **WHEN** the desktop app starts its local runtime
- **THEN** the system MUST avoid relying on a fixed port that may already be occupied
- **AND** the selected runtime URL MUST be used by the desktop webview.

#### Scenario: Desktop app exits
- **WHEN** the user quits Browhere
- **THEN** the system MUST stop the managed Next runtime
- **AND** the system MUST NOT leave orphaned runtime processes.

### Requirement: Preserve Existing Local-First Behavior
The system SHALL preserve the current local indexing and search behavior inside the desktop app.

#### Scenario: Index status is requested in desktop app
- **WHEN** the Tauri-hosted UI requests index status
- **THEN** the system MUST return the same folder, provider, queue, repair, and document-log state exposed by the existing web app.

#### Scenario: Search is submitted in desktop app
- **WHEN** the Tauri-hosted UI submits a search query
- **THEN** the system MUST use the existing local index and provider-backed search pipeline
- **AND** results MUST remain limited to approved indexed folders.

### Requirement: Build Release Artifacts
The system SHALL build deployable macOS desktop artifacts through the Tauri build flow.

#### Scenario: Release build is run
- **WHEN** the developer runs the Tauri build command
- **THEN** the system MUST produce a macOS app bundle artifact
- **AND** the artifact MUST include the runtime assets needed to launch Browhere without the source repository.

#### Scenario: Packaged app is moved
- **WHEN** the built app is moved to `/Applications`
- **THEN** the system MUST still launch successfully
- **AND** app data MUST NOT depend on the original source checkout path.
