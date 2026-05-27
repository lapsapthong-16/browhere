## MODIFIED Requirements

### Requirement: Manage The Next Runtime
The system SHALL manage the server-side runtime required by the existing Next.js API routes when running as a desktop app, without depending on a manually started terminal server or the source repository path in packaged mode.

#### Scenario: Desktop app starts
- **WHEN** the Tauri app starts in packaged mode
- **THEN** the system MUST start the bundled Next runtime or sidecar
- **AND** the system MUST wait for runtime readiness before loading API-dependent UI
- **AND** production launch MUST NOT require the user to run `npm run start`, open a terminal, or launch from the source checkout.

#### Scenario: Runtime port is selected
- **WHEN** the desktop app starts its local runtime
- **THEN** the system MUST avoid relying on a fixed port that may already be occupied
- **AND** the selected runtime URL MUST be used by the desktop webview.

#### Scenario: Runtime dependency is unavailable
- **WHEN** a required packaged runtime dependency cannot be started
- **THEN** Browhere MUST show or log a clear desktop-runtime error
- **AND** it MUST NOT silently show an API-dependent UI that cannot work.

#### Scenario: Desktop app exits
- **WHEN** the user quits Browhere
- **THEN** the system MUST stop the managed Next runtime
- **AND** the system MUST NOT leave orphaned runtime processes.

## ADDED Requirements

### Requirement: Avoid Source Checkout Data Dependency
The system SHALL keep installed-app data and runtime assets independent from the development source checkout.

#### Scenario: Packaged app is moved
- **WHEN** the built app is moved to `/Applications` or another folder
- **THEN** the app MUST still launch the packaged UI and runtime
- **AND** it MUST store app data in an app-scoped location unless a development override is explicitly configured.

#### Scenario: Development override is configured
- **WHEN** `BROWHERE_INDEX_DIR` or an equivalent development override is set
- **THEN** Browhere MUST respect that override in development
- **AND** packaged default behavior MUST still use app-scoped data paths.
