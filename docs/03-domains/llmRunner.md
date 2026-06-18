# LLM Runner

## Purpose

`llm-runner` owns LLM-backed processing over domain content.

It resolves requested source content through the owning domain, runs a
configured profile, stores derived artifacts, and publishes run and
artifact events while hiding source-domain mechanics, provider adapters,
connection details, retries, and artifact storage details.

`llm-runner` is a regular module and can act as an action provider when
`triggers` calls one of its procedures.

## Goals

- Run LLM-backed processing over domain content.
- Keep source-domain semantics private to the source domain.
- Support direct RPC runs and triggered runs through one run lifecycle.
- Store derived artifacts so consumers can query results through source
  references.
- Configure LLM connection profiles for providers, models, endpoints,
  credentials, adapter protocols, timeouts, and retries.
- Publish live run and artifact events.
- Keep current artifact storage as the first implementation slice while keeping
  the model compatible with multiple artifacts per source later.

## Ubiquitous Language

- `LlmRunPayload`: the request body for one LLM-backed processing run.
- `Profile`: named module configuration that knows how to connect to one LLM
  backend through a provider adapter.
- `Instructions`: domain-level processing instructions supplied by a user or
  run input.
- `SourceSelector`: a declarative selector for source-domain content.
- `SourceRef`: a neutral reference to a selected source object.
- `ContentRef`: a neutral reference to concrete content used by a run.
- `SourceSnapshot`: the resolved `SourceRef` and `ContentRef` set used by one
  run.
- `LlmRun`: a durable lifecycle record for one execution attempt.
- `LlmArtifact`: the derived result produced by a run.
- `ActionProvider`: the regular module procedure role used when `triggers`
  calls `llm-runner`.

## Boundary Contract

### LLM Runner Boundary

`llm-runner` owns:

- LLM run procedures;
- action-provider procedure handling for triggered runs;
- `LlmRunPayload` validation;
- profile configuration and adapter selection;
- source resolver ports;
- source snapshot persistence;
- run lifecycle;
- current artifact persistence;
- artifact read procedures indexed by source references;
- run and artifact events;
- observability for processing lifecycle.

### Related Ownership

- `triggers` owns `TriggerRule` policies, schedules, occurrences, leases, and
  dispatch.
- Source domains own selector semantics, storage, read models, readiness, and
  source materialization.
- Telegram owns Telegram history readiness, coverage, TDLib access, file slots,
  file queues, and Telegram read models.
- Gateway owns external protocol compatibility.
- Dashboard owns shell behavior and user interaction state.

## Run Payload

`llm-runner` defines the payload shape for direct runs and triggered runs:

```ts
type LlmRunPayload = {
  artifactKey: string;
  instructions: string;
  profile: string;
  sourceSelector: SourceSelector;
};
```

Example `TriggerRule` policy that calls `llm-runner`:

```yaml
apiVersion: agentg.dev/v1
kind: TriggerRule
metadata:
  name: unreadDigestDaily
spec:
  condition:
    kind: periodic
    everySeconds: 86400
  action:
    module: llm-runner
    procedure: runTriggered
    input:
      artifactKey: dailyUnreadDigest
      profile: default
      instructions: Summarize important unread signals.
      sourceSelector:
        domain: telegram
        selector:
          unread: true
```

`triggers` owns the surrounding `TriggerRule` semantics. `llm-runner` owns only
the `action.input` payload when `action.module` is `llm-runner`.

## Source Domain Boundary

The source domain owns selector interpretation. For Telegram sources, Telegram
interprets Telegram selectors, reads Telegram read models, checks readiness and
coverage, requests missing materialization through Telegram-owned capabilities,
and returns neutral `SourceRef` and `ContentRef` values for `llm-runner`.

`llm-runner` stores and passes source selectors as source-domain data until it
calls the source-domain resolver.

## Profile Boundary

A profile is named runtime configuration owned by `llm-runner`.

