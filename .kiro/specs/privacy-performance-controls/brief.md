# Brief: privacy-performance-controls

## Problem
Local file search touches private documents, images, and code. Users need control over what is indexed, whether AI processing leaves the device, and how much CPU, memory, disk, and battery the app consumes.

## Current State
There are no folder exclusions, provider controls, consent flows, resource limits, or indexing transparency features.

## Desired Outcome
Users can choose indexed locations, exclude sensitive folders or file types, understand indexing status, choose local/remote AI behavior where available, and limit indexing work so the app remains trustworthy and unobtrusive.

## Approach
Define a control layer that applies across indexing, extraction, OCR, embeddings, and desktop UX. It should enforce policy before processing occurs, not only hide results after the fact.

## Scope
- **In**: Folder exclusions, file type exclusions, provider mode settings, local/remote AI consent surfaces, resource throttling controls, pause/resume indexing, index status, basic storage visibility, and policy enforcement hooks.
- **Out**: Enterprise policy management, cross-device account settings, cloud backup, audit logging for teams, and legal/compliance certification.

## Boundary Candidates
- Privacy controls own user policy and enforcement rules.
- Indexer and pipelines must consult those rules before processing.
- Desktop shell owns user-facing settings presentation.

## Out of Boundary
This spec does not own the full implementation of parsers, OCR engines, embedding models, or result ranking algorithms.

## Upstream / Downstream
- **Upstream**: local-file-indexer, content-extraction-pipeline, semantic-vector-search, and vision-ocr-pipeline expose processing hooks and status data.
- **Downstream**: Future enterprise, sync, or account features may depend on these trust boundaries.

## Existing Spec Touchpoints
- **Extends**: None.
- **Adjacent**: all other specs because privacy and resource policy must apply consistently across the product.

## Constraints
Defaults should be privacy-preserving. The product should avoid sending file contents, OCR text, image captions, or embeddings to remote services unless the user explicitly enables that mode.
