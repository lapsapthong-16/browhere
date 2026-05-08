# Research & Design Decisions

## Summary

- **Feature**: `local-file-indexer`
- **Discovery Scope**: Extension / Complex Integration
- **Key Findings**:
  - The feature extends the Desktop Search Shell contract by accepting indexed roots and providing index freshness status, but it does not replace the shell's search result contract.
  - File discovery, file identity, and durable job state must be owned by one local indexing core so downstream extraction and retrieval systems can remain asynchronous consumers.
  - A ports-and-adapters design keeps Windows filesystem watching and persistence replaceable while preserving a small domain contract for future privacy and performance controls.

## Research Log

### Upstream Shell Integration

- **Context**: The roadmap lists `local-file-indexer` after `desktop-search-shell`; the shell design owns search UX, placeholder search provider behavior, and native open/reveal actions.
- **Sources Consulted**: `.kiro/steering/roadmap.md`, `.kiro/specs/desktop-search-shell/requirements.md`, `.kiro/specs/desktop-search-shell/design.md`.
- **Findings**:
  - The shell consumes a `SearchResult` shape for ranked results and explicitly does not own crawling, watching, index scheduling, or persisted index state.
  - The shell can present status, but status contracts must not force users to understand extraction, OCR, embeddings, or vector storage.
  - Future search providers need stable file identity and freshness signals before they can replace placeholder results.
- **Implications**: The indexer exposes `IndexedRoot`, `FileRecord`, `IndexingJob`, and `IndexStatusSnapshot` contracts while leaving search result ranking to later specs.

### Persistence and Recovery Boundary

- **Context**: Requirements call for restart-safe indexing, durable jobs, and incremental freshness without manual rebuilds.
- **Sources Consulted**: Feature brief and roadmap constraints.
- **Findings**:
  - File records and jobs must persist as the source of truth for downstream processing state.
  - Crawl progress can be resumable or restartable, but completed file records and pending jobs must survive crashes.
  - Duplicate job coalescing is necessary because crawls and watcher events can report the same file change.
- **Implications**: The design uses a repository boundary with transactional updates around file record and job state changes.

### Filesystem Change Detection

- **Context**: Windows filesystem events can be missed while the app is stopped or when watcher buffers overflow.
- **Sources Consulted**: Project brief and common filesystem watcher constraints.
- **Findings**:
  - Watchers are useful for low-latency updates but cannot be the only correctness mechanism.
  - Periodic or startup reconciliation through a crawl is required to detect missed create, modify, and delete events.
  - The domain must treat watcher events and crawl findings as equivalent change observations.
- **Implications**: The design routes both crawler findings and watcher events through a `ChangeClassifier` and `JobPlanner`.

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks / Limitations | Notes |
|--------|-------------|-----------|---------------------|-------|
| Ports and adapters | Domain services own lifecycle decisions; filesystem, persistence, and runtime adapters sit at the edge | Clear ownership, testable core, replaceable storage and watcher implementations | Requires explicit contracts up front | Selected because the feature crosses Windows IO, persistence, and downstream pipeline seams |
| Direct watcher-to-job pipeline | Filesystem watcher writes jobs directly | Simple for live changes | Misses crawl/reconciliation parity and makes recovery harder | Rejected because restart safety is a core requirement |
| Downstream-owned file state | Extraction or search systems discover files on demand | Minimal indexer surface | Duplicates lifecycle logic and blurs boundaries | Rejected because roadmap assigns file lifecycle and freshness to this spec |

## Design Decisions

### Decision: Centralize File Lifecycle in Indexer Core

- **Context**: Multiple downstream specs need consistent file records and job state.
- **Alternatives Considered**:
  1. Let extraction own discovery and job state.
  2. Let search own freshness during retrieval.
  3. Create a dedicated indexing core.
- **Selected Approach**: The Local File Indexer owns roots, file records, eligibility, freshness, and job planning.
- **Rationale**: This matches the roadmap boundary and prevents downstream systems from implementing competing file lifecycle rules.
- **Trade-offs**: The indexer must define durable contracts before extraction exists, but downstream features gain a stable integration point.
- **Follow-up**: Implementation should validate that file and job schemas can evolve without breaking downstream consumers.

### Decision: Treat Crawl and Watch Events as Observations

- **Context**: Initial crawls and watchers report overlapping file changes.
- **Alternatives Considered**:
  1. Separate crawl and watcher logic.
  2. Normalize both inputs into a shared change classifier.
- **Selected Approach**: Both sources become file observations processed by shared eligibility, identity, freshness, and job planning rules.
- **Rationale**: This reduces duplicate behavior and keeps reconciliation consistent with live change handling.
- **Trade-offs**: The observation contract must include enough metadata for both sources.
- **Follow-up**: Implementation should test duplicate observations and watcher miss recovery.

### Decision: Durable Jobs Are Coalesced by File and Work Type

- **Context**: A modified file may generate multiple events before downstream extraction completes.
- **Alternatives Considered**:
  1. Append every event as a separate job.
  2. Coalesce duplicate current work.
- **Selected Approach**: The current job for a file and work type is updated instead of duplicated.
- **Rationale**: Coalescing avoids redundant downstream work while preserving the latest file freshness signal.
- **Trade-offs**: Historical event detail is not the primary record; observability should focus on current job state.
- **Follow-up**: Implementation should ensure removal jobs supersede stale indexing jobs for deleted files.

## Risks & Mitigations

- File identity may vary by filesystem or adapter capability -- design identity as a confidence-based match with fallback to new records.
- Watcher events may be incomplete -- require startup or scheduled reconciliation scans.
- Large folders may produce many files -- keep scanning asynchronous and expose progress without blocking the shell.
- Downstream specs may need additional status fields -- version contracts and list revalidation triggers for file/job/status shape changes.

## References

- `.kiro/steering/roadmap.md` -- staged MVP scope and dependency order.
- `.kiro/specs/local-file-indexer/brief.md` -- feature scope and boundary candidates.
- `.kiro/specs/desktop-search-shell/design.md` -- upstream shell contract and out-of-boundary indexing commitments.
