## MODIFIED Requirements

### Requirement: Browser UI Displays Search Results
The system SHALL display ranked file results in the Next.js React UI and SHALL support optional desktop-native result actions when the UI is running inside the Tauri desktop app.

#### Scenario: Results are available in browser
- **WHEN** search completes successfully in the browser web app
- **THEN** the UI MUST show ranked results with display name, file path, file type, match context, and readiness status
- **AND** it MUST NOT require desktop-native file actions in the browser workflow.

#### Scenario: Results are available in desktop app
- **WHEN** search completes successfully inside the Tauri desktop app
- **THEN** the UI MUST show ranked results with display name, file path, file type, match context, and readiness status
- **AND** it MUST expose desktop-native result actions when those actions are available.
