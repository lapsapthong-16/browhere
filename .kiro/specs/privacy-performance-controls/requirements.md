# Requirements Document

## Introduction

Windows users need local file search to remain trustworthy while it indexes private documents, images, screenshots, notes, and code. The current project has no folder exclusions, file type exclusions, AI provider controls, explicit local/remote consent, resource limits, pause or resume behavior, storage visibility, or unified indexing transparency. This feature establishes privacy and performance controls that apply before indexing, extraction, OCR, embeddings, and search processing occur, while preserving the local-first product direction.

## Boundary Context

- **In scope**: Indexed location management, folder and file type exclusions, privacy-preserving defaults, canonical provider mode settings, explicit remote-processing consent, policy enforcement decisions, pause/resume indexing, resource limits, battery-aware behavior, indexing status, storage visibility, and user-facing controls for those capabilities.
- **Out of scope**: Enterprise policy management, account sync, cross-device settings, cloud backup, legal certification, team audit logging, parser implementation, OCR engine implementation, embedding model implementation, vector ranking, and result rendering beyond the controls surfaces.
- **Adjacent expectations**: Local File Indexer, Content Extraction Pipeline, Semantic Vector Search, and Vision OCR Pipeline must consult policy before processing. Semantic and vision pipelines use thin adapters over these decisions and must not define divergent provider mode semantics. Desktop Search Shell presents settings and status through contracts defined here without owning policy semantics.

## Requirements

### Requirement 1: Indexed Scope and Exclusion Controls

**Objective:** As a Windows user, I want to choose indexed locations and exclusions, so that private or irrelevant files are not processed.

#### Acceptance Criteria

1. When the user adds an indexed location, the Privacy Performance Controls shall make that location available to indexing policy as an approved root.
2. When the user excludes a folder, the Privacy Performance Controls shall make files under that folder ineligible for new indexing and downstream processing.
3. When the user excludes a file type or extension, the Privacy Performance Controls shall make matching files ineligible for new indexing and downstream processing.
4. If an excluded folder is inside an approved indexed location, then the Privacy Performance Controls shall prefer the more restrictive exclusion for affected files.
5. When indexed scope or exclusion settings change, the Privacy Performance Controls shall expose that affected known files need eligibility re-evaluation.

### Requirement 2: Privacy-Preserving Provider Modes and Consent

**Objective:** As a Windows user, I want AI processing to stay local unless I explicitly allow remote providers, so that file contents and generated search data do not leave my device unexpectedly.

#### Acceptance Criteria

1. When default settings are used, the Privacy Performance Controls shall allow only local processing for file contents, OCR text, image data, captions, tags, and embeddings.
2. When the user enables a remote provider mode, the Privacy Performance Controls shall require explicit consent before any file content or generated content may be transmitted.
3. If remote processing is not allowed for a file, provider, or modality, then the Privacy Performance Controls shall deny the processing request before content is sent.
4. Where local and remote providers are both configured, the Privacy Performance Controls shall expose the active mode that downstream processors must evaluate for each processing request.
5. When provider mode settings change, the Privacy Performance Controls shall expose whether existing extraction, visual, or semantic outputs must be regenerated, invalidated, or left current.
6. The Privacy Performance Controls shall be the single owner of provider mode names and semantics: `localOnly`, `remoteAllowed`, and `hybrid`.

### Requirement 3: Policy Enforcement Hooks

**Objective:** As a pipeline integrator, I want a single policy decision surface, so that every processor applies the same privacy and performance rules before work begins.

#### Acceptance Criteria

1. When the Local File Indexer evaluates a file, the Privacy Performance Controls shall return an allow or deny decision with a user-presentable reason when denied.
2. When the Content Extraction Pipeline prepares to read file contents, the Privacy Performance Controls shall return an allow, deny, or defer decision before parsing starts.
3. When the Vision OCR Pipeline prepares OCR, captioning, or tagging, the Privacy Performance Controls shall return an allow, deny, or defer decision before local or remote processing starts.
4. When the Semantic Vector Search prepares content embedding, query embedding, or vector refresh work, the Privacy Performance Controls shall return an allow, deny, or defer decision before provider calls start.
5. If a policy decision cannot be evaluated, then the Privacy Performance Controls shall fail closed for private content processing and expose a recoverable policy error.

### Requirement 4: Pause, Resume, and Throttling Controls

