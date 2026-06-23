# Triggers

## Purpose

`triggers` owns scheduled wakeups for registered module actions.

It stores materialized trigger registrations, creates due occurrences, claims
work with leases, dispatches ordinary module procedures, and publishes trigger
runtime events while hiding clock reconciliation, duplicate prevention, and
dispatch retry mechanics.

Pipeline automation policy and materialized pipeline definitions live in
`pipelines`. `triggers` only stores the compiled registration needed to wake
`pipelines.runTriggered`.

## Goals

- Store materialized trigger registrations from owner modules.
- Create deterministic occurrences for due periodic schedules.
- Dispatch ordinary module procedures when occurrences are due.
- Persist enough state to avoid duplicate dispatches across restarts.
- Keep action execution, action input semantics, and target run lifecycle in the
  target module.
- Let `pipelines` register schedules for policy-owned named pipeline runs.

## Non-Goals

- Do not store pipeline YAML.
- Do not validate pipeline node definitions.
- Do not inspect action input beyond JSON safety.
- Do not own LLM runs, data writes, or Telegram reads.
- Do not own policy semantics for scheduled pipelines.

## Ubiquitous Language

- `TriggerRegistration`: one materialized schedule entry stored by `triggers`.
- `RegistrationOwner`: the module and owner key that compiled the registration.
- `TriggerCondition`: the condition that decides when a registration becomes due.
- `TriggerAction`: the module procedure call requested by a registration.
- `RegistrationKey`: stable identity for one trigger registration.
- `Schedule`: the time condition inside a trigger registration.
- `Occurrence`: one due firing of one trigger registration.
- `OccurrenceKey`: stable idempotency key for `registrationKey + scheduledAt`.
- `ActionProvider`: a regular module procedure target invoked by `triggers`.
- `Dispatch`: one attempt to call an action provider for one occurrence.
- `DispatchResult`: the provider response that says whether the call was
  accepted or rejected.
- `Lease`: a temporary claim that lets one worker dispatch one occurrence.

## Boundary Contract

`triggers` owns:

- trigger registration storage;
- periodic schedule computation;
- occurrence identity and idempotency;
- occurrence lifecycle;
- dispatch claims and leases;
- module procedure routing by action target;
- dispatch retry for transport or protocol failures;
- trigger events.

Related ownership:

- `pipelines` owns `PipelineAutomationRule` policy, materialized pipeline
  documents, schedule compilation, pipeline run lifecycle, and
  `pipelines.runTriggered`.
- Target modules own procedure input validation, execution lifecycle, data
  writes, read models, and module events after accepting an action call.
- Gateway owns external protocol compatibility.
- Dashboard owns shell behavior and user interaction state.

## Registration Contract

Owner modules replace their own registration set:

```ts
type ReplaceRegistrationsInput = {
  owner: {
    module: string;
    key: string;
  };
  registrations: readonly TriggerRegistrationInput[];
};
```

Registration input:

```ts
type TriggerRegistrationInput = {
  name: string;
  condition: TriggerCondition;
  action: TriggerAction;
};

type TriggerCondition = {
  everySeconds: number;
  kind: 'periodic';
  startAt?: string;
};

type TriggerAction = {
  input: JsonValue;
  module: string;
  procedure: string;
};
```

Example registration compiled by `pipelines` from a `PipelineAutomationRule`:

```yaml
owner:
  module: pipelines
  key: subcreativeUnreadSummary
registrations:
  - name: schedule
    condition:
      kind: periodic
      everySeconds: 86400
    action:
      module: pipelines
      procedure: runTriggered
      input:
        pipelineName: subcreativeUnreadSummary
        triggerName: schedule
```

The registration key is stable for `owner.module + owner.key + name`. Updating a
registration updates the same trigger registration. Removing a registration
stops future occurrence creation for that key.

Registration updates affect occurrences created after the update. Existing
occurrences keep their stored action payload snapshots. Removing a registration
cancels existing `scheduled` and `retryWaiting` occurrences for that registration
key; claimed, dispatching, accepted, rejected, cancelled, and failed occurrences
keep their stored snapshots.

## Action Provider Contract

