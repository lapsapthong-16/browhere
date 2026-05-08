# Requirements Document

## Introduction

Windows users need local semantic search results to stay current as files are created, changed, moved, or deleted inside folders they have chosen to index. The current project has no filesystem crawl, monitor, file identity model, scheduling system, or persisted index state. This feature establishes the local file indexing core that discovers user-approved files, records stable file metadata and a canonical source version, detects lifecycle changes, publishes base file-change events, derives per-pipeline work items, and exposes freshness status without owning content extraction, OCR, embeddings, or retrieval.

## Boundary Context

- **In scope**: Folder indexing inputs from the desktop shell, initial crawl, filesystem watching, file identity, metadata capture, canonical extension and file type semantics, canonical `sourceVersion`, incremental change detection, deleted-file handling, base `FileChangeEvent` records, per-pipeline `PipelineWorkItem` records, retryable work item status, and index freshness state.
- **Out of scope**: Parsing document contents, OCR, image captioning, embedding generation, vector search, semantic ranking, remote sync, advanced UI design, and resource throttling controls beyond status data needed by future controls.
- **Adjacent expectations**: The Desktop Search Shell provides user-selected folders and presents index status. Downstream extraction, vision, semantic search, and privacy/performance features consume file records, canonical `sourceVersion`, `FileChangeEvent`, and `PipelineWorkItem` contracts but do not own file discovery or freshness.

## Requirements

### Requirement 1: Folder Scope Registration

**Objective:** As a Windows user, I want the app to index only folders I have selected, so that local search respects my intended file boundaries.

#### Acceptance Criteria

1. When the user approves a folder for indexing, the Local File Indexer shall register that folder as an indexed root.
2. When an indexed root is registered, the Local File Indexer shall preserve enough folder information for future app restarts to continue indexing the same root.
3. If a requested indexed root is not accessible, then the Local File Indexer shall report the root as unavailable without indexing files outside that root.
4. When the user removes an indexed root, the Local File Indexer shall stop treating files under that root as eligible for indexing.
5. The Local File Indexer shall never discover or queue files outside registered indexed roots.

### Requirement 2: Initial File Discovery

**Objective:** As a search backend integrator, I want approved folders to be crawled into file records, so that downstream pipelines know which files can be processed.

#### Acceptance Criteria

1. When an indexed root is ready for scanning, the Local File Indexer shall discover eligible files under that root.
2. When the Local File Indexer discovers an eligible file, it shall record the file path, display name, canonical extension, canonical file type, size when available, modified timestamp when available, containing indexed root, and canonical source version.
3. If a file cannot be read during discovery, then the Local File Indexer shall record a recoverable discovery issue without stopping the entire root scan.
4. While an initial scan is in progress, the Local File Indexer shall expose scan progress state for the affected indexed root.
5. When an initial scan completes, the Local File Indexer shall expose that the indexed root has completed its current discovery pass.

### Requirement 3: File Eligibility Filtering

**Objective:** As a Windows user, I want indexing to skip unsupported or intentionally ignored files, so that the app avoids unnecessary work and respects configured scope.

#### Acceptance Criteria

1. When a discovered file has an unsupported canonical extension or file type, the Local File Indexer shall exclude that file from downstream work items.
2. When a discovered file matches an ignored path pattern, the Local File Indexer shall exclude that file from downstream work items.
3. If eligibility rules change, then the Local File Indexer shall be able to re-evaluate known files against the current rules.
4. The Local File Indexer shall distinguish excluded files from missing files in its status data.
5. The Local File Indexer shall expose the reason a file was excluded when that reason is available.

### Requirement 4: Stable File Identity and Metadata Freshness

**Objective:** As a downstream pipeline integrator, I want file records to remain stable across renames and modifications where possible, so that extraction and search can update incrementally.

#### Acceptance Criteria

1. When the Local File Indexer records a file, it shall assign a stable file identity and canonical `sourceVersion` that downstream work items can reference.
2. When a known file changes metadata, the Local File Indexer shall update the existing file record instead of creating a duplicate record when the file identity can be matched.
3. If a file identity cannot be matched confidently, then the Local File Indexer shall create a new file record and preserve the prior record state separately.
4. When a file path changes but the file identity can be matched, the Local File Indexer shall update the file path while preserving downstream reference continuity.
5. The Local File Indexer shall maintain a canonical `sourceVersion` for each current file record and use it to determine whether downstream pipelines need reprocessing.

### Requirement 5: Incremental Change Detection

**Objective:** As a Windows user, I want search freshness to update after file changes, so that I do not need to rebuild the index manually.

#### Acceptance Criteria

1. When a file is created inside an indexed root, the Local File Indexer shall evaluate the file and publish a `FileChangeEvent` plus eligible downstream `PipelineWorkItem` records if processing is required.
2. When a known eligible file is modified, the Local File Indexer shall mark the file as needing downstream reprocessing.
3. When a known eligible file is deleted, the Local File Indexer shall mark the file as deleted and prevent new downstream processing for its prior contents.
4. If filesystem watching misses changes while the app is not running, then the Local File Indexer shall reconcile changes during the next discovery pass.
5. While change detection is active, the Local File Indexer shall avoid blocking the desktop search interface.

### Requirement 6: Pipeline Work Item Scheduling State

**Objective:** As a downstream pipeline, I want file lifecycle changes to become durable per-pipeline work items, so that content extraction and visual enrichment can run asynchronously, settle independently, and recover after restart.

#### Acceptance Criteria

1. When an eligible file is new or stale, the Local File Indexer shall create or update durable `PipelineWorkItem` records from the same `FileChangeEvent` for each target processor that should handle the file version.
2. When a deleted file has downstream indexed content, the Local File Indexer shall create or update durable removal `PipelineWorkItem` records for each target processor that may hold derived content.
3. If a work item already exists for the same `fileId`, `sourceVersion`, work type, and `targetProcessor`, then the Local File Indexer shall coalesce duplicate work into one current `PipelineWorkItem`.
4. When a downstream processor settles a `PipelineWorkItem`, the Local File Indexer shall update only that work item's settlement state without requiring other processors for the same `FileChangeEvent` to settle the same way.
5. If downstream processing reports work item failure, then the Local File Indexer shall retain retryable work item status with an observable failure reason scoped to the target processor.

### Requirement 7: Index Status and Recovery

**Objective:** As a Windows user, I want to know whether indexing is current or recovering, so that I can understand why search results may be incomplete.

#### Acceptance Criteria

1. When indexed roots, files, or pipeline work items have pending work, the Local File Indexer shall expose aggregate freshness status.
2. When an indexed root scan or watcher encounters an error, the Local File Indexer shall expose the affected root and a user-presentable status.
3. If the app restarts during a crawl or work item update, then the Local File Indexer shall recover persisted roots, file records, and pending work items without requiring a manual rebuild.
4. While recovery is in progress, the Local File Indexer shall expose recovery status separately from completed freshness status.
5. The Local File Indexer shall provide status data that the Desktop Search Shell can present without exposing extraction, OCR, embedding, or vector database internals.
