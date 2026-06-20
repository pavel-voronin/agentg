# LLM Runner

## Purpose

`llm-runner` owns LLM action execution for pipeline nodes.

It receives an input dataset from `pipelines`, calls a configured LLM profile,
returns an output dataset, records LLM run lifecycle, and hides provider
adapters, connection details, retries, and profile loading.

`llm-runner` does not own source selection and does not own final semantic
storage. Pipelines select and render content through `data`; pipelines write
results through `data.writeAnnotation` or `data.writeCollectionItem`.

## Goals

- Provide the `llm.run` pipeline action.
- Configure LLM provider profiles from files.
- Keep provider credentials out of profile files.
- Execute provider calls with bounded retry and timeout settings.
- Return LLM output as a dataset that later pipeline nodes can consume.
- Record LLM run state for inspection and retry diagnostics.

## Non-Goals

- Do not resolve Telegram selectors.
- Do not materialize source content.
- Do not write final annotations or collections.
- Do not store the main addressable derived-data model.
- Do not make profile files carry prompts or pipeline instructions.

## Ubiquitous Language

- `Profile`: named file-backed configuration for one provider/model endpoint.
- `LlmActionInput`: the `with` payload for one `llm.run` pipeline node.
- `Prompt`: the node-owned instruction text.
- `InputDataset`: rows supplied by the upstream pipeline node.
- `OutputDataset`: rows produced from the provider response.
- `LlmRun`: one durable lifecycle record for one `llm.run` action execution.
- `ProviderCall`: one provider request for one input row and one attempt.
- `ActionProvider`: the role `llm-runner` plays when `pipelines` invokes
  `llm.run`.

## Boundary Contract

`llm-runner` owns:

- `llm.run` action validation;
- profile configuration and adapter selection;
- provider request construction;
- provider retry and timeout behavior;
- LLM run lifecycle storage;
- LLM run events.

Related ownership:

- `pipelines` owns pipeline definitions, node dependency graph, run lifecycle,
  and action dispatch.
- `data` owns model refs, provider routing, annotations, collections, and data
  write actions.
- Telegram owns Telegram content readiness, coverage, storage, TDLib access, and
  Telegram data-provider procedures.

## Profile Boundary

A profile is named file-backed configuration owned by `llm-runner`.

Profiles are loaded from `config/llm-runner/profiles.yaml` unless
`LLM_RUNNER_PROFILES_PATH` points at another profile file.

The profile file includes LLM provider, model, endpoint, secret reference,
adapter protocol, timeout, retry, and generation settings. Direct provider
credentials must not be stored in the profile file. A profile references a
secret through `apiKeyEnv`, and runtime reads the secret value from that
environment variable before making the provider call.

Profile file shape:

```yaml
profiles:
  openrouterFree:
    adapter: openai-compatible
    apiKeyEnv: OPENROUTER_API_KEY
    baseUrl: https://openrouter.ai/api/v1
    model: openrouter/free
    timeoutMs: 60000
    maxAttempts: 1
    maxOutputTokens: 300
    temperature: 0.2
```

Supported profile fields:

- `adapter`: currently only `openai-compatible`.
- `baseUrl`: provider API base URL.
- `model`: provider model identifier.
- `apiKeyEnv`: optional environment variable containing the bearer token.
- `timeoutMs`: optional provider request timeout.
- `maxAttempts`: optional provider retry count.
- `maxOutputTokens`: optional output token limit.
- `temperature`: optional provider temperature.

`apiKey` is not a supported profile file field.

## Pipeline Action Contract

Pipeline node:

```yaml
summary:
  use: llm.run
  from: promptInput
  with:
    profile: openrouterFree
    prompt: Summarize the input in one sentence.
```

Action input:

```ts
type LlmActionInput = {
  profile: string;
  prompt: string;
  output?: {
    format?: 'text' | 'json';
  };
};
```

The first implementation treats `prompt` as literal instruction text. Prompt
template lookup is not part of `llm-runner`.

