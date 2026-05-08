# Implementation Plan

- [ ] 1. Establish visual enrichment contracts and storage foundation
- [ ] 1.1 Define visual content, status, provider, error, and reader contracts
  - Capture source traceability, canonical `sourceVersion`, enrichment version, visual modalities, confidence metadata, and retryable errors.
  - Include current, limited, empty, stale, removed, failed, policy-blocked, pending, running, and throttled states.
  - Define a visual worker adapter over Local File Indexer `PipelineWorkItem` and require `targetProcessor = "visualEnrichment"`.
  - Consume the shared Privacy Performance Controls `ProviderMode = "localOnly" | "remoteAllowed" | "hybrid"` without redefining provider mode semantics.
  - The completed contracts compile without unsafe public types and can be imported by worker, repository, and reader modules.
  - _Requirements: 1.4, 2.5, 4.1, 4.2, 5.5, 7.1, 8.5_

- [ ] 1.2 Create local persistence for visual enrichment records and current payload pointers
  - Persist records, payloads, signals, current pointers, attempts, safe failure reasons, and timestamps.
  - Enforce one current payload per file and canonical `sourceVersion`.
  - The repository can store, replace, remove, and recover visual state after restart.
  - _Requirements: 4.1, 4.5, 7.2, 7.3, 7.4_
  - _Touches: storage migrations_

- [ ] 2. Build candidate classification and provider policy
- [ ] 2.1 (P) Implement visual candidate classification from indexer-owned file state
  - Accept image-like files and scanned-document candidates based on file metadata supplied by the indexer.
  - Reject files outside eligible lifecycle states, including deleted, removed, excluded, unsupported, and inaccessible files.
  - The classifier returns an observable accept or reject decision with a safe reason for every candidate fixture.
  - _Requirements: 1.1, 1.2, 1.3, 1.5_
  - _Boundary: CandidateClassifier_

- [ ] 2.2 (P) Implement local-first provider policy decisions
  - Implement only a thin `VisionPolicyAdapter` that turns OCR, caption, and tag work into Privacy Performance Controls `PolicyWorkRequest` values.
  - Permit remote processing only when the shared controls `PolicyDecisionService` allows the candidate, modality, and `ProviderMode`.
  - Consume controls impact plans when provider mode or permission changes instead of owning divergent invalidation semantics.
  - _Requirements: 3.5, 5.1, 5.2, 5.3, 5.4, 5.5_
  - _Boundary: VisionPolicyAdapter_

- [ ] 3. Implement visual signal processing and payload normalization
- [ ] 3.1 (P) Add OCR processor port and normalized OCR result handling
  - Represent ordered OCR regions with text, labels, offsets, and confidence where available.
  - Distinguish empty OCR from processor failure.
  - OCR results from screenshots, image files, and scanned-document candidates can be normalized into visual text signals.
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_
  - _Boundary: OCRProcessor_

- [ ] 3.2 (P) Add vision processor port for captions and non-biometric generated tags
  - Represent captions and tags as visual signals with confidence and low-confidence markers.
  - Exclude biometric identity and face-recognition outputs from accepted processor results.
  - Caption and tag fixtures produce safe signals or explicit low-confidence omissions without fabricated content.
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_
  - _Boundary: VisionProcessor_

- [ ] 3.3 Build visual payload normalization across OCR, captions, and tags
  - Combine visual signals into searchable text while preserving modality, labels, offsets, confidence, and source traceability.
  - Produce current, limited, or empty payload status based on available signals and failures.
  - The payload builder emits deterministic payload content for equivalent canonical `sourceVersion` and processor outputs.
  - _Requirements: 1.4, 2.4, 2.5, 3.3, 3.4, 4.1, 4.2, 4.3, 4.4, 8.2, 8.3, 8.4_
  - _Depends: 3.1, 3.2_

