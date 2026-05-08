# Research & Design Decisions

## Summary

- **Feature**: `privacy-performance-controls`
- **Discovery Scope**: Extension / cross-cutting integration across generated specs
- **Key Findings**:
  - The roadmap positions this feature last because it must constrain local indexing, extraction, OCR, embeddings, and desktop UX without taking ownership of those pipelines.
  - Upstream specs already define status contracts and provider policy placeholders, but they defer actual provider settings, consent UI, resource controls, folder exclusions, and policy authority to this spec.
  - The repository currently contains specifications only. `product.md`, `tech.md`, and `structure.md` steering files are absent; `.kiro/steering/roadmap.md` is the authoritative steering context available.

## Research Log

### Upstream Enforcement Hooks

- **Context**: The brief requires policy enforcement before processing occurs.
- **Sources Consulted**: `.kiro/specs/local-file-indexer`, `content-extraction-pipeline`, `semantic-vector-search`, and `vision-ocr-pipeline` requirements and designs.
- **Findings**:
  - Local File Indexer owns indexed roots, file lifecycle, eligibility filtering, durable jobs, and status snapshots.
  - Content Extraction Pipeline reads file contents locally by default and already anticipates configured extraction limits.
  - Semantic Vector Search contains an `EmbeddingPolicy` placeholder and needs provider policy decisions before content or query embedding.
  - Vision OCR Pipeline contains a `VisionProviderPolicy` placeholder and needs explicit remote-processing permission before OCR, captioning, or tagging.
- **Implications**: This spec should define a shared `PolicyDecisionService` and policy state, while upstream processors remain responsible for calling it at their existing pre-work boundaries.

### User-Facing Controls and Status

- **Context**: The brief includes indexing transparency, provider controls, storage visibility, pause/resume, and resource limits.
- **Sources Consulted**: Desktop Search Shell design plus all upstream status sections.
- **Findings**:
  - Desktop Search Shell owns UI presentation and should consume settings/status contracts without owning policy semantics.
  - Upstream pipelines expose aggregate status counts but use domain-specific terms that should not leak directly into settings.
  - User-facing explanations need normalized reasons such as excluded, policy blocked, paused, throttled, waiting for battery, failed, or current.
- **Implications**: Add a controls view model service that combines policy settings with upstream status snapshots into a privacy-safe presentation shape.

### Provider Settings and Resource Limits

- **Context**: Provider modes and resource limits must apply consistently across text, vision, and embedding work.
- **Sources Consulted**: Roadmap, Content Extraction, Semantic Vector Search, Vision OCR Pipeline specs.
- **Findings**:
  - Remote provider support is intentionally replaceable and must be explicit opt-in.
  - Resource-sensitive work is distributed across crawl, extraction, visual enrichment, and semantic indexing workers.
  - The first MVP can use policy limits and worker decisions rather than OS-level process enforcement.
- **Implications**: Model provider policy and resource policy as persisted settings plus runtime snapshots. Workers consult the policy before starting or continuing units of work.

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks / Limitations | Notes |
|--------|-------------|-----------|---------------------|-------|
| Central policy service | Shared privacy/resource policy service consulted by every worker and shell settings UI | Single authority, testable decisions, consistent denial reasons | Requires every pipeline to honor the hook | Selected |
| Per-pipeline settings | Each pipeline owns its own provider and resource controls | Local implementation is simple per component | Inconsistent behavior and duplicate consent semantics | Rejected |
| UI-only controls | Hide or filter settings and results in shell | Simple first screen | Violates brief because processing may already have occurred | Rejected |

## Design Decisions

### Decision: Centralize Policy Decisions

- **Context**: Exclusions, provider modes, pause state, battery behavior, and resource limits affect every processing pipeline.
- **Alternatives Considered**:
  1. Add local settings to each pipeline.
  2. Define a central policy decision service with pipeline-specific decision inputs.
- **Selected Approach**: A `PolicyDecisionService` evaluates indexed scope, modality, provider mode, pause state, resource state, and battery state before work begins.
- **Rationale**: One authority prevents drift and creates a clear boundary for implementation review.
- **Trade-offs**: Pipelines must integrate a new dependency and treat missing policy as fail-closed for private processing.
- **Follow-up**: Implementation must verify that all downstream workers call policy before reading or transmitting content.

### Decision: Keep Presentation Separate from Policy Ownership

- **Context**: Desktop Search Shell owns UI surfaces; this feature owns policy and status semantics.
- **Alternatives Considered**:
  1. Make settings UI own policy state directly.
  2. Expose typed view models from policy/status services to the shell.
- **Selected Approach**: `ControlsViewModelService` composes persisted settings and upstream status into shell-safe display data.
- **Rationale**: This aligns with the shell boundary and keeps privacy rules testable outside UI components.
- **Trade-offs**: Adds a small translation layer.
- **Follow-up**: UI tests should validate consent and error flows without exposing raw content.

### Decision: Use Soft Runtime Enforcement for MVP Resource Controls

- **Context**: The MVP is a local desktop app with background workers rather than separate services.
- **Alternatives Considered**:
  1. OS-level process controls.
  2. Worker-consumed policy limits and runtime snapshots.
- **Selected Approach**: Persist resource limits and expose `ResourceBudgetSnapshot` for workers to honor.
- **Rationale**: Fits staged implementation without choosing heavyweight process supervision prematurely.
- **Trade-offs**: Enforcement depends on worker compliance.
- **Follow-up**: Tests must cover worker deferral decisions for paused, throttled, and battery-aware states.

## Risks & Mitigations

- Policy bypass by a pipeline -- require explicit integration tasks and tests for each upstream processor hook.
- Confusing user status -- normalize blocked reasons and aggregate counts through the controls view model.
- Remote processing enabled accidentally -- require explicit consent state before remote provider decisions can allow content transmission.
- Resource controls interpreted inconsistently -- define a single `ResourceBudgetSnapshot` contract consumed by all workers.

## References

- `.kiro/steering/roadmap.md` -- project scope, local-first constraints, and dependency order.
- `.kiro/specs/desktop-search-shell/design.md` -- shell ownership and result/status presentation boundary.
- `.kiro/specs/local-file-indexer/design.md` -- indexed roots, eligibility, file status, and job lifecycle hooks.
- `.kiro/specs/content-extraction-pipeline/design.md` -- extraction limits, local-only defaults, and aggregate status.
- `.kiro/specs/semantic-vector-search/design.md` -- embedding policy hook and semantic status.
- `.kiro/specs/vision-ocr-pipeline/design.md` -- vision provider policy hook, throttled status, and visual status.
