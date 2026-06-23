# Pipeline Spec

This document is the agent-facing source of truth for creating pipeline
automation. Read it before writing a `PipelineAutomationRule`.

## Control Plane

Durable scheduled automation must be created as a policy document:

```yaml
apiVersion: agentg.dev/v1
kind: PipelineAutomationRule
metadata:
  name: myPipelineName
spec:
  enabled: true
  trigger:
    kind: periodic
    everySeconds: 3600
    startAt: '2026-06-22T17:03:20.000Z'
  pipeline:
    nodes:
      first:
        use: data.select
        with:
          model: telegram.chat
```

`metadata.name` becomes the materialized pipeline name. `spec.trigger` is
compiled by `pipelines` into one trigger named `schedule`.

Use `policies_set_instance` to create or update scheduled automation. Use
`pipelines_set_pipeline` only for dev/test materialized pipelines.

## Pipeline Graph

`spec.pipeline.nodes` is an object keyed by node id. Each node has:

```yaml
nodeId:
  use: action.id
  from: previousNodeId
  needs:
    - sideDependencyNodeId
  with:
    actionInput: value
```

Rules:

- `use` is required and must be one supported action id.
- `from` selects the previous node whose dataset becomes this node input.
- `needs` adds execution-order dependencies only. It does not add input rows.
- Omit `from` only for source nodes such as `data.select` and `data.get`.
- YAML object order is not execution order. Dependencies determine execution
  order.
- Node ids must be unique inside one pipeline.
- The graph must not contain cycles.

## Dataset Rows

Actions pass datasets between nodes:

```ts
type Dataset = {
  rows: Array<{
    lineage: Array<{ _model: string; id: string }>;
    refs: Record<string, { _model: string; id: string }>;
    value: JsonValue;
  }>;
};
```

`refs` are named references carried by a row. Write nodes use `subject:
{ ref: "chat" }` to read `row.refs.chat`. Render and expand nodes use
`sourceRef` to choose which ref in each row they operate on.

## Runtime Context

Inside `node.with`, a single-key object can read runtime context:

```yaml
itemId:
  $context: date.utc
```

Supported keys:

- `run.startedAt`: ISO timestamp when the pipeline run started.
- `trigger.scheduledAt`: ISO timestamp of the trigger occurrence. Present only
  for triggered runs.
- `window.startAt`: ISO timestamp at `trigger.scheduledAt - everySeconds`.
  Present only for triggered runs.
- `window.endAt`: same ISO timestamp as `trigger.scheduledAt`. Present only for
  triggered runs.
- `date.utc`: UTC date string, `YYYY-MM-DD`. For triggered runs it is derived
  from `window.startAt`; for manual runs it is derived from run start time.

`pipelines` resolves `$context` before calling action providers. Providers see
literal values.

## Supported Actions

### `data.select`

Creates a dataset by selecting model rows through `data`.

```yaml
chats:
  use: data.select
  with:
    model: telegram.chat
    where:
      readState: unread
    limit: 10
```

Input dataset is ignored. Call `data_list_models` before using model-specific
fields in `where`.

### `data.get`

Creates a one-row dataset from one model ref, or an empty dataset if missing.

```yaml
seed:
  use: data.get
  with:
    ref:
      _model: data.collectionItem
      id: telegram.chat:chat-1:seed:latest
```

Input dataset is ignored.

### `data.expand`

Expands each input row through a relation.

```yaml
messages:
  use: data.expand
  from: chats
  with:
    sourceRef: chat
    relation: messages
    where:
      readState: unread
    limit: 20
```

`sourceRef` must exist in every input row that should expand.

### `data.render`

Renders rows into text or JSON for a later node.

```yaml
promptInput:
  use: data.render
  from: messages
  with:
    format: text
    sourceRef: message
    options:
      groupByRef: chat
```

`options.groupByRef` groups rendered output by a ref, producing one row per
group. Use it before `llm.run` when one summary should be produced per chat.

### `llm.run`

Runs an LLM action over the input dataset.