- [ ] 4. Implement enrichment service, freshness transitions, and worker recovery
- [ ] 4.1 Wire the visual enrichment service through classification, policy, processors, and repository
  - Validate candidates and provider policy before processing.
  - Persist partial success when at least one useful OCR, caption, or tag signal exists.
  - The service durably records current, limited, empty, failed, or policy-blocked state before job settlement.
  - _Requirements: 1.3, 4.1, 4.4, 5.3, 6.4, 7.1, 7.3_

- [ ] 4.2 Implement visual freshness and removal transitions
  - Mark changed canonical `sourceVersion` values stale until refreshed.
  - Remove deleted or removed files from current ready reads.
  - Policy changes can mark affected payloads for regeneration, invalidation, or no-op preservation.
  - _Requirements: 5.4, 6.3, 6.4, 7.4_

- [ ] 4.3 Add queue-backed worker execution and restart recovery
  - Claim `visualEnrichment` `PipelineWorkItem` records from the indexer contract and run them asynchronously under configured limits.
  - Preserve pending, running, failed, stale, policy-blocked, and current state across restart.
  - Shell search remains usable while visual work is queued, running, throttled, or retrying.
  - _Requirements: 1.5, 6.1, 6.2, 6.5, 7.2, 7.3_

- [ ] 5. Expose downstream reads and diagnostics
- [ ] 5.1 Implement the visual content reader for semantic search intake
  - Return paginated current and limited visual payloads with searchable text derived from OCR, captions, and tags.
  - Exclude stale, removed, failed, pending, running, empty, and policy-blocked payloads from ready-for-embedding reads.
  - Semantic search can consume visual payloads without the vision pipeline creating embeddings, vectors, rankings, or shell results.
  - _Requirements: 4.1, 4.5, 8.1, 8.2, 8.3, 8.4, 8.5_

- [ ] 5.2 (P) Implement aggregate visual enrichment status snapshots
  - Count pending, running, current, limited, empty, stale, failed, policy-blocked, and throttled visual work.
  - Omit raw image contents, OCR text, captions, tags, and provider payloads from diagnostic status.
  - Status snapshots can explain incomplete visual search coverage with safe aggregate data.
  - _Requirements: 4.4, 5.5, 6.5, 7.1, 7.5_
  - _Boundary: VisualStatusService_

- [ ] 6. Integrate boundaries and validate end-to-end behavior
- [ ] 6.1 Connect visual work items to indexer and visual payloads to semantic intake
  - Route visual candidate work through `claimNextWorkItem("visualEnrichment", workerId)`, `completeWorkItem`, and `failWorkItem`.
  - Register visual payload reads as an additional `SemanticContentSource` in the provider-neutral semantic intake contract without changing vector ownership.
  - A processed visual file can move from indexer candidate to current visual payload to semantic-ready input.
  - _Requirements: 1.1, 1.2, 1.5, 6.1, 8.1, 8.5_
  - _Depends: 4.3, 5.1_
  - _Touches: src/indexer/jobService.ts, src/semantic-search/intake/semanticContentIntake.ts_

- [ ] 6.2 Add focused unit and integration coverage for visual pipeline behavior
  - Cover candidate decisions, provider policy, OCR empty status, low-confidence captions and tags, payload normalization, freshness transitions, and reader filtering.
  - Cover restart recovery and duplicate-current prevention for retryable work.
  - Test results demonstrate that all visual pipeline acceptance criteria have an executable validation path.
  - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.4, 3.1, 3.2, 3.5, 4.5, 5.1, 5.3, 6.2, 7.2, 7.3, 7.4, 8.5_

- [ ] 6.3 Validate semantic and shell boundary behavior
  - Verify OCR match metadata, caption context, and tag context are available for downstream explanation without requiring desktop UI changes.
  - Verify deleted or stale visual payloads no longer appear as current semantic-ready content.
  - End-to-end validation shows screenshots, scanned documents, and photos can contribute searchable visual text while embeddings and ranking remain outside this feature.
  - _Requirements: 2.3, 4.3, 4.4, 7.4, 8.1, 8.2, 8.3, 8.4, 8.5_
