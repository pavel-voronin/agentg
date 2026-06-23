# Data

## Purpose

`data` owns the shared addressable model space used by pipelines, agent tools,
and modules that need to read or write derived data without knowing which module
physically serves a model.

The module provides one language for references, model routing, simple derived
storage, and pipeline data access. Provider modules keep ownership of the
lifecycle and truth for the models they expose.

## Goals

- Provide stable `ModelRef` addressing across Telegram and derived models.
- Route reads and expansions to the module that provides the requested model.
- Store schema-free derived annotations and collections in Postgres JSONB.
- Let pipelines read Telegram-owned data and write derived data through one
  addressable model space.
- Avoid explicit module routing in pipeline YAML.
- Keep Telegram ingestion, history coverage, edits, deletes, and file lifecycle
  inside Telegram for the first implementation.

## Non-Goals

- Do not move Telegram canonical storage into `data` in the first implementation.
- Do not make `data` own the meaning or lifecycle of provider-owned models.
- Do not require migrations or predeclared schemas before a pipeline can write an
  annotation or collection item.
- Do not build a general graph database in the first implementation.
- Do not expose provider module storage tables through `data`.

## Ubiquitous Language

- `Model`: a named data shape such as `telegram.chat`, `telegram.message`, or
  `data.collectionItem`.
- `ModelRef`: a stable reference with `_model` and `id`.
- `Provider`: the module that serves a model to `data`.
- `ProviderCapability`: one operation a provider supports for a model, such as
  `select`, `get`, `expand`, or `render`.
- `Dataset`: a set of rows passed between pipeline nodes.
- `DatasetRow`: one value plus refs and lineage.
- `Lineage`: refs that explain which source rows produced a derived row.
- `Annotation`: one schema-free value addressed by `subjectRef + key`.
- `Collection`: schema-free items addressed under `subjectRef + key + itemId`.

## Model References

Every addressable object uses the same reference shape:

```ts
type ModelRef = {
  _model: string;
  id: string;
};
```

Provider models use their provider-owned identifiers:

```text
telegram.chat:-1002129631268
telegram.message:-1002129631268:456
telegram.user:123456
```

Derived models and stored derived items also use `ModelRef` values, but their
storage and ids are owned by `data` or by the module that registered the derived
model provider.

## Model Catalog

`data` keeps a model catalog:

```ts
type ModelCatalogEntry = {
  model: string;
  provider: string;
  capabilities: readonly ProviderCapability[];
  columns: readonly ModelCatalogColumn[];
};

type ModelCatalogColumn = {
  key: string;
  label: string;
  source: { kind: 'primaryRef' } | { kind: 'valuePath'; path: readonly string[] };
  filter?: {
    kind: 'where';
    input: 'dateTime' | 'enum' | 'id' | 'number' | 'text';
    operators: readonly {
      key: 'contains' | 'eq' | 'gt' | 'gte' | 'lt' | 'lte' | 'notContains';
      label: string;
      whereKey: string;
      value: 'array' | 'single';
    }[];
    placeholder?: string;
    refOperator?: 'eq';
    values?: readonly { label: string; value: string }[];
  };
  format?: 'dateTime';
  sortable?: boolean;
};
```

Initial catalog shape:

```text
telegram.chat -> provider telegram
telegram.message -> provider telegram
telegram.user -> provider telegram
data.annotation -> provider data
data.collectionItem -> provider data
```

Pipeline YAML names models, not modules. `data` resolves the provider from the
catalog and calls the provider through module RPC.

Catalog columns describe the model-owned browse shape for Data Dashboard tables.
They are declarative field descriptors only: providers do not contribute Vue
components, CSS, or renderer functions. `sortable: false` means Dashboard must
not send that column key as a provider `select` sort key.

Column filters are also declarative. A `where` filter lists the allowed
operators for that column and the provider-owned `whereKey` for each operator.
`value: 'array'` wraps the entered value in a single-item array. Dashboard must
not invent provider filters that are absent from the catalog column descriptor.
`refOperator: 'eq'` means Dashboard may apply that column filter from a
`ModelRef` for the same model by using `ModelRef.id` as the input value.
Text filter descriptors may expose `contains` and `notContains`. Query syntax
is provider-owned; the initial Telegram provider uses case-insensitive SQL
matching, splits words by spaces as AND terms, and treats `*` inside a term as
a wildcard.

## Provider Contract