```yaml
summary:
  use: llm.run
  from: promptInput
  with:
    profile: openrouterCheapSummary
    prompt: Summarize the input in one sentence.
```

Pipelines do not carry model names, prices, token budgets, or provider
settings. Those belong to the selected LLM Runner profile.

### `data.writeAnnotation`

Writes one annotation per input row.

```yaml
save:
  use: data.writeAnnotation
  from: summary
  with:
    subject:
      ref: chat
    key: unreadSummary
    mode: replace
```

Fields:

- `subject: { ref: "chat" }` reads `row.refs.chat`.
- `key` is the annotation key.
- `mode` is `replace` or `merge`.
- Omit `value` and `valueFrom` to write the whole `row.value`.
- `valueFrom: { field: "summary" }` writes `row.value.summary`.
- Do not set both `value` and `valueFrom`.

### `data.writeCollectionItem`

Writes one collection item per input row.

```yaml
save:
  use: data.writeCollectionItem
  from: summary
  with:
    subject:
      ref: chat
    key: dailyUnreadSummaries
    itemId:
      $context: date.utc
    mode: replace
```

Fields:

- `subject: { ref: "chat" }` reads `row.refs.chat`.
- `key` is the collection key.
- `mode` is `append`, `replace`, or `merge`.
- `append` must not set `itemId` or `itemIdFrom`.
- `replace` and `merge` require exactly one of `itemId` or `itemIdFrom`.
- `itemId` is a literal item id after `$context` resolution.
- `itemIdFrom: { field: "slug" }` reads `row.value.slug`.
- `itemIdFrom: { refId: "message" }` reads `row.refs.message.id`.
- Omit `value` and `valueFrom` to write the whole `row.value`.
- Do not set both `value` and `valueFrom`.

## Working Examples

### Copy One Data Collection Item On A Schedule

This example has no LLM cost. It reads one existing Data collection item and
writes it to another collection key.

```yaml
apiVersion: agentg.dev/v1
kind: PipelineAutomationRule
metadata:
  name: policySpecEcho
spec:
  enabled: true
  trigger:
    kind: periodic
    everySeconds: 3600
  pipeline:
    nodes:
      seed:
        use: data.get
        with:
          ref:
            _model: data.collectionItem
            id: telegram.chat:agentg-policy-spec-demo:policySpecSeed:seed

      save:
        use: data.writeCollectionItem
        from: seed
        with:
          subject:
            ref: subject
          key: policySpecOutput
          itemId:
            $context: date.utc
          mode: replace
```

Before setting this policy, create the seed item:

```json
{
  "subject": { "_model": "telegram.chat", "id": "agentg-policy-spec-demo" },
  "key": "policySpecSeed",
  "itemId": "seed",
  "mode": "replace",
  "value": "Pipeline spec demo input."
}
```

### Daily Unread Message Summary

```yaml
apiVersion: agentg.dev/v1
kind: PipelineAutomationRule
metadata:
  name: dailyUnreadChatSummary
spec:
  enabled: true
  trigger:
    kind: periodic
    everySeconds: 86400
  pipeline:
    nodes:
      messages:
        use: data.select
        with:
          model: telegram.message
          where:
            readState: unread
            startAt:
              $context: window.startAt
            endAt:
              $context: window.endAt

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
          prompt: Summarize unread messages in one short Russian paragraph.

      save:
        use: data.writeCollectionItem
        from: summary
        with:
          subject:
            ref: chat
          key: dailyUnreadSummaries
          itemId:
            $context: date.utc
          mode: replace
```

## Agent Checklist

1. Call `pipelines_describe_spec` before creating a pipeline policy.
2. Call `data_list_models` when the pipeline needs model-specific `where`
   fields.
3. Create scheduled automation with `policies_set_instance`, not
   `pipelines_set_pipeline`.
4. Verify materialization with `pipelines_get_pipeline`.
5. Verify execution with `pipelines_list_runs` or `pipelines_get_run`.
6. Verify saved outputs with Data read tools.
7. Delete test automation with `policies_delete_instance` when the test is done.
