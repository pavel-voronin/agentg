# Policies

## Purpose

`policies` owns the external control API, policy document storage, policy
definition catalog, document validation, resolved policy values, and policy
update events.

Modules define policy `spec` schemas. `policies` validates a document `spec`
through the owning module definition and handles the document envelope,
metadata, storage, and value distribution through the framework contract.

Module-owned `spec` semantics and execution behavior stay in the module that
consumes the resolved policy value.

## Goals

- Keep one external API for creating, updating, reading, and deleting policy
  documents.
- Store active policy documents as the source of truth.
- Validate policy document envelopes, metadata, and module-owned `spec` bodies
  before accepting changes.
- Resolve active documents of one `kind` into the policy value read by modules.
- Publish policy change events after accepted mutations.
- Keep module `spec` semantics inside the module that defines the policy kind.
- Keep execution behavior in the module that consumes the policy value.

## Ubiquitous Language

- `PolicyDocument`: one active declarative behavior document.
- `PolicyEnvelope`: the framework-owned document fields around `spec`.
- `PolicyMetadata`: management data used for identity, labels, search, and
  control-plane operations.
- `PolicySpec`: the module-owned body of a policy document.
- `PolicyDefinition`: the module-owned definition of one `kind`, including
  module id, version, `zod` spec form, examples, and resolver.
- `PolicyStore`: persistent document storage. The first adapter is file-based.
- `PolicyValue`: the resolved JSON-safe value returned to `usePolicy(...)`.

## Policy Document

Policy documents have framework-owned root fields and a module-owned `spec`:

```ts
type PolicyDocument = {
  apiVersion: 'agentg.dev/v1';
  kind: string;
  metadata: PolicyMetadata;
  spec: JsonValue;
};

type PolicyMetadata = {
  labels?: Record<string, string>;
  name: string;
};
```

`apiVersion`, `kind`, and `metadata` are framework-owned fields. `spec` is
owned by the module definition selected by `kind`.

`kind + metadata.name` is the stable policy identity. The file adapter stores
documents at the canonical path derived from that identity.

`metadata` is for policy management: identity, labels, search, filtering, UI,
and diagnostics.

Example:

```yaml
apiVersion: agentg.dev/v1
kind: ExampleRule
metadata:
  name: example
  labels:
    area: local
spec:
  enabled: true
```

For this example, `policies` validates only the document envelope and delegates
`spec` validation to the `ExampleRule` definition owned by its module.

## Policy Definition

The definition lives in the module that owns the meaning of `spec`.

```ts
export const exampleRulePolicy = definePolicy({
  id: 'example.rule',
  kind: 'ExampleRule',
  moduleId: 'example',
  spec: exampleRuleSpec,
  version: 1,
  resolve: collectSpecs()
});
```

Definition fields:

- `id`: stable developer-facing definition id.
- `kind`: policy document kind selected by `PolicyDocument.kind`.
- `moduleId`: owner of the policy `spec` semantics.
- `version`: contract version for the `spec`.
- `spec`: `zod` form for `PolicyDocument.spec`.
- `resolve`: pure function that turns active valid instances into the resolved
  policy value.

Policy definitions stay pure. They declare shape and resolution rules. Runtime
resources, databases, RPC clients, event subscriptions, TDLib, trigger clients,
and file system access stay outside policy definitions.

## Validation And Storage

Mutation flow:

1. Parse the policy document envelope.
2. Validate `apiVersion`, `kind`, and `metadata`.
3. Find the `PolicyDefinition` by `kind`.
4. Validate `spec` with the definition's `zod` form.
5. Build the next active document set for that `kind`.
6. Resolve the next policy value for that `kind`.
7. Store the document change in `PolicyStore`.
8. Publish `policies.instances.changed`.

The file store is the source of truth for active policy documents. Derived
runtime state belongs to the module that consumes the resolved policy value.

Scheduled pipeline automation is policy-owned through
`PipelineAutomationRule`, defined by `pipelines`. The policy document is the
source of truth. `pipelines` consumes the resolved value, validates the
materialized pipeline graph, stores the runtime definition with `source:
policy`, and registers compiled schedules in `triggers`.

Direct `pipelines.setPipeline` remains available as a dev/test escape hatch for
materialized pipeline documents. It is not the main behavior-change path.

## Endpoint API

The generic endpoint contract lives in `@agentg/framework/policies`.
`@agentg/policies` exposes that contract as an infrastructure endpoint.

Control API:

```ts
listPolicyKinds(): readonly PolicyKindDescriptor[];
listInstances(input: { kind?: string; moduleId?: string; labels?: Record<string, string> }): readonly PolicyDocument[];
getInstance(input: PolicyIdentity): PolicyDocument;
setInstance(input: { document: PolicyDocument }): PolicyMutationResult;
deleteInstance(input: PolicyIdentity): PolicyMutationResult;
```

Execution API:

```ts
getPolicyValue(input: { kind: string }): PolicyValue;
```

`setInstance` and `deleteInstance` are serialized mutations.

Mutation result:

