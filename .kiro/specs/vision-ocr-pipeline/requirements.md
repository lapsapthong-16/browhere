# Requirements Document

## Introduction

Windows users need local semantic search to find screenshots, scanned documents, and photos by remembered visual meaning or text embedded inside images. The current project has no OCR pipeline, scanned-document handling, image captioning, generated visual tags, or normalized payload shape that semantic search can embed. This feature establishes a local-first vision and OCR enrichment pipeline that consumes image-like files and scanned-document candidates from the Local File Indexer, emits OCR text, captions, tags, confidence and error metadata, and exposes searchable visual content to Semantic Vector Search without owning born-digital document extraction, vector storage, retrieval, or desktop result presentation.

## Boundary Context

- **In scope**: Intake of image and scanned-document candidates, OCR for screenshots and scans, image caption generation, generated visual tags, confidence metadata, retryable error metadata, normalized visual content payloads, visual enrichment freshness state, and ready-for-embedding reads for Semantic Vector Search.
- **Out of scope**: Born-digital PDF/DOCX/plain-text extraction, file discovery, vector database internals, embedding generation, ranking, desktop UI rendering, image editing, photo library management, face recognition, biometric identification, cloud albums, and manual tagging workflows.
- **Adjacent expectations**: Local File Indexer supplies stable file records, canonical `sourceVersion`, file lifecycle state, and durable `PipelineWorkItem` records with `targetProcessor = "visualEnrichment"`. Content Extraction Pipeline remains authoritative for born-digital text payloads. Semantic Vector Search consumes generated visual text through provider-neutral semantic intake and owns embeddings and retrieval. Desktop Search Shell presents results through its established `SearchResult` and `MatchContext` contracts. Privacy Performance Controls owns provider mode semantics, remote processing consent, queue concurrency, and resource limits.

## Requirements

### Requirement 1: Visual Candidate Intake

**Objective:** As a search backend integrator, I want visual files and scanned-document candidates accepted from indexed file state, so that visual enrichment runs only on eligible local files.

#### Acceptance Criteria

1. When the Local File Indexer exposes an eligible image-like file, the Vision OCR Pipeline shall accept that file as a visual enrichment candidate.
2. When the Local File Indexer exposes a scanned-document candidate, the Vision OCR Pipeline shall accept that file as a visual enrichment candidate.
3. If a file is outside indexed roots, deleted, removed, excluded, unsupported, or inaccessible, then the Vision OCR Pipeline shall exclude it from visual enrichment work.
4. When a candidate is accepted, the Vision OCR Pipeline shall preserve the source file identifier, root identifier, path, display name, canonical file type, normalized extension, modified timestamp when available, and canonical `sourceVersion` needed for downstream traceability.
5. The Vision OCR Pipeline shall not discover files independently of the Local File Indexer.

### Requirement 2: OCR Text Extraction

**Objective:** As a Windows user, I want text inside screenshots and scanned documents to become searchable, so that I can find files by words visible in an image.

#### Acceptance Criteria

1. When a screenshot or image file contains readable text, the Vision OCR Pipeline shall produce normalized OCR text for that file.
2. When a scanned document candidate contains readable text, the Vision OCR Pipeline shall produce normalized OCR text for that file.
3. If OCR detects multiple text regions or pages, then the Vision OCR Pipeline shall preserve ordering and region or page labels when available.
4. If no readable text is detected, then the Vision OCR Pipeline shall record an empty-OCR status without treating the entire visual enrichment as failed.
5. The Vision OCR Pipeline shall distinguish OCR text generated from visual pixels from born-digital document text produced by the Content Extraction Pipeline.

### Requirement 3: Caption and Tag Generation

**Objective:** As a Windows user, I want images to have generated descriptions and tags, so that natural-language search can find visual files even when they contain little or no text.

#### Acceptance Criteria

1. When an eligible visual file is processed, the Vision OCR Pipeline shall generate a concise caption that describes the visible content when enough visual signal is available.
2. When an eligible visual file is processed, the Vision OCR Pipeline shall generate visual tags that summarize prominent non-biometric objects, scenes, document types, or visual concepts.
3. If caption generation lacks enough confidence, then the Vision OCR Pipeline shall preserve the low-confidence status instead of fabricating a confident description.
4. If tag generation lacks enough confidence, then the Vision OCR Pipeline shall omit or mark low-confidence tags instead of presenting them as reliable tags.
5. The Vision OCR Pipeline shall not identify people, infer biometric identity, or create face-recognition metadata.

### Requirement 4: Normalized Visual Content Payloads

