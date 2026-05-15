# Browhere

Browhere is a local-first semantic search app for personal folders. It indexes only the folders you approve, stores the vector database on your machine, and lets you find files by meaning instead of exact filenames.

It is built for the common problem of knowing what a file was about, what an image looked like, or which project folder it belonged to, but not remembering its name or path.

## Problem Statement

Desktop file search is still mostly literal. It works when you remember exact filenames, extensions, or words inside a document, but it breaks down when:

- the filename is vague, such as `IMG_4021.jpg` or `notes-final-v3.md`;
- the file is an image with no searchable text;
- the useful signal is in PDF or DOCX contents;
- the user remembers a concept, brand, scene, topic, or folder context rather than a string;
- the user does not want to upload an entire folder archive to a hosted search product.

Browhere solves this by turning approved local folders into a searchable semantic index while keeping the index local.

## Solution

Browhere runs as a Next.js app on your machine. You approve one or more folder paths in the browser UI. The app discovers supported files, extracts useful text or image context, generates embeddings with Gemini, stores searchable vectors in LanceDB locally, and returns ranked file matches for natural-language queries.

For stronger retrieval, Browhere can use Groq as a bounded retrieval agent. Groq may rewrite a query into a small number of retrieval passes and rerank candidate results, but it only receives the user query, candidate snippets, and safe metadata from already approved folders.

## What It Supports

- Local folder approval and removal from the web UI
- Recursive indexing for `txt`, `md`, `pdf`, `docx`, `png`, `jpg`, and `jpeg`
- File watching for additions, edits, and deletions
- Default exclusions for sensitive or noisy paths such as `.env`, `.git`, `node_modules`, caches, build output, `*.key`, and `*.pem`
- Text extraction for plain text, Markdown, PDF, and DOCX files
- Raw image embeddings and generated image labels for searchable visual context
- Searchable metadata context from safe fields such as display name, file type, parent folders, size class, and modified time
- Local LanceDB persistence for vectors, chunks, file records, folder state, and indexing metadata
- Optional Groq query planning and reranking
- UI visibility into folder status, indexed files, chunks, failures, partial results, and image-label state

## User Scenarios

| Scenario | User action | How Browhere responds |
| --- | --- | --- |
| Find a topic inside a document | Search `document about lizards` | Embeds the query with Gemini, searches local LanceDB chunks, groups matches by file, and returns relevant text/PDF/DOCX files even if the filename does not contain `lizards`. |
| Find an image by visual memory | Search `photo of a restaurant sign` | Searches raw image vectors and generated image-label embeddings. If the caption exists, it is shown as match context. If captioning is pending, Browhere can still show an unconfirmed visual match. |
| Find by file context | Search `finance pdf from reports folder` | Uses metadata embeddings and lexical fallback over display name, file path, folder names, media type, and safe metadata fields. |
| Add a new folder | Submit an absolute folder path | Normalizes and persists the folder as an approved root, scans supported files, starts watchers, and updates indexing status in the UI. |
| Edit or add a file after indexing | Save a supported file under an approved folder | Chokidar detects the change and queues the file for reindexing without a manual refresh action. |
| Delete a file | Remove a previously indexed file from disk | Browhere prunes or marks stale records so future search results do not present the deleted file as available. |
| Gemini key is missing | Start the app without `GEMINI_API_KEY` | Indexing and semantic search report provider-unavailable status and file contents are not sent for embeddings. |
| Groq key is missing | Start the app without `GROQ_API_KEY` | Browhere still performs basic Gemini vector search. Agentic query planning and reranking are disabled. |
| Image labeling fails because of quota or provider issues | Index a supported image while labeling is unavailable | The raw image embedding is preserved when available, the file is marked partial or pending for labels, and a repair task can retry later. |
| Remove an approved folder | Click remove for a folder | Browhere stops watching that folder and excludes its indexed records from future searches. |

## Privacy Model

Browhere is local-first, not offline-only.

- The folder list, vector index, file records, extracted chunks, and metadata are stored locally in the configured index directory.
- Only folders explicitly approved in the UI are indexed.
- Default exclusions prevent common sensitive and generated paths from being indexed or sent to providers.
- Gemini receives indexed content or image data when embeddings or image labels are generated.
- Groq receives only bounded search payloads: the query, candidate snippets, context-source labels, and selected safe metadata.
- Groq does not receive full folder contents, non-candidate chunks, or files outside approved folders.

Use narrow test folders when working with private data.

## Architecture

```text
Browser UI
  | approve folders, search queries, status polling
  v
Next.js API routes
  | /api/folders, /api/index/status, /api/search
  v
Indexer and Search Orchestration
  | discovery, extraction, watchers, repair queue, query planning
  v
Local Storage + AI Providers
  | LanceDB/local metadata on disk
  | Gemini embeddings and image labels
  | optional Groq planning and reranking
```

Open the standalone architecture and user-flow diagram:

- [architecture-flow.html](./architecture-flow.html)

## Tech Stack

