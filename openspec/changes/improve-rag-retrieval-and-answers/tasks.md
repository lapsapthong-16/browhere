## 1. Retrieval Data Model

- [ ] 1.1 Extend shared search/index types for evidence source, evidence id, provenance, chunk location metadata, score components, query interpretation, retrieval diagnostics, and optional answer payloads.
- [ ] 1.2 Update repository row normalization to read/write new fields while preserving compatibility with existing LanceDB records.
- [ ] 1.3 Add migration-safe defaults for old records missing evidence source, provenance, score details, or chunk location metadata.

## 2. Image Evidence Indexing

- [ ] 2.1 Split image label records into visual-caption evidence with explicit context source and provider/model provenance.
- [ ] 2.2 Add OCR/readable-text extraction for supported images through the configured provider path.
- [ ] 2.3 Embed OCR text as a separate record linked to the same image file identity.
- [ ] 2.4 Queue repair tasks for missing visual-caption or OCR evidence on unchanged image files.
- [ ] 2.5 Add tests for raw image, visual caption, OCR text, and metadata records coexisting for one image.

## 3. Query Understanding And Top-K Controls

- [ ] 3.1 Add retrieval configuration for semantic top-k, lexical top-k, maximum retrieval passes, source caps, answer context budget, and final result bounds.
- [ ] 3.2 Extend `/api/search` input parsing to accept safe request-level retrieval options within configured bounds.
- [ ] 3.3 Implement local query understanding for file type, folder hint, date hint, quoted text, visual intent, OCR/text intent, and answer intent.
- [ ] 3.4 Extend Groq planning to return structured query intent and semantic retrieval queries while preserving the original query.
- [ ] 3.5 Add tests for default top-k, clamped top-k, and query interpretation without Groq.

## 4. Hybrid Retrieval And Ranking

- [ ] 4.1 Replace implicit `limit * 4` retrieval with configured semantic and lexical candidate collection.
- [ ] 4.2 Compute score components for vector similarity, lexical match, filename/path match, metadata match, source confidence, filters, and optional boosts.
- [ ] 4.3 Group candidates by file using the best evidence plus supporting evidence from other sources.
- [ ] 4.4 Preserve source-specific caps so one source type or one file cannot dominate the candidate pool.
- [ ] 4.5 Send bounded score components and evidence snippets to Groq reranking when configured.
- [ ] 4.6 Add tests for hybrid ranking order, source caps, metadata boosts, OCR boosts, and Groq fallback behavior.

## 5. Result Explanations

- [ ] 5.1 Expand search results with evidence snippets, source labels, provenance, score details, and retrieval diagnostics.
- [ ] 5.2 Update Groq reranking/explanation prompts to use evidence sources without misrepresenting AI-generated or OCR-derived evidence.
- [ ] 5.3 Update the search UI to show concise match evidence and provenance without overwhelming the result row.
- [ ] 5.4 Add tests for explanation payloads from extracted text, visual captions, OCR text, raw image vectors, metadata, and filename/path matches.

## 6. Answer Generation

- [ ] 6.1 Add answer-generation request/response types and API behavior gated by answer intent or explicit answer option.
- [ ] 6.2 Build a bounded answer context pack from top-ranked diverse evidence records.
- [ ] 6.3 Implement grounded answer generation with citations to file path, evidence id, and page/section/chunk metadata when available.
- [ ] 6.4 Return insufficient-evidence responses when retrieved context does not support an answer.
- [ ] 6.5 Add tests for cited answers, insufficient evidence, provider-unavailable fallback, and answer context budgeting.

## 7. Verification

- [ ] 7.1 Run unit tests for search, repository normalization, indexing, Groq planning/reranking, and answer generation.
- [ ] 7.2 Run typecheck and fix any API/UI type regressions.
- [ ] 7.3 Run targeted UI/e2e coverage for normal search results and answer-enabled search.
- [ ] 7.4 Validate OpenSpec status for the change before implementation is marked complete.
