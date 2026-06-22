# Data Dashboard

## Purpose

The Data Dashboard is the top-level operator interface for the `data` model
space. It is a table-first explorer for structures available through Data:
provider models, annotations, and collections.

The page is not a SQL browser, not a Telegram storage browser, and not part of
Telemetry.

## Goals

- Add a top-level Dashboard page named `Data` at `/data`.
- Contribute the page from the Data package through the neutral
  `dashboard.page` slot.
- Keep the page in navigation whenever Dashboard is available, independent of
  Telemetry and Grafana.
- Show a tree navigation of structures available through Data.
- Let an operator click an annotation key, collection key, or provider model
  and immediately see a table for that structure.
- Keep the inspector hidden until the operator selects a table row.
- Keep Dashboard reads tied to initialization or explicit user clicks.
- Hide provider-owned storage, provider lifecycle, Gateway, and Telemetry
  mechanics.

## Non-Goals

- Do not expose Postgres tables through Dashboard.
- Do not expose Telegram tables, TDLib details, history coverage internals,
  file slots, file jobs, or Telegram provider storage.
- Do not make Data own provider-specific filter semantics.
- Do not add a default query console, JSON filter editor, or generic RPC
  launcher to the page.
- Do not add Dashboard polling, timers, broad refreshes, or background
  procedure calls.
- Do not embed `/telemetry/data` or any Grafana Data dashboard in this page.
- Do not treat pipeline run datasets as semantic Data storage.
- Do not add provider counts for provider-owned models until providers expose a
  Data-level capability for that fact.

## Public Contract

The Data package contributes one Dashboard page:

```text
contentId: data.page
slot tag: dashboard.page
label: Data
route: /data
page order: 8
```

The Data module exposes these direct read procedures for the Dashboard
explorer:

```ts
overview(): DataOverview
browseAnnotations(input: BrowseInput): PageResult<AnnotationRecord>
browseCollection(input: BrowseInput): PageResult<CollectionRecord>
selectPage(input: SelectInput): PageResult<DatasetRow>
```

`overview` is a Data-owned capability. It reads only the Data model catalog and
Data-owned derived storage. It must not read provider-owned storage tables and
must not call provider-specific storage helpers.

```ts
type DataOverview = {
  catalog: readonly ModelCatalogEntry[];
  derivedStorage: {
    annotations: DerivedStorageOverview;
    collectionItems: DerivedStorageOverview;
  };
};

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

type DerivedStorageOverview = {
  totalItems: number;
  bySubjectModel: readonly {
    count: number;
    subjectCount: number;
    subjectModel: string;
  }[];
  byKey: readonly {
    count: number;
    key: string;
    latestUpdatedAt: string | null;
    subjectCount: number;
  }[];
  recent: readonly DerivedStorageRef[];
};

type PageInput = {
  limit?: number;
  offset?: number;
};

type SortInput = {
  direction: 'asc' | 'desc';
  key: string;
};

type BrowseInput = PageInput & {
  key?: string;
  sort?: SortInput;
  subject?: ModelRef;
  subjectModel?: string;
  where?: {
    itemIdQuery?: string;
    itemIdNotQuery?: string;
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

type PageResult<T> = {
  hasMore: boolean;
  rows: readonly T[];
  total?: number;
};

type SelectInput = PageInput & {
  model: string;
  sort?: SortInput;
  where?: JsonValue;
};

type AnnotationRecord = {
  createdAt: string;
  key: string;
  lineage: readonly ModelRef[];
  subject: ModelRef;
  updatedAt: string;
  value: JsonValue;
};

type CollectionRecord = AnnotationRecord & {
  itemId: string;
};
```

`browseAnnotations` and `browseCollection` are Data-owned read capabilities.
They exist because the subject-scoped `listAnnotations` and `listCollection`
procedures cannot answer "show this annotation or collection key across the
system". They may filter by key, subject, or subject model, and may sort by
Data-owned row columns. Dashboard must not work around that gap with direct SQL.

`selectPage` is the Dashboard-facing provider model browse capability. It keeps
the direct `select` dataset contract stable for Data actions while giving the
page UI `hasMore` metadata. It requests `limit + 1` rows from the provider and
does not compute provider-owned totals.

## Dashboard Procedures

