## MODIFIED Requirements

### Requirement: Report Indexing Status
The system SHALL expose indexing state for folders, files, queue progress, failures, repair retry state, and last indexed timestamps.

#### Scenario: Indexing is active
- **WHEN** the background indexer is processing files
- **THEN** the UI MUST be able to display active status, current file context when available, processed counts, skipped counts, and failed counts.

#### Scenario: A file fails indexing
- **WHEN** extraction, embedding, persistence, permission checking, or metadata handling fails for a file
- **THEN** the system MUST record the failure reason with file path and timestamp
- **AND** indexing MUST continue for other eligible files
- **AND** status MUST NOT silently clear the failure before it is visible to the user.

#### Scenario: Repair task is scheduled
- **WHEN** a partial index record has a queued or cooldown repair task
- **THEN** indexing status MUST expose queued, running, cooldown, next retry, and last error details sufficient for the UI to explain the delayed state.

## ADDED Requirements

### Requirement: Run Repair Queue Reliably
The system SHALL process due repair tasks without requiring a manual reindex of unchanged files.

#### Scenario: Repair cooldown expires
- **WHEN** a repair task reaches its next retry time and the app is running
- **THEN** Browhere MUST attempt the repair from a startup, status, search, or scheduled repair trigger
- **AND** the repair MUST respect provider availability and cooldown limits.

#### Scenario: Repair succeeds
- **WHEN** a repair task successfully creates the missing evidence
- **THEN** Browhere MUST update the file status and evidence count
- **AND** remove the completed repair task from the repair queue.
