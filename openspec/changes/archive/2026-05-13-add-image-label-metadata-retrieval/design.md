## Context

The app indexes approved local folders into LanceDB using Gemini embeddings and uses Groq for bounded retrieval orchestration. Raw image embeddings can match visual concepts, but image results may lack text snippets, causing the reranker or answer step to reject a good hit with messages like "No relevant text found in the snippet."

The fix is to make image records dual-surface: keep visual vectors for semantic image matching, and add generated labels/captions as text evidence for ranking, explanation, and display. File metadata also needs to be stored as structured retrieval context instead of only display fields.

## Goals / Non-Goals

**Goals:**

- Generate cloud image labels/captions for `png`, `jpg`, and `jpeg` files.
- Persist raw image vectors, caption text vectors, and structured file metadata in LanceDB.
- Use extracted text, image captions, and selected metadata as candidate context for Groq.
- Return useful image results even when no extracted text exists.
- Keep all index storage local except cloud AI calls.

**Non-Goals:**

- No local vision model.
- No video/audio/spreadsheet indexing.
- No hosted vector database.
- No desktop-native open/reveal behavior.
- No manual image tagging UI in this change.

## Decisions

1. Store image caption records in addition to raw image records.

   Raw image embeddings are best for visual similarity, while caption embeddings are best for text-based reranking and explanations. Replacing raw image vectors with captions only would lose visual search strength, so both records point to the same file path with different `recordKind` values.

2. Generate labels/captions with Gemini vision before caption embedding.

   The existing provider choice is Gemini cloud. One provider keeps config smaller and avoids adding another dependency. The label prompt should ask for concrete visible objects, logos, scene type, readable text, and location-like clues without inventing private facts.

3. Store metadata as structured fields and as a short searchable metadata summary.

   Structured fields support filtering/display. A compact metadata summary supports vector search fallback for path, extension, file name, media type, dimensions when available, modified date, and source folder. Sensitive default exclusions still apply before metadata or content is sent to any provider.

4. Send bounded candidate context to Groq.

   Groq receives query, candidate snippets/captions, selected metadata, record kind, and file identity. Full files and unrelated chunks stay local.

## Risks / Trade-offs

- Caption hallucination -> use a constrained prompt, mark generated labels as AI-derived, and keep raw image hits visible even if caption confidence is low.
- More cloud calls for images -> cache caption records by content marker and skip unchanged files.
- LanceDB schema migration needed -> create/update tables idempotently and tolerate missing new fields on old rows until reindex.
- Metadata may expose path names to Groq -> only send metadata from approved folders and keep payload limited to candidate results.
- Generated labels may miss local meaning like "my local McDonald's" -> combine raw visual match, caption text, filename/path metadata, and user query rewrite.

## Migration Plan

1. Add new LanceDB fields with backward-compatible defaults.
2. Reindex changed or requested image files to create caption records.
3. Keep existing raw image records valid.
4. Search handles old rows with missing captions/metadata by falling back to existing snippet behavior.
5. Rollback by ignoring caption record kinds and metadata summary fields; raw image/text search remains usable.
