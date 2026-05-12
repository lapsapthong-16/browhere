## ADDED Requirements

### Requirement: Extract Text Content
The system SHALL extract searchable text from supported text and document files.

#### Scenario: Text file is indexed
- **WHEN** the indexer processes a `txt` or `md` file
- **THEN** the system MUST read its textual contents
- **AND** split the contents into retrievable chunks.

#### Scenario: Document file is indexed
- **WHEN** the indexer processes a `pdf` or `docx` file
- **THEN** the system MUST extract text where possible
- **AND** preserve a failure or partial-content status when text extraction is incomplete.

### Requirement: Embed Image Content
The system SHALL index supported image files using Gemini multimodal embeddings.

#### Scenario: Raw image embedding succeeds
- **WHEN** the indexer processes a `png`, `jpg`, or `jpeg` file
- **THEN** the system MUST first attempt to send the raw image content to Gemini for embedding
- **AND** store the resulting vector with file metadata.

#### Scenario: Raw image embedding is unavailable
- **WHEN** Gemini cannot embed a raw image for the selected API/model
- **THEN** the system MUST fall back to searchable image text derived from available metadata and supported cloud description behavior
- **AND** mark the record as partial when visual semantics are limited.

### Requirement: Generate Gemini Embeddings
The system SHALL use Gemini cloud APIs to generate embeddings for all supported indexed chunks and search queries.

#### Scenario: Content chunk is embedded
- **WHEN** a text, document, or image chunk is ready for indexing
- **THEN** the system MUST request a Gemini embedding
- **AND** validate that the returned vector matches the configured vector dimension before persistence.

#### Scenario: Gemini key is missing
- **WHEN** the Gemini API key is not configured in local environment variables
- **THEN** indexing and search MUST report provider-unavailable status
- **AND** file contents MUST NOT be sent.

### Requirement: Persist Local Index
The system SHALL store vectors, extracted chunks, file metadata, and indexing status in local storage using LanceDB and local metadata files or tables.

#### Scenario: Chunk is persisted
- **WHEN** embedding succeeds for a chunk
- **THEN** the system MUST persist the vector, chunk text, file path, display name, file type, size, modification marker, and indexing timestamp.

#### Scenario: File is unchanged
- **WHEN** a discovered file has the same content marker as the last indexed version
- **THEN** the system MUST reuse the existing indexed records
- **AND** avoid sending unchanged content to Gemini again.

### Requirement: Keep Index Local Except AI Calls
The system SHALL keep the vector database and extracted chunks on the user's machine for V1.

#### Scenario: Index is queried
- **WHEN** the user searches
- **THEN** vector lookup MUST read from local LanceDB
- **AND** no hosted vector database MUST be required.
