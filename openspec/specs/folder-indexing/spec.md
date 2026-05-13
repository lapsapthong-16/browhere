## Purpose
Define how local folders are approved, discovered, watched, filtered, indexed, and reported to the user.

## Requirements

### Requirement: Register Approved Folders
The system SHALL allow the single local user to register and remove folders that are approved for indexing.

#### Scenario: Folder is registered
- **WHEN** the user submits a readable local folder path
- **THEN** the system MUST persist the normalized folder path as an approved indexing root
- **AND** the folder MUST appear in indexing status.

#### Scenario: Folder is removed
- **WHEN** the user removes an approved folder
- **THEN** the system MUST stop indexing that folder
- **AND** indexed records belonging to that folder MUST be excluded from future search results.

### Requirement: Apply Default Exclusions
The system SHALL skip sensitive, private, generated, and noisy files by default.

#### Scenario: Excluded path is discovered
- **WHEN** discovery reaches a path matching default exclusions such as `.env`, `.git`, `node_modules`, build output, cache folders, `*.key`, or `*.pem`
- **THEN** the system MUST skip the path
- **AND** the path MUST NOT be sent to cloud AI providers.

### Requirement: Discover Supported Files
The system SHALL recursively discover only V1 supported file types under approved folders.

#### Scenario: Supported files are found
- **WHEN** a folder contains `txt`, `md`, `pdf`, `docx`, `png`, `jpg`, or `jpeg` files
- **THEN** the system MUST create or update index jobs for those files.

#### Scenario: Unsupported files are found
- **WHEN** a folder contains unsupported files such as video, audio, spreadsheet, or executable files
- **THEN** the system MUST skip those files
- **AND** indexing status MUST be able to report them as unsupported or ignored without failing the whole index.

### Requirement: Watch Approved Folders
The system SHALL automatically watch approved folders for file additions, changes, and removals.

#### Scenario: File changes after initial indexing
- **WHEN** a supported file is created or modified under an approved folder
- **THEN** the system MUST enqueue that file for reindexing without requiring a manual update action.

#### Scenario: File is deleted
- **WHEN** a previously indexed file is removed from disk
- **THEN** the system MUST remove or mark stale its searchable records
- **AND** search results MUST NOT present it as an available result.

### Requirement: Report Indexing Status
The system SHALL expose indexing state for folders, files, queue progress, failures, and last indexed timestamps.

#### Scenario: Indexing is active
- **WHEN** the background indexer is processing files
- **THEN** the UI MUST be able to display active status, current file context when available, processed counts, skipped counts, and failed counts.

#### Scenario: A file fails indexing
- **WHEN** extraction, embedding, or persistence fails for a file
- **THEN** the system MUST record the failure reason
- **AND** indexing MUST continue for other eligible files.
