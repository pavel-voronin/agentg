# Triggers

## Purpose

`triggers` owns scheduled execution for `TriggerRule` policies.

It consumes the resolved `TriggerRule` policy value, materializes trigger
registrations, persists the trigger runtime state needed to survive restarts,
creates due occurrences, dispatches module procedure calls, and publishes live
trigger facts while hiding clock reconciliation, leases, duplicate prevention,
retries, and scheduler internals.

The first implementation is a periodic schedule runtime.

## Goals

- Define the `TriggerRule` policy kind.
- Keep schedule execution separate from policy document storage.
- Materialize active `TriggerRule` policies into trigger registrations owned by
  `triggers`.
- Create deterministic occurrences for due periodic schedules.
- Dispatch ordinary module procedures when occurrences are due.
- Persist enough state to avoid duplicate dispatches across restarts.
- Keep action execution, artifacts, and action-specific retries in the target
  module procedure.

## Ubiquitous Language

- `TriggerRule`: the policy kind whose `spec` describes one scheduled action.
- `TriggerRuleSpec`: the module-owned body of one trigger rule policy.
- `TriggerCondition`: the condition that decides when a rule becomes due.
- `TriggerAction`: the module procedure call requested by a rule.
- `TriggerRegistration`: one materialized schedule entry stored by `triggers`.
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

### Triggers Boundary

`triggers` owns:

- `TriggerRule` policy definition;
- `TriggerRule` spec validation and resolution;
- trigger registration storage;
- materialization from active `TriggerRule` policies;
- periodic schedule computation;
- occurrence identity and idempotency;
- occurrence lifecycle;
- dispatch claims and leases;
- module procedure routing by action target;
- dispatch retry for transport or protocol failures;
- trigger events;
- trigger observability.

### Related Ownership

- `policies` owns policy document storage, policy definition catalog, document
  validation, resolved policy value distribution, and policy change events.
- Target modules own procedure input validation, execution lifecycle, artifacts,
  read models, and domain events after accepting an action call.
- Gateway owns external protocol compatibility.
- Dashboard owns shell behavior and user interaction state.

## Trigger Rule Policy

`triggers` defines the `spec` shape for `TriggerRule` policy documents:

```ts
type TriggerRuleSpec = {
  action: TriggerAction;
  condition: TriggerCondition;
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

Policy definition:

```ts
export const triggerRulePolicy = definePolicy({
  id: 'triggers.rule',
  kind: 'TriggerRule',
  moduleId: 'triggers',
  spec: triggerRuleSpec,
  version: 1,
  resolve: collectTriggerRules()
});
```

Example:

```yaml
apiVersion: agentg.dev/v1
kind: TriggerRule
metadata:
  name: unreadDigestDaily
  labels:
    area: telegram
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

`policies` stores and validates this document through the `TriggerRule`
definition. `triggers` consumes the resolved value and owns all runtime behavior
created from it.

## Materialized Registration

`triggers` materializes every active `TriggerRule` into one
`TriggerRegistration`.

```ts
type TriggerRegistration = {
  action: TriggerAction;
  key: string;
  rule: {
    kind: 'TriggerRule';
    name: string;
  };
  schedule: TriggerCondition;
};
```

The registration key is stable for the `TriggerRule` policy identity. Updating
a rule updates the same trigger registration. Deleting a rule removes the
registration and stops future occurrence creation for that key.

Registration updates affect new occurrences only. Already claimed, dispatched,
accepted, rejected, cancelled, or failed occurrences keep their stored action
payload snapshots.

On restart, `triggers` loads its stored registrations and occurrence state,
loads the current resolved `TriggerRule` value through `policies`, and
materializes the active rule set.

## Action Provider Contract

An action provider is a regular module procedure target.

`triggers` calls the target module procedure from the registration `action`:

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
the stored anchor unless the registration identity changes or a new `startAt`
is provided.

The scheduler reconciles active registrations into due occurrences. Missed
periods after downtime are bounded by explicit `triggers` lookback
configuration.

## Storage Model

The first implementation stores:

- registration key;
- trigger rule kind and name;
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

`triggers` publishes live, non-durable events:

- `triggers.registration.changed`
- `triggers.occurrence.scheduled`
- `triggers.occurrence.dispatching`
- `triggers.occurrence.accepted`
- `triggers.occurrence.rejected`
- `triggers.occurrence.retryWaiting`
- `triggers.occurrence.failed`

Event payloads may include:

