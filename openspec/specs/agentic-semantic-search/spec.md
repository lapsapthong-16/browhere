## Purpose
Define how indexed local files are searched, reranked, explained, and displayed using bounded cloud AI calls.
## Requirements
### Requirement: Search By Natural Language Meaning
The system SHALL let the user search indexed files using natural-language descriptions rather than filenames or folder paths.

#### Scenario: User searches for visual content
- **WHEN** the user searches for a remembered visual concept such as a McDonald's image
- **THEN** the system MUST retrieve relevant indexed image files when their visual embeddings or fallback descriptions match the query.

#### Scenario: User searches for document topic
- **WHEN** the user searches for a topic such as a document about lizards
- **THEN** the system MUST retrieve relevant text or document files based on indexed content chunks even when the filename is unrelated.

### Requirement: Use Bounded Groq Retrieval Agent
The system SHALL use Groq chat for bounded agentic retrieval orchestration.

#### Scenario: Search query is submitted
- **WHEN** the user submits a search query
- **THEN** Groq MAY rewrite the query, identify retrieval intents, and request a limited number of vector retrieval passes
- **AND** the system MUST enforce a configured maximum number of retrieval passes.

#### Scenario: Candidate results are retrieved
- **WHEN** local vector search returns candidate chunks
- **THEN** Groq MUST be able to rerank candidates using the query, snippets, and file metadata
- **AND** the final response MUST preserve file-level result identities from the local index.

### Requirement: Explain Matches
The system SHALL provide concise match context for each returned file.

#### Scenario: Result is shown
- **WHEN** a file appears in search results
- **THEN** the result MUST include a snippet, caption, or explanation describing why it matched the query.

### Requirement: Respect Provider Configuration
The system SHALL require local environment variables for Gemini and Groq credentials.

#### Scenario: Groq key is missing
- **WHEN** the Groq API key is missing
- **THEN** the system MUST still be able to return basic vector search results when Gemini query embedding is available
- **AND** the UI MUST indicate that agentic reranking or explanations are unavailable.

### Requirement: Limit Search Data Sent To Groq
The system SHALL send only the user query, candidate snippets, and file metadata needed for reranking and explanation to Groq.

#### Scenario: Groq reranking is invoked
- **WHEN** candidate results are sent to Groq
- **THEN** the payload MUST exclude full files and non-candidate indexed chunks
- **AND** it MUST include only data from approved indexed folders.

### Requirement: Browser UI Displays Search Results
The system SHALL display ranked file results in the Next.js React UI without native open/reveal actions.

#### Scenario: Results are available
- **WHEN** search completes successfully
- **THEN** the UI MUST show ranked results with display name, file path, file type, match context, and readiness status
- **AND** it MUST NOT require desktop-native file actions in V1.

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