```ts
type PolicyMutationResult =
  | {
      identity: PolicyIdentity;
      operation: 'set' | 'delete';
      policyValueChanged: boolean;
      status: 'applied';
    }
  | {
      error: PolicyError;
      identity?: PolicyIdentity;
      operation: 'set' | 'delete';
      policyValueChanged: false;
      status: 'rejected';
    };
```

Expected policy contract failures return `status: 'rejected'`. Transport and
protocol failures stay RPC errors.

## Module Consumption

Modules consume resolved policy values through `usePolicy(definition)` from
module setup:

```ts
setup({ resource, usePolicy }) {
  const getExamples = usePolicy(exampleRulePolicy);

  const service = resource('exampleConsumer', () =>
    createExampleConsumer({
      getExamples
    })
  );

  return {
    getExampleState: getExampleStateProcedure({ service })
  };
}
```

`usePolicy(definition)` returns a stable getter. Every call reads the latest
resolved policy value. The module receives the resolver output only.

When a module needs to reconcile derived runtime state after policy changes, it
uses `usePolicy(definition, { onChange })`. The callback receives the resolved
value after the policy endpoint refetch succeeds. The callback is module-owned:
it may compile registrations, update module storage, or fail startup if current
policy cannot be materialized.

Domain code reads the getter as normal TypeScript data. The policy endpoint,
YAML, file paths, raw events, and resolver execution stay in the policy
framework and endpoint.

## Update Delivery

`policies.instances.changed` is a live notification:

```ts
type PolicyInstancesChanged = {
  kind: string;
  moduleId: string;
};
```

On this event, `usePolicy(definition)` refetches `getPolicyValue({ kind })` and
replaces the local snapshot.

After restart, modules load current resolved values from the endpoint. The event
bus is a wake-up path; the policy store remains the source of truth.

## File Structure

Framework policy contract:

```text
packages/framework/src/policies/
```

Endpoint and file store:

```text
packages/policies/
  src/
    generated/
      policyCatalog.ts
    module.ts
    store.ts
```

Module policy definitions:

```text
packages/<module>/policies/policies.ts
```

Policy instances:

```text
config/policies/<kebab-kind>/<metadata.name>.yaml
```

Generated catalog files are produced from `packages/*/policies/policies.ts`.
They import policy entrypoints only.

## Acceptance Test Contract

A `policies` implementation is accepted only when the feature-owned tests prove
the behavior below.

### Policy Catalog

- The generated catalog includes every policy definition from
  `packages/*/policies/policies.ts`.
- `listPolicyKinds()` returns descriptors for registered definitions.
- Catalog generation imports policy entrypoints only and does not instantiate
  runtime resources.
- Duplicate `kind` values fail catalog construction before the endpoint starts.
- Duplicate policy definition `id` values fail catalog construction before the
  endpoint starts.

### Document Validation

- `setInstance` rejects a document with an unsupported `apiVersion`.
- `setInstance` rejects a document with an unknown `kind`.
- `setInstance` rejects a `Pipeline` document. Durable scheduled pipeline
  automation uses `PipelineAutomationRule`; direct `Pipeline` documents belong
  to the pipelines dev/test procedure surface.
- `setInstance` rejects missing or invalid `metadata.name`.
- `setInstance` validates `spec` through the `PolicyDefinition` selected by
  `kind`.
- A resolver error rejects the mutation before the store changes.
- A resolver output that is not JSON-safe rejects the mutation before the store
  changes.
- A rejected document does not change stored documents, resolved values, or
  published policy events.
- After successful validation, `policies` treats the module-owned `spec` as
  opaque data.

### Mutation And Storage

- `setInstance` stores a new document at the canonical path derived from
  `kind + metadata.name`.
- `setInstance` updates an existing document with the same identity.
- `deleteInstance` removes an existing document and resolves the next value for
  that `kind`.
- `deleteInstance` rejects an unknown `kind`.
- `deleteInstance` for a missing identity with a known `kind` is idempotent and
  returns an applied mutation with no value change.
- Serialized concurrent mutations cannot leave the file store and resolved
  value out of sync.
- A store conflict during `setInstance` or `deleteInstance` returns
  `store_conflict` and does not change the in-memory resolved value.
- Accepted mutations publish `policies.instances.changed` with `kind` and
  `moduleId`.
- Event publish failure does not roll back an accepted mutation.

### Resolved Values

- `getPolicyValue({ kind })` returns the current resolver output for active
  documents of that `kind`.
- `getPolicyValue({ kind })` rejects an unknown `kind`.
- `getInstance` returns the active document for a known identity.
- `getInstance` raises a contract error for a missing identity.
- `listInstances` filters active documents by `kind`, `moduleId`, and `labels`.
- A mutation that changes active instances recomputes the resolver output.
- A mutation that preserves the resolver output reports
  `policyValueChanged: false`.
- `usePolicy(definition)` returns a stable getter.
- The getter reads the latest resolved value after
  `policies.instances.changed`.
- `usePolicy(definition, { onChange })` calls the hook after the initial
  resolved value load and after later policy refetches.
- Modules receive only resolver output, not policy endpoint internals, file
  paths, raw events, or unrelated policy documents.