**Objective:** As a semantic search implementer, I want OCR text, captions, and tags exposed in one normalized payload, so that generated visual meaning can be embedded consistently.

#### Acceptance Criteria

1. When visual enrichment succeeds or partially succeeds, the Vision OCR Pipeline shall expose a normalized visual content payload for the current canonical `sourceVersion`.
2. When a payload is created, the Vision OCR Pipeline shall include OCR text, captions, tags, source file identifiers, canonical `sourceVersion`, enrichment version, modality fields, and generated-at metadata.
3. When a payload includes OCR regions, captions, or tags, the Vision OCR Pipeline shall preserve enough labels and offsets for downstream match context where available.
4. If enrichment is limited, empty, or partially failed, then the Vision OCR Pipeline shall expose that status in the payload metadata without exposing provider internals to the desktop shell.
5. The Vision OCR Pipeline shall expose only current visual payloads as ready for semantic embedding.

### Requirement 5: Privacy and Provider Consent

**Objective:** As a Windows user, I want visual processing to respect local-first privacy expectations, so that personal images and screenshots are not sent to remote providers by default.

#### Acceptance Criteria

1. When default processing settings are used, the Vision OCR Pipeline shall process visual content locally or keep enrichment pending if no allowed local processor is available.
2. Where remote vision or OCR providers are allowed by Privacy Performance Controls provider policy, the Vision OCR Pipeline shall process only candidates permitted by that shared policy decision.
3. If provider policy does not permit remote processing for a candidate, then the Vision OCR Pipeline shall not transmit visual content for remote processing.
4. When provider policy changes, the Vision OCR Pipeline shall consume the Privacy Performance Controls impact plan to determine which visual payloads must be regenerated, invalidated, or left current.
5. The Vision OCR Pipeline shall retain the shared `ProviderMode` metadata needed for diagnostics without exposing raw image contents in status data.

### Requirement 6: Queueing, Throttling, and Freshness

**Objective:** As a Windows user, I want visual enrichment to run in the background without slowing desktop search, so that search remains usable while expensive visual processing catches up.

#### Acceptance Criteria

1. When visual candidates require enrichment, the Vision OCR Pipeline shall queue work asynchronously.
2. While visual enrichment work is running, the Vision OCR Pipeline shall avoid blocking the Desktop Search Shell.
3. When a source file changes, the Vision OCR Pipeline shall mark the affected visual payload stale until enrichment refresh completes.
4. When visual enrichment refresh completes for the current canonical `sourceVersion`, the Vision OCR Pipeline shall mark the visual enrichment state current.
5. While resource limits or provider policy delay work, the Vision OCR Pipeline shall expose pending or throttled status suitable for indexing transparency.

### Requirement 7: Error Handling and Recovery

**Objective:** As a user or operator, I want visual enrichment failures to be observable and recoverable, so that incomplete visual search coverage can be explained.

#### Acceptance Criteria

1. If OCR, captioning, tagging, provider access, file access, or storage fails for a candidate, then the Vision OCR Pipeline shall record a failure reason and retry status.
2. If the app restarts during visual enrichment, then the Vision OCR Pipeline shall recover pending, running, failed, stale, and current visual enrichment state without requiring a full rebuild.
3. When retryable visual enrichment work is retried, the Vision OCR Pipeline shall avoid creating duplicate current payloads for the same canonical `sourceVersion`.
4. If a source file is deleted or removed from indexing, then the Vision OCR Pipeline shall prevent prior visual payloads from being exposed as current.
5. The Vision OCR Pipeline shall provide aggregate visual enrichment status counts suitable for diagnostics without leaking raw visual content.

### Requirement 8: Semantic Search Integration and Result Context

**Objective:** As a Windows user, I want visual meaning to appear in natural-language search results, so that screenshots, scans, and photos are discoverable through the same search workflow as text documents.

#### Acceptance Criteria

1. When Semantic Vector Search requests ready visual payloads, the Vision OCR Pipeline shall return current payloads with searchable text derived from OCR, captions, and tags.
2. When a visual payload contains OCR text, the Vision OCR Pipeline shall provide match-context metadata that allows downstream search to explain text-in-image matches.
3. When a visual payload contains captions or tags, the Vision OCR Pipeline shall provide match-context metadata that allows downstream search to explain visual-concept matches.
4. If no safe match context can be produced, then the Vision OCR Pipeline shall expose searchable text without fabricated snippets, captions, or tags.
5. The Vision OCR Pipeline shall not create embeddings, rank search results, or require desktop UI changes beyond the established result presentation contract.
