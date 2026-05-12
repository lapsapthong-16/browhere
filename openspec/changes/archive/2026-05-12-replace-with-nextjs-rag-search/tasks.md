## 1. Project Replacement

- [x] 1.1 Replace the Vite/Tauri project structure with a Next.js App Router project in the repo root.
- [x] 1.2 Update `package.json`, TypeScript config, lint/test scripts, and build scripts for Next.js and TypeScript/Node.
- [x] 1.3 Remove Rust/Tauri runtime paths from the active app build while preserving git history.
- [x] 1.4 Add `.env.local.example` documenting required `GEMINI_API_KEY`, `GROQ_API_KEY`, and local index path settings.

## 2. Local Index Storage

- [x] 2.1 Add LanceDB-backed repository modules for file records, chunk records, embeddings, folder registry, index status, and schema version metadata.
- [x] 2.2 Implement local app-data path resolution and index initialization for development.
- [x] 2.3 Implement reset/rebuild helpers for local index data.
- [x] 2.4 Add repository tests for insert, update, delete, unchanged-file reuse, and vector search.

## 3. Folder Indexing

- [x] 3.1 Implement approved-folder registration and removal APIs.
- [x] 3.2 Implement recursive discovery for `txt`, `md`, `pdf`, `docx`, `png`, `jpg`, and `jpeg`.
- [x] 3.3 Implement default exclusion rules for `.env`, `.git`, `node_modules`, build/cache directories, private keys, and unsupported noisy files.
- [x] 3.4 Implement automatic background watching with debounced reindex jobs for created, changed, and deleted files.
- [x] 3.5 Implement indexing status APIs for folders, queue progress, skipped counts, failures, and timestamps.
- [x] 3.6 Add tests for exclusions, supported extension detection, folder removal cleanup, watcher events, and failure isolation.

## 4. Extraction And Embedding

- [x] 4.1 Implement text extraction and chunking for `txt` and `md`.
- [x] 4.2 Implement PDF text extraction with partial/failure status.
- [x] 4.3 Implement DOCX text extraction with partial/failure status.
- [x] 4.4 Implement Gemini embedding client for text chunks and search queries.
- [x] 4.5 Implement raw Gemini image embedding for `png`, `jpg`, and `jpeg`.
- [x] 4.6 Implement image fallback indexing when raw image embedding is unavailable.
- [x] 4.7 Persist embeddings, extracted chunks, metadata, content markers, and partial/failure status in LanceDB/local metadata.
- [x] 4.8 Add tests for chunking, extraction failures, missing Gemini key handling, vector dimension validation, and unchanged-file reuse.

## 5. Agentic Search

- [x] 5.1 Implement local vector retrieval over LanceDB with file-level result grouping.
- [x] 5.2 Implement Groq query planning and query rewrite with a configured maximum retrieval-pass limit.
- [x] 5.3 Implement Groq candidate reranking using only query text, candidate snippets, and file metadata.
- [x] 5.4 Implement match explanations as snippets, captions, or concise rationale text.
- [x] 5.5 Implement fallback basic vector search when Groq is unavailable but Gemini query embeddings work.
- [x] 5.6 Add tests for retrieval pass limits, Groq payload minimization, reranking preservation of local file identities, and missing-key fallbacks.

## 6. Next.js UI

- [x] 6.1 Build the main search page with search input, readiness state, loading state, empty state, and ranked results.
- [x] 6.2 Build folder management UI for adding/removing approved folders and displaying indexed roots.
- [x] 6.3 Build indexing status UI for active work, processed/skipped/failed counts, file failures, and last indexed time.
- [x] 6.4 Add visible privacy copy explaining Gemini receives selected-folder content/images and Groq receives queries plus candidate snippets/metadata.
- [x] 6.5 Remove native open/reveal file actions from V1 result controls.
- [x] 6.6 Add component and browser tests for search, folder management, indexing status, and provider-unavailable states.

## 7. Verification

- [x] 7.1 Run TypeScript checks and unit tests.
- [x] 7.2 Run the Next.js dev server and verify the browser UI loads.
- [x] 7.3 Verify a small fixture folder can be indexed and searched for text/document content.
- [x] 7.4 Verify an image fixture can be indexed and found by a semantic visual query or marked partial when fallback is used.
- [x] 7.5 Verify excluded files are not indexed and are not sent to AI providers.