- Next.js App Router
- React 19
- TypeScript
- LanceDB for local vector storage
- Gemini for text embeddings, multimodal embeddings, and image labels
- Groq for optional query planning and reranking
- Chokidar for folder watching
- Mammoth and pdf-parse for document extraction
- Vitest, Testing Library, and Playwright for tests

## Requirements

- Node.js 20 or newer
- Gemini API key for indexing and semantic search
- Groq API key if you want agentic query planning and reranking

## Setup

Install dependencies:

```bash
npm i
```

Create `.env.local`:

```bash
GEMINI_API_KEY=your_gemini_key
GROQ_API_KEY=your_groq_key
HUGGINGFACE_API_KEY=your_huggingface_key
```

Groq is optional. Gemini is required for embeddings.

Optional configuration:

```bash
BROWHERE_INDEX_DIR=.browhere/index
BROWHERE_GEMINI_ENDPOINT=https://generativelanguage.googleapis.com/v1beta
BROWHERE_GEMINI_EMBEDDING_MODEL=gemini-embedding-2
BROWHERE_GEMINI_VISION_MODEL=gemini-2.0-flash
BROWHERE_GEMINI_EMBEDDING_DIMENSIONS=3072
BROWHERE_IMAGE_LABEL_PROVIDER=gemini
BROWHERE_HUGGINGFACE_IMAGE_CAPTION_MODEL=google/gemma-3n-E4B-it:together
BROWHERE_GROQ_ENDPOINT=https://api.groq.com/openai/v1/chat/completions
BROWHERE_GROQ_MODEL=llama-3.3-70b-versatile
BROWHERE_MAX_RETRIEVAL_PASSES=2
```

Run the web app in development:

```bash
npm run dev
```

Open `http://localhost:3000`.

Run the desktop app in development:

```bash
npm run tauri:dev
```

This starts Tauri against the Next.js dev server. It is useful while coding, but it is not the same app bundle you click in `/Applications`.

## Desktop App Build and Install

The clickable macOS app lives at:

```text
/Applications/Browhere.app
```

After code changes, rebuilding does not automatically replace that installed app. Use both commands:

```bash
npm run tauri:build
npm run tauri:install-app
```

`npm run tauri:build` creates the release bundle at:

```text
src-tauri/target/release/bundle/macos/Browhere.app
```

`npm run tauri:install-app` copies that rebuilt bundle over:

```text
/Applications/Browhere.app
```

Start the installed app:

```bash
open /Applications/Browhere.app
```

You can also start it by double-clicking `/Applications/Browhere.app` in Finder.

If the global shortcut does not open the search window, close any running `npm run tauri:dev` or `npm run tauri` instance first. Only one app can own `Command+Shift+Space` at a time.

## Usage

1. Start `/Applications/Browhere.app`.
2. Open the main window from the app icon, or press `Command+Shift+Space` to open the search window.
3. Enter an absolute local folder path in the approved folders form, or use the folder picker in the desktop app.
4. Wait for the index status to show files and chunks.
5. Search with natural language, for example `image of a restaurant sign`, `budget PDF`, or `notes about launch risks`.
6. Review ranked results, match context, readiness state, and source type.
7. Remove a folder when you no longer want that folder included in search.

The default local index path is `.browhere/index`. Override it with `BROWHERE_INDEX_DIR`.

## Scripts

```bash
npm run dev        # Start the Next.js development server
npm run build      # Build for production
npm run start      # Start the production server
npm run tauri:dev  # Start the desktop app in development
npm run tauri:build # Build the macOS desktop release bundle
npm run tauri:install-app # Copy the release bundle to /Applications/Browhere.app
npm run test       # Run Vitest tests
npm run test:e2e   # Run Playwright tests
npm run typecheck  # Run TypeScript checks
```

## Project Layout

```text
app/                 Next.js routes, UI, and API handlers
lib/ai/              Gemini and Groq provider clients
lib/files/           File discovery, exclusions, and extraction
lib/indexer/         Folder watching, indexing, and repair queue
lib/search/          Semantic search orchestration
lib/storage/         LanceDB-backed repository and local metadata
openspec/            Product specs and archived changes
test/                Vitest setup
tests/               Playwright tests
architecture-flow.html
```

## API Surface

| Route | Method | Purpose |
| --- | --- | --- |
| `/api/folders` | `GET` | Return approved folders and runtime status. |
| `/api/folders` | `POST` | Approve and index a folder path. |
| `/api/folders` | `DELETE` | Remove an approved folder and exclude its records. |
| `/api/index/status` | `GET` | Return index state, provider readiness, counts, failures, and document log. |
| `/api/search` | `POST` | Search indexed files with a natural-language query. |

## Testing

Run local checks:

```bash
npm run test
npm run typecheck
```

Run browser tests:

```bash
npm run test:e2e
```

Playwright starts the development server automatically from `playwright.config.ts`.

## Current Scope

Browhere is a V1 local web app. It does not provide desktop-native open/reveal actions, user accounts, hosted sync, spreadsheet/audio/video indexing, or a remote vector database. Those can be added later without changing the core approved-folder and local-index model.
