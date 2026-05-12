## Context

The current repository contains a Vite React frontend with a Tauri/Rust backend that already explores folder selection, indexing state, Gemini embeddings, Groq runtime configuration, SQLite persistence, and `sqlite-vec` search. The replacement must move the product to a Next.js React app with TypeScript/Node backend code, local storage, LanceDB vectors, cloud-only AI models, and no native desktop wrapper in V1.

The target user selects folders they trust, lets the app index supported files in the background, and later searches by remembered meaning such as "McDonald's image" or "document about lizards" even when filenames and folders are unhelpful.

## Goals / Non-Goals

**Goals:**

- Replace the app with a Next.js project using React for the UI and TypeScript/Node for backend APIs and workers.
- Index only user-approved folders and skip sensitive/noisy paths by default.
- Support automatic background file watching for `txt`, `md`, `pdf`, `docx`, `png`, `jpg`, and `jpeg`.
- Persist file metadata, extracted text chunks, image-derived searchable content, embeddings, and indexing state locally.
- Use Gemini for cloud embeddings and Groq for bounded agentic retrieval orchestration.
- Keep API keys in `.env.local` for the first version.
- Keep the app single-user and local-first.

**Non-Goals:**

- No Rust/Tauri backend in V1.
- No local embedding or chat models.
- No video, audio, spreadsheet, or full-disk indexing in V1.
- No login, multi-user accounts, or hosted SaaS backend.
- No browser-based open/reveal file actions in V1.

## Decisions

1. Use Next.js App Router as the replacement application.

   Rationale: Next.js keeps React UI and TypeScript backend code in one project and matches the requested stack. API routes can expose indexing/search endpoints, while server-only modules can own filesystem, LanceDB, Gemini, and Groq integrations.

   Alternatives considered: Keep Vite/Tauri and replace only Rust with a sidecar service; use Python/FastAPI. Both add more moving parts than requested for the replacement.

2. Use a local Node worker for indexing rather than relying only on request/response API routes.

   Rationale: recursive crawling, extraction, image embedding, and file watching are long-running operations. A worker module can manage queues, debounce filesystem events, update status, and avoid blocking UI requests.

   Alternatives considered: index synchronously from API routes. This is simpler but brittle for large folders and background watching.

3. Use LanceDB for local vector and metadata persistence.

   Rationale: LanceDB is a local vector database with a Node integration and simpler operational fit for multimodal RAG than managing SQLite vector extensions from TypeScript. It can store vectors with file metadata and chunk references in local app data.

   Alternatives considered: SQLite plus vector extension. That keeps continuity with the current Rust prototype but has more setup risk in a pure TypeScript/Node app.

4. Store extracted text chunks locally alongside embeddings.

   Rationale: result snippets, reranking, and Groq explanations need source text. Storing chunks avoids repeated extraction and lets the search layer verify results without rereading every source file.

   Alternatives considered: store only embeddings and metadata. This improves privacy footprint but weakens explainability and reranking.

5. Use Gemini embeddings for all supported content, trying raw image embedding first.

   Rationale: the user wants Gemini multimodal embedding behavior for text, documents, and images. For images, the pipeline will first try direct image embedding. If direct image embedding fails or is unsupported for the selected model/API, the system will create text fallback content from file metadata and an image description flow where available.

   Alternatives considered: OCR/caption every image first. That is more predictable for text search but does not use Gemini's multimodal embedding path as the primary mechanism.

6. Use Groq as a bounded retrieval agent, not an autonomous desktop actor.

   Rationale: V1 should be agentic enough to improve retrieval without taking unsafe local actions. Groq can rewrite the query, decide whether a second retrieval pass is useful, rerank candidates, and produce concise match explanations. It cannot open files, mutate indexed folders, or inspect arbitrary paths outside indexed data.

   Alternatives considered: one-shot vector search only. This is faster and cheaper but weaker for ambiguous queries. Fully autonomous file agent behavior is out of scope for a browser-only V1.

7. Keep secrets in `.env.local`.

   Rationale: the first version is a local development app. This avoids building a settings vault before the core RAG flow is proven.

   Alternatives considered: settings UI and OS keychain. Better for packaged desktop use, but not required for the Next.js-only V1.

## Risks / Trade-offs

- Cloud privacy exposure -> The UI must state that indexed contents and images from selected folders are sent to Gemini, and queries/snippets/metadata are sent to Groq.
- Browser filesystem limits -> Folder selection and watching require Node server access to local paths, so the app is a local development/server app rather than a generic hosted website.
- Large folders can trigger high API cost -> Add extension filters, default excludes, queueing, debounce, status reporting, and changed-file reuse.
- Gemini image embedding support may vary by API/model -> Implement raw image embedding first with a fallback path and visible partial-status reasons.
- LanceDB schema changes can be awkward during early iteration -> Version local index metadata and provide a reset/rebuild path.
- Background watchers can miss events or duplicate work -> Combine watchers with periodic reconciliation and idempotent file hashing.
- Groq reranking adds latency and cost -> Cap retrieval passes and candidate count in V1.

## Migration Plan

1. Create a Next.js project structure in the repo and remove the Tauri/Rust runtime from the active application path.
2. Port the existing search UI concepts into Next.js pages/components: search box, result list, indexing status, folder controls, and warnings.
3. Implement server-only modules for folder registry, exclusion rules, extraction, embedding, LanceDB persistence, indexing worker, and search orchestration.
4. Add tests around exclusion rules, extraction/chunking, indexing queue behavior, LanceDB repository functions, and Groq retrieval orchestration.
5. Validate the local app with `npm run dev`, unit tests, and browser checks.

Rollback is git-based during development: keep the OpenSpec change and implementation commits separable so the previous Tauri prototype can be recovered if needed.

## Open Questions

- Exact Gemini model/API endpoint should be verified against official docs during implementation.
- Exact Groq model should default to the current repo's `llama-3.3-70b-versatile` unless a better current Groq model is selected during implementation.
- The app data directory path should be finalized for macOS/Linux/Windows compatibility when implementation starts.
