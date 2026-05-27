## ADDED Requirements

### Requirement: Verify Desktop Release Baseline
The system SHALL define a repeatable release baseline for the desktop app before new product expansion work is accepted.

#### Scenario: Release checks are run
- **WHEN** a developer prepares a desktop release candidate
- **THEN** `npm run typecheck`, `npm run test`, `npm run build`, and `npm run test:e2e` MUST pass or have documented accepted failures
- **AND** manual Tauri launch, shortcut, window focus, native action, and packaged app checks MUST be recorded.

#### Scenario: A baseline check fails
- **WHEN** a required check fails
- **THEN** the release MUST NOT be marked complete until the failure is fixed or explicitly documented as out of scope for the release.

### Requirement: Keep Documentation Faithful To Implemented Scope
The system SHALL keep user-facing documentation aligned with the current desktop implementation.

#### Scenario: Desktop features are documented
- **WHEN** README or plan documents describe desktop app behavior
- **THEN** they MUST distinguish implemented behavior from planned future behavior
- **AND** they MUST NOT claim the app lacks desktop-native actions when open, reveal, folder picker, or shortcut behavior is implemented.

#### Scenario: Runtime or settings limitations remain
- **WHEN** a packaged app still requires a host dependency, restart, unsigned launch step, or non-secure settings storage
- **THEN** documentation MUST state that limitation in the desktop setup or release notes.