It includes LLM provider, model, endpoint, credential, adapter protocol,
timeout, and retry settings. The first retry setting is `maxAttempts`, a
positive integer that defaults to one provider attempt. Direct run inputs and
triggered run inputs reference the profile by name.

## Public Contract

Direct run payload:

```ts
type RunInput = LlmRunPayload;
```

Triggered run payload:

```ts
type RunTriggeredInput = {
  actionInput: LlmRunPayload;
  occurrence: {
    idempotencyKey: string;
    registrationKey: string;
    scheduledAt: string;
  };
  trigger: {
    kind: 'trigger';
    requestId: string;
  };
};
```

Run result:

```ts
type LlmRunOutput =
  | {
      runId: string;
      status: 'accepted';
    }
  | {
      error: LlmRunError;
      status: 'rejected';
    };
```

`accepted` means `llm-runner` accepted responsibility for the run lifecycle.
Artifact readiness is reported through run state, artifact events, and artifact
read procedures.

Triggered runs use `occurrence.idempotencyKey` as the deduplication key.
Duplicate dispatch for the same key returns the existing accepted run.

Artifact reads are indexed by source references and artifact keys:

```ts
type ListArtifactsInput = {
  artifactKey?: string;
  sourceRef: SourceRef;
};

type GetCurrentArtifactInput = {
  artifactKey: string;
  sourceRef: SourceRef;
};
```

## Source Reference Semantics

```ts
type SourceSelector = {
  domain: string;
  selector: JsonValue;
};

type SourceRef = {
  _model: string;
  id: string;
};

type ContentRef = {
  _model: string;
  id: string;
  sourceRef?: SourceRef;
};
```

The source domain owns `_model` and `id` values. `llm-runner` stores and indexes
these values as opaque identifiers.

The source resolver returns:

- `SourceRef[]`: selected source scopes;
- `ContentRef[]`: concrete content references to process;
- optional source-domain read payload required by the run;
- readiness state if source materialization is still in progress.

If readiness is pending, `llm-runner` records the run as waiting for source
readiness and resumes through the run lifecycle after source completion.

## Run Lifecycle

Allowed run states:

```text
accepted
resolvingSource
waitingForSource
processing
storingArtifact
completed
failed
cancelled
```

Transitions:

- `accepted -> resolvingSource`
- `resolvingSource -> waitingForSource`
- `resolvingSource -> processing`
- `waitingForSource -> resolvingSource`
- `processing -> storingArtifact`
- `storingArtifact -> completed`
- any non-terminal state -> `failed`
- any non-terminal state -> `cancelled`

Rules:

- A direct run stores the request snapshot that created it.
- A triggered run stores trigger provenance and the accepted run request needed
  to resume execution.
- A run stores the profile name. Provider and model details remain in module
  configuration.
- A run stores the resolved source snapshot before processing starts.
- `TriggerRule` changes affect new triggered runs. Accepted runs keep their
  stored run request.
- Processing retries are idempotent for the same run id and source snapshot.
- Artifact writes are idempotent for the same run id.

## Artifact Model

The first implementation stores the current artifact for a source and artifact
key.

Minimum artifact fields:

- artifact id;
- artifact key;
- source refs;
- content refs;
- profile;
- run id;
- status;
- title or summary metadata;
- body or structured payload;
- created timestamp;
- updated timestamp.

The model supports later storage of multiple artifacts for one source, such as
artifacts produced by different runs, profiles, or instructions.

## Event Contract

`llm-runner` publishes live, non-durable events:

- `llmRunner.run.accepted`
- `llmRunner.run.waitingForSource`
- `llmRunner.run.processing`
- `llmRunner.run.completed`
- `llmRunner.run.failed`
- `llmRunner.artifact.updated`

Event payloads may include:

- `runId`;
- `artifactId`;
- `artifactKey`;
- `sourceRefs`;
- `contentRefs`;
- trigger provenance;
- timestamps;
- failure code for failed runs.

Events are live facts. Consumers recover state through read procedures after
live event loss.

## Observability Contract

Allowed low-cardinality labels:

- run state;
- failure code;
- source domain;
- profile when configured cardinality is bounded.