The browser calls Dashboard-owned procedures, not module RPC directly.

The Data Dashboard backend exposes only the procedures needed by the explorer:

```text
data.dashboard.overview
data.dashboard.browseAnnotations
data.dashboard.browseCollection
data.dashboard.selectPage
```

Each wrapper forwards to the typed `@agentg/data` internal RPC client and
returns the Data result directly. These procedures are not Gateway methods and
do not expose arbitrary Data module calls.

Dashboard server configuration adds `DATA_RPC_URL`, default
`http://127.0.0.1:8708`.

## Information Architecture

The `/data` page uses three regions.

`Navigation Tree`: a left-side tree with structure types:

- `Models`: provider models that support `select`;
- `Annotations`: annotation keys;
- `Collections`: collection keys.

The tree is navigation only. It must not show overview metrics, recent lists,
provider storage statistics, query forms, or explanatory copy.

Tree expansion state is local operator UI state and may be persisted in browser
local storage.

`Table`: the center region renders the selected structure immediately:

- annotation key: rows across all subjects with subject ref, updated time, and
  value preview;
- collection key: rows across all subjects with subject ref, item id, updated
  time, and value preview;
- provider model: a bounded `select` result table using the selected model's
  `ModelCatalogEntry.columns` descriptors from Data overview.

Tables use server-side pagination. Page changes request a bounded page from
Data with `limit` and `offset`; the browser must not load a full structure and
slice it locally. Column widths are content-derived by default,
user-resizable, and may be persisted in browser local storage.

Provider model columns are declarative. Dashboard reads values from `DatasetRow`
using `primaryRef` or a `valuePath`, applies neutral formatting such as
`dateTime`, and must not import provider storage schema or provider-specific UI
components. Dashboard must not send sort requests for columns marked
`sortable: false`.

Provider model filters are available only for columns with a declarative
`filter` descriptor. Dashboard renders all available model filters as a list,
not as a column picker, and passes entered values through `selectPage.where`
according to the selected operator descriptor. It must not expose raw JSON
filters or hardcode provider model names. When a descriptor declares
`refOperator: 'eq'`, Dashboard may reuse that column filter for navigation from
a `ModelRef` of the same model.

Text filters use the provider-owned text query language. The Telegram provider
uses case-insensitive SQL matching, splits words by spaces as AND terms, and
treats `*` inside a term as a wildcard. Text filter descriptors may expose
`contains` and `notContains`; the negative operator applies the same text query
language and excludes rows that match it.

The cell context menu may offer filter actions only when the clicked column has
a filter descriptor. The menu uses the clicked row value as the filter value and
offers the column's declared operators, for example `=`, `>`, `<`, `contains`,
or `not contains`. Rows with an openable model ref must also expose
`Open related data` from the context menu.

`Inspector`: the right-side inspector is hidden by default. It appears only
after the operator selects a table row. It shows formatted domain fields for
the selected row and may expose row actions such as `Open related data`. It must
not show debug-only refs, lineage counts, or full raw JSON blocks by default.
Passive navigation changes must close it.

Rows that carry a `telegram.chat` reference may expose `Open in client` in the
row context menu and inspector actions. The action navigates to the existing
Dashboard client chat route.

## Operation Semantics

Initialization may call `data.dashboard.overview` and may load the first
available table so `/data` opens into useful data.

After initialization, Dashboard procedure calls require explicit user intent:

- clicking an annotation key calls `data.dashboard.browseAnnotations`;
- clicking a collection key calls `data.dashboard.browseCollection`;
- clicking a provider model calls `data.dashboard.selectPage`;
- clicking table pagination controls calls the same selected structure
  procedure with the next `offset` and `limit`;
- clicking a sortable table header calls the same selected structure procedure
  with the selected `sort`;
- applying a table filter calls the same selected structure procedure with the
  selected model or derived-storage `where`;
- choosing a filter action from a cell context menu calls the same selected
  structure procedure with the selected column filter and clicked value;
- choosing `Open related data` from a row context menu or inspector action opens
  the subject-scoped related-data view and reads annotations and collections for
  that model ref;
- clicking a table row opens the local inspector and must not call a procedure.
- clicking the selected table row again closes the local inspector.

The page must not poll Data, refresh on broad events, or call procedures from
timers.

