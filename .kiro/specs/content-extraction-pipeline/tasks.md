# Implementation Plan

- [ ] 1. Establish extraction foundation
- [ ] 1.1 Define extraction contracts, statuses, limits, and supported format mapping
  - Capture parser-neutral payloads, source file references, canonical `sourceVersion`, extraction statuses, errors, chunk hints, and aggregate status shapes.
  - Define the content worker adapter over Local File Indexer `PipelineWorkItem` and require `targetProcessor = "contentExtraction"`.
  - Preserve indexer-owned `fileType` and normalized `extension` semantics without redefining them.
  - Include local-only defaults, size or complexity limits, and concurrency settings needed by later runtime work.
  - Completed state: downstream code can import typed extraction contracts without depending on parser-specific details.
  - _Requirements: 1.5, 2.5, 3.2, 3.3, 3.5, 4.3, 4.4, 5.1, 7.4_

- [ ] 1.2 Create local extraction persistence and migration support
  - Persist extraction records, payloads, chunk hints, current extraction pointers, attempts, failure reasons, and removed state.
  - Enforce one current extraction pointer per file and canonical `sourceVersion` guard behavior.
  - Completed state: a fresh app store can create extraction storage and recover existing extraction state after restart.
  - _Requirements: 1.4, 4.5, 5.3, 6.2, 6.4, 6.5, 8.2_
  - _Touches: storage migrations_

- [ ] 2. Build parser and normalization capabilities
- [ ] 2.1 (P) Implement parser registry and unsupported-file classification
  - Route supported file metadata to PDF, DOCX, text, Markdown, note, or code parsers.
  - Record unsupported formats as skipped extraction outcomes rather than corrupted-file failures.
  - Completed state: representative file extensions resolve to the correct parser or an unsupported status.
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 5.4_
  - _Boundary: ParserRegistry_
  - _Depends: 1.1_

- [ ] 2.2 (P) Implement PDF and DOCX local text extraction
  - Extract textual content and basic document metadata from supported PDF and Word files.
  - Distinguish parser failure, no usable text, and limited extraction according to configured limits.
  - Completed state: PDF and DOCX fixtures produce parser outputs or explicit extraction errors without network access.
  - _Requirements: 2.1, 2.2, 3.1, 3.2, 4.3, 4.4, 5.2_
  - _Boundary: ContentParser adapters_
  - _Depends: 1.1_

- [ ] 2.3 (P) Implement text, Markdown, note, and code extraction
  - Extract plain text from text-bearing files and preserve meaningful Markdown, note, and source-code structure.
  - Include structural hints for headings, paragraphs, code blocks, or line ranges where available.
  - Completed state: text, Markdown, note, and code fixtures produce parser outputs with usable text and structural hints.
  - _Requirements: 2.3, 2.4, 3.1, 3.3, 4.2_
  - _Boundary: ContentParser adapters_
  - _Depends: 1.1_

- [ ] 2.4 (P) Implement text normalization and chunk hint generation
  - Normalize control characters and repeated whitespace while preserving meaningful Markdown and code boundaries.
  - Convert parser structure hints into parser-neutral chunk hints with valid offsets.
  - Completed state: normalized outputs retain readable text and all chunk hints point to valid text ranges.
  - _Requirements: 3.1, 3.3, 4.1, 4.2, 7.4_
  - _Boundary: TextNormalizer, ChunkHintBuilder_
  - _Depends: 1.1_

- [ ] 3. Implement extraction orchestration
- [ ] 3.1 Coordinate parser selection, normalization, and payload persistence
  - Process a `contentExtraction` `PipelineWorkItem` into one extraction record for the referenced file and canonical `sourceVersion`.
  - Persist success, empty, unsupported, limited, and failed outcomes with the correct metadata and failure reason.
  - Completed state: service-level tests can extract a supported fixture and observe a current normalized payload in storage.
  - _Requirements: 1.1, 1.3, 1.4, 2.5, 3.1, 3.2, 3.4, 3.5, 5.1, 5.2_

