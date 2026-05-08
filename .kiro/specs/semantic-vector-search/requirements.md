# Requirements Document

## Introduction

Windows users need local file search that can find documents by remembered meaning rather than exact filenames or keywords. The project currently has no embedding generation, vector storage, query embedding, semantic retrieval, ranking layer, or explanation metadata. This feature establishes the semantic vector search core that consumes current extracted content, creates searchable content chunks and embeddings, stores vectors locally by default, retrieves natural-language matches, ranks them with file metadata signals, and returns result context that the Desktop Search Shell can present through its existing result contract.

## Boundary Context

- **In scope**: Provider-neutral semantic content intake, content chunk preparation for embedding, embedding provider abstraction, local vector persistence, embedding freshness state, query embedding, semantic similarity retrieval, metadata-aware ranking, file-level grouping, bounded availability hints, and match context for result presentation.
- **Out of scope**: Filesystem monitoring, file identity, raw document parsing, OCR, image captioning, desktop UI components, provider billing, cross-device sync, enterprise search, and privacy-control UI.
- **Adjacent expectations**: The Local File Indexer supplies stable file records, lifecycle state, and canonical `sourceVersion`. The Content Extraction Pipeline supplies current normalized text payloads and chunking hints. The Vision OCR Pipeline supplies current visual payloads with searchable OCR, caption, and tag text. Privacy Performance Controls owns provider mode semantics and policy decisions. The Desktop Search Shell consumes ranked results with optional match context and bounded `availabilityHint`.

## Requirements

### Requirement 1: Provider-Neutral Semantic Content Intake

**Objective:** As a semantic search implementer, I want text extraction and visual enrichment outputs to enter one stable semantic intake contract, so that embedding work does not depend on parser or vision internals.

#### Acceptance Criteria

1. When the Content Extraction Pipeline exposes a current payload with usable text, the Semantic Vector Search shall adapt it into a `SemanticContentInput` record through the shared semantic intake contract.
2. When the Vision OCR Pipeline exposes a current visual payload with usable OCR, caption, or tag text, the Semantic Vector Search shall adapt it into a `SemanticContentInput` record through the same shared semantic intake contract.
3. When either upstream source exposes a limited payload with usable text, the Semantic Vector Search shall accept the usable portion and preserve limited-content status in search metadata.
4. If upstream content is unsupported, empty, failed, pending, stale, policy-blocked, or removed, then the Semantic Vector Search shall exclude it from embedding-ready work.
5. When an accepted input includes source file identifiers, upstream artifact identifiers, and canonical `sourceVersion`, the Semantic Vector Search shall preserve those identifiers in all derived search records without parsing raw files or modifying upstream results.

### Requirement 2: Semantic Chunk Preparation

**Objective:** As a search backend integrator, I want extracted text split into stable semantic chunks, so that embeddings can point back to useful match context.

#### Acceptance Criteria

1. When a payload is prepared for embedding, the Semantic Vector Search shall divide its text into chunks suitable for semantic retrieval.
2. When extraction chunking hints are available, the Semantic Vector Search shall use those hints to preserve meaningful document boundaries where possible.
3. If text exceeds configured chunk limits, then the Semantic Vector Search shall create multiple ordered chunks without dropping traceability to the source file.
4. When chunks are created, the Semantic Vector Search shall record offsets, labels, and source version information needed to reconstruct match context.
5. The Semantic Vector Search shall produce stable chunk identifiers for the same file version and chunk boundaries.

### Requirement 3: Embedding Generation and Provider Policy

**Objective:** As a Windows user, I want semantic search to create embeddings through replaceable providers while honoring shared provider policy, so that the app can support local-only, remote-allowed, or hybrid modes without changing search behavior.

#### Acceptance Criteria

1. When chunks require embeddings, the Semantic Vector Search shall request embeddings through a provider-neutral interface.
2. When the default provider configuration is used, the Semantic Vector Search shall keep source text local unless Privacy Performance Controls returns an allow decision for the requested provider, modality, and shared `ProviderMode`.
3. If an embedding provider is unavailable, then the Semantic Vector Search shall record retryable embedding status without making search unavailable for already indexed content.
4. When an embedding provider returns vectors, the Semantic Vector Search shall associate each vector with its chunk, source file, canonical `sourceVersion`, source artifact ID, source kind, and provider model metadata.
5. Where provider policy changes are applied, the Semantic Vector Search shall consume Privacy Performance Controls impact plans to determine which existing embeddings need regeneration or invalidation.

