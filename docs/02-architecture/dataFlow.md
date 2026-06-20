# Data Flow

## Main Flow

```text
TDLib update
  -> TDLib update handler
  -> Telegram domain table records
  -> inspectable chats and messages
```

The first implementation proves that the system can authenticate, receive
Telegram data, synchronize the chat list, converge requested history coverage,
and persist text-oriented chats and messages.

Telegram stores coverage, computes missing intervals from its own coverage
tables, and owns TDLib page continuity. Consumers request Telegram product
reads; they do not select TDLib cursors, page fetch strategy, or coverage
materialization mechanics.

## Derived Data Flow

The derived-data path is:

```text
Pipeline trigger or manual run
  -> pipelines run
  -> data.select / data.expand / data.render provider calls
  -> llm.run action when needed
  -> data.writeAnnotation or data.writeCollectionItem
  -> addressable derived data
```

`pipelines` owns the graph and run lifecycle. `data` owns addressable model refs,
provider routing, annotations, and collections. Provider modules own lifecycle
and truth for the models they serve.

For the first implementation, Telegram remains the provider and lifecycle owner
for `telegram.*` models:

```text
data.select model=telegram.chat
  -> Telegram provider procedure
  -> Telegram-owned read model
```

Derived data writes go through `data`:

```text
data.writeAnnotation subject=telegram.chat:-1002129631268 key=unreadSummary
  -> data_annotations
```

`llm-runner` is an action provider. It transforms input datasets into output
datasets and does not own final semantic storage.
`llm.run` completes inside the action call and returns a ready output dataset or
a rejected provider failure. `pipelines` stores that node output and continues
the graph from stored node outputs.

## Acceptance Test Contract

- A manual pipeline run can select a Telegram chat through `data.select`, expand
  its messages through the Telegram provider, render those messages through
  `data.render`, call `llm.run`, write the result through
  `data.writeAnnotation`, and read it back through `data.getAnnotation`.
- A triggered pipeline run follows the same data path as a manual run and uses
  the trigger occurrence idempotency key as the pipeline run idempotency key.
- The end-to-end flow preserves Telegram refs and lineage from selected chats
  and messages into the stored data annotation.
- The end-to-end flow does not call Telegram storage, TDLib, or coverage
  internals outside Telegram-owned provider procedures.
- The end-to-end flow does not let `llm-runner` write final semantic storage.
- `llm.run` returns a ready dataset; the following data write node stores the
  final addressable result.
