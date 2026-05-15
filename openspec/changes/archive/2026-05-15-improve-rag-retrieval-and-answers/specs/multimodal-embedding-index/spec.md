## MODIFIED Requirements

### Requirement: Store Image Caption Embeddings
The system SHALL store generated image visual captions as embedded text records linked to the original image file.

#### Scenario: Image visual caption is embedded
- **WHEN** a generated visual label or caption exists for a supported image
- **THEN** the system MUST request a text embedding for that visual label or caption
- **AND** persist the caption vector with the same file path and file identity as the raw image record
- **AND** identify the record as visual-caption evidence.

#### Scenario: Raw image and caption both exist
- **WHEN** both raw image embedding and visual caption embedding succeed for an image
- **THEN** the system MUST keep both records searchable
- **AND** distinguish them by record kind or equivalent metadata.

### Requirement: Persist Local Index
The system SHALL store vectors, extracted chunks, file metadata, evidence metadata, and indexing status in local storage using LanceDB and local metadata files or tables.

#### Scenario: Chunk is persisted
- **WHEN** embedding succeeds for a chunk or evidence record
- **THEN** the system MUST persist the vector, chunk text, file path, display name, file type, size, modification marker, indexing timestamp, record kind, context source, and evidence provenance.

#### Scenario: File is unchanged
- **WHEN** a discovered file has the same content marker as the last indexed version
- **THEN** the system MUST reuse the existing indexed records when required evidence records already exist
- **AND** avoid sending unchanged content to Gemini again.

#### Scenario: New evidence type is missing for unchanged file
- **WHEN** a discovered unchanged file is missing a newly supported evidence record
- **THEN** the system MUST queue or perform a repair/indexing step for the missing evidence without reindexing unrelated records.

## ADDED Requirements

### Requirement: Store Image OCR Embeddings
The system SHALL store readable text detected in supported images as separate embedded OCR-text records linked to the original image file.

#### Scenario: Image OCR text is extracted
- **WHEN** a supported image contains readable text and OCR extraction succeeds
- **THEN** the system MUST request a text embedding for the OCR text
- **AND** persist the OCR vector with the same file path and file identity as the raw image record
- **AND** identify the record as OCR-text evidence.

#### Scenario: Image OCR text is unavailable
- **WHEN** OCR extraction fails or no readable text is detected
- **THEN** the system MUST preserve raw image and visual-caption records when available
- **AND** record OCR status without failing the entire file index.

#### Scenario: Caption and OCR both exist
- **WHEN** both visual caption text and OCR text exist for an image
- **THEN** the system MUST store them as separate searchable records
- **AND** retrieval MUST be able to score and explain them independently.

### Requirement: Persist Chunk Location Metadata
The system SHALL preserve location metadata for retrievable evidence where available.

#### Scenario: Document chunk has a location
- **WHEN** extracted document text includes page, heading, section, or chunk index metadata
- **THEN** the system MUST persist that location metadata with the embedded chunk.

#### Scenario: Result cites evidence
- **WHEN** search or answer generation returns evidence from a chunk
- **THEN** the system MUST be able to reference the chunk or evidence id and any available page or section metadata.
