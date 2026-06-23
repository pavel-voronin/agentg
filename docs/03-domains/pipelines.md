# Pipelines

## Purpose

`pipelines` owns named YAML pipeline definitions, pipeline validation, pipeline
run lifecycle, node execution, and schedule registration with `triggers`.

A pipeline is a graph of named nodes. Each node calls one action provider, reads
datasets from previous nodes, and either produces a dataset, performs a side
effect, or both.

## Goals

- Store named YAML pipeline definitions.
- Run the same pipeline manually, through Gateway/MCP, or from a schedule.
- Treat writes as ordinary pipeline nodes.
- Build execution order from node dependencies, not YAML mapping order.
- Let node YAML name models and actions without hard-coding module routing.
- Keep scheduling in `triggers` and LLM/provider behavior in action providers.

## Non-Goals

- Do not store semantic data inside `pipelines`.
- Do not call Telegram, LLM providers, or storage directly from pipeline core.
- Do not make `triggers` store pipeline YAML.
- Do not make `llm-runner` resolve source selectors or write final semantic
  outputs.
- Do not use detached post-processing write blocks.

## Ubiquitous Language

- `Pipeline`: one named YAML definition.
- `PipelineNode`: one named action invocation in a pipeline graph.
- `Action`: the provider capability selected by `node.use`.
- `ActionProvider`: a module that implements pipeline actions.
- `Dataset`: the rows passed between nodes.
- `PipelineRun`: one execution of one pipeline definition.
- `NodeRun`: one execution of one node inside a pipeline run.
- `TriggerBinding`: a schedule declaration in a pipeline that `pipelines`
  registers with `triggers`.

## Pipeline Document

Pipeline definitions live in `pipelines`, not in `triggers`.

```yaml
apiVersion: agentg.dev/v1
kind: Pipeline
metadata:
  name: subcreativeUnreadSummary
spec:
  triggers:
    unreadSummaryEveryMinute:
      kind: periodic
      everySeconds: 60

  nodes:
    chats:
      use: data.select
      with:
        model: telegram.chat
        where:
          chatIds:
            - '-1002129631268'
          readState: unread

    messages:
      use: data.expand
      from: chats
      with:
        relation: messages
        sourceRef: chat
        where:
          readState: unread
        limit: 50

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
        profile: openrouterFree
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

YAML mapping order is not execution semantics. Named nodes execute according to
`from` and `needs`.

The target pipeline format is named `nodes` plus explicit dependencies. Array
pipeline documents are not part of the first implementation.

## Node Contract

```ts
type PipelineNode = {
  use: string;
  from?: string;
  needs?: readonly string[];
  with?: JsonValue;
};
```

`from` supplies the default dataset input. A node without `from` receives an
empty dataset. `needs` adds ordering dependencies without passing a dataset as
the default input.

The first implementation has one default dataset input per node. Node `with`
payloads may contain action-owned selectors, but those selectors resolve against
the current input row only. They do not join against arbitrary previous node
outputs. If a later node needs a ref or lineage, an upstream action must carry it
forward in the dataset row.

Pipeline-owned runtime context expressions are explicit JSON objects with a
single `$context` key. Pipelines resolves them before dispatching the action, so
action providers receive ordinary JSON values:

```yaml
where:
  startAt:
    $context: window.startAt
  endAt:
    $context: window.endAt
itemId:
  $context: date.utc
```

Supported context paths:

```text
run.startedAt
trigger.scheduledAt
window.startAt
window.endAt
date.utc
```

`run.startedAt` is the actual run creation time. For triggered periodic runs,
`trigger.scheduledAt` is the occurrence time from `triggers`,
`window.endAt` equals that scheduled occurrence, and `window.startAt` is
`scheduledAt - trigger.everySeconds`. `date.utc` is the UTC date of
`window.startAt` for triggered runs and the UTC date of `run.startedAt` for
manual runs. Context expressions do not perform string templating; unknown or
unavailable context paths fail the node.

Action ids use module-owned action names:

```text
data.select
data.get
data.expand
data.render
data.writeAnnotation
data.writeCollectionItem
llm.run
```

The pipeline runtime validates:

- referenced nodes exist;
- the node graph has no cycles;
- `from` and `needs` do not reference the node itself;
- the action id exists;
- action input is JSON-safe;
- provider-owned action validation accepts `with`;
- a node with `from` can consume the upstream dataset shape.

## Dataset Contract

Pipeline nodes pass datasets:

```ts
type DatasetRow = {
  value: JsonValue;
  refs: Record<string, ModelRef>;
  lineage: readonly ModelRef[];
};

