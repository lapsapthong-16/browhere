## ADDED Requirements

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