- [ ] 3.2 Enforce incremental freshness and stale-result protection
  - Skip unchanged files when a current extraction already matches the file's canonical `sourceVersion`.
  - Prevent in-flight extraction for an older `sourceVersion` from replacing a newer current result.
  - Completed state: concurrent or repeated extraction attempts leave only the newest matching canonical `sourceVersion` current.
  - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [ ] 3.3 Handle removal work items and deleted-content exclusion
  - Mark extracted content removed when the indexer reports file deletion or removal from indexing.
  - Ensure previous payloads for removed files are not returned as current or ready for embedding.
  - Completed state: a removal work item makes prior content unavailable to downstream reads while preserving diagnostic history.
  - _Requirements: 1.2, 6.5, 7.3_

- [ ] 4. Connect runtime worker and status surfaces
- [ ] 4.1 Integrate extraction worker with indexer work item lifecycle
  - Claim `PipelineWorkItem` records through `claimNextWorkItem("contentExtraction", workerId)`, execute extraction or removal, and report completion or failure back to the Local File Indexer.
  - Preserve retryable failure reasons for missing, inaccessible, or parser-failed files.
  - Completed state: a queued content extraction work item advances to completed or failed based on the extraction outcome.
  - _Requirements: 1.1, 1.3, 5.3, 8.4_
  - _Touches: src/indexer/jobService.ts_

- [ ] 4.2 Run extraction in the background with recovery and concurrency limits
  - Process work items according to configured concurrency limits without blocking the desktop search surface.
  - Recover pending, running, failed, and current extraction state on app restart.
  - Completed state: worker restart tests show abandoned running work is recoverable and the shell remains responsive while extraction proceeds.
  - _Requirements: 8.1, 8.2, 8.3_

- [ ] 4.3 Provide extraction status and local diagnostics
  - Expose per-file and aggregate status counts for pending, running, current, unsupported, empty, limited, failed, and removed records.
  - Emit local diagnostics for failures, unsupported skips, stale results, and unusually slow extraction work without raw file contents.
  - Completed state: status snapshots can be displayed by the shell and diagnostic logs contain useful local reasons without extracted text.
  - _Requirements: 1.5, 5.1, 5.2, 5.5, 8.5_

- [ ] 5. Expose downstream content consumption
- [ ] 5.1 Implement current-payload and ready-for-embedding readers
  - Return the current normalized payload for a file when available.
  - List only successful or limited current payloads that contain usable text.
  - Completed state: ready-for-embedding reads exclude unsupported, empty, failed, pending, running, and removed records.
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [ ] 5.2 Validate downstream traceability and no embedding ownership
  - Ensure every returned payload includes file ID, canonical `sourceVersion`, extraction ID, parser kind, and chunk hints.
  - Keep embedding generation, vector persistence, ranking, and explanation behavior outside the extraction implementation.
  - Completed state: semantic-search-facing tests can trace payloads back to source files without any vector records being created by extraction.
  - _Requirements: 3.5, 7.1, 7.4, 7.5_

- [ ] 6. Validate end-to-end extraction behavior
- [ ] 6.1 Add parser, normalization, and error classification tests
  - Cover supported parser selection, unsupported classification, empty text, limited output, corrupted files, and text normalization behavior.
  - Completed state: unit tests demonstrate each status category and parser family behaves according to the requirements.
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 3.4, 4.1, 4.2, 4.3, 5.2, 5.4_

- [ ] 6.2 Add worker, recovery, and incremental re-extraction tests
  - Cover work item claim and settlement, duplicate work, restart recovery, concurrency limits, stale in-flight output, and removal handling.
  - Completed state: integration tests prove extraction stays recoverable and current across changes and restart scenarios.
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 6.1, 6.2, 6.3, 6.4, 6.5, 8.1, 8.2, 8.3, 8.4_

- [ ] 6.3 Add content reader and shell-safe status tests
  - Verify ready-for-embedding filtering, current payload lookup, aggregate status counts, and diagnostic privacy.
  - Completed state: downstream and shell-facing tests pass without exposing raw text through status or creating embeddings.
  - _Requirements: 1.5, 3.1, 3.2, 3.3, 3.5, 4.4, 4.5, 5.1, 5.3, 5.5, 7.1, 7.2, 7.3, 7.4, 7.5, 8.5_
