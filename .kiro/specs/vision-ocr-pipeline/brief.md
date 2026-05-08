# Brief: vision-ocr-pipeline

## Problem
Users also search for screenshots, scanned documents, and photos by memory. Filenames like `IMG_4829.png` do not reveal content such as "my dog sleeping on the couch" or text embedded in a screenshot.

## Current State
There is no OCR pipeline, image captioning, visual tag generation, or normalized way to attach visual meaning to indexed files.

## Desired Outcome
The app can extract text from screenshots and scanned documents, generate captions/tags for images, and feed those outputs into semantic search so visual files are discoverable through natural language.

## Approach
Add a multimodal enrichment pipeline that consumes image-like files and scanned document candidates from the indexer. It should emit OCR text, captions, tags, confidence/error metadata, and searchable text suitable for the vector search pipeline.

## Scope
- **In**: OCR for screenshots and scanned documents, image caption generation, AI tags, confidence/error metadata, normalized visual content payloads, and integration with semantic vector search.
- **Out**: Full photo management, image editing, face recognition, biometric identification, cloud albums, and manual tagging workflows beyond generated metadata.

## Boundary Candidates
- Indexer owns file discovery and type detection.
- Vision/OCR pipeline owns visual text and caption/tag generation.
- Semantic vector search owns embeddings and retrieval over generated visual text.

## Out of Boundary
This spec does not own general document text extraction for born-digital PDFs/DOCX, desktop result UI, or vector database internals.

## Upstream / Downstream
- **Upstream**: local-file-indexer supplies image and scanned-document candidates; semantic-vector-search supplies embedding/index integration.
- **Downstream**: desktop-search-shell displays image results and match context; privacy-performance-controls govern AI provider use and resource limits.

## Existing Spec Touchpoints
- **Extends**: None.
- **Adjacent**: content-extraction-pipeline, semantic-vector-search, privacy-performance-controls.

## Constraints
Visual processing can be expensive, so it must be queueable and throttleable. Privacy-sensitive image processing should default to local or require explicit remote-provider consent.