**Objective:** As a Windows user, I want indexing and AI work to pause or run within limits, so that the app does not disrupt my desktop work.

#### Acceptance Criteria

1. When the user pauses indexing, the Privacy Performance Controls shall cause new background indexing, extraction, OCR, captioning, tagging, and embedding work to be deferred.
2. While indexing is paused, the Privacy Performance Controls shall preserve existing indexed search data that is still policy-allowed.
3. When the user resumes indexing, the Privacy Performance Controls shall make deferred work eligible to continue under the current policy.
4. When resource limits are configured, the Privacy Performance Controls shall expose CPU, concurrency, memory, disk, and queue limits that background processors must honor.
5. If current device conditions require throttling, then the Privacy Performance Controls shall expose a throttled state instead of allowing unlimited background work.

### Requirement 5: Battery and Background Behavior

**Objective:** As a Windows laptop user, I want expensive background processing to adapt to power state, so that search indexing does not drain battery unexpectedly.

#### Acceptance Criteria

1. When the device is on battery and battery-aware mode is enabled, the Privacy Performance Controls shall defer expensive visual and embedding work unless the user allows it.
2. When the device returns to external power, the Privacy Performance Controls shall allow deferred work to resume under the configured limits.
3. While battery-aware deferral is active, the Privacy Performance Controls shall expose that work is waiting for power conditions rather than failed.
4. If the user explicitly allows indexing on battery, then the Privacy Performance Controls shall apply the configured resource limits without using battery state as a blocker.
5. The Privacy Performance Controls shall not prevent foreground search over already-current local index data solely because the device is on battery.

### Requirement 6: Indexing Status and Transparency

**Objective:** As a Windows user, I want to understand what the app has indexed and what is pending, so that incomplete search results are explainable.

#### Acceptance Criteria

1. When indexing, extraction, visual enrichment, or semantic embedding has pending work, the Privacy Performance Controls shall expose aggregate status that the Desktop Search Shell can present.
2. When work is blocked by exclusions, provider policy, pause state, resource limits, battery mode, or errors, the Privacy Performance Controls shall expose a user-presentable reason.
3. When an indexed location is current, scanning, unavailable, excluded, or recovering, the Privacy Performance Controls shall expose that location status without revealing raw file contents.
4. When status data includes counts, the Privacy Performance Controls shall distinguish current, pending, failed, excluded, policy-blocked, throttled, and removed work where available.
5. The Privacy Performance Controls shall present indexing transparency without requiring users to understand parser, OCR, embedding, vector, or ranking internals.

### Requirement 7: Storage Visibility and Cleanup Controls

**Objective:** As a Windows user, I want to see and manage local index storage, so that the app's footprint remains understandable and controllable.

#### Acceptance Criteria

1. When local index storage exists, the Privacy Performance Controls shall expose approximate storage used by index metadata, extracted content, visual payloads, embeddings, and vector data where available.
2. When the user removes an indexed location, the Privacy Performance Controls shall allow removal of local index data associated with that location.
3. When the user clears all local index data, the Privacy Performance Controls shall cause current indexed content, visual payloads, embeddings, and vectors to become unavailable for search until rebuilt.
4. If storage cleanup cannot complete, then the Privacy Performance Controls shall expose a recoverable cleanup error without deleting unrelated settings.
5. The Privacy Performance Controls shall not upload local index storage or backups as part of cleanup behavior.

### Requirement 8: User-Facing Settings Experience

**Objective:** As a Windows user, I want clear settings and status controls inside the desktop app, so that privacy and performance choices are easy to review and change.

#### Acceptance Criteria

1. When the user opens settings, the Desktop Search Shell shall display indexed locations, exclusions, provider mode, pause state, resource limits, battery behavior, status, and storage controls exposed by Privacy Performance Controls.
2. When the user changes a setting, the Desktop Search Shell shall show the resulting state after the Privacy Performance Controls accepts or rejects the change.
3. If a setting change would allow remote processing, then the Desktop Search Shell shall present an explicit consent step before the Privacy Performance Controls applies the change.
4. If a setting cannot be applied, then the Desktop Search Shell shall preserve the prior setting and display a user-presentable error.
5. The Desktop Search Shell shall avoid exposing raw file contents, OCR text, captions, embeddings, or vector details in privacy and performance controls.