type Dataset = {
  rows: readonly DatasetRow[];
};
```

Node actions may return:

```ts
type ActionResult =
  | { status: 'ready'; dataset: Dataset }
  | { status: 'accepted'; runId: string }
  | { status: 'rejected'; error: { code: string; message: string } };
```

A `ready` result stores the node output dataset. An `accepted` result stores the
provider run id, marks the node and pipeline run as `waiting`, and resumes the
same pipeline run after the provider result is available. A `rejected` result
stores the provider error and fails the node run.

For the first implementation, `data.*` actions return `ready` or `rejected`.
`llm.run` may return `accepted`. `pipelines` resumes `llm.run` nodes from
`llmRunner.run.completed` and `llmRunner.run.failed` events, then reads the
provider result from `llm-runner` by provider run id before continuing dependent
nodes.

## Write Nodes

Writes are ordinary nodes:

```yaml
save:
  use: data.writeCollectionItem
  from: subjects
  with:
    subject:
      ref: chat
    key: subjects
    itemIdFrom:
      field: slug
    mode: merge
```

A write node may be terminal. A pipeline may contain no write nodes, one write
node, or many write nodes.

## Scheduling

Pipelines can include schedule declarations under `spec.triggers`.

`pipelines` compiles each schedule into a trigger registration:

```text
pipeline name + trigger name + schedule
  -> triggers registration
  -> action module: pipelines
  -> action procedure: runTriggered
  -> action input: pipeline name and trigger name
```

`triggers` owns occurrence creation, leases, and dispatch. `pipelines` owns the
pipeline definition and the pipeline run created by a trigger occurrence.

Deleting or changing a pipeline updates the trigger registrations owned by that
pipeline. Existing started `PipelineRun` records keep the definition snapshot
accepted at run start.

## Public Procedures

Initial internal procedures:

```ts
listPipelines(): readonly PipelineSummary[];
getPipeline(input: { name: string }): PipelineDocument | null;
setPipeline(input: { document: PipelineDocument }): PipelineMutationResult;
deletePipeline(input: { name: string }): PipelineMutationResult;
runPipeline(input: { name: string; idempotencyKey?: string }): PipelineRunAccepted;
getRun(input: { runId: string }): PipelineRunView | null;
listRuns(input: { pipelineName?: string; status?: PipelineRunStatus }): readonly PipelineRunView[];
```

Mutation result:

```ts
type PipelineMutationResult =
  | {
      name: string;
      operation: 'set' | 'delete';
      status: 'applied';
    }
  | {
      error: {
        code: string;
        message: string;
      };
      name?: string;
      operation: 'set' | 'delete';
      status: 'rejected';
    };

type PipelineRunAccepted = {
  runId: string;
  status: 'accepted';
};
```

Triggered action provider procedure:

```ts
runTriggered(input: TriggeredActionInput): TriggeredActionResult;
```

`runTriggered` validates the trigger action input as a pipeline run request and
uses the occurrence idempotency key as the pipeline run idempotency key.

## Run Lifecycle

Allowed pipeline run states:

```text
accepted
running
waiting
completed
failed
cancelled
```

Allowed node run states:

```text
pending
running
waiting
completed
failed
skipped
```

Rules:

- A run stores the pipeline definition snapshot used for execution.
- A node run stores the action id, resolved node input dataset, output dataset
  when present, output metadata, and failure code.
- A failed required node fails the pipeline run.
- An accepted async provider result marks the node and run as waiting until the
  provider result is read by provider run id.
- Triggered duplicate dispatch with the same occurrence idempotency key returns
  the existing accepted pipeline run.
- Manual runs create new pipeline runs unless the caller supplies an idempotency
  key.
- Completed node output datasets are durable run state and are visible through
  run read procedures.

## Action Provider Boundary

`pipelines` calls action providers through module-owned action procedures.

Action providers own:

- action-specific input validation;
- domain-specific reads and writes;
- external provider calls;
- action-specific events.

`pipelines` owns:

- pipeline document validation;
- dependency graph execution;
- run and node state;
- schedule registration with `triggers`;
- action dispatch;
- run read procedures.

## Storage Model

Initial tables:

```text
pipelines_definitions
pipelines_runs
pipelines_node_runs
pipelines_trigger_bindings
```

Definitions store:

- pipeline name;
- document YAML or normalized JSON;
- validation status;
- created timestamp;
- updated timestamp.

Runs store:

- run id;
- pipeline name;
- definition snapshot;
- idempotency key when present;
- trigger provenance when present;
- run status;
- timestamps.

Node runs store:

- run id;
- node id;
- action id;
- node status;
- input dataset JSONB;
- output dataset JSONB when present;
- output metadata;
- failure code;
- timestamps.

Trigger bindings store the current registrations that `pipelines` owns in
`triggers`.

## Observability

`pipelines` emits bounded domain metrics:

- `pipelines.definitions`: current stored pipeline definition count.
- `pipelines.runs`: current durable pipeline runs by `pipeline.run.status`.
- `pipelines.nodes`: current durable node runs by `pipeline.node.status`.
- `pipelines.runs.started`: started runs by `pipeline.run.source`.
- `pipelines.node.dispatches`: action provider dispatch count by
  `pipeline.node.action` and `pipeline.node.result`.
- `pipelines.node.duration`: action provider dispatch duration by
  `pipeline.node.action`, `pipeline.node.result`, and `error.type` on failures.

Metric labels must not include pipeline names, run ids, node ids, provider run
ids, trigger names, idempotency keys, dataset values, refs, or lineage ids.

Operator path:

- AgentG Dashboard: `/telemetry/pipelines`
- Grafana dashboard UID: `agentg-pipelines`
- Jaeger service: `pipelines`

The dashboard must show definition count, waiting and failed runs, waiting
nodes, runs by status, nodes by status, started runs, node dispatches, node p95,
RPC call rate, and Postgres p95.

## File Structure Constraints

Target package ownership:

```text
packages/pipelines/
  src/
    module.ts
    client.ts
    actions/
    definitions/
    runs/
    scheduler/
    storage/
    schema.ts
  drizzle/
  tests/
