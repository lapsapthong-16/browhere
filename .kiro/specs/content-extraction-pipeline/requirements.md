# Requirements Document

## Introduction

Windows users need local semantic search to understand the contents of documents, notes, text files, and source code inside approved indexed folders. The project currently has no parsing layer or normalized extracted-content format, so downstream semantic search cannot embed useful file contents. This feature establishes a local-first content extraction pipeline that consumes `FileRecord` and `PipelineWorkItem` contracts from the Local File Indexer, extracts text and basic metadata for common text-bearing formats, and records normalized extraction results for later embedding and retrieval.

## Boundary Context

- **In scope**: Parser selection by indexer-owned canonical `fileType` plus normalized `extension`, PDF text extraction, DOCX text extraction, plain text and Markdown extraction, code file extraction, basic extracted metadata, normalized content payloads, extraction status, retryable failures, unsupported-file handling, and chunking hints for downstream semantic processing.
- **Out of scope**: OCR for scanned PDFs or images, image captioning, embedding generation, vector storage, semantic ranking, desktop UI, cloud document ingestion, file monitoring, and folder scope selection.
- **Adjacent expectations**: The Local File Indexer supplies stable file records, canonical `sourceVersion`, and durable `PipelineWorkItem` records with `targetProcessor = "contentExtraction"`. Semantic Vector Search consumes extracted content and chunking hints later through semantic intake. Privacy and performance controls may constrain runtime policy in a later spec, but this feature must keep file contents local by default.

## Requirements

### Requirement 1: Extraction Work Item Intake

**Objective:** As a downstream pipeline integrator, I want indexer work items to become extraction work, so that content processing is recoverable and aligned with file freshness.

#### Acceptance Criteria

1. When the Local File Indexer provides a current `PipelineWorkItem` with `targetProcessor = "contentExtraction"` and `type = "processFile"`, the Content Extraction Pipeline shall accept the work item for extraction without changing the file record identity.
2. When the Local File Indexer provides a `PipelineWorkItem` with `targetProcessor = "contentExtraction"` and `type = "removeFile"`, the Content Extraction Pipeline shall mark any extracted content for that file as removed or unavailable to downstream consumers.
3. If an extraction work item references a missing or inaccessible file record, then the Content Extraction Pipeline shall report a retryable extraction failure with a reason.
4. When duplicate extraction work is requested for the same `sourceVersion`, the Content Extraction Pipeline shall avoid creating duplicate current extraction results.
5. The Content Extraction Pipeline shall preserve the file identifier, path, canonical file type, normalized extension, modified timestamp, size metadata, and canonical `sourceVersion` supplied by the Local File Indexer in extraction status data.

### Requirement 2: Parser Selection and Format Coverage

**Objective:** As a search backend integrator, I want supported file types to use the correct text parser, so that extracted content is useful without exposing parser internals downstream.

#### Acceptance Criteria

1. When a supported PDF file is processed, the Content Extraction Pipeline shall attempt to extract textual content and document metadata from the PDF.
2. When a supported Word document is processed, the Content Extraction Pipeline shall attempt to extract textual content and document metadata from the document.
3. When a supported plain text, Markdown, or note file is processed, the Content Extraction Pipeline shall extract the file text and basic metadata.
4. When a supported code file is processed, the Content Extraction Pipeline shall extract source text while preserving enough structural hints for downstream chunking.
5. If a file type has no supported parser, then the Content Extraction Pipeline shall record the file as unsupported without treating the job as a corrupted-file failure.

### Requirement 3: Normalized Content Payload

**Objective:** As a semantic search implementer, I want every successful extraction to produce one common payload shape, so that embedding and retrieval do not need format-specific parser knowledge.

#### Acceptance Criteria

1. When extraction succeeds, the Content Extraction Pipeline shall produce normalized text content associated with the source file identifier.
2. When extraction succeeds, the Content Extraction Pipeline shall include parser-neutral metadata such as detected content type, text length, extraction time, and the canonical `sourceVersion` from Local File Indexer.
3. When extraction succeeds, the Content Extraction Pipeline shall include chunking hints suitable for downstream embedding preparation.
4. If a parser returns no usable text, then the Content Extraction Pipeline shall record an empty-content status distinct from extraction failure.
5. The Content Extraction Pipeline shall expose extracted content through a contract that does not require downstream consumers to know which parser produced it.

### Requirement 4: Text Normalization and Safety

