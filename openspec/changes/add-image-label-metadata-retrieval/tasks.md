## 1. Schema And Types

- [ ] 1.1 Add record kind and context source types for raw image, image label, extracted text, and metadata context records.
- [ ] 1.2 Extend LanceDB record schema to include structured metadata fields and searchable metadata context.
- [ ] 1.3 Add backward-compatible handling for old records missing new metadata or context source fields.

## 2. Image Labeling

- [ ] 2.1 Add Gemini image labeling client method using configured cloud credentials and existing provider config.
- [ ] 2.2 Add constrained label prompt for visible objects, logos, readable text, scene details, and uncertainty.
- [ ] 2.3 Integrate image label generation into image indexing without blocking raw image embedding success.
- [ ] 2.4 Cache labels by file content marker so unchanged images do not trigger repeated cloud calls.

## 3. Indexing And Persistence

- [ ] 3.1 Persist raw image embedding records and generated caption embedding records for the same image file.
- [ ] 3.2 Persist safe structured metadata for all supported indexed files.
- [ ] 3.3 Generate and persist compact metadata context for retrieval fallback.
- [ ] 3.4 Record partial status when caption generation, optional image metadata reading, or caption embedding fails.

## 4. Search And Reranking

- [ ] 4.1 Include extracted text, generated labels, raw image vector hits, and metadata context in candidate normalization.
- [ ] 4.2 Update Groq rerank payload to include context source labels and safe metadata only.
- [ ] 4.3 Prevent image candidates from being rejected solely because extracted text is missing.
- [ ] 4.4 Return match context and evidence source in search API responses.

## 5. UI And Status

- [ ] 5.1 Show generated label or metadata context as result snippet when extracted text is unavailable.
- [ ] 5.2 Show evidence source for result matches in the React UI.
- [ ] 5.3 Surface image label failures in indexing status without marking the whole folder failed.

## 6. Verification

- [ ] 6.1 Add unit tests for image label persistence, metadata context creation, and old-record compatibility.
- [ ] 6.2 Add search tests covering image result with no extracted text and metadata-assisted retrieval.
- [ ] 6.3 Run typecheck, unit tests, build, and e2e tests.