An action provider is a regular module procedure target.

`triggers` calls the target module procedure from the registration action:

```ts
type TriggeredActionInput = {
  actionInput: JsonValue;
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

`actionInput` is the opaque JSON payload stored in `TriggerAction.input`.

Provider result:

```ts
type TriggeredActionResult =
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

After `accepted`, the target module owns execution. After `rejected`,
`triggers` records a terminal rejected occurrence. Transport and protocol
failures before a provider result remain dispatch failures and can retry the
same occurrence.

## Public Contract

Internal procedures:

```ts
type ReplaceRegistrationsOutput = {
  registrations: TriggerRegistrationView[];
};

type ListTriggerRegistrationsInput = {
  owner?: {
    module: string;
    key?: string;
  };
};

type ListTriggerRegistrationsOutput = {
  registrations: TriggerRegistrationView[];
};

type ListOccurrencesInput = {
  registrationKey?: string;
  status?: TriggerOccurrenceStatus;
};

type RunDueTriggersOutput = {
  claimed: number;
  dispatched: number;
};
```

`RunDueTriggersOutput` is an operational procedure for development, tests, and
runtime loops.

`listTriggerRegistrations` returns current active registrations. Historical
occurrence snapshots remain queryable through `listOccurrences`.

## Occurrence Lifecycle

Allowed occurrence states:

```text
scheduled
claimed
dispatching
accepted
rejected
retryWaiting
failed
cancelled
```

Transitions:

- `scheduled -> claimed`
- `claimed -> dispatching`
- `dispatching -> accepted`
- `dispatching -> rejected`
- `dispatching -> retryWaiting`
- `retryWaiting -> claimed`
- `scheduled -> cancelled`
- `retryWaiting -> cancelled`
- any non-terminal dispatch-owned state -> `failed`

Terminal states:

- `accepted`
- `rejected`
- `failed`
- `cancelled`

Rules:

- `OccurrenceKey` is deterministic for one registration identity and scheduled
  time.
- A stored occurrence is the idempotency proof that the scheduled firing exists.
- At most one worker may hold the active lease for an occurrence.
- Reclaiming an expired lease reuses the stored occurrence.
- Accepted and rejected provider results are terminal for `triggers`.
- Dispatch retry limits apply to transport and protocol failures.

## Scheduling Semantics

The first condition kind is periodic.

`everySeconds` is a positive integer. `startAt` anchors the first possible
occurrence when present. Without `startAt`, the runtime anchors scheduling at
the first time the registration identity is stored. Registration updates keep
the stored anchor unless the registration identity changes or a new `startAt` is
provided.

The scheduler reconciles active registrations into due occurrences. Missed
periods after downtime are bounded by explicit `triggers` lookback
configuration.

## Storage Model

The first implementation stores:

- registration key;
- owner module and owner key;
- registration name;
- schedule definition;
- schedule anchor timestamp;
- action module, procedure, and input snapshot;
- occurrence key;
- scheduled timestamp;
- occurrence status;
- lease owner and lease expiration;
- dispatch attempt count;
- next dispatch attempt timestamp;
- provider run id when accepted;
- rejection or failure code;
- timestamps.

## Event Contract

`triggers` publishes live events:

- `triggers.registration.changed`
- `triggers.occurrence.scheduled`
- `triggers.occurrence.dispatching`
- `triggers.occurrence.accepted`
- `triggers.occurrence.rejected`
- `triggers.occurrence.retryWaiting`
- `triggers.occurrence.failed`

Event payloads may include:

- occurrence id;
- registration key;
- registration name;
- registration owner;
- registration operation: `upserted` or `removed`;
- action module and procedure;
- scheduled timestamp;
- occurrence status;
- provider run id when accepted;
- failure code;
- timestamps.

Events are live facts. Consumers recover state through `triggers` read
procedures and target-module read procedures.

## Observability

`triggers` emits bounded domain metrics:

- `triggers.registrations`: current durable registration count.
- `triggers.occurrences`: current durable occurrence count by
  `trigger.occurrence.status`.
