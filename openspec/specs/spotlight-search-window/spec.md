## Requirements

### Requirement: Register A Global Search Shortcut
The system SHALL register a configurable global keyboard shortcut for opening Browhere search while the desktop app is running.

#### Scenario: Shortcut is pressed from another app
- **WHEN** the user presses the configured shortcut while another macOS app is active
- **THEN** Browhere MUST show its compact search window
- **AND** the search input MUST be focused for immediate typing.

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
- **AND** the background app MUST remain running.

### Requirement: Support Keyboard-First Search
The system SHALL allow the user to perform the primary search flow from the keyboard in the compact window.

#### Scenario: Query is submitted
- **WHEN** the user types a query and submits it from the compact search window
- **THEN** Browhere MUST call the existing search behavior
- **AND** ranked results MUST be displayed in the compact window.

#### Scenario: Result is selected
- **WHEN** search results are visible in the compact search window
- **THEN** the user MUST be able to move through results with the keyboard
- **AND** the selected result MUST expose the primary result action.

### Requirement: Keep Management UI Reachable
The system SHALL keep folder and index management available outside the compact search window.

#### Scenario: User opens management view
- **WHEN** the user chooses the management action from the desktop app
- **THEN** Browhere MUST show the full folder, provider, status, and document-log UI
- **AND** the compact search shortcut MUST remain available while the app is running.