Forbidden high-cardinality labels:

- run id;
- artifact id;
- chat id;
- message id;
- file id;
- raw selector;
- raw instructions text.

## File Structure Constraints

Target package ownership:

```text
packages/llm-runner/
  src/
    module.ts
    client.ts
    config.ts
    artifacts/
    profiles/
    runs/
    sources/
    events.ts
    schema.ts
  drizzle/
  tests/
```

The package root exports a typed internal client when another current package
imports it. Internal tests use relative imports.

## Acceptance Test Contract

An `llm-runner` implementation is accepted only when the feature-owned tests
prove the behavior below.

### Run Input

- Direct `run` validates `LlmRunPayload`.
- Triggered `runTriggered` validates `TriggeredActionInput`.
- `runTriggered` validates `actionInput` as `LlmRunPayload`.
- Missing or invalid `artifactKey`, `profile`, `instructions`, or
  `sourceSelector` rejects the run.
- An unknown profile rejects the run before source processing starts.
- Rejected runs do not create artifacts.

### Run Lifecycle

- A direct run creates a durable run record in `accepted`.
- A triggered run creates the same run lifecycle as a direct run.
- A triggered run stores trigger provenance and the accepted run request needed
  to resume execution.
- Duplicate trigger dispatch with the same occurrence idempotency key returns
  the existing accepted run.
- Restart resumes durable accepted and waiting runs without creating duplicate
  runs or duplicate artifacts.
- A run stores the profile name and does not copy provider credentials into the
  run record.
- A failed source, provider, or artifact step records a failed run with a
  failure code.
- Shutdown waits for the active run tick to finish before the module stop
  completes.

### Source Resolution

- Source selectors pass to the owning domain resolver as source-domain data.
- Telegram selectors are resolved only through the Telegram source resolver
  port.
- A ready source result stores `SourceRef` and `ContentRef` values in the
  source snapshot before provider processing starts.
- A pending source result leaves artifact storage unchanged.
- A pending source result does not call the provider.
- Source readiness completion resumes the same run id.
- A source resolver result with zero `SourceRef` values fails the run before the
  provider is called.
- A ready source result with source refs and no content refs completes the run
  without provider processing and without artifact update.
- Source references and content references are stored and indexed as opaque
  identifiers.

### Profile And Provider Call

- Provider, model, endpoint, timeout, retry, and adapter settings come from the
  named profile configuration.
- `maxAttempts` controls provider retry count and defaults to one attempt.
- The provider request contains the run instructions and resolved source
  content.
- The provider request uses the configured profile and does not read provider
  settings from the run payload.
- The profile is connection and provider configuration only; it does not supply
  or override run instructions.
- Provider retry uses the same run id and source snapshot.
- A provider failure records a failed run and publishes
  `llmRunner.run.failed`.
- An invalid provider response rejects artifact storage and records a failed
  run.

### Artifact Storage And Reads

- Successful processing writes current artifact records indexed by every
  associated `SourceRef` and `artifactKey`.
- Artifact writes are idempotent for the same run id.
- A newer successful run for the same source and artifact key replaces the
  current artifact.
- Artifact records store `artifactKey`, source refs, content refs, profile,
  run id, status, body or structured payload, and timestamps.
- `listArtifacts` can query by source reference and optional artifact key.
- `getCurrentArtifact` returns the current artifact for a source reference and
  artifact key.
- `getCurrentArtifact` returns `null` when no artifact exists for a source
  reference and artifact key.
- Artifact read procedures recover state from storage after live event loss.

### Events

- Accepted, waiting-for-source, processing, completed, and failed run events are
  published at the matching lifecycle transitions.
- `llmRunner.artifact.updated` is published after a successful artifact write.
- Event payloads include identifiers needed for consumers to read state.
- Event payloads do not expose raw provider credentials, raw instructions, or
  raw source payload.

### Feature Gate

The scoped verification command for this feature is `npm run check:llm-runner`.
The triggered action-provider integration gate is
`npm run integration:triggers-llm-runner`.