- `triggers.due_occurrences`: occurrences due for dispatch now.
- `triggers.oldest_due_age`: age in seconds of the oldest due occurrence.
- `triggers.occurrences.created`: occurrences created by reconciliation.
- `triggers.dispatches`: dispatch results by `trigger.dispatch.result`.
- `triggers.runtime.duration`: reconcile and run-due runtime duration by
  `trigger.runtime.operation`.
- `triggers.dispatch.duration`: dispatch call duration.

Metric labels must not include registration keys, owner keys, occurrence keys,
pipeline names, run ids, action inputs, or trigger names.

Operator path:

- AgentG Dashboard: `/telemetry/triggers`
- Grafana dashboard UID: `agentg-triggers`
- Jaeger service: `triggers`

The dashboard must show registrations, due occurrences, oldest due age,
occurrences by status, occurrence creation, dispatch result volume, runtime
latency, dispatch latency, RPC call rate, and Postgres p95.

## File Structure Constraints

Target package ownership:

```text
packages/triggers/
  src/
    module.ts
    client.ts
    config.ts
    dispatcher/
    events.ts
    occurrences/
    registrations/
    scheduler/
    schema.ts
  drizzle/
  tests/
```

The package root exports a typed internal client when another current package
imports it.

## Test Contract

- Registration replacement is scoped by owner.
- Replacing one owner's registrations does not affect another owner's
  registrations.
- `condition.kind: periodic` is accepted with a positive integer
  `everySeconds`.
- Invalid schedule forms are rejected.
- `action.module`, `action.procedure`, and `action.input` are required.
- `action.input` remains opaque to `triggers` after JSON validation.
- The registration key is stable for `owner + name`.
- A registration with `startAt` uses `startAt` as the schedule anchor.
- A registration without `startAt` stores the first registration time as the
  schedule anchor.
- Updating a registration updates the same registration.
- Updating a registration without a new `startAt` keeps the stored schedule
  anchor.
- Updating a registration with a new `startAt` replaces the stored schedule
  anchor.
- Removing a registration stops future occurrence creation for that key.
- Removed registrations cancel existing `scheduled` and `retryWaiting`
  occurrences for the removed registration.
- Claimed, dispatching, accepted, rejected, failed, and cancelled occurrences
  keep their stored action payload snapshots after registration updates.
- Existing `scheduled` and `retryWaiting` occurrences keep their stored action
  payload snapshots after registration updates that do not remove the
  registration.
- Periodic scheduling creates one deterministic occurrence per due period.
- `OccurrenceKey` is stable for `registrationKey + scheduledAt`.
- Reconciliation does not create duplicate occurrences for an existing
  occurrence key.
- Missed periods after downtime are bounded by `triggers` lookback
  configuration.
- Only one worker can hold an active occurrence lease.
- Expired leases can be reclaimed.
- Provider `accepted` stores provider run id and makes the occurrence terminal
  for `triggers`.
- Provider `rejected` stores the rejection code and makes the occurrence
  terminal for `triggers`.
- Transport failures retry the same occurrence until the retry limit is reached.
- Transport failures move the occurrence to `failed` after the retry limit is
  reached.
- Terminal occurrences are never dispatched again.
- `RunDueTriggersOutput` reports claimed and dispatched counts from the current
  run only.
- Trigger occurrence events are published for scheduled, dispatching, accepted,
  rejected, retry waiting, and failed transitions.
- Consumers can recover trigger state through read procedures after live event
  loss.
- A compiled pipeline registration dispatches `pipelines.runTriggered` with the
  policy-owned pipeline name and trigger name.
- Trigger telemetry records registration count, occurrence state, due backlog,
  oldest due age, occurrence creation, dispatch result, runtime duration, and
  dispatch duration without registration keys, owner keys, occurrence keys,
  pipeline names, run ids, action inputs, or trigger names as metric labels.
- `/telemetry/triggers` embeds the `agentg-triggers` Grafana dashboard for
  operator readback.

## Implementation Sequence

1. Add registration storage and replacement scoped by owner.
2. Add periodic schedule reconciliation into occurrences.
3. Add occurrence claiming and lease recovery.
4. Add dispatcher for module procedures.
5. Add events and read procedures.
6. Connect `pipelines` schedule registration.