Provider model browsing uses the Data `selectPage` capability and a bounded
limit. Provider-specific relation traversal is outside the default page
contract until a neutral Dashboard contribution contract exists for those
controls.

## Storage And Read Model

Data Overview reads:

- the Data model catalog;
- `data_annotations`;
- `data_collection_items`.

Browse procedures read:

- a bounded page from `data_annotations`, optionally filtered by key, subject,
  subject model, subject query, negative subject query, value query, negative
  value query, or updated time;
- a bounded page from `data_collection_items`, optionally filtered by key,
  subject, subject model, subject query, negative subject query, item id query,
  negative item id query, value query, negative value query, or updated time.

No new storage table is required.

All derived-storage aggregation and browse logic lives inside Data, not
Dashboard. Dashboard must not import Data storage schema, Telegram storage
schema, or Drizzle query helpers.

The overview may include:

- total annotation count;
- total collection item count;
- counts by subject model;
- counts by key;
- latest update time by key;
- recent annotation refs;
- recent collection item refs.

The overview must not include:

- full annotation values;
- full collection item values;
- provider-owned model row counts;
- provider-owned storage statistics;
- Telegram history coverage;
- Telegram file lifecycle state;
- pipeline run datasets;
- LLM run datasets.

Provider-owned data is explored only through Data provider routing.

## Ownership Boundaries

Data owns `overview`, derived storage browse procedures, model catalog shape,
provider routing, annotation and collection semantics, and Data Dashboard files
under `packages/data/dashboard`.

Dashboard owns shell navigation, `dashboard.page` slot resolution, browser
WebSocket protocol, Dashboard backend procedure dispatch, and shared UI
primitives.

Provider modules own provider model lifecycle, provider storage,
provider-specific filter semantics, and provider-specific relation support.

Telemetry remains the owner of Grafana, Jaeger, VictoriaMetrics, telemetry
links, and `/telemetry` page content.

## File Ownership

Data runtime:

```text
packages/data/src/
```

Data Dashboard:

```text
packages/data/dashboard/dashboard.ts
packages/data/dashboard/contracts.ts
packages/data/dashboard/backend/
packages/data/dashboard/frontend/
```

Dashboard server integration:

```text
packages/dashboard/src/server/config.ts
packages/dashboard/src/server/module.ts
```

Rules:

- `dashboard.ts` must import only browser-safe frontend contribution code.
- Frontend code must call only the explicit Data Dashboard procedures.
- Do not export Data Dashboard DTO types from the Data package root unless a
  current external package needs that public surface.
- File names must follow repository camelCase stem rules.
- Vue components must use `<script setup lang="ts">` and `<style scoped>`.

## Observability

Data overview and browse procedures are normal Data operations and are recorded
by the existing bounded Data operation duration metric using operations
`overview`, `browse_annotations`, `browse_collection`, and `select_page`.

Metrics must not include subject ids, item ids, model ids, provider filter
values, rendered content, annotation values, or collection item values.

The top-level Data page must not embed the Data Grafana dashboard. Telemetry
readback remains under the Telemetry page.

## Test Contract

Data overview tests must prove catalog return, annotation and collection totals,
grouping by subject model and key, recent refs, omission of stored JSON values,
and no provider registry calls.

Data browse tests must prove annotation and collection rows are returned by key,
include stored values for the selected table, and do not call provider
registries.

Dashboard tests must prove the `Data` page contribution, route `data`, page
order between Client and Events, explicit Dashboard procedure wrappers,
`DATA_RPC_URL` usage, and dependency failure handling.

Browser verification must prove `/data` loads directly, remains in navigation
with Telemetry disabled, loads the initial table when Data is running, shows a
dependency unavailable state when Data RPC is down, and performs reads only from
initialization or explicit user actions. It must also prove row-click inspector
toggle, persisted tree expansion, persisted column resizing, and table
pagination controls.

## Migration Notes

No legacy Data Dashboard exists, so there is no compatibility path to preserve.

The existing Telemetry Data dashboard remains an observability surface under
Telemetry. It must not be moved into the top-level Data page.

If implementation discovers that Data needs provider-owned counts or
provider-owned storage state, stop and re-plan. Do not add direct SQL from
Dashboard and do not add provider-specific storage reads to Data.