### Requirement 4: Local Vector Index Persistence

**Objective:** As a Windows user, I want semantic search data stored locally and recoverably, so that indexed results survive app restarts without uploading personal documents by default.

#### Acceptance Criteria

1. When embeddings are generated, the Semantic Vector Search shall persist vectors and related metadata in local search storage.
2. When the app restarts, the Semantic Vector Search shall recover persisted vectors, chunk records, embedding status, and index freshness state.
3. If a source file is deleted or removed from indexing, then the Semantic Vector Search shall prevent its prior chunks and vectors from appearing in current search results.
4. When a newer canonical `sourceVersion` supersedes an older version, the Semantic Vector Search shall prevent stale vectors from being returned as current results.
5. The Semantic Vector Search shall expose vector index freshness status without exposing raw file contents.

### Requirement 5: Query Embedding and Retrieval

**Objective:** As a Windows user, I want natural language queries to find semantically related files, so that I can search by memory instead of exact text.

#### Acceptance Criteria

1. When the user submits a non-empty natural language query, the Semantic Vector Search shall create a query embedding through the same provider policy used for searchable content.
2. When a query embedding is available, the Semantic Vector Search shall retrieve semantically similar current chunks from the local vector index.
3. If no current vectors are available, then the Semantic Vector Search shall return an empty shell `SearchResponse` whose query-level readiness indicates semantic indexing is not ready.
4. If query embedding fails, then the Semantic Vector Search shall return a provider-unavailable search error without deleting indexed content.
5. The Semantic Vector Search shall ignore stale, removed, failed, and policy-invalidated vectors during retrieval.

### Requirement 6: Ranking and File-Level Grouping

**Objective:** As a Windows user, I want semantic matches ranked and grouped by file, so that result lists are concise and relevant.

#### Acceptance Criteria

1. When multiple matching chunks belong to the same file, the Semantic Vector Search shall group them into one file-level result.
2. When ranking file-level results, the Semantic Vector Search shall combine semantic similarity with available file metadata signals.
3. When ranking results, the Semantic Vector Search shall prefer current source versions over older unavailable versions.
4. If two results have equivalent relevance, then the Semantic Vector Search shall apply deterministic tie-breaking.
5. The Semantic Vector Search shall return results in ranked order suitable for the Desktop Search Shell.

### Requirement 7: Match Context and Result Contract

**Objective:** As a Windows user, I want each semantic result to show why it matched, so that I can trust the search result before opening a file.

#### Acceptance Criteria

1. When a result is returned, the Semantic Vector Search shall include the file path, display name, file type, rank, and action eligibility expected by the Desktop Search Shell.
2. When a result has matching chunks, the Semantic Vector Search shall include human-readable match context derived from the best available current chunk.
3. When limited-content or partial indexing affects a result, the Semantic Vector Search shall map internal readiness to the Desktop Search Shell `availabilityHint` bounded enum without exposing internal pipeline details.
4. If no safe snippet can be produced for a matching chunk, then the Semantic Vector Search shall return the result without fabricated match text.
5. The Semantic Vector Search shall not require desktop UI changes beyond consuming the established search result contract.

### Requirement 8: Incremental Freshness and Operational Status

**Objective:** As a user or operator, I want semantic search freshness and failures to be observable, so that incomplete results can be explained.

#### Acceptance Criteria

1. When extracted content changes for a file, the Semantic Vector Search shall mark affected chunks and embeddings as stale until refreshed.
2. When embedding refresh completes for the current canonical `sourceVersion`, the Semantic Vector Search shall mark the file's semantic index state as current.
3. If embedding, storage, or retrieval work fails for a file, then the Semantic Vector Search shall retain a failure reason and retry status.
4. While background embedding work is running, the Semantic Vector Search shall avoid blocking the desktop search interface.
5. The Semantic Vector Search shall provide aggregate semantic indexing status counts suitable for search readiness and diagnostics.