**Objective:** As a Windows user, I want extracted text to be clean enough for search while staying private, so that personal file contents remain local and useful.

#### Acceptance Criteria

1. When text is extracted from a supported file, the Content Extraction Pipeline shall normalize control characters and repeated whitespace that would degrade downstream semantic processing.
2. When text is extracted from Markdown or code, the Content Extraction Pipeline shall preserve meaningful line boundaries and symbols needed for human-readable snippets and code understanding.
3. If a file is too large or too complex to process within configured extraction limits, then the Content Extraction Pipeline shall record a limited-content or failed status with a user-presentable reason.
4. While extraction runs under default settings, the Content Extraction Pipeline shall not send file contents outside the local machine.
5. The Content Extraction Pipeline shall avoid storing transient parser artifacts that are not needed for downstream content search.

### Requirement 5: Extraction Status and Error Reporting

**Objective:** As a user or operator, I want extraction progress and failures to be observable at a high level, so that incomplete search coverage can be explained.

#### Acceptance Criteria

1. When extraction is pending, running, completed, unsupported, empty, failed, limited, or removed, the Content Extraction Pipeline shall expose that status for the affected file.
2. When a parser fails on a corrupted or unreadable file, the Content Extraction Pipeline shall record the failure without stopping extraction for other files.
3. If extraction fails for a retryable reason, then the Content Extraction Pipeline shall retain retry information and the last failure reason.
4. When extraction cannot proceed because the file type is unsupported, the Content Extraction Pipeline shall expose an unsupported status that downstream consumers can skip.
5. The Content Extraction Pipeline shall provide aggregate status counts suitable for the Desktop Search Shell without exposing raw file contents.

### Requirement 6: Incremental Re-Extraction

**Objective:** As a Windows user, I want changed files to refresh their extracted content, so that search results are based on the latest local file contents.

#### Acceptance Criteria

1. When a file record becomes stale after modification, the Content Extraction Pipeline shall produce a new extraction result for the current indexer `sourceVersion`.
2. When a file has not changed since the last successful extraction, the Content Extraction Pipeline shall treat the existing extraction result as current only when its `sourceVersion` matches the current `FileRecord.sourceVersion`.
3. If a file changes while extraction is in progress, then the Content Extraction Pipeline shall prevent the older `sourceVersion` extraction result from becoming the current result for the newer `sourceVersion`.
4. When re-extraction succeeds, the Content Extraction Pipeline shall replace the current extracted-content pointer for that file without losing failure history needed for diagnostics.
5. When an extracted file is deleted or removed from indexing, the Content Extraction Pipeline shall prevent its previous content from being consumed as current search input.

### Requirement 7: Downstream Content Consumption

**Objective:** As a semantic vector search implementer, I want a stable extracted-content interface, so that embedding generation can consume text and chunk hints independently of file parsers.

#### Acceptance Criteria

1. When downstream semantic processing requests current extracted content for a file, the Content Extraction Pipeline shall return the current normalized payload when one exists.
2. When downstream semantic processing requests files ready for embedding, the Content Extraction Pipeline shall list only current successful or limited extracted-content payloads that contain usable text.
3. If extracted content is unsupported, empty, failed, pending, or removed, then the Content Extraction Pipeline shall exclude it from ready-for-embedding results.
4. When downstream processing reads an extracted payload, the Content Extraction Pipeline shall include stable identifiers that allow resulting chunks or embeddings to trace back to the source file and extraction version.
5. The Content Extraction Pipeline shall not own embedding generation, vector persistence, retrieval ranking, or result explanation.

### Requirement 8: Local-First Operational Behavior

**Objective:** As a Windows user, I want extraction to run predictably in the background, so that the desktop search app remains usable during indexing.

#### Acceptance Criteria

1. While extraction work items are running, the Content Extraction Pipeline shall avoid blocking the desktop search interface.
2. When the app restarts during extraction, the Content Extraction Pipeline shall recover pending, running, failed, and current extraction state without requiring a full manual rebuild.
3. If multiple extraction work items are available, then the Content Extraction Pipeline shall process them according to configured concurrency limits.
4. When extraction completes or fails, the Content Extraction Pipeline shall report completion or failure back to the Local File Indexer `PipelineWorkItem` lifecycle.
5. The Content Extraction Pipeline shall provide local diagnostic events for extraction failures, skipped files, and unusually slow extraction work.