A provider module exposes only model-level capabilities to `data`. It does not
expose storage tables, upstream cursors, worker state, or implementation
switches.

Initial provider capabilities:

```ts
type DataSelectInput = {
  model: string;
  where?: JsonValue;
  limit?: number;
  offset?: number;
  sort?: DataSortInput;
};

type DataSortInput = {
  direction: 'asc' | 'desc';
  key: string;
};

type DataGetInput = {
  ref: ModelRef;
};

type DataExpandInput = {
  from: readonly DatasetRow[];
  relation: string;
  sourceRef: string;
  where?: JsonValue;
  limit?: number;
};

type DataRenderInput = {
  from: readonly DatasetRow[];
  format: 'json' | 'text';
  options?: JsonValue;
  sourceRef: string;
};
```

Provider outputs are datasets:

```ts
type DatasetRow = {
  value: JsonValue;
  refs: Record<string, ModelRef>;
  lineage: readonly ModelRef[];
};

type Dataset = {
  rows: readonly DatasetRow[];
};

type PageResult<T> = {
  hasMore: boolean;
  rows: readonly T[];
  total?: number;
};
```

Telegram provider examples:

```text
data.select model=telegram.chat
  -> telegram provider selects chats

data.expand sourceRef=chat relation=messages from telegram.chat rows
  -> telegram provider selects messages for those chats

data.render sourceRef=message format=text from telegram.message rows
  -> telegram provider renders message text for an LLM node
```

`sourceRef` is the ref key in each input row that selects the source model for
provider routing. `data.expand` and `data.render` reject the request before a
provider call when an input row is missing `sourceRef` or when input rows carry
different source models under that ref key. Empty input datasets still validate
the `sourceRef` field and then return an empty dataset without a provider call.

Telegram provider rows use stable ref aliases:

- `telegram.chat` rows carry `refs.chat`;
- `telegram.message` rows carry `refs.chat` and `refs.message`;
- `telegram.user` rows carry `refs.user`.

For Telegram messages, `render` supports `options.groupByRef: 'chat'`. With
that option, the provider returns one rendered row per chat ref. Without that
option, the provider renders the input dataset as one row only when each carried
ref key has at most one distinct `ModelRef` across the input rows. If a ref key
has multiple distinct refs, `render` rejects the action as ambiguous instead of
dropping refs.

## Annotation Structure

An annotation is one value on one subject ref and one key.

```ts
type AnnotationAddress = {
  subject: ModelRef;
  key: string;
};
```

Writes:

```ts
type WriteAnnotationInput = {
  subject: ModelRef;
  key: string;
  value: JsonValue;
  lineage?: readonly ModelRef[];
  mode: 'replace' | 'merge';
};
```

Storage identity:

```text
subject_model + subject_id + key
```

Use annotations for:

- summaries;
- tags;
- classifications;
- scores;
- single current facts about a subject.

Annotation writes do not require a predeclared schema. The key is the semantic
name chosen by the pipeline or caller.

## Collection Structure

A collection is a set of items under one subject ref and one key.

```ts
type CollectionItemAddress = {
  subject: ModelRef;
  key: string;
  itemId: string;
};
```

Writes:

```ts
type WriteCollectionItemInput =
  | {
      itemId?: never;
      key: string;
      lineage?: readonly ModelRef[];
      mode: 'append';
      subject: ModelRef;
      value: JsonValue;
    }
  | {
      itemId: string;
      key: string;
      lineage?: readonly ModelRef[];
      mode: 'replace' | 'merge';
      subject: ModelRef;
      value: JsonValue;
    };
```

Storage identity:

```text
subject_model + subject_id + key + item_id
```

Use collections for:

- extracted subjects under a chat;
- facts under a user;
- observations under a chat;
- repeated outputs that should accumulate instead of replacing one value.

Collection writes do not require a predeclared schema. `append` creates a durable
item id and returns it in the write result. `replace` and `merge` require an
existing caller-supplied `itemId`.

## Data Procedures

Initial public internal procedures:

