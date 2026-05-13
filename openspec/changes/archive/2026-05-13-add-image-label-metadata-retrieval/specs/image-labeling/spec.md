## ADDED Requirements

### Requirement: Generate Image Labels
The system SHALL generate searchable AI labels or captions for supported image files using configured cloud vision behavior.

#### Scenario: Image label is generated
- **WHEN** the indexer processes a supported `png`, `jpg`, or `jpeg` image
- **THEN** the system MUST request a concise label or caption describing visible content
- **AND** the label MUST be associated with the same file identity as the image.

#### Scenario: Image label generation fails
- **WHEN** image label generation fails for a supported image
- **THEN** the system MUST preserve the raw image embedding result when available
- **AND** record label generation failure without failing the entire folder index.

### Requirement: Label Captures Retrieval Evidence
The system SHALL generate labels that are useful for search explanations and reranking.

#### Scenario: Visible image evidence exists
- **WHEN** the image contains recognizable objects, logos, places, readable text, or scene details
- **THEN** the generated label MUST include those visible details when available
- **AND** avoid claiming facts that are not visible in the image or metadata.

#### Scenario: Image has no useful visible content
- **WHEN** the image does not contain recognizable visual evidence
- **THEN** the generated label MUST indicate limited visible content
- **AND** the system MUST still store file metadata for retrieval fallback.

### Requirement: Persist Image Label Provenance
The system SHALL track whether result context came from generated image labels.

#### Scenario: Label is persisted
- **WHEN** a generated image label is stored
- **THEN** the record MUST identify the context source as AI-generated image labeling
- **AND** include the provider/model identifier when available.

#### Scenario: Label appears in a result
- **WHEN** search returns an image matched through a generated label
- **THEN** the result MUST be able to show the generated label as match context.
