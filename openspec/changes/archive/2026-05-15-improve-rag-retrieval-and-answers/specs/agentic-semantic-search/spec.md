## MODIFIED Requirements

### Requirement: Use Bounded Groq Retrieval Agent
The system SHALL use Groq chat for bounded agentic retrieval orchestration when Groq is configured, while preserving local deterministic retrieval when Groq is unavailable.

#### Scenario: Search query is submitted
- **WHEN** the user submits a search query
- **THEN** Groq MAY rewrite the query, identify retrieval intents, and request a limited number of vector retrieval passes
- **AND** the system MUST enforce a configured maximum number of retrieval passes
- **AND** the system MUST preserve the original query as one retrieval input.

#### Scenario: Query understanding is available
- **WHEN** the user submits a search query
- **THEN** the system MUST derive structured query intent for supported filters such as file type, folder hint, date hint, visual intent, OCR/text intent, and answer intent
- **AND** retrieval MUST apply those filters or boosts without requiring exact text matches.

#### Scenario: Candidate results are retrieved
- **WHEN** local vector search returns candidate chunks
- **THEN** Groq MUST be able to rerank candidates using the query, snippets, evidence source labels, score components, and safe file metadata
- **AND** the final response MUST preserve file-level result identities from the local index.

### Requirement: Explain Matches
The system SHALL provide concise, evidence-specific match context for each returned file.

#### Scenario: Result is shown
- **WHEN** a file appears in search results
- **THEN** the result MUST include a snippet, caption, OCR text, metadata summary, raw visual notice, or explanation describing why it matched the query.

#### Scenario: Score details are available
- **WHEN** a file appears in search results
- **THEN** the result MUST expose the evidence source and score components used for ranking in the API response.

#### Scenario: Generated evidence is shown
- **WHEN** match context comes from AI-generated visual caption, OCR text, or LLM explanation
- **THEN** the result MUST identify that provenance and MUST NOT imply the evidence was human-authored.

### Requirement: Search With Caption And Metadata Context
The system SHALL use extracted text, generated visual image captions, image OCR text, and selected file metadata as retrieval context.

#### Scenario: Image result has no extracted text
- **WHEN** vector search returns an image candidate without extracted text
- **THEN** the system MUST use generated visual captions, OCR text, and safe metadata as candidate snippets for reranking and explanation when available
- **AND** avoid rejecting the image solely because no human-authored text snippet exists.

#### Scenario: Metadata helps identify a file
- **WHEN** a query matches safe metadata such as file type, display name, parent folder, or modified time
- **THEN** the system MUST be able to retrieve or rerank the matching file using that metadata context.

#### Scenario: OCR intent is detected
- **WHEN** the user query asks for readable text, signs, screenshots, labels, menus, or text visible in an image
- **THEN** the system MUST boost or prioritize OCR-text evidence over generic visual-caption evidence when both are available.

### Requirement: Preserve Result Evidence Source
The system SHALL expose which context source caused a file to match.

#### Scenario: Result is ranked
- **WHEN** the system returns a ranked file result
- **THEN** the result MUST identify whether match context came from extracted text, generated visual image caption, OCR text, raw image vector, metadata context, filename/path, or a combination.

#### Scenario: Groq generates explanation
- **WHEN** Groq explains a result
- **THEN** the prompt payload MUST include candidate context source labels
- **AND** the explanation MUST not imply the source was human-authored when it was AI-generated.

## ADDED Requirements

### Requirement: Configure Top-K Retrieval
The system SHALL support explicit top-k controls for retrieval and ranking.

#### Scenario: Search uses default top-k settings
- **WHEN** the user submits a search without custom retrieval options
- **THEN** the system MUST use configured defaults for semantic candidates per retrieval pass, lexical candidates, maximum retrieval passes, source caps, and final result count.

#### Scenario: Search uses request top-k settings
- **WHEN** the API request includes allowed top-k search options
- **THEN** the system MUST apply those options within configured maximum bounds
- **AND** reject or clamp values that exceed safe limits.

#### Scenario: Candidate diagnostics are returned
- **WHEN** search completes
- **THEN** the response MUST include enough retrieval diagnostics to identify retrieval passes, candidate counts, and final grouped result counts.

### Requirement: Rank Results With Hybrid Scoring
The system SHALL rank candidate files using a hybrid score rather than vector similarity alone.

#### Scenario: Multiple score signals exist
- **WHEN** semantic, lexical, filename/path, metadata, source confidence, filter, or recency signals are available
- **THEN** the system MUST combine those signals into an explicit ranking score
- **AND** expose score components in the API response.

#### Scenario: Groq is unavailable
- **WHEN** Groq reranking is unavailable
- **THEN** the system MUST still return locally ranked hybrid results.

#### Scenario: Groq reranks candidates
- **WHEN** Groq reranks a candidate set
- **THEN** Groq MUST receive only the bounded locally ranked candidates and their score components
- **AND** the system MUST preserve candidates not returned by Groq after the reranked items.
