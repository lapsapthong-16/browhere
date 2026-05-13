# Browhere RAG Search

Browhere is a local-folder semantic search app built with Next.js, TypeScript, LanceDB, Gemini, and Groq. It indexes files from folders you explicitly approve, stores the local vector index on disk, and lets you search by meaning instead of remembering exact file names or paths.

The current app supports text, Markdown, PDF, DOCX, PNG, JPG, and JPEG files.

## Features

- Approve and remove local folders from the browser UI.
- Recursively index supported files from approved folders.
- Watch approved folders for file additions, edits, and removals.
- Skip sensitive and noisy paths by default, including `.env`, `.git`, `node_modules`, build output, cache folders, and private key files.
- Extract text from text documents and supported office/document formats.
- Generate Gemini embeddings for text, documents, images, image labels, and metadata context.
- Store embeddings, chunks, file records, and metadata locally in LanceDB.
- Use Groq for bounded query planning and result reranking when configured.
- Show index status, failures, partial results, and search matches in the Next.js UI.

## Tech Stack

- Next.js App Router
- React
- TypeScript
- LanceDB for local vector storage
- Gemini for embeddings and image labeling
- Groq for query planning and reranking
- Vitest and Testing Library for unit/component tests
- Playwright for browser tests

## Requirements

- Node.js 20 or newer is recommended.
- A Gemini API key is required for indexing and search embeddings.
- A Groq API key is optional but enables agentic query planning and reranking.

## Setup

Install dependencies:

```bash
npm i
```

Create `.env.local`:

```bash
GEMINI_API_KEY=your_gemini_key
GROQ_API_KEY=your_groq_key
```

Optional environment variables:

```bash
BROWHERE_INDEX_DIR=.browhere/index
BROWHERE_GEMINI_ENDPOINT=https://generativelanguage.googleapis.com/v1beta
BROWHERE_GEMINI_EMBEDDING_MODEL=gemini-embedding-2
BROWHERE_GEMINI_VISION_MODEL=gemini-2.0-flash
BROWHERE_GEMINI_EMBEDDING_DIMENSIONS=3072
BROWHERE_GROQ_ENDPOINT=https://api.groq.com/openai/v1/chat/completions
BROWHERE_GROQ_MODEL=llama-3.3-70b-versatile
BROWHERE_MAX_RETRIEVAL_PASSES=2
```

Run the development server:

```bash
npm run dev
```

Open `http://localhost:3000`.

## Usage

1. Enter an absolute folder path in the approved folders form.
2. Wait for indexing status to show files and chunks.
3. Search with natural language, such as `document about lizards` or `image of a restaurant sign`.
4. Remove a folder when you no longer want its records included in search.

The index is stored locally at `BROWHERE_INDEX_DIR` when configured, otherwise at `.browhere/index` in the repo.

## Privacy Notes

Browhere only indexes folders you approve in the UI. The app skips common sensitive paths and key formats by default, but approved file contents can still be sent to cloud providers:

- Selected-folder text, documents, images, generated image labels, and metadata context are sent to Gemini for embeddings and image labeling.
- Search queries, candidate snippets, and selected safe metadata are sent to Groq when Groq is configured.
- Full non-candidate files and files outside approved folders are not sent as part of search reranking.

Use a narrow approved folder when testing with private data.

## Scripts

```bash
npm run dev        # Start the Next.js dev server
npm run build      # Build for production
npm run start      # Start the production server
npm run test       # Run Vitest tests
npm run test:e2e   # Run Playwright tests
npm run typecheck  # Run TypeScript checks
```

## Project Layout

```text
app/                 Next.js routes, UI, and API handlers
lib/ai/              Gemini and Groq provider clients
lib/files/           File discovery, exclusions, and extraction
lib/indexer/         Folder watching and indexing pipeline
lib/search/          Semantic search orchestration
lib/storage/         LanceDB-backed repository
openspec/            Product specs and archived changes
tests/               Playwright tests
test/                Vitest setup
```

## Testing

Run the full local test suite:

```bash
npm run test
npm run typecheck
```

Run browser tests:

```bash
npm run test:e2e
```

Playwright starts the dev server automatically from `playwright.config.ts`.