Action execution input:

```ts
type LlmRunActionRequest = {
  input: Dataset;
  node: {
    id: string;
    runId: string;
  };
  with: LlmActionInput;
};
```

Action result:

```ts
type LlmRunActionResult =
  | {
      runId: string;
      status: 'accepted';
    }
  | {
      error: {
        code: string;
        message: string;
      };
      status: 'rejected';
    };
```

`llm.run` creates a durable run, stores it as `accepted`, publishes the accepted
event, starts provider work outside the action response path, and returns the
run id. Pipelines resume from LLM runner events and read the terminal provider
result through `getRunResult`.

The action returns `rejected` only when the action request is rejected before a
durable run is accepted, such as an unknown profile. Provider failures after
acceptance are stored as failed runs and are visible through `getRunResult`.

## Dataset Semantics

`llm.run` consumes a dataset produced by a previous node. For text prompts,
`data.render` should prepare the input dataset before the LLM node.

`llm.run` treats each input dataset row as one prompt context and makes one LLM
call per input row. If the caller needs one LLM call for many source rows, the
upstream `data.render` node must aggregate those rows into one rendered input
row. If the caller needs one LLM call per chat, `data.render` should return one
row per chat, for example with `options.groupByRef: 'chat'`.

One `llm.run` node execution has one `LlmRun` id. Multi-row input creates
multiple provider calls under that run id. If any row reaches a terminal provider
failure, the whole accepted run fails and no partial output dataset is exposed
through `getRunResult`.

`llm.run` with an empty input dataset returns an accepted run id, makes no
provider calls, stores a completed empty output dataset, and publishes the
completed run event.

Input example:

```yaml
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
```

`llm-runner` carries each input row's refs and lineage into the corresponding
output row so a later `data.write*` node can address the result.

## Run Lifecycle

Allowed LLM run states:

```text
accepted
processing
completed
failed
cancelled
```

Rules:

- A run stores the profile name, prompt, input metadata, output metadata, and
  provider failure code when present.
- Provider and model details remain in profile configuration.
- Provider credentials are not copied into run records.
- Provider retries use the same LLM run id.
- A failed provider call records a failed run and publishes a failed run event.

## Event Contract

`llm-runner` publishes live events:

- `llmRunner.run.accepted`
- `llmRunner.run.processing`
- `llmRunner.run.completed`
- `llmRunner.run.failed`

Event payloads may include:

- LLM run id;
- pipeline run id;
- pipeline node id;
- profile;
- run state;
- failure code;
- timestamps.

Completed and failed events for pipeline action runs include the pipeline run id
and pipeline node id from the action execution input. Events are live facts.
Consumers recover state through read procedures after live event loss.

## Storage Model

The first implementation stores LLM run records:

- run id;
- pipeline run id;
- pipeline node id;
- profile;
- prompt;
- input metadata;
- output metadata;
- output dataset for completed action runs;
- status;
- failure code;
- timestamps.

Final semantic outputs are stored by `data` write nodes, not by `llm-runner`.
The stored action output dataset is action-run state, not addressable semantic
storage.

## Read Procedures

Consumers can read LLM run state through:

```ts
getRunResult(input: { runId: string }): LlmRunResult | null;

type LlmRunResult =
  | {
      runId: string;
      status: 'accepted' | 'processing';
    }
  | {
      dataset: Dataset;
      runId: string;
      status: 'completed';
    }
  | {
      error: {
        code: string;
        message: string;
      };
      runId: string;
      status: 'failed';
    };
```

`getRunResult` returns the current run state, the completed output dataset when
the run completed, and the failure code when the run failed. Provider credentials
are never returned.

## Observability

`llm-runner` emits bounded domain metrics:

- `llm_runner.runs`: current durable run count by `llm.run.status`.
- `llm_runner.runs.started`: accepted action runs by `llm.profile`.
- `llm_runner.provider.duration`: provider call duration by `llm.profile`,
  `llm.output.format`, `llm.provider.result`, and `error.type` on failures.
