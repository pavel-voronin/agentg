# TDLib Storage Review Data

- `tdlibStorageReview.json` is the source of truth for TDLib storage review
  decisions, schema-design metadata, update handler plans, and generated
  Telegram database table definitions.
- Keep the file at `version: 2`. The source audit requires version 2 and at
  least one schema-design table.
- Keep top-level data in the canonical order emitted by the storage review
  writer: `version`, `storageOptions`, `tables`, `updateDesigns`, `entries`.
- Do not add ad hoc keys. The dev-server parser rejects unknown keys in
  entries, schema designs, tables, columns, foreign keys, update designs,
  handler plans, and handler plan steps.

## Top-Level Shape

- `storageOptions` is the list of storage decision labels. Current labels are
  `table`, `embedded`, `extend`, `facet`, `pair`, `kv`, and `event`.
- `tables` describes the target PostgreSQL schema for TDLib-derived Telegram
  state. `scripts/telegramDbSchemaGenerate.mjs` reads this array to generate
  `packages/telegram/src/database/storageSchema.ts` and
  `packages/telegram/drizzle/0000_telegram_tdlib_schema.sql`.
- `updateDesigns` is a record keyed by TDLib update constructor names such as
  `updateFile`. Each value describes field routes and the target handler
  algorithm for that update.
- `entries` is an array keyed by TDLib type name. Each entry combines the
  accepted storage decision, review evidence, and per-constructor schema design
  for that TDLib type.

## Entry Shape

- `entries[].type` must be a unique TDLib type name from `tdlibSchema.json`.
- `entries[].maturity` must be `1`, `2`, or `3`.
- `entries[].storage` is empty only for unfinished work; otherwise it must be
  one value from `storageOptions`.
- `entries[].storageTarget` names the target table, KV key family, event, or
  embedded owner described by the storage decision.
- `entries[].reviews` stores review records. A `storage-decision` review must
  include `status`, `maturity`, `decision`, `constructors`, `uses`,
  `rejectedStorage`, `notes`, and `openQuestions`.
- `entries[].schemaDesign` is required by the full schema-design validator. It
  must cover every TDLib constructor and every TDLib field for `entries[].type`.

## Type Schema Design

- `schemaDesign.constructors[]` names one TDLib constructor and contains
  `fields`, `notes`, and an optional constructor `target`.
- Constructor `target.kind` may be `kv` for `storage: "kv"` or `event` for
  `storage: "event"`. Do not use these constructor targets with other storage
  decisions.
- `fields[]` must use the exact TDLib field `name` and `tdlibType`.
- Field `target.kind` may be `constructor-payload`, `embedded-payload`,
  `dynamic`, `embedded`, `event-payload`, `not-stored`, `pending`,
  `table-column`, or `table-ref`.
- Use `table-column` for regular physical columns. Use `table-ref` for columns
  whose role is `foreign-key` or a reference-bearing primary key, and declare
  `referencedTable`.
- For `embedded` targets, declare `table` and `column`; add `path` when the
  stored field is nested inside a JSON payload.
- `embedded-payload` is valid only for `storage: "embedded"`. `event-payload`
  is valid only for `storage: "event"`.
- Use `not-stored` only when the field is intentionally not persisted and the
  `reason` states the storage decision.

## Table Shape

- `tables[].name` is the PostgreSQL table name.
- `sourceTypes` lists TDLib types whose fields directly populate the table.
- `indirectSourceTypes` lists nested TDLib types used through source fields or
  references. A type must not appear in both lists for the same table.
- `columns[].id` must be exactly `${table.name}.${column.name}`.
- `columns[].pgType` must be one of `bigint`, `boolean`, `bytea`,
  `double precision`, `integer`, `jsonb`, `text`, or
  `timestamp with time zone`.
- `columns[].role` must be `primary-key`, `foreign-key`, or `data`.
- `columns[].sourceFields` must contain exact TDLib source paths that justify
  the column, such as `Chat.chat.id` or `Update.updateFile.file`.
- `primaryKey` lists column ids whose role is `primary-key`.
- `foreignKeys[]` links local column ids to `referencedTable` and
  `referencedColumns`. Use `onDelete` only with PostgreSQL-supported actions:
  `cascade`, `no action`, `restrict`, `set default`, or `set null`.
- `columnLayout` is UI metadata for the schema-design table view. Supported
  values are `ddl`, `grid`, and `stacked`.

## Update Designs

- `updateDesigns` keys must be TDLib update constructor names from
  `tdlibSchema.json`.
- `fields` is keyed by root update field name. Event and effect route
  `sourceFields` must be exactly `Update.<updateName>.<fieldName>`.
- `handlerPlan` is the target handler algorithm, not prose commentary. The full
  validator requires every TDLib update to have one.
- `handlerPlan.status` is `draft` or `ready`; `maturity` is `1`, `2`, or `3`.
- `handlerPlan.steps[]` is ordered. Every step needs stable kebab-case `id`,
  generic `op`, non-empty `description`, and `sourceFields`.
- Handler plan `sourceFields` must belong to the owning update and must cover
  every root update field at least once.
- Allowed step operations are `returnWhen`, `delegateType`, `upsertTable`,
  `replaceTable`, `replaceRows`, `deleteRows`, `publishEvent`, `runEffect`, and
  `ignoreField`.
- `delegateType` steps must declare `type`. DB steps should declare `table` and
  the touched `columns`. `publishEvent` steps must declare `event`. `runEffect`
  steps must declare `effect` and `effectKind`.
- Supported `effectKind` values are `cache-invalidation`, `file-download`,
  `file-system`, and `other`.
- Do not introduce product-specific step operations. Put product meaning in
  `description`, `table`, `columns`, `type`, `event`, `effect`, and
  `condition`.

## Verification

- For parser and policy checks, run `npm run source:audit`.
- For schema-design validation tests, run
  `npm --workspace @agentg/tdlib-docs run test -- tdlibStorageReview tdlibSchemaDesignValidator`.
- For docs UI/build checks, run `npm run tdlib:docs:build`.
- When `tables` changes, regenerate Telegram database artifacts with
  `npm --workspace @agentg/telegram run db:generate` and inspect the generated
  schema and migration.