- occurrence id;
- trigger rule name;
- registration key;
- action module and procedure;
- scheduled timestamp;
- occurrence status;
- provider run id when accepted;
- failure code;
- timestamps.

Events are live facts. Consumers recover state through `triggers` read
procedures and target-module read procedures.

## Observability Contract

Allowed low-cardinality labels:

- action module;
- action procedure;
- schedule kind;
- occurrence status;
- failure code;
- dispatch result.

Forbidden high-cardinality labels:

- occurrence id;
- registration key;
- trigger rule name;
- provider run id;
- raw action input;
- raw trigger rule spec;
- Telegram chat id;
- Telegram message id.

Useful signals:

- active registration count;
- due occurrence count;
- claimed occurrence count;
- dispatch latency;
- dispatch attempts;
- accepted, rejected, retry, and failed counts;
- expired lease reclaim count;
- scheduler loop duration.

## File Structure Constraints

Target package ownership:

```text
packages/triggers/
  policies/
    policies.ts
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

## Acceptance Test Contract

A `triggers` implementation is accepted only when the feature-owned tests prove
the behavior below.

### TriggerRule Policy

- `TriggerRule` documents validate through the `triggers` policy definition.
- `condition.kind: periodic` is accepted with a positive integer
  `everySeconds`.
- Invalid schedule forms are rejected by `TriggerRule` spec validation.
- `action.module`, `action.procedure`, and `action.input` are required.
- `action.input` remains opaque to `triggers` after JSON validation.
- The resolved `TriggerRule` policy value contains only active valid rules.

### Registration Materialization

- Every active `TriggerRule` materializes into one stored
  `TriggerRegistration`.
- The registration key is stable for the policy identity.
- Updating a `TriggerRule` updates the same registration.
- Deleting a `TriggerRule` removes its registration and stops future occurrence
  creation for that key.
- Deleting a `TriggerRule` cancels existing `scheduled` and `retryWaiting`
  occurrences for the removed registration.
- Registration updates keep already created occurrence snapshots unchanged.
- Registration updates keep the stored schedule anchor for the same
  registration identity when no new `startAt` is provided.
- A new `startAt` replaces the schedule anchor for future occurrences.

### Scheduling And Occurrence Identity

- Periodic scheduling creates one deterministic occurrence per due period.
- `OccurrenceKey` is stable for `registrationKey + scheduledAt`.
- Reconciliation does not create duplicate occurrences for an existing
  occurrence key.
- Missed periods after downtime are bounded by `triggers` lookback
  configuration.
- Occurrences created before a registration update keep their stored action
  payload snapshot.
- Removed registrations do not create new occurrences.

### Dispatch And Leases

- A lease lets only one worker dispatch an occurrence at a time.
- Expired leases can be reclaimed for the same stored occurrence.
- Dispatch calls the action provider procedure named by `action.module` and
  `action.procedure`.
- Dispatch wraps opaque `action.input` as `actionInput`.
- Dispatch includes trigger provenance and an occurrence idempotency key.
- A provider `accepted` result stores the provider `runId` and makes the
  occurrence terminal.
- A provider `rejected` result stores the rejection code and makes the
  occurrence terminal.
- Unknown `action.module` moves the occurrence to terminal `failed` without
  retry.
- Unknown `action.procedure` moves the occurrence to terminal `failed` without
  retry.
- Invalid provider response moves the occurrence to terminal `failed` without
  retry.
- Transport and protocol failures before a provider result retry the same
  occurrence until the configured retry limit is reached.
- Exhausted retry attempts move the occurrence to `failed`.
- `runDueTriggers` reports the number of claimed and dispatched occurrences for
  the tick.

### Events And Reads

- `triggers.registration.changed` is published for registration changes.
- Occurrence events are published for scheduled, dispatching, accepted,
  rejected, retry-waiting, and failed state changes.
- Event payloads do not expose raw action input.
- Read procedures return current registrations from storage.
- Read procedures return occurrence state from storage after live event loss.
- `listOccurrences` filters occurrence state by `registrationKey` and `status`.

### Restart And Shutdown

- Restart loads stored registrations and occurrences before scheduler
  reconciliation.
- Restart reconciles stored registrations with the current resolved
  `TriggerRule` policy value.
- Restart preserves one existing occurrence per occurrence key.
- Shutdown waits for the active scheduler tick to finish before the module stop
  completes.

### Feature Gate

The scoped verification command for this feature is `npm run check:triggers`.
The dispatch integration gate with a configured action provider is
`npm run integration:triggers-llm-runner`.
