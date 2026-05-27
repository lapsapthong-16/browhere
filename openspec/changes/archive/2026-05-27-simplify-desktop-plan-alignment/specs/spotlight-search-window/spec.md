## MODIFIED Requirements

### Requirement: Register A Global Search Shortcut
The system SHALL register a configurable global keyboard shortcut for opening Browhere search while the desktop app is running.

#### Scenario: Shortcut is pressed from another app
- **WHEN** the user presses the configured shortcut while another macOS app is active
- **THEN** Browhere MUST show its compact search window
- **AND** the search input MUST be focused for immediate typing.

#### Scenario: Shortcut preference changes
- **WHEN** the user saves a different supported shortcut in desktop settings
- **THEN** Browhere MUST use the saved shortcut on the next registration attempt
- **AND** the UI MUST make clear whether a restart is required for the new shortcut to take effect.

#### Scenario: Shortcut cannot be registered
- **WHEN** macOS or another app prevents the shortcut from being registered
- **THEN** Browhere MUST report the failure in the desktop UI
- **AND** the app MUST continue running without crashing.

### Requirement: Show A Compact Search Window
The system SHALL provide a compact desktop search window optimized for quick search and result selection.

#### Scenario: Search window opens
- **WHEN** the global shortcut opens the search window
- **THEN** the window MUST appear centered on the active display
- **AND** the window MUST be brought above normal windows.

#### Scenario: User presses Escape
- **WHEN** the compact search window is focused and the user presses `Escape`
- **THEN** the system MUST hide the compact search window
- **AND** the background app MUST remain running
- **AND** Browhere MUST NOT register Escape as a global shortcut that intercepts Escape while other apps are active.
