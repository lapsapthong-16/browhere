# Brief: content-extraction-pipeline

## Problem
Most valuable local files are documents, notes, text files, or code, and semantic search cannot understand them until their contents are extracted into clean text and metadata.

## Current State
There is no document parsing layer or normalized extracted-content format for downstream embeddings and search.

## Desired Outcome
The app can extract useful text and metadata from PDFs, Word documents, plain text, notes, and code files, then attach that content to indexed file records for embedding and retrieval.

## Approach
Build a pluggable extraction pipeline keyed by file type. Normalize extracted text, metadata, errors, and chunking hints into a common payload so semantic search does not need to know each parser's internals.

## Scope
- **In**: PDF text extraction, DOCX text extraction, plain text/Markdown extraction, code file text extraction, basic metadata, extraction errors, unsupported-file handling, and normalized content payloads.
- **Out**: OCR for scanned PDFs/images, image captioning, embedding generation, vector storage, ranking, desktop UI, and cloud document ingestion.

## Boundary Candidates
- File indexer owns which files need extraction.
- Extraction pipeline owns parser selection and normalized text output.
- Semantic vector search owns chunk embedding and retrieval.

## Out of Boundary
This spec does not own visual understanding, scanned-document OCR, semantic ranking, or file monitoring.

## Upstream / Downstream
- **Upstream**: local-file-indexer supplies file paths, file types, and extraction jobs.
- **Downstream**: semantic-vector-search consumes extracted content; privacy-performance-controls may constrain where and how extraction runs.

## Existing Spec Touchpoints
- **Extends**: None.
- **Adjacent**: local-file-indexer, vision-ocr-pipeline, semantic-vector-search.

## Constraints
Extraction should be deterministic where possible, tolerate corrupted/unsupported files, and avoid leaking file contents outside the machine unless a later provider setting explicitly allows it.
