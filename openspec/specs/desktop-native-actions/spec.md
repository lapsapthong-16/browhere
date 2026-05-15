## Requirements

### Requirement: Select Folders With Native Dialog
The system SHALL allow desktop users to approve folders through a native macOS folder picker.

#### Scenario: Folder is selected
- **WHEN** the user selects a readable folder in the native folder picker
- **THEN** Browhere MUST add the selected path as an approved indexing root
- **AND** the folder MUST appear in indexing status.

#### Scenario: Folder picker is cancelled
- **WHEN** the user cancels the native folder picker
- **THEN** Browhere MUST leave the approved folder list unchanged
- **AND** the UI MUST remain usable.

### Requirement: Provide Native Result Actions
The system SHALL provide desktop-native actions for files returned in search results.

#### Scenario: Reveal result in Finder
- **WHEN** the user chooses reveal for a search result
- **THEN** Browhere MUST ask macOS Finder to reveal the selected file path
- **AND** the action MUST only be available for files from approved indexed folders.

#### Scenario: Open result with default app
- **WHEN** the user chooses open for a search result
- **THEN** Browhere MUST ask macOS to open the selected file with its default application
- **AND** the action MUST only be available for files from approved indexed folders.

#### Scenario: Copy result path
- **WHEN** the user chooses copy path for a search result
- **THEN** Browhere MUST place the selected file path on the clipboard.

### Requirement: Persist Desktop App Settings
The system SHALL persist desktop app settings outside the source repository.

#### Scenario: Provider keys are configured
- **WHEN** the desktop user saves provider credentials in app settings
- **THEN** Browhere MUST use those credentials for indexing and search
- **AND** the credentials MUST NOT be written into tracked source files.

#### Scenario: App is relaunched
- **WHEN** the user quits and relaunches the desktop app
- **THEN** Browhere MUST retain configured provider settings, index location, and shortcut preference.

### Requirement: Use App-Scoped Data Paths
The system SHALL default installed-app data storage to an app-scoped location rather than the source repository.

#### Scenario: Fresh installed app starts
- **WHEN** Browhere launches from an installed app bundle without `BROWHERE_INDEX_DIR`
- **THEN** the system MUST store index data in an app-scoped local data directory
- **AND** the index path MUST persist across app restarts.

#### Scenario: Development override is set
- **WHEN** `BROWHERE_INDEX_DIR` is configured during development
- **THEN** Browhere MUST respect the configured index directory
- **AND** desktop defaults MUST NOT break existing local development workflows.
