# Telegram Media Download Implementation Plan

## Goal

Implement Telegram-owned media slots, policy-driven downloads, durable file state,
and Control Plane rendering/request flows for avatars, photos, videos, and generic
downloadable files.

## Requirements

- Chat avatars arriving through Telegram events are downloaded and rendered in
  the Control Plane chat UI.
- Photos up to 1 MB are downloaded automatically for chats where the current
  Telegram user is a participant.
- Photos up to 100 MB can be explicitly requested from their chat preview and
  render in place once ready.
- Generic non-rendered files are shown as download controls with visible status.
- Videos up to 5 MB are downloaded automatically; larger videos are explicitly
  requested from the Control Plane preview and render in place once ready.
- Download policies live in separate Telegram package files with a simple,
  manually editable structure.

## Architecture Rules

- Telegram owns file extraction, policy, storage, RPC, and media events.
- Control Plane performs only initialization RPC reads and explicit user-intent
  file requests.
- No compatibility envelopes, fallback shapes, legacy branches, or cross-domain
  ownership.
- Browser DTOs expose stable file refs and URLs through Telegram-owned read
  boundaries, not filesystem paths.

## Steps

- [x] Add durable Telegram file schema and migration.
- [x] Add file slot extraction for chat avatars and message media.
- [x] Add editable policy files and apply policies during ingestion and explicit
  requests.
- [x] Add download queue operations, atomic local file storage, and TDLib
  download worker integration.
- [x] Extend Telegram RPC contracts/read models/events with media refs and a
  requestFile mutation.
- [x] Add neutral Control Plane HTTP proxy support for provider file URLs.
- [x] Render avatars, image previews, video previews, generic downloads, and
  explicit request states in Telegram Control Plane Vue content.
- [x] Add focused tests for extraction, policy, storage/RPC behavior, and Control
  Plane normalization.
- [x] Run typecheck, lint/source audit where applicable, and targeted tests.

## Verification

- `npm --workspace @agentg/telegram run typecheck`: passed.
- `npm --workspace @agentg/control-plane run typecheck`: passed.
- `npm --workspace @agentg/rpc run typecheck`: passed.
- `npm --workspace @agentg/telegram run test`: passed.
- `npm --workspace @agentg/gateway run typecheck`: passed.
- `npm --workspace @agentg/gateway run test`: passed.
- `npm --workspace @agentg/telegram run build:control-plane`: passed.
- `npm run typecheck`: passed.
- `npm run test`: passed.
- `npm run source:audit`: passed.
- Targeted ESLint on touched source/test files passed.
- Full `npm run lint` is blocked by existing unrelated lint errors in
  `packages/control-plane/tests/slot-runtime.test.ts` and
  `scripts/tdlib-data-model-audit.mjs`.
- Full `npm run format:check` is blocked by existing unrelated formatting in
  `packages/control-plane-sdk/src/slots/SlotOutletItem.vue`.

## Asset-Level Queue Fix

### Problem

The original durable row mixed two responsibilities in `telegram_files`: the UI
slot where a file is referenced and the physical Telegram file download state.
When TDLib exposed the same physical file through two slots with different
current file ids or remote ids, one slot could become `ready` while another
slot stayed `failed`.

### Target Shape

- `telegram_files` stores only owner-slot metadata: owner model/id, slot key,
  render metadata, source, and `asset_key`.
- `telegram_file_assets` stores physical file state keyed by stable Telegram
  identity. For TDLib files this is `telegram:${remoteUniqueId}`; byte size is
  mutable metadata, not identity.
- `telegram_file_download_jobs` stores queue state per asset.
- Control Plane file refs read effective status from the joined asset/job state.

### Fix Steps

- [x] Add `telegram_file_assets` and `telegram_file_download_jobs`.
- [x] Migrate existing `telegram_files` rows into asset rows grouped by
  `remoteUniqueId`.
- [x] Move ready/failed/downloaded/path/hash state from slots to assets.
- [x] Move queued/downloading state from slots to jobs.
- [x] Make explicit failed-file retry enqueue the asset again while automatic
  updates leave failed assets idle.
- [x] Keep the File queue tile driven by asset/job counts, not slot counts.

### Verification

- `npm --workspace @agentg/telegram run typecheck`: passed.
- `npm --workspace @agentg/telegram run test -- telegram-file-extractor.test.ts`:
  passed.
- `npm --workspace @agentg/telegram run test`: passed.
- `npm --workspace @agentg/telegram run build:server`: passed.
- `npm --workspace @agentg/telegram run build:control-plane`: passed.
- `npm run typecheck`: passed.
- `npm run test`: passed.
- `npm run build`: passed.
- `npx prettier --check packages/telegram/src/schema.ts packages/telegram/src/telegram-file-store.ts packages/telegram/src/telegram-file-worker.ts packages/telegram/src/telegram-file-policy.ts packages/telegram/src/telegram-file-extractor.ts packages/telegram/tests/telegram-file-extractor.test.ts packages/telegram/tests/router.test.ts docs/04-data/data-model.md docs/telegram-media-download-implementation-plan.md`:
  passed.
- `npm run source:audit`: passed.
