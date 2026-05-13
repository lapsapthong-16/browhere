## Purpose
Define how supported local file contents, images, embeddings, metadata, and index records are prepared and stored.
## Requirements
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

### Requirement: Store Image Caption Embeddings
The system SHALL store generated image labels or captions as embedded text records linked to the original image file.

#### Scenario: Image caption is embedded
- **WHEN** a generated label or caption exists for a supported image
- **THEN** the system MUST request a text embedding for that label or caption
- **AND** persist the caption vector with the same file path and file identity as the raw image record.

#### Scenario: Raw image and caption both exist
- **WHEN** both raw image embedding and caption embedding succeed for an image
- **THEN** the system MUST keep both records searchable
- **AND** distinguish them by record kind or equivalent metadata.

### Requirement: Persist Structured File Metadata
The system SHALL persist structured file metadata in vector database records for search, filtering, and display.

#### Scenario: File record is persisted
- **WHEN** the system stores an indexed record for any supported file
- **THEN** it MUST persist file path, display name, extension, media type, size, modified time, approved folder root, record kind, and indexing timestamp.

#### Scenario: Image metadata is available
- **WHEN** image dimensions or image-specific metadata can be read without unsafe parsing
- **THEN** the system MUST persist available image metadata with the image records
- **AND** continue indexing if optional image metadata cannot be read.

### Requirement: Store Searchable Metadata Context
The system SHALL store a compact searchable metadata context for indexed files.

#### Scenario: Metadata context is created
- **WHEN** a file record is prepared for embedding or retrieval
- **THEN** the system MUST create metadata context from safe fields such as display name, extension, media type, parent folder names, size class, and modified time
- **AND** exclude sensitive fields and contents matched by default exclusions.

#### Scenario: Content text is weak or missing
- **WHEN** a file has no extracted text or generated caption
- **THEN** metadata context MUST remain available for retrieval fallback
- **AND** the record MUST identify metadata as the context source.

