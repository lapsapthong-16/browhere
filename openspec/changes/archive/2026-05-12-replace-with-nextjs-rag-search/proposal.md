## Why

The current app is a Tauri/Rust desktop search shell, but the target product is a replacement built as a Next.js app with a TypeScript/Node backend for local RAG search over user-selected folders. Users need to find files by remembered content or visual meaning, not by filename or folder location.

## What Changes

- **BREAKING** Replace the current Vite/Tauri/Rust implementation with a Next.js React application.
- Add a TypeScript/Node indexing backend that reads only user-approved folders.
- Add local LanceDB vector storage for embeddings, metadata, and extracted text chunks.
- Add automatic background watching so changed files are indexed without a manual refresh.
- Use Gemini cloud embeddings for text, documents, and raw images when possible.
- Use Groq chat for bounded agentic retrieval: query rewrite, retrieval planning, reranking, and match explanations.
- Support V1 indexing for `txt`, `md`, `pdf`, `docx`, `png`, `jpg`, and `jpeg`.
- Skip sensitive and noisy paths by default, including `.env`, `.git`, `node_modules`, private keys, and common build/cache directories.
- Store API keys in local development environment variables for V1.
- Keep the product single-user with no authentication or multi-tenant backend.
- Remove native open/reveal file actions from V1 because the replacement is browser-based.

## Capabilities

### New Capabilities

- `folder-indexing`: User-approved folder registration, recursive file discovery, exclusion rules, and automatic background reindexing.
- `multimodal-embedding-index`: Extraction, chunking, Gemini embedding, and local LanceDB persistence for supported text, document, and image files.
- `agentic-semantic-search`: Natural-language search using Groq-assisted query planning, vector retrieval, reranking, and result explanations.

### Modified Capabilities

- None.

## Impact

- Replaces the current `src/` Vite app and `src-tauri/` Rust backend with a Next.js project structure.
- Adds Node-compatible file extraction, folder watching, Gemini embedding, Groq chat, and LanceDB dependencies.
- Introduces local persisted data for indexed file metadata, extracted chunks, embeddings, and indexing status.
- Requires `.env.local` configuration for Gemini and Groq API keys.
- Changes test coverage from the current Tauri command tests toward TypeScript unit/integration tests and browser UI tests.
