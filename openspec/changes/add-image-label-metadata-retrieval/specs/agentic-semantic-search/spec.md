## ADDED Requirements

### Requirement: Search With Caption And Metadata Context
The system SHALL use extracted text, generated image labels, and selected file metadata as retrieval context.

#### Scenario: Image result has no extracted text
- **WHEN** vector search returns an image candidate without extracted text
- **THEN** the system MUST use generated image labels and safe metadata as the candidate snippet for reranking and explanation
- **AND** avoid rejecting the image solely because no text snippet exists.

#### Scenario: Metadata helps identify a file
- **WHEN** a query matches safe metadata such as file type, display name, parent folder, or modified time
- **THEN** the system MUST be able to retrieve or rerank the matching file using that metadata context.

### Requirement: Preserve Result Evidence Source
The system SHALL expose which context source caused a file to match.

#### Scenario: Result is ranked
- **WHEN** the system returns a ranked file result
- **THEN** the result MUST identify whether match context came from extracted text, generated image label, raw image vector, metadata context, or a combination.

#### Scenario: Groq generates explanation
- **WHEN** Groq explains a result
- **THEN** the prompt payload MUST include candidate context source labels
- **AND** the explanation MUST not imply the source was human-authored when it was AI-generated.

### Requirement: Limit Metadata Sent To Groq
The system SHALL send only bounded, safe metadata for candidate results to Groq.

#### Scenario: Candidate payload is built
- **WHEN** candidate results are sent to Groq for reranking or explanation
- **THEN** the payload MUST include only selected metadata needed for retrieval context
- **AND** exclude full file contents, non-candidate chunks, and paths outside approved folders.
