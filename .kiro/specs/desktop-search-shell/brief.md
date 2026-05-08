# Brief: desktop-search-shell

## Problem
Windows users lose time navigating folders or guessing filenames when they only remember the meaning of a file. Existing search experiences often depend on exact names, paths, or keywords, which fails for files named like `final_v7_updated_REAL.docx` or `IMG_4829.png`.

## Current State
This is a greenfield project with no existing app shell. There is no search surface, result presentation model, or desktop workflow for opening and revealing matched files.

## Desired Outcome
Users can open a Windows desktop app, type a natural language memory of a file, see ranked results with enough context to choose the right item, and open or reveal the file in Explorer.

## Approach
Build a focused desktop search shell first, with an interface that can consume placeholder/local search results before the full indexing and semantic backends exist. This creates a stable user workflow and result contract for later specs.

## Scope
- **In**: Search input, result list, file metadata display, simple preview snippets/captions when available, empty/loading/error states, open file action, reveal in folder action, and basic app navigation.
- **Out**: Full indexing implementation, content extraction, OCR, image captioning, embedding generation, vector database internals, cloud sync, and advanced file preview/editing.

## Boundary Candidates
- Desktop UI owns user workflows and display contracts.
- Search backend owns retrieval, ranking, and enrichment data.
- Indexer owns file discovery and freshness state.

## Out of Boundary
This spec does not own AI model selection, vector schema design, OCR accuracy, file parsing libraries, or long-running indexing resource management.

## Upstream / Downstream
- **Upstream**: None for the first app shell; it can begin against mocked or simple local result data.
- **Downstream**: Local file indexer, semantic vector search, privacy/performance controls, and future richer previews depend on the UX contracts established here.

## Existing Spec Touchpoints
- **Extends**: None.
- **Adjacent**: local-file-indexer, semantic-vector-search, privacy-performance-controls.

## Constraints
The first target is Windows desktop. The app should feel like a utility, prioritize fast repeated search, and avoid requiring users to understand embeddings, OCR, or indexing internals.
