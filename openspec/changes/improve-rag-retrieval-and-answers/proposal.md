## Why

Browhere already retrieves files by semantic similarity, but result quality depends on simple top-k settings, coarse ranking, and limited explanation surfaces. The next step is to make retrieval more controllable, evidence-rich, and answer-capable while preserving the local-first and bounded-provider privacy model.

## What Changes

- Add configurable top-k retrieval controls for semantic candidate collection, per-pass candidate limits, and final result limits.
- Improve hybrid ranking by combining vector similarity, lexical match, filename/path match, metadata match, source confidence, and optional recency/file-type boosts.
- Add structured query understanding for file type, date, folder, visual, OCR/text, and answer intent.
- Split image-derived text into separate searchable evidence records for visual captions and OCR text instead of treating all image text as one label.
- Improve result explanations so every result exposes source-specific evidence, score components, and why it was included.
- Add answer-generation RAG mode that synthesizes an answer from retrieved evidence with citations to files and chunks.
- Keep Groq agentic behavior bounded to query planning, reranking, explanation, and optional answer generation over retrieved candidates only.

## Capabilities

### New Capabilities
- `rag-answer-generation`: Answer user questions from retrieved local evidence with citations and strict grounding.

### Modified Capabilities
- `agentic-semantic-search`: Add query understanding, real top-k controls, hybrid ranking, richer result explanations, and bounded answer-oriented orchestration.
- `multimodal-embedding-index`: Add separate OCR-text embedding records for image files and preserve source-specific chunk metadata needed for ranking/explanations.
- `image-labeling`: Distinguish visual caption evidence from OCR/readable-text evidence and preserve provenance for both.

## Impact

- Affected code: `lib/search/search.ts`, `lib/ai/groq.ts`, `lib/ai/gemini.ts`, `lib/indexer/indexer.ts`, `lib/files/extraction.ts`, `lib/storage/repository.ts`, `lib/types.ts`, search API routes, and result UI components.
- Storage impact: LanceDB chunk records need backward-compatible fields for evidence type, rank feature metadata, OCR text, chunk/page references, and explanation payloads.
- Provider impact: Gemini remains required for embeddings; image OCR may use Gemini vision or another configured provider; Groq remains optional for planning/reranking/explanations/answers.
- API impact: `/api/search` response shape will expand with score details, evidence snippets, query interpretation, top-k diagnostics, and optional answer payloads.
- Testing impact: retrieval tests need coverage for top-k behavior, hybrid ranking, source-specific image evidence, query filters, and grounded answers.
