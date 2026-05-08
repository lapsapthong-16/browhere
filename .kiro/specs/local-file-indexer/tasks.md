# Implementation Plan

- [ ] 1. Establish local indexer contracts and persistence foundation
- [ ] 1.1 Define root, file, identity, file-change, work item, status, and error contracts
  - Capture lifecycle states for active, unavailable, removed, eligible, excluded, deleted, stale, pending, current, failed, and recovering records.
  - Add canonical `sourceVersion` to `FileRecord`, `FileChangeEvent`, and `PipelineWorkItem`.
  - Define exact shared names `FileChangeEvent`, `PipelineWorkItem`, `PipelineProcessor`, `PipelineWorkType`, `PipelineWorkState`, and `targetProcessor`.
  - Ensure downstream processors can reference files and work items without depending on crawler or watcher internals.
  - Completed contracts are usable by root, crawl, watcher, work item, and status services without unsafe catch-all types.
  - _Requirements: 1.1, 1.2, 1.5, 4.1, 4.5, 6.1, 6.2, 7.1, 7.5_

- [ ] 1.2 Create local persistence schema and repository adapters
  - Persist indexed roots, file records, file-change events, and current pipeline work items with transactional updates.
  - Add lookup support for root path, file path, file identity, source version, freshness, target processor, and current work item state.
  - Completed storage recovers roots, file records, pending work items, and failed work items after process restart.
  - _Requirements: 1.2, 2.2, 6.1, 6.2, 6.3, 7.3_
  - _Touches: storage migrations_

- [ ] 2. Implement root scope and scan orchestration
- [ ] 2.1 Build indexed root registration and removal behavior
  - Register only user-approved folder paths and preserve them for future restarts.
  - Mark inaccessible roots unavailable with a user-presentable reason.
  - Removing a root stops future eligibility for files under that root.
  - Completed behavior never indexes files outside active registered roots.
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [ ] 2.2 Build crawl scheduling and root scan progress state
  - Start initial crawls after root registration and reconciliation crawls after startup or watcher recovery.
  - Maintain scanning, completed, failed, and recovery progress per root.
  - Completed status snapshots show in-progress and completed discovery passes for affected roots.
  - _Requirements: 2.1, 2.4, 2.5, 5.4, 5.5, 7.4_

- [ ] 2.3 Build file crawling with recoverable per-file issues
  - Enumerate files only under active indexed roots and emit observations with available metadata.
  - Record file read failures as recoverable issues without aborting the entire root scan.
  - Completed crawls produce observations for eligible evaluation and status for unreadable files.
  - _Requirements: 1.5, 2.1, 2.2, 2.3_

- [ ] 3. Implement file lifecycle domain logic
- [ ] 3.1 (P) Build eligibility filtering and re-evaluation
  - Exclude unsupported canonical `fileType`, raw extension, and ignored path patterns from downstream work items.
  - Preserve the distinction that `extension` is a normalized suffix and `fileType` is the indexer-owned broad classification for routing.
  - Preserve exclusion status separately from deleted or missing state.
  - Completed eligibility decisions include a reason when a file is excluded.
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_
  - _Boundary: EligibilityService_

- [ ] 3.2 (P) Build stable identity matching
  - Assign stable identities to newly recorded files.
  - Update existing records when identity can be matched across metadata or path changes.
  - Create separate records when identity confidence is insufficient.
  - Completed matching preserves downstream reference continuity for confident renames or moves.
  - _Requirements: 4.1, 4.2, 4.3, 4.4_
  - _Boundary: IdentityResolver_

- [ ] 3.3 Build change classification from crawl and watcher observations
  - Normalize created, modified, deleted, excluded, inaccessible, and duplicate observations.
  - Mark changed eligible files as needing downstream reprocessing.
  - Mark deleted files deleted and prevent new processing for prior contents.
  - Completed classification produces consistent lifecycle changes from both crawl and watcher inputs.
  - _Requirements: 4.5, 5.1, 5.2, 5.3, 5.4_
  - _Depends: 3.1, 3.2_

