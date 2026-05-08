# Roadmap

## Overview
The project is a local-first Windows semantic file search app positioned as "Search your files by memory, not filenames." It continuously indexes local files, extracts text and visual meaning, generates embeddings and AI tags, and lets users search with natural language when filenames, folders, or exact keywords are forgotten.

The chosen direction is a staged MVP that separates desktop UX, local indexing, content extraction, multimodal enrichment, semantic retrieval, and privacy/performance controls. This keeps the first implementation useful while leaving clean boundaries for heavier AI and Windows integration work.

## Approach Decision
- **Chosen**: Local-first staged Windows MVP with modular pipelines for indexing, extraction, enrichment, retrieval, and desktop search UX.
- **Why**: The product crosses desktop UX, filesystem monitoring, document parsing, OCR, image understanding, embeddings, vector storage, and privacy controls. Splitting by responsibility keeps specs independently implementable and reviewable while preserving an end-to-end MVP path.
- **Rejected alternatives**: A single all-in-one spec was rejected because it would likely exceed 20 tasks and mix unrelated risk areas. A cloud-first search backend was rejected for the initial direction because local file search has strong privacy expectations and should remain useful without uploading personal documents by default.

## Scope
- **In**: Windows desktop search experience, local file monitoring, text extraction for common document/code formats, OCR and image caption/tag enrichment, embedding generation, local vector search, result ranking, file open/reveal actions, folder exclusions, provider settings, and resource limits.
- **Out**: Cross-device sync, shared/team search, enterprise admin policy, cloud backup, full document editing, email/calendar indexing, browser history indexing, mobile apps, and guaranteed support for every proprietary file format in the first version.

## Constraints
The first product target is Windows desktop. The architecture should favor local-first indexing and storage, explicit user control over scanned folders, and privacy-safe defaults. AI provider choices should stay replaceable so local models, remote APIs, or hybrid modes can be supported without rewriting the search UX or indexing core. Indexing must be incremental and resource-aware to avoid making the desktop feel slow.

## Boundary Strategy
- **Why this split**: Each spec owns a distinct responsibility: user-facing desktop workflow, filesystem/index lifecycle, content parsing, vision/OCR enrichment, vector retrieval, and trust/performance controls. These boundaries allow independent implementation and focused validation.
- **Shared seams to watch**: File identity and metadata schema, extracted content payload format, embedding document/chunk schema, indexing job lifecycle, AI provider interface, privacy/exclusion enforcement, and ranking signals shared between keyword, semantic, and visual matches.

## Specs (dependency order)
- [x] desktop-search-shell -- Windows desktop app shell, search interface, result list, preview metadata, and open/reveal actions. Dependencies: none
- [x] local-file-indexer -- Filesystem crawl, monitoring, file identity, index scheduling, change detection, and persisted index state. Dependencies: desktop-search-shell
- [x] content-extraction-pipeline -- Text and metadata extraction for PDFs, Word documents, plain text, notes, and code files. Dependencies: local-file-indexer
- [x] semantic-vector-search -- Embedding generation, vector storage, query embedding, retrieval, ranking, and result explanation metadata. Dependencies: local-file-indexer, content-extraction-pipeline
- [x] vision-ocr-pipeline -- OCR for screenshots/scans plus image captioning and tag generation for visual semantic search. Dependencies: local-file-indexer, semantic-vector-search
- [x] privacy-performance-controls -- Folder exclusions, AI provider controls, local/remote processing modes, resource limits, and indexing transparency. Dependencies: local-file-indexer, content-extraction-pipeline, semantic-vector-search, vision-ocr-pipeline
