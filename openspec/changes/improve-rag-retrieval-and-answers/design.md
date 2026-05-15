## Context

Browhere currently indexes approved local folders into LanceDB using Gemini embeddings and optional image labels. Search embeds the user's query, runs LanceDB vector search, adds lexical fallback, groups chunk hits by file, and optionally asks Groq to plan and rerank bounded candidates.

The current flow is useful but coarse. Top-k is derived from the result limit, ranking is mostly vector-score-first with simple lexical fallback, image evidence mixes visual labels with any readable text, and explanations are a single context string. Answer-style RAG is not yet a first-class mode.

The design must preserve the privacy model: local index storage, only approved-folder records, Gemini for embedding/index evidence, and bounded Groq payloads containing candidates rather than full folders.

## Goals / Non-Goals

**Goals:**
- Make retrieval controls explicit: semantic candidate top-k, per-query passes, lexical candidate limits, final result limit, and optional source-specific caps.
- Improve ranking with a transparent hybrid score composed from vector similarity, lexical match, metadata/path match, evidence source confidence, filters, and optional boosts.
- Add query understanding that extracts retrieval intent and structured filters without requiring exact matches.
- Store image visual captions and OCR/readable text as separate evidence records with separate embeddings and provenance.
- Return richer result explanations that expose evidence source, matched snippet, score components, and whether the evidence is generated, OCR-derived, raw visual, metadata, or extracted text.
- Add answer-generation mode that uses retrieved evidence to answer questions with citations.

**Non-Goals:**
- No hosted vector database.
- No indexing outside approved folders.
- No full-file upload to Groq for reranking or answer generation.
- No replacement of Gemini as the embedding provider in this change.
- No spreadsheet, audio, or video indexing expansion.

## Decisions

1. **Represent retrieval evidence as typed records.**

   Existing chunk records already have `recordKind` and `contextSource`. Extend that model instead of adding a parallel table. New evidence types include `imageVisualCaption` and `imageOcrText`, while existing `rawImageVector`, `extractedText`, and `metadata` remain valid.

   Alternative considered: one combined image text record. That keeps storage simple but weakens ranking and explanations because OCR text and visual captions have different reliability and retrieval intent.

2. **Use configurable retrieval controls with sane defaults.**

   Add search options/config for semantic top-k, lexical top-k, per-pass top-k, max retrieval passes, source caps, and final result limit. Defaults should preserve current behavior roughly: final limit remains caller-driven and semantic candidate pool remains larger than final results.

   Alternative considered: keep `limit * 4`. That is simple, but it hides retrieval behavior and makes tests/tuning harder.

3. **Perform hybrid ranking locally before optional Groq reranking.**

   Local ranking should compute score components and produce a deterministic candidate order. Groq can rerank/explain the bounded candidate set, but correctness should not depend on Groq availability.

   Alternative considered: send larger candidate pools to Groq for scoring. That increases provider payloads, cost, latency, and privacy exposure.

4. **Separate query understanding from query rewriting.**

   Query understanding should produce structured intent such as `fileTypes`, `dateRange`, `folderHints`, `visualIntent`, `ocrIntent`, `answerIntent`, and `semanticQueries`. When Groq is unavailable, a local heuristic parser should still handle obvious file extensions, quoted terms, and visual/answer keywords.

   Alternative considered: only let Groq rewrite natural language queries. That misses deterministic filters and makes behavior inconsistent without Groq.

5. **Add answer generation as an explicit mode, not a side effect of search.**

   Search should continue returning ranked files. Answer mode should retrieve evidence, assemble a bounded context pack, and ask the configured answer provider to produce a grounded answer with citations. The response must include when evidence is insufficient.

   Alternative considered: always generate an answer after every search. That adds latency and provider usage to users who only want file results.

6. **Keep citation references local and source-specific.**

   Citations should point to file identity/path plus chunk/evidence id, and page/section metadata when available. The LLM receives only the evidence snippets included in the context pack and must cite those ids.

   Alternative considered: cite only file paths. That is simpler but too vague for document answers and weak for debugging retrieval quality.

## Risks / Trade-offs

- [Risk] More ranking knobs make behavior harder to understand. → Mitigation: expose defaults, diagnostics, and score components in developer-facing responses/tests while keeping UI copy concise.
- [Risk] OCR can be noisy or hallucinated if produced by a vision model. → Mitigation: label OCR/readable-text evidence separately, preserve provider/model, and avoid treating it as human-authored content.
- [Risk] Hybrid scoring can overfit to a few test examples. → Mitigation: keep score components explicit, tune with fixture-based tests, and avoid hidden one-off boosts.
- [Risk] Answer generation may imply unsupported facts. → Mitigation: require strict grounding, citations, and an insufficient-evidence response when retrieved context does not support an answer.
- [Risk] Schema migration can break old indexes. → Mitigation: normalize missing fields to existing defaults and rebuild only new evidence records when files are unchanged.

## Migration Plan

1. Add backward-compatible type fields and normalizers for new evidence sources and ranking metadata.
2. Index new OCR evidence for images without deleting existing raw image and image label records.
3. Add retrieval config defaults that preserve current result volume.
4. Introduce hybrid scorer behind the existing `/api/search` path and validate current tests.
5. Add query understanding and diagnostics to the search response.
6. Add optional answer-generation API behavior after search remains stable.
7. If rollback is needed, ignore new fields and continue using existing vector search, lexical fallback, grouping, and Groq reranking.

## Open Questions

- Should answer generation use Groq only, or allow a separate configurable answer provider?
- Should OCR be implemented through Gemini vision prompts first, or a local OCR library where available?
- Should top-k controls be environment-only for V1, request-level API options, or both?