- [ ] 4. Implement durable file-change events, work planning, and downstream settlement
- [ ] 4.1 Build file-change publishing, work planning, and duplicate coalescing
  - Create base `FileChangeEvent` records for new, stale, deleted, or re-eligible files with canonical `sourceVersion`.
  - Derive `PipelineWorkItem` records per `targetProcessor`, using `contentExtraction` for text/document/code processing and `visualEnrichment` for image or scanned-document processing.
  - Create removal work items for deleted files with downstream indexed content.
  - Coalesce duplicate current work for the same file, source version, work type, and target processor.
  - Completed planning prevents change storms from creating unbounded duplicate work items.
  - _Requirements: 5.1, 5.2, 5.3, 6.1, 6.2, 6.3_
  - _Touches: src/indexer/jobService.ts_

- [ ] 4.2 Build downstream work item claim, completion, failure, and retry state
  - Let processors call `claimNextWorkItem(targetProcessor, workerId)` and settle only their own work items as completed or failed.
  - Update work item settlement without requiring other processors derived from the same `FileChangeEvent` to settle identically.
  - Preserve retryable failure status with observable failure reasons, target processor, source version, and attempt counts.
  - Completed work item settlement keeps pending, current, removed, and failed states consistent without cross-pipeline coupling.
  - _Requirements: 6.4, 6.5, 7.1_
  - _Touches: src/indexer/jobService.ts_

- [ ] 5. Implement live watching, recovery, and status integration
- [ ] 5.1 (P) Build filesystem watcher observation handling
  - Watch active indexed roots for create, modify, rename, and delete changes.
  - Ignore events outside active root boundaries and surface watcher failures per affected root.
  - Completed watcher handling emits observations without blocking the desktop search interface.
  - _Requirements: 1.4, 1.5, 5.1, 5.2, 5.3, 5.5, 7.2_
  - _Boundary: FilesystemWatcher_

- [ ] 5.2 (P) Build aggregate index status snapshots
  - Summarize root availability, scan state, recovery state, pending work items, failed work items, and overall freshness.
  - Provide user-presentable messages for degraded or recovering roots.
  - Completed snapshots contain no extraction, OCR, embedding, vector search, or ranking internals.
  - _Requirements: 2.4, 2.5, 7.1, 7.2, 7.4, 7.5_
  - _Boundary: StatusAggregator_

- [ ] 5.3 Wire root, crawl, watcher, lifecycle, job, and status flows together
  - Route crawl and watcher observations through eligibility, identity, change classification, file-change publishing, and pipeline work planning.
  - Restore persisted roots, records, file-change events, and work items at startup and expose recovery status while reconciliation runs.
  - Completed integration supports initial crawl, live changes, missed-change reconciliation, and downstream work item settlement end to end.
  - _Requirements: 1.1, 2.1, 3.3, 4.5, 5.4, 6.1, 6.4, 7.3, 7.4_
  - _Depends: 5.1, 5.2_
  - _Touches: src/indexer/jobService.ts, storage migrations_

- [ ] 6. Validate indexer behavior across lifecycle and failure cases
- [ ] 6.1 Add unit coverage for eligibility, identity, change classification, and work planning
  - Verify supported, unsupported, ignored, renamed, modified, deleted, duplicate, and inaccessible file cases.
  - Verify duplicate work item coalescing and removal superseding processing for deleted files per target processor.
  - Completed unit tests prove core lifecycle decisions without requiring a live filesystem watcher.
  - _Requirements: 3.1, 3.2, 3.4, 3.5, 4.1, 4.2, 4.3, 4.4, 5.2, 5.3, 6.3_

- [ ] 6.2 Add integration coverage for root scans, recovery, watcher reconciliation, and work item settlement
  - Verify registering a root records files, canonical source versions, file-change events, and durable work items.
  - Verify restart recovery restores state and reconciliation catches missed changes.
  - Verify downstream completion and failure update only the target processor work item and retryable status.
  - Completed integration tests exercise persisted state across a simulated restart.
  - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.3, 5.1, 5.4, 6.1, 6.2, 6.4, 6.5, 7.3_

- [ ] 6.3 Add shell-facing status validation
  - Verify status snapshots show working, current, degraded, and recovering states.
  - Verify removed roots stop eligibility and unavailable roots do not widen scan scope.
  - Verify shell-facing status avoids downstream implementation terminology.
  - Completed validation demonstrates the Desktop Search Shell can present index freshness without owning indexing logic.
  - _Requirements: 1.4, 1.5, 2.4, 2.5, 5.5, 7.1, 7.2, 7.4, 7.5_