- `llm_runner.run.duration`: accepted run processing duration by `llm.profile`,
  `llm.run.result`, and `error.type` on failures.
- `llm_runner.rows.processed`: rows emitted by completed LLM runs by
  `llm.profile` and `llm.run.result`.

Metric labels must not include run ids, pipeline run ids, node ids, prompts,
input text, provider secrets, message ids, or chat ids.

Operator path:

- AgentG Dashboard: `/telemetry/llm-runner`
- Grafana dashboard UID: `agentg-llm-runner`
- Jaeger service: `llm-runner`

The dashboard must show current runs by status, processing runs, failed runs,
started runs by profile, provider call volume, provider p95, run p95, rows
processed, RPC call rate, and Postgres p95.

## File Structure Constraints

Target package ownership:

```text
packages/llm-runner/
  src/
    module.ts
    client.ts
    config.ts
    actions/
    profiles/
    runs/
    events.ts
    schema.ts
  drizzle/
  tests/
```

The package root exports a typed internal client when another current package
imports it. Internal tests use relative imports.

## Test Contract

- `llm.run` validates `LlmActionInput`.
- Unknown profiles are rejected before provider calls.
- Referenced `apiKeyEnv` secret values that are missing or empty are rejected
  before provider calls.
- Provider, model, endpoint, timeout, retry, and adapter settings come from the
  named profile file configuration.
- Provider secrets are referenced by environment variable name and are not
  stored in profile files.
- `maxAttempts` controls provider retry count and defaults to one attempt.
- `timeoutMs` bounds one provider request attempt.
- Provider retry attempts reuse the same LLM run id.
- The provider request contains the node prompt and upstream dataset content.
- The provider request uses the configured profile and does not read provider
  settings from the pipeline node beyond the profile name.
- The profile is connection and provider configuration only; it does not supply
  or override node prompts.
- Multi-row input uses one LLM run id and one provider call per input row.
- Empty input returns an accepted LLM run id, makes no provider calls, and later
  exposes a completed empty output dataset through `getRunResult`.
- Successful provider output records a completed LLM run and exposes one output
  dataset row for each input row through `getRunResult`.
- Output dataset rows preserve the corresponding input row refs and lineage.
- A terminal provider failure for one row fails the whole accepted run and
  exposes no partial output dataset through `getRunResult`.
- `output.format: text` returns provider text as a JSON-safe text value.
- `output.format: json` parses provider text as JSON and rejects invalid JSON.
- Provider timeout records a failed LLM run and publishes a failed run event.
- Provider terminal failure records a failed LLM run and publishes a failed run
  event.
- LLM run records never store provider credentials.
- Completed and failed runs publish corresponding LLM runner events.
- Completed and failed events for pipeline action runs include pipeline run id
  and pipeline node id.
- `getRunResult` returns the completed output dataset for a completed action
  run.
- `getRunResult` returns failed state and failure code for a failed action run.
- Consumers can recover LLM run state through read procedures after live event
  loss.
- `llm-runner` does not write data annotations or collections.
- LLM runner telemetry records durable run state, run starts, provider duration,
  run duration, and processed rows without run ids, node ids, prompts, message
  ids, chat ids, input text, or secrets as metric labels.
- `/telemetry/llm-runner` embeds the `agentg-llm-runner` Grafana dashboard for
  operator readback.

## Implementation Sequence

1. Keep file-backed profile loading.
2. Add `llm.run` action provider procedure for `pipelines`.
3. Store LLM run records keyed by pipeline run and node id.
4. Return provider output as a dataset.
5. Keep the target LLM action path as prepared dataset input, dataset output, and
   separate persistence through a following `data.write*` node.

## Removal Notes

The artifact/source-selector execution path is replaced by pipeline dataset
action execution. Remove artifact storage/read procedures, source resolver
configuration, `LlmRunPayload`, and `runTriggered`-specific artifact payload
handling as part of this implementation. Do not keep a compatibility path.