```ts
type DataBrowseInput = {
  key?: string;
  limit?: number;
  offset?: number;
  sort?: DataSortInput;
  subject?: ModelRef;
  subjectModel?: string;
  where?: {
    itemIdNotQuery?: string;
    itemIdQuery?: string;
    subjectNotQuery?: string;
    subjectQuery?: string;
    updatedAtGt?: string;
    updatedAtGte?: string;
    updatedAtLt?: string;
    updatedAtLte?: string;
    valueNotQuery?: string;
    valueQuery?: string;
  };
};

listModels(): readonly ModelCatalogEntry[];
overview(): DataOverview;
select(input: DataSelectInput): Dataset;
selectPage(input: DataSelectInput): PageResult<DatasetRow>;
get(input: DataGetInput): DatasetRow | null;
expand(input: DataExpandInput): Dataset;
render(input: DataRenderInput): Dataset;

writeAnnotation(input: WriteAnnotationInput): WriteResult;
getAnnotation(input: AnnotationAddress): Annotation | null;
listAnnotations(input: { subject: ModelRef; key?: string }): readonly Annotation[];
browseAnnotations(input: DataBrowseInput): PageResult<Annotation>;

writeCollectionItem(input: WriteCollectionItemInput): WriteResult;
getCollectionItem(input: CollectionItemAddress): CollectionItem | null;
listCollection(input: { subject: ModelRef; key: string }): readonly CollectionItem[];
browseCollection(input: DataBrowseInput): PageResult<CollectionItem>;
```

`data` validates refs, routes provider-owned models, and writes data-owned
annotations and collection items.

`overview`, `browseAnnotations`, `browseCollection`, and `selectPage` are
operator-surface read capabilities. Derived-storage browse procedures return
bounded pages and Data-owned totals. `selectPage` returns a bounded provider
model page and `hasMore` without computing provider-owned totals.
Derived-storage browse procedures may filter by key, subject, subject model,
subject text query, negative subject text query, value text query, negative
value text query, updated time, and collection item id query. Data-owned
annotation sort keys are `key`, `subject`, `updatedAt`, and `value`; collection
sort keys also include `itemId`.

`WriteResult` includes the written address, written model ref, write mode, and
created or updated timestamp. Write procedures reject non-JSON-safe values.

`merge` mode is defined for JSON object values only. A merge with a non-object
incoming value or a non-object existing value is rejected.

## Pipeline Actions

`data` provides pipeline actions:

```text
data.select
data.get
data.expand
data.render
data.writeAnnotation
data.writeCollectionItem
```

Read action mapping:

- `data.select` ignores the input dataset and uses `with` as `DataSelectInput`.
- `data.get` ignores the input dataset and uses `with` as `DataGetInput`.
- `data.get` returns a one-row dataset when the ref exists and an empty dataset
  when the ref is missing.
- `data.expand` uses the current input dataset as `DataExpandInput.from` and
  uses `with` for `sourceRef`, `relation`, `where`, and `limit`.
- `data.expand` with an empty input dataset returns an empty dataset.
- `data.render` uses the current input dataset as `DataRenderInput.from` and uses
  `with` for `sourceRef`, `format`, and `options`.
- `data.render` with an empty input dataset returns an empty dataset.

Write actions are ordinary pipeline nodes. They consume a dataset and perform a
side effect. They may return a small dataset of written refs when another node
needs to continue from the write result.

Write actions do not join against arbitrary previous node outputs. They resolve
their address and value from each input row. Upstream actions must carry the refs
and lineage needed by the write node.

Each input row produces one attempted write. A write action rejects the whole
node before writing when any row cannot resolve the required subject, required
collection item id, or JSON-safe value.

Pipeline write selector shapes:

```ts
type RowRefSelector = {
  ref: string;
};

type RowFieldSelector = {
  field: string;
};

type RowRefIdSelector = {
  refId: string;
};

type WriteAnnotationActionInput = {
  key: string;
  mode: 'replace' | 'merge';
  subject: RowRefSelector;
  value?: JsonValue;
  valueFrom?: RowFieldSelector;
};

type WriteCollectionItemActionInput = {
  itemId?: string;
  itemIdFrom?: RowFieldSelector | RowRefIdSelector;
  key: string;
  mode: 'append' | 'replace' | 'merge';
  subject: RowRefSelector;
  value?: JsonValue;
  valueFrom?: RowFieldSelector;
};
```

`subject: { ref: 'chat' }` means "use `row.refs.chat` from the current input
row". `itemIdFrom: { field: 'slug' }` means "use `row.value.slug` from the
current input row". `itemIdFrom: { refId: 'message' }` means "use
`row.refs.message.id` from the current input row". `valueFrom` with
`{ field: 'summary' }` means "write `row.value.summary`". If `value` and
`valueFrom` are omitted in a write action, the action writes the current input
row value.

