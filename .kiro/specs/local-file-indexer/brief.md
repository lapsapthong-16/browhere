# Brief: local-file-indexer

## Problem
Semantic search is only useful if the app reliably knows which files exist, when they changed, and which files need reprocessing. Users need results to stay current without manually rebuilding an index.

## Current State
There is no filesystem crawl, monitor, file identity model, scheduling system, or persisted index state.

## Desired Outcome
The app can scan user-approved folders, detect created/modified/deleted files, queue indexing work, persist file metadata, and expose freshness state to downstream extraction and search components.

## Approach
Create a local indexing core that separates file discovery from content extraction. It should maintain stable file records and indexing jobs so extraction, OCR, and embedding pipelines can operate asynchronously and incrementally.

## Scope
- **In**: Folder selection inputs from the app, initial crawl, filesystem watching, file identity, metadata capture, extension/type filtering, change detection, deleted-file handling, job queue records, and index status.
- **Out**: Parsing document contents, OCR/image captioning, embedding generation, vector search, UI design beyond status surfaces, and remote sync.

## Boundary Candidates
- Indexer owns file lifecycle and freshness.
- Extraction pipeline owns content payload creation.
- Search pipeline owns embeddings and retrieval indexes.

## Out of Boundary
This spec does not own semantic relevance, OCR accuracy, AI tagging quality, or desktop UI polish beyond data needed for status and progress.

## Upstream / Downstream
- **Upstream**: desktop-search-shell for user-selected folders and status presentation.
- **Downstream**: content-extraction-pipeline, vision-ocr-pipeline, semantic-vector-search, and privacy-performance-controls rely on file records and indexing jobs.

## Existing Spec Touchpoints
- **Extends**: None.
- **Adjacent**: desktop-search-shell, content-extraction-pipeline, privacy-performance-controls.

## Constraints
Indexing must be incremental, restart-safe, and respectful of user-selected folder boundaries. It should avoid blocking the desktop UI and should support future resource throttling.