```

The package root exports a typed client only when another current package
imports it.

## Test Contract

- `setPipeline` rejects malformed YAML documents.
- `setPipeline` rejects unsupported `apiVersion` values.
- `setPipeline` rejects unsupported `kind` values.
- `setPipeline` rejects missing or invalid `metadata.name`.
- `setPipeline` rejects missing or empty `spec.nodes`.
- Named nodes validate by `from` and `needs`, not YAML mapping order.
- A node without `from` receives an empty dataset.
- A node cannot reference itself through `from` or `needs`.
- Action-owned selectors inside `with` resolve against the current input row.
- Action-owned selectors inside `with` reject missing row refs or fields.
- `with` selectors do not create implicit cross-node joins.
- Cycles are rejected.
- Unknown action ids are rejected.
- Provider-owned action validation failures reject the pipeline definition or
  node run before side effects occur.
- A node with an upstream dataset shape rejected by the provider fails before
  the provider performs side effects.
- A ready action result stores the node output dataset and makes it available to
  dependent nodes.
- `llm.run` can return an accepted provider run id and later resume from the
  provider result.
- A rejected action result stores the provider error and fails the required node.
- Write nodes are accepted as ordinary nodes.
- A pipeline with no write nodes can run.
- A pipeline with two write nodes can run both when dependencies allow it.
- A triggered run uses the occurrence idempotency key.
- A duplicate triggered run with the same occurrence idempotency key returns the
  existing pipeline run.
- A manual run creates a new run without an idempotency key.
- A manual run with an idempotency key returns the existing run for that key.
- Updating a pipeline updates its trigger registrations.
- Deleting a pipeline removes its trigger registrations.
- Started runs keep the definition snapshot accepted at run start after the
  pipeline definition is changed.
- Manual `runPipeline` and triggered `runTriggered` use the same run lifecycle.
- Triggered periodic runs persist runtime context on the run record.
- `$context` expressions in node `with` resolve before action dispatch and
  survive async provider resume.
- Unknown or unavailable `$context` paths fail the node instead of passing
  through as literal data.
- Pipeline telemetry records definition count, run state, node state, started
  runs, dispatch count, and node dispatch duration without pipeline names, run
  ids, node ids, provider run ids, trigger names, idempotency keys, dataset
  values, refs, or lineage ids as metric labels.
- `/telemetry/pipelines` embeds the `agentg-pipelines` Grafana dashboard for
  operator readback.

## Implementation Sequence

1. Add the `pipelines` module package and definition storage.
2. Add YAML parser and DAG validation.
3. Add run and node run storage.
4. Add action provider registry and dispatch for ready and rejected actions.
5. Add `data` action provider integration.
6. Add `llm.run` action provider integration.
7. Add schedule registration into `triggers`.
8. Add Gateway and MCP methods for pipeline management and manual runs.
