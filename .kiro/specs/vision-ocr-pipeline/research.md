# Research Notes

## Summary

The vision OCR pipeline is an extension feature in the staged local-first Windows MVP. It consumes file lifecycle and job context from Local File Indexer, produces generated visual content payloads parallel to but distinct from Content Extraction Pipeline payloads, and exposes ready visual text to Semantic Vector Search. Discovery was integration-focused because upstream specs already define the relevant contracts and boundaries.

## Research Log

### Upstream Candidate and File Lifecycle Contracts

- **Sources reviewed**: `.kiro/specs/local-file-indexer/requirements.md`, `.kiro/specs/local-file-indexer/design.md`
- **Findings**: The indexer owns registered roots, file identity, metadata freshness, durable jobs, deletion state, and aggregate status. It explicitly excludes OCR, image captioning, embeddings, and retrieval.
- **Implication**: Vision work must consume stable `FileRecord` identity and job state rather than crawling independently. Visual enrichment state must use source versions to avoid duplicate or stale current payloads.

### Born-Digital Extraction Boundary

- **Sources reviewed**: `.kiro/specs/content-extraction-pipeline/design.md`
- **Findings**: Content extraction owns parser selection and normalized text payloads for PDF, DOCX, plain text, Markdown, notes, and code. It explicitly excludes OCR for scanned PDFs or images and image captioning.
- **Implication**: Vision can process scanned-document candidates and image pixels, but must label generated OCR as visual text and must not take over born-digital parsing or ready-for-embedding ownership for text-bearing formats.

### Semantic Search Integration

- **Sources reviewed**: `.kiro/specs/semantic-vector-search/requirements.md`, `.kiro/specs/semantic-vector-search/design.md`
- **Findings**: Semantic search consumes current extracted payloads, chunks text, generates embeddings, persists vectors, retrieves and ranks file-level results, and returns shell-compatible `SearchResult` values. Its boundary excludes OCR and image captioning.
- **Implication**: Vision must expose a `VisualContentReader` equivalent that returns current generated visual text and trace metadata. Semantic search remains responsible for chunking or adapting payloads to embedding records, vector freshness, ranking, and result explanations.

### Desktop Result Presentation

- **Sources reviewed**: `.kiro/specs/desktop-search-shell/design.md`
- **Findings**: The shell presents `SearchResult` with optional `MatchContext` variants of snippet, caption, or explanation. It owns UI states and file actions, not search internals.
- **Implication**: Vision payloads should include match-context metadata suitable for downstream search, but should not require new UI components or expose provider diagnostics directly to users.

### Privacy and Performance Constraints

- **Sources reviewed**: `.kiro/steering/roadmap.md`, `.kiro/specs/vision-ocr-pipeline/brief.md`
- **Findings**: The product is local-first, user-approved-folder scoped, provider choices must stay replaceable, and visual processing can be expensive. Remote AI use should require explicit consent. Privacy/performance controls are a downstream spec.
- **Implication**: The design uses provider-neutral OCR and vision adapters, local-only defaults, queueable work, explicit policy decisions, and status fields that future controls can govern without moving those controls into this spec.

## Architecture Pattern Evaluation

| Option | Decision | Rationale |
|--------|----------|-----------|
| Embed OCR and captioning inside Content Extraction Pipeline | Rejected | Would violate the extraction spec's explicit boundary around born-digital text and image OCR ownership. |
| Embed vision processing inside Semantic Vector Search | Rejected | Would mix enrichment generation with embedding, ranking, and retrieval ownership. |
| Separate visual enrichment worker with provider ports and payload reader | Chosen | Preserves staged boundaries, keeps visual processing replaceable, and gives semantic search a clean ready-content interface. |

## Design Decisions

- Generalize OCR, caption, and tag outputs as `VisualSignal` records under one `VisualContentPayload`, while limiting current implementation scope to OCR text, one caption set, and generated non-biometric tags.
- Adopt provider-neutral adapter contracts instead of committing to a specific OCR or vision library in the spec. Implementation may choose local engines or remote adapters later under policy.
- Use source version plus enrichment version as the freshness guard so retries and restarts cannot create duplicate current payloads.
- Keep match-context preparation as metadata and labeled spans, not final UI rendering. Semantic search and shell contracts remain authoritative downstream.

## Risks and Mitigations

- **Expensive image processing**: Queue work, expose throttled status, and design batch/concurrency settings as policy inputs.
- **Privacy-sensitive screenshots/photos**: Default to local processing or pending state and require explicit provider policy for remote processing.
- **Low-confidence generated descriptions**: Persist confidence and low-confidence status, and avoid fabricating captions or tags.
- **Boundary drift into born-digital text extraction**: Preserve generated modality labels and scanned-document candidate handling, while leaving born-digital parsing to Content Extraction Pipeline.
- **Stale visual data in search**: Filter ready reads to current payloads and invalidate or remove payloads on source version, deletion, or provider-policy changes.

## Synthesis Outcomes

- The smallest viable architecture is a visual enrichment worker, processor adapters, repository, freshness service, status service, and reader contract. A separate retrieval or ranking layer is unnecessary here.
- Build-vs-adopt remains implementation-time for concrete OCR/vision engines because project dependencies are not yet established. The spec fixes the adapter shape and privacy behavior instead of selecting a vendor.
- Downstream revalidation is required if payload shape, provider policy semantics, freshness states, or result-context metadata change.