`itemId` is a literal item id. `itemIdFrom` is a row selector. A write action
rejects a node that sets both. `value` is a literal JSON value. `valueFrom` is a
row selector. A write action rejects a node that sets both. String templating is
not part of the first implementation; create a field in an upstream node when a
compound id is needed. Pipeline runtime context expressions are resolved by
`pipelines` before Data receives the action input; Data sees the resolved
literal value.

For `data.writeCollectionItem`, `append` rejects `itemId` and `itemIdFrom`.
`replace` and `merge` require exactly one of `itemId` or `itemIdFrom`.

Write actions with an empty input dataset perform zero writes and return an empty
dataset.

Example node graph inside `PipelineAutomationRule.spec.pipeline`:

```yaml
nodes:
  chats:
    use: data.select
    with:
      model: telegram.chat
      where:
        readState: unread

  messages:
    use: data.expand
    from: chats
    with:
      relation: messages
      sourceRef: chat
      where:
        readState: unread

  promptInput:
    use: data.render
    from: messages
    with:
      format: text
      sourceRef: message
      options:
        groupByRef: chat

  summary:
    use: llm.run
    from: promptInput
    with:
      profile: openrouterCheapSummary
      prompt: Summarize the input in one sentence.

  save:
    use: data.writeAnnotation
    from: summary
    with:
      subject:
        ref: chat
      key: unreadSummary
      mode: replace
```

## Storage Model

Initial tables:

```text
data_annotations
data_collection_items
```

`data_annotations` stores:

- subject model;
- subject id;
- key;
- value JSONB;
- lineage JSONB;
- created timestamp;
- updated timestamp.

`data_collection_items` stores:

- subject model;
- subject id;
- key;
- item id;
- value JSONB;
- lineage JSONB;
- created timestamp;
- updated timestamp.

Indexes cover:

- `subject_model + subject_id`;
- `subject_model + subject_id + key`;
- `subject_model + subject_id + key + item_id`.

JSONB value indexes are not part of the first implementation.

## Ownership Boundaries

`data` owns:

- model catalog;
- `ModelRef` validation;
- provider routing;
- annotation storage;
- collection item storage;
- generic data read/write procedures;
- pipeline actions `data.*`.

`data` does not own:

- Telegram ingestion;
- Telegram coverage;
- Telegram edits, deletes, or files;
- the meaning of provider-owned models;
- provider-owned model tables;
- LLM provider calls;
- pipeline execution graph.

## Observability

`data` emits bounded domain metrics:

- `data.operation.duration`: direct procedure and pipeline action runtime by
  `data.operation`, `data.operation.result`, and `error.type` on failures.
- `data.writes`: successful annotation and collection item writes by
  `data.write.kind` and `data.write.mode`.

Metric labels must not include subject ids, item ids, model ids, chat ids,
message ids, provider filter values, rendered content, annotation values, or
collection item values.

Telemetry operator path:

- AgentG Telemetry page: `/telemetry/data`
- Grafana dashboard UID: `agentg-data`
- Jaeger service: `data`

The Grafana dashboard must show operation errors, write volume, operation rate,
operation p95, writes by kind and mode, RPC call rate, and Postgres p95.

The top-level Data model-space operator UI is separate from telemetry and is
documented in [Data Dashboard](../05-interfaces/dataDashboard.md). Its route is
`/data`.

## File Structure Constraints

Target package ownership:

```text
packages/data/
  src/
    catalog.ts
    config.ts
    database/
    ids.ts
    index.ts
    main.ts
    module.ts
    overview.ts
    providers.ts
    runtime.ts
    schema.ts
    store.ts
    telemetry.ts
  dashboard/
    dashboard.ts
    contracts.ts
    backend/
    frontend/
  drizzle/
```

The package root exports a typed client only when another current package
imports it.

## Test Contract

- `listModels` returns the initial catalog entries for `telegram.chat`,
  `telegram.message`, `telegram.user`, `data.annotation`, and
  `data.collectionItem`.
- `ModelRef` is validated against the registered `model`.
- Unknown model names are rejected before any provider call.
- Requests for unsupported provider capabilities are rejected before any
  provider call.
- `select` calls the provider registered for the requested model.
- `select` passes `where`, `limit`, `offset`, and `sort` to the provider without
  interpreting provider-owned filter semantics.
