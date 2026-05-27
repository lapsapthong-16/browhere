## MODIFIED Requirements

### Requirement: Provide Native Result Actions
The system SHALL provide desktop-native actions for files returned in search results, and the Tauri command boundary SHALL authorize those actions against approved indexed folders.

#### Scenario: Reveal result in Finder
- **WHEN** the user chooses reveal for a search result
- **THEN** Browhere MUST ask macOS Finder to reveal the selected file path
- **AND** the action MUST only be available for files from approved indexed folders
- **AND** the Tauri reveal command MUST reject paths outside approved indexed folders even if invoked directly by the renderer.

#### Scenario: Open result with default app
- **WHEN** the user chooses open for a search result
- **THEN** Browhere MUST ask macOS to open the selected file with its default application
- **AND** the action MUST only be available for files from approved indexed folders
- **AND** the Tauri open command MUST reject paths outside approved indexed folders even if invoked directly by the renderer.

#### Scenario: Copy result path
- **WHEN** the user chooses copy path for a search result
- **THEN** Browhere MUST place the selected file path on the clipboard.

#### Scenario: File path no longer exists
- **WHEN** the user invokes a native open or reveal action for a stale result path
- **THEN** Browhere MUST return a clear failure
- **AND** it MUST NOT attempt to open a different path.

### Requirement: Persist Desktop App Settings
The system SHALL persist desktop app settings outside the source repository and SHALL distinguish safe settings from provider secrets.

#### Scenario: Provider keys are configured
- **WHEN** the desktop user saves provider credentials in app settings
- **THEN** Browhere MUST use those credentials for indexing and search after the documented apply point
- **AND** the credentials MUST NOT be written into tracked source files
- **AND** the storage mechanism MUST be documented if it is not backed by a secure platform secret store.

#### Scenario: App is relaunched
- **WHEN** the user quits and relaunches the desktop app
- **THEN** Browhere MUST retain configured provider settings, index location, and shortcut preference.
