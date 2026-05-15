## ADDED Requirements

### Requirement: Generate Grounded Answers From Retrieved Evidence
The system SHALL generate answers only from bounded evidence retrieved from approved indexed folders.

#### Scenario: User requests an answer
- **WHEN** the user submits a search with answer intent or an explicit answer-generation option
- **THEN** the system MUST retrieve candidate evidence using the semantic search pipeline
- **AND** generate an answer using only the selected evidence context.

#### Scenario: Evidence is insufficient
- **WHEN** retrieved evidence does not support an answer
- **THEN** the system MUST return an insufficient-evidence response
- **AND** MUST NOT invent facts from outside the retrieved evidence.

#### Scenario: Groq is unavailable
- **WHEN** the configured answer provider is unavailable
- **THEN** the system MUST still return ranked retrieval results
- **AND** indicate that answer generation is unavailable.

### Requirement: Cite Answer Evidence
The system SHALL cite the local evidence used to generate an answer.

#### Scenario: Answer includes factual claims
- **WHEN** the generated answer states a fact from retrieved context
- **THEN** the answer MUST include citations to the supporting file and evidence record or chunk.

#### Scenario: Chunk location is available
- **WHEN** supporting evidence includes page, heading, section, or chunk index metadata
- **THEN** the citation MUST include that location metadata in the API response.

#### Scenario: Evidence comes from generated context
- **WHEN** supporting evidence comes from AI-generated visual caption, OCR text, metadata, or LLM explanation
- **THEN** the citation MUST identify that provenance.

### Requirement: Bound Answer Context
The system SHALL limit answer-generation payloads to selected candidate evidence.

#### Scenario: Context pack is built
- **WHEN** the system prepares answer context for a provider
- **THEN** it MUST include only approved-folder candidate snippets selected by retrieval and ranking
- **AND** MUST exclude full files, unrelated chunks, and records from unapproved folders.

#### Scenario: Context exceeds limit
- **WHEN** retrieved evidence exceeds the configured answer context budget
- **THEN** the system MUST select the highest-ranked diverse evidence records within the budget
- **AND** include diagnostics about omitted candidate counts in the API response.

### Requirement: Preserve Search Results With Answers
The system SHALL return answer output alongside the ranked retrieval results that supported it.

#### Scenario: Answer is generated
- **WHEN** answer generation succeeds
- **THEN** the response MUST include the answer text, citations, evidence ids, and ranked file results.

#### Scenario: User only searches for files
- **WHEN** the request does not include answer intent
- **THEN** the system MUST return normal ranked file results without requiring answer generation.
