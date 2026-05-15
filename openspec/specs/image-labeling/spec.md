# image-labeling Specification

## Purpose
Define how supported image files produce searchable visual-caption and OCR evidence for retrieval.

## Requirements
### Requirement: Generate Image Labels
The system SHALL generate searchable AI visual captions for supported image files using configured cloud vision behavior.

#### Scenario: Image visual caption is generated
- **WHEN** the indexer processes a supported `png`, `jpg`, or `jpeg` image
- **THEN** the system MUST request a concise visual caption describing visible non-text content
- **AND** the caption MUST be associated with the same file identity as the image
- **AND** the caption MUST be stored separately from OCR/readable-text evidence.

#### Scenario: Image label generation fails
- **WHEN** image visual caption generation fails for a supported image
- **THEN** the system MUST preserve the raw image embedding result and OCR-text result when available
- **AND** record visual caption generation failure without failing the entire folder index.

### Requirement: Label Captures Retrieval Evidence
The system SHALL generate visual captions that are useful for search explanations and reranking.

#### Scenario: Visible image evidence exists
- **WHEN** the image contains recognizable objects, logos, places, scenes, colors, layout, or visual details
- **THEN** the generated visual caption MUST include those visible details when available
- **AND** avoid claiming facts that are not visible in the image or metadata.

#### Scenario: Image contains readable text
- **WHEN** the image contains readable signs, screenshots, document text, labels, or menus
- **THEN** readable text MUST be captured as OCR-text evidence when OCR behavior is available
- **AND** visual caption text MAY summarize that text only as visible evidence.

#### Scenario: Image has no useful visible content
- **WHEN** the image does not contain recognizable visual evidence
- **THEN** the generated visual caption MUST indicate limited visible content
- **AND** the system MUST still store file metadata for retrieval fallback.

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
