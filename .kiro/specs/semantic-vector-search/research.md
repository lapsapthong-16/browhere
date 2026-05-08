# Research & Design Decisions

## Summary

- **Feature**: `semantic-vector-search`
- **Discovery Scope**: Complex Integration
- **Key Findings**:
  - Upstream contracts already separate file identity from extracted content: `FileRecord` and indexer jobs identify files, while `ExtractedContentPayload` provides normalized text and chunking hints.
  - The Desktop Search Shell already defines a provider-facing `SearchResult` shape with optional `MatchContext`; semantic search can implement this provider boundary without owning UI components.
  - The safest MVP design is provider-neutral and local-first: keep embeddings and vectors local by default, make provider policy an explicit input, and avoid committing to one vector database engine before implementation.

## Research Log

### Upstream Content and File Contracts

- **Context**: Semantic search depends on both file lifecycle state and normalized extracted content.
- **Sources Consulted**: `.kiro/specs/local-file-indexer/requirements.md`, `.kiro/specs/local-file-indexer/design.md`, `.kiro/specs/content-extraction-pipeline/requirements.md`, `.kiro/specs/content-extraction-pipeline/design.md`
- **Findings**:
  - Local File Indexer owns indexed roots, `FileRecord`, deletion state, and durable jobs.
  - Content Extraction Pipeline owns parser selection, `ExtractedContentPayload`, `SourceFileReference`, `ChunkHint`, extraction status, and ready-for-embedding reads.
  - Extraction explicitly excludes embedding generation, vector persistence, retrieval ranking, and result explanation.
- **Implications**:
  - Semantic Vector Search should consume extracted payloads by reader contract rather than reading raw files.
  - All chunk, embedding, and vector records must preserve `fileId` and extraction version so stale results can be removed from current retrieval.

### Desktop Result Presentation Contract

- **Context**: Search results must be usable by the shell without new UI ownership.
- **Sources Consulted**: `.kiro/specs/desktop-search-shell/design.md`
- **Findings**:
  - The shell consumes `SearchProvider.search(query)` and renders ranked `SearchResult` values.
  - `SearchResult` requires identity, rank, path, display name, file type, and action eligibility, with optional `MatchContext`.
  - The shell explicitly excludes indexing, embeddings, vector storage, and ranking algorithms.
- **Implications**:
  - Semantic search should expose a provider implementation that returns the existing shell contract.
  - Match explanation should fit `MatchContext` instead of requiring desktop component changes.

### Architecture and Storage Options

- **Context**: The brief requires local vector storage and replaceable embedding provider and vector database choices.
- **Sources Consulted**: Project roadmap, upstream specs, Kiro design principles
- **Findings**:
  - The roadmap emphasizes local-first Windows MVP behavior, staged specs, and replaceable AI provider choices.
  - A ports-and-adapters design keeps embedding providers and vector storage replaceable.
  - A local embedded vector index is sufficient for MVP as long as it supports vector upsert, deletion or tombstoning, similarity search, and metadata filters.
- **Implications**:
  - The design defines `EmbeddingProvider` and `VectorIndex` contracts, with a local adapter selected during implementation.
  - Provider model metadata is part of embedding records so model changes can trigger regeneration.

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks / Limitations | Notes |
|--------|-------------|-----------|---------------------|-------|
| Ports and adapters | Domain services call provider and vector-store ports through narrow interfaces | Keeps providers replaceable, supports local-first policy, aligns with upstream designs | Requires explicit adapter and contract tests | Selected |
| Direct provider and store coupling | Search service calls one embedding SDK and one vector database directly | Faster first implementation | Locks the product to one model and store, conflicts with roadmap constraints | Rejected |
| Remote search backend | Upload extracted content to a hosted semantic search service | Simplifies local indexing complexity | Conflicts with privacy expectations and local-first default | Rejected for MVP |

## Design Decisions

### Decision: Own Chunks and Embeddings, Not Extracted Content

- **Context**: Extraction already owns parser output and normalized payloads.
- **Alternatives Considered**:
  1. Store copied full extracted text inside semantic search.
  2. Store only chunk text, offsets, and source version references derived from current payloads.
- **Selected Approach**: Semantic search stores chunk records and embedding metadata derived from extracted payloads, while source payload ownership remains with extraction.
- **Rationale**: This preserves traceability without creating a second owner for parser output.
- **Trade-offs**: Match snippets require enough chunk text or offset context to be persisted; full extraction payload reads remain upstream-owned.
- **Follow-up**: Validate whether implementation stores snippet-safe chunk text or reconstructs snippets from extraction payload offsets.

### Decision: Provider-Neutral Embedding Boundary

- **Context**: The roadmap requires local, remote, or hybrid AI modes without rewriting search.
- **Alternatives Considered**:
  1. Hard-code one local embedding model.
  2. Hard-code one remote embedding API.
  3. Define an embedding provider port with model metadata and policy checks.
- **Selected Approach**: Define an `EmbeddingProvider` contract and an `EmbeddingPolicy` input that defaults to local-only.
- **Rationale**: This keeps the MVP privacy-safe while allowing future provider controls to change policy.
- **Trade-offs**: Provider adapters need conformance tests and consistent vector dimension handling.
- **Follow-up**: Verify selected provider dimensions and batching behavior during implementation.

### Decision: Local Vector Index Behind a Replaceable Port

- **Context**: The brief calls for local vector storage by default but avoids early database lock-in.
- **Alternatives Considered**:
  1. Use a fixed embedded vector database throughout the design.
  2. Store vectors in a generic local persistence layer with linear scan.
  3. Define a `VectorIndex` port with local adapter semantics.
- **Selected Approach**: Define a `VectorIndex` contract for upsert, remove, query, and freshness metadata; choose the physical engine during implementation.
- **Rationale**: The contract captures current product needs without locking the spec to one engine.
- **Trade-offs**: Performance depends on the selected adapter and must be validated with representative local datasets.
- **Follow-up**: Benchmark query latency and update cost after the first adapter is implemented.

## Risks & Mitigations

- Provider policy drift could expose text remotely by mistake — centralize provider policy evaluation before embedding content or queries.
- Stale vectors could appear after file edits or deletion — require source version filters and current-state checks during retrieval.
- Large files could create too many chunks — enforce chunk limits and persist limited indexing status.
- Ranking may be hard to trust without context — return best chunk context and stable score metadata for every explainable result.

## References

- `.kiro/steering/roadmap.md` — product scope, dependency order, and local-first constraints.
- `.kiro/specs/local-file-indexer/design.md` — upstream file identity and lifecycle contracts.
- `.kiro/specs/content-extraction-pipeline/design.md` — upstream extracted payload and ready-for-embedding contracts.
- `.kiro/specs/desktop-search-shell/design.md` — downstream result presentation contract.
