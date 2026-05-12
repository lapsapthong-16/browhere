## Why

Image-only vector hits can be retrieved correctly but still fail agentic answer/rerank steps because they have no text snippet for Groq to inspect. File metadata is also useful retrieval evidence, but it is not yet treated as first-class searchable context.

## What Changes

- Generate AI labels/captions for supported image files during indexing.
- Store image labels/captions alongside raw image vectors so visual matches also have text evidence.
- Persist richer file metadata in LanceDB records, including path-derived and filesystem-derived fields needed for search and display.
- Include image captions and selected metadata in retrieval candidates sent to Groq for reranking and explanations.
- Allow search to match against metadata-derived context when content snippets are missing or weak.

## Capabilities

### New Capabilities

- `image-labeling`: Generate, store, and retrieve AI-produced labels/captions for indexed images.

### Modified Capabilities

- `multimodal-embedding-index`: Persist richer metadata and add caption/label embedding records for image files.
- `agentic-semantic-search`: Use captions and metadata as retrieval context for reranking, explanations, and fallback matching.

## Impact

- Indexing pipeline: adds cloud image labeling before or after raw image embedding for supported image files.
- LanceDB schema: adds caption/label records and structured metadata fields.
- Search pipeline: includes captions and metadata in candidate payloads and result context.
- UI/API: result snippets may come from extracted text, generated image labels, or metadata context.
- Environment/config: uses existing Gemini cloud provider; no local model added.
