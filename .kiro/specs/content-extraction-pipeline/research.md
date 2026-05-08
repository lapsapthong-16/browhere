# Research Log

## Summary

The content extraction pipeline is an extension that sits between the Local File Indexer and future Semantic Vector Search. Discovery focused on existing project specs rather than implementation code because the repository currently contains specifications but no content extraction implementation. The design follows the roadmap's local-first Windows MVP, the indexer's stable `FileRecord` and durable job contracts, and the desktop shell's requirement that status remain user-presentable without exposing parser internals or raw file contents.

## Investigations

### Upstream File and Job Contracts

- **Sources**: `.kiro/specs/local-file-indexer/requirements.md`, `.kiro/specs/local-file-indexer/design.md`
- **Findings**: The indexer owns registered roots, file identity, file metadata, freshness state, and durable indexing/removal jobs. Downstream processors may claim jobs and settle completion or failure through `JobService`; they must not mutate root scope, eligibility, identity, or freshness directly.
- **Implications**: Extraction must preserve `fileId` continuity, treat indexer jobs as the authoritative trigger, and return job completion or failure through the indexer lifecycle rather than inventing a separate file discovery path.

### User-Facing Status Contract

- **Sources**: `.kiro/specs/desktop-search-shell/design.md`, `.kiro/steering/roadmap.md`
- **Findings**: The desktop shell owns presentation, search states, file actions, and high-level status. It explicitly excludes extraction internals, embeddings, and vector database details.
- **Implications**: Extraction status must be summarized as counts and human-presentable reasons. Raw text, parser stack traces, and downstream embedding concepts should stay out of shell-facing status.

### Parser Scope

- **Sources**: `.kiro/specs/content-extraction-pipeline/brief.md`, roadmap scope
- **Findings**: Required format coverage is PDF, Word documents, plain text, Markdown or notes, and code files. OCR, image captioning, embeddings, and ranking are out of scope.
- **Implications**: The design uses a pluggable parser registry but limits MVP parser adapters to text-bearing local formats. Scanned PDF OCR is represented as empty or unsupported text extraction, not as a hidden OCR task.

## Architecture Pattern Evaluation

- **Selected pattern**: Local worker pipeline with parser adapters, normalized payload persistence, and contract-first downstream readers.
- **Why**: This keeps parser-specific concerns isolated while giving Semantic Vector Search one stable extracted-content shape.
- **Rejected alternative**: Embedding-specific chunk generation inside extraction. This was rejected because the roadmap assigns embeddings, vector storage, retrieval, and ranking to Semantic Vector Search. Extraction should provide chunking hints and normalized text, not vector-specific records.

## Design Decisions

1. **Generalize parser output, not parser behavior**: Parsers may vary internally, but all successful outputs become a single `ExtractedContentPayload`.
2. **Use source version markers as freshness guards**: Extraction results are current only when their captured file version matches the file record version supplied by the indexer.
3. **Separate empty, unsupported, limited, and failed states**: These states have different downstream meaning and user-facing status implications.
4. **Keep local-first as a hard default**: No parser adapter may send file contents off-machine under this spec.

## Risks and Mitigations

- **Large or malformed documents can consume excessive resources**: The design includes extraction limits, timeout or size failure reasons, and limited-content status.
- **File changes during parsing can create stale output**: The design records source version markers and promotes only matching extraction results to current.
- **Parser dependency behavior may differ by platform**: The design keeps parser adapters behind contracts and requires integration tests with representative fixtures.
- **Downstream consumers may assume all files have text**: Ready-for-embedding queries include only usable current payloads and exclude unsupported, empty, failed, pending, and removed states.

## Synthesis Outcomes

- **Generalization**: PDF, DOCX, text, Markdown, notes, and code extraction all map to parser adapters returning normalized text, metadata, status, and chunking hints.
- **Build vs adopt**: The implementation should adopt proven parser libraries for PDF and DOCX parsing where compatible with the stack, while building the registry, normalization, status, and persistence contracts locally.
- **Simplification**: The pipeline does not create a general distributed queue. It consumes the existing local indexer job lifecycle and stores extraction state locally.
