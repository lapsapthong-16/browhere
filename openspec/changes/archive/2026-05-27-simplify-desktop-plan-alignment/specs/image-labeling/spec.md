## MODIFIED Requirements

### Requirement: Generate Image Labels
The system SHALL generate searchable AI visual captions for supported image files using configured cloud vision behavior, and SHALL repair missing caption evidence without duplicating existing records.

#### Scenario: Image visual caption is generated
- **WHEN** the indexer processes a supported `png`, `jpg`, or `jpeg` image
- **THEN** the system MUST request a concise visual caption describing visible non-text content
- **AND** the caption MUST be associated with the same file identity as the image
- **AND** the caption MUST be stored separately from OCR/readable-text evidence.

#### Scenario: Image label generation fails
- **WHEN** image visual caption generation fails for a supported image
- **THEN** the system MUST preserve the raw image embedding result and OCR-text result when available
- **AND** record visual caption generation failure without failing the entire folder index
- **AND** schedule a repair task when the failure is retryable or caused by missing provider configuration.

#### Scenario: Image label repair succeeds
- **WHEN** a queued image label repair later generates and embeds a visual caption
- **THEN** the file label status MUST become `generated`
- **AND** exactly one visual-caption evidence record MUST exist for that file identity
- **AND** the corresponding repair task MUST be removed.

### Requirement: Persist Image Label Provenance
The system SHALL track whether result context came from generated visual captions or OCR-text evidence.

#### Scenario: Visual caption is persisted
- **WHEN** a generated visual caption is stored
- **THEN** the record MUST identify the context source as AI-generated visual captioning
- **AND** include the provider/model identifier when available.

#### Scenario: OCR text is persisted
- **WHEN** OCR/readable-text evidence is stored
- **THEN** the record MUST identify the context source as OCR or AI-derived readable-text extraction
- **AND** include the provider/model identifier when available.

#### Scenario: Image evidence appears in a result
- **WHEN** search returns an image matched through visual caption or OCR text
- **THEN** the result MUST be able to show the matched evidence and its provenance as match context.