- `get` calls the provider registered for the requested ref model and returns
  `null` for a missing provider-owned ref.
- `expand` calls the provider for the model of the input rows.
- `render` calls the provider for the model of the input rows.
- `expand` and `render` route by `sourceRef` and reject input rows missing that
  ref key.
- `expand` and `render` reject mixed source models under the selected
  `sourceRef`.
- Telegram chat rows carry `refs.chat`; Telegram message rows carry `refs.chat`
  and `refs.message`; Telegram user rows carry `refs.user`.
- Telegram `render` with `options.groupByRef: 'chat'` returns one row per chat
  ref and carries that chat ref into each output row.
- Telegram `render` without grouping rejects input rows that contain multiple
  distinct refs for the same carried ref key.
- Provider failures are returned as failed data procedure calls and are not
  converted into successful empty datasets.
- Telegram provider filters stay inside the Telegram provider contract.
- `writeAnnotation` creates an annotation without a predeclared schema.
- `writeAnnotation` with the same `subject + key` and `mode: replace` replaces
  the value.
- `writeAnnotation` with the same `subject + key` and `mode: merge` merges JSON
  object values.
- `writeAnnotation` rejects `mode: merge` for non-object values.
- `getAnnotation` returns the written value, lineage, created timestamp, and
  updated timestamp for the addressed annotation.
- `writeCollectionItem` creates an item without a predeclared schema.
- `writeCollectionItem` with `mode: append` rejects caller-supplied `itemId` and
  returns the created durable item id.
- `writeCollectionItem` with `mode: replace` or `mode: merge` requires an
  `itemId`.
- `writeCollectionItem` with the same `subject + key + itemId` and
  `mode: replace` replaces the item value.
- `writeCollectionItem` with the same `subject + key + itemId` and `mode: merge`
  merges the value.
- `writeCollectionItem` rejects `mode: merge` for non-object values.
- `getCollectionItem` returns the written value, lineage, created timestamp, and
  updated timestamp for the addressed item.
- `listAnnotations` and `listCollection` return data by subject address.
- `browseAnnotations` and `browseCollection` return bounded pages of data-owned
  rows across subjects, optionally filtered by key, subject, subject model,
  subject/value text query, updated time, and collection item id query, then
  sorted by Data-owned columns for the top-level Data explorer.
- Pipeline actions use the same procedures as the direct data API after resolving
  action selectors into direct procedure inputs.
- `data.get` action returns an empty dataset when the direct `get` procedure
  returns `null`.
- `data.expand` and `data.render` actions return an empty dataset when their input
  dataset is empty.
- Write actions resolve `subject`, `itemIdFrom`, `valueFrom`, and default `value`
  from the current input row only.
- Write actions attempt one write per input row and return one output row per
  successful write.
- Write actions reject selector references that are missing from the current
  input row.
- Write actions reject nodes that set both `itemId` and `itemIdFrom`.
- Write actions reject nodes that set both `value` and `valueFrom`.
- `data.writeCollectionItem` actions with `mode: append` reject `itemId` and
  `itemIdFrom`.
- `data.writeCollectionItem` actions with `mode: replace` or `mode: merge`
  require exactly one of `itemId` or `itemIdFrom`.
- Write actions with an empty input dataset perform zero writes and return an
  empty dataset.
- Write actions reject the node before writing if any input row cannot be
  resolved into a valid write.
- `data.writeAnnotation` and `data.writeCollectionItem` actions return written
  refs when a downstream node needs to consume the write result.
- `data` tests prove it does not read or write provider-owned storage tables.
- Data telemetry records operation duration and write volume without subject ids,
  item ids, model ids, chat ids, message ids, rendered content, annotation
  values, or collection item values as metric labels.
- `/telemetry/data` embeds the `agentg-data` Grafana dashboard for operator
  readback.

## Implementation Sequence

1. Add the `data` package, catalog, and `ModelRef` validation.
2. Add annotation and collection item storage.
3. Add the data provider registry.
4. Add Telegram provider procedures for `telegram.chat`, `telegram.message`, and
   `telegram.user`.
5. Add pipeline actions `data.select`, `data.get`, `data.expand`, `data.render`,
   `data.writeAnnotation`, and `data.writeCollectionItem`.
6. Add Gateway and MCP methods for direct inspection and agent-authored pipeline
   support.
