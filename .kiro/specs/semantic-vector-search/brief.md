# Brief: semantic-vector-search

## Problem
Keyword and filename matching fail when users remember meaning instead of exact text. The product needs semantic retrieval so a query like "that McDonald's marketing analysis document" can find a poorly named file.

## Current State
There is no embedding generation, vector database, query embedding, ranking layer, or result explanation metadata.

## Desired Outcome
The app can embed extracted content, store vectors locally, process natural language queries, return relevant file results, and provide enough match context to help users trust the result.

## Approach
Build a search core around normalized content chunks and file-level metadata. Keep embedding provider and vector database interfaces replaceable so the product can evolve between local, remote, and hybrid AI modes.

## Scope
- **In**: Content chunking strategy, embedding generation interface, local vector storage, query embedding, semantic similarity retrieval, metadata-aware ranking, result grouping by file, and match context returned to the desktop shell.
- **Out**: Filesystem monitoring, raw document parsing, OCR/image captioning, desktop UI components, provider billing, cross-device sync, and enterprise search.

## Boundary Candidates
- Extraction pipeline owns text payloads.
- Vector search owns embeddings, retrieval, and ranking.
- Desktop shell owns result presentation.
- Privacy controls own whether local or remote providers are allowed.

## Out of Boundary
This spec does not own document parser quality, OCR/caption generation, folder selection, or visual UI design.

## Upstream / Downstream
- **Upstream**: local-file-indexer and content-extraction-pipeline provide indexed files and text content.
- **Downstream**: desktop-search-shell consumes result data; vision-ocr-pipeline may feed captions/OCR text into the same vector index; privacy-performance-controls constrain provider and storage choices.

## Existing Spec Touchpoints
- **Extends**: None.
- **Adjacent**: content-extraction-pipeline, vision-ocr-pipeline, desktop-search-shell, privacy-performance-controls.

## Constraints
The vector store should be local by default. The design should avoid locking the product to one embedding model or one vector database too early.
