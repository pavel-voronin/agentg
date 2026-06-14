# Policy Service Contract

## Purpose

`policies` gives the external agent/operator edge one API for changing active
behavior declarations. Modules get `usePolicy(...)`, which returns a getter for
the current policy body without metadata, YAML, RPC, subscriptions, or file
paths.

Policies are a framework infrastructure capability. They are not part of the
Telegram, History Sync, Dashboard, or any other domain module.

## Goal

Build a central policy mechanism that:

- stores active YAML instances;
- validates `spec` with `zod` forms declared by modules;
- resolves all active instances into a policy value;
- notifies running modules when a policy value changes;
- hides storage, YAML parsing, RPC, and events from domain code;
- gives developers a small surface: `definePolicy(...)` and `usePolicy(...)`.

## Non-goals

- Do not build an audit storage for changes. Logs are enough for the first
  slice.
- Do not add metrics or Dashboard UI before the contract stabilizes.
- Do not use a database store as the first storage adapter.
- Do not add policy APIs inside domain modules.
- Do not apply policy changes to already running jobs.

## Decisions

- Source of truth: YAML instances in `PolicyStore`.
- Catalog: the generated catalog belongs to the endpoint composition layer, not
  framework source.
- Resolve: policy values are resolved server-side before store writes.
- Consumption: modules read only policy values through `usePolicy(...)`.
- Runtime value: `usePolicy(...)` returns a stable getter for the current
  readonly snapshot.
- Empty store: active set `[]` is passed into the resolver.
- Endpoint: the control API changes instances, and the execution API returns
  resolved values.

## Invariants

- Raw YAML exists only at the store/endpoint input boundary. After parsing, the
  system works with `PolicyDocument`.
- Resolvers receive only valid `spec` values, without `metadata`.
- `metadata` is used for identity, search, ordering, and control-plane
  operations.
- Store mutation happens only after successful validation and resolve.
- Consuming modules receive only policy values.
- Policy values must be JSON-serializable top-level plain objects or arrays.

## Ownership

Client and server implementation for policies lives in the framework.

```text
@agentg/framework/policies
  definePolicy(...)
  usePolicy(...)
  resolver helpers
  policy procedure names
  policy wire types
  createPolicyServer(...)
  createPolicyClient(...)

@agentg/policies
  endpoint process composition
  generated catalog integration
  file store adapter
```

`@agentg/policies` is not a domain module and does not contain module DX. It
exists only as the endpoint process, composition entrypoint, and storage adapter.
The generic contract, wire types, procedure names, client, and server live in
the framework; the endpoint process calls the framework factory.

The generated catalog must not live inside framework source if it imports module
policy entrypoints. The catalog belongs to the composition layer:

```ts
createPolicyServer({ catalog, store });
```

Modules import policy DX from the framework subpath:

```ts
import { collectSpecs, definePolicy, recordBy } from '@agentg/framework/policies';
```

Root exports stay minimal. Policy helpers must not widen the package root unless
there is a current external consumer that needs that public entrypoint.

## Core Tension

The external agent needs small independent YAML declarations, while module code
needs a simple current object or array that behaves like normal TypeScript data.

The policy server stores and validates instances, resolves them into the final
policy value, and `usePolicy(definition)` returns a getter for that value to the
consuming module.

## How It Works

1. A module declares `definePolicy(...)`: `kind`, `moduleId`, `version`, a `zod`
   `spec` form, and an optional resolver.
2. The build-time catalog collects definitions from modules.
3. The composition layer starts the endpoint and passes the catalog into the
   framework: `createPolicyServer({ catalog, store })`.
4. The external agent/operator edge creates, updates, or deletes a YAML instance
   through the single policy endpoint.
5. The policy server finds the definition by `kind`.
6. The policy server validates the changed document `spec`.
7. The policy server builds the next active set for this `kind`.
8. The policy server runs the resolver for the whole active set.
9. If validation or resolve fails, the document is not saved.
10. If a new policy value is resolved, the server stores the document and
    publishes `policies.instances.changed`.
11. `usePolicy(definition)` receives the event and refetches the resolved policy
    value.
12. Module code calls the getter and reads the object or array returned by the
    resolver.

Document metadata does not reach the consuming module: the module has already
selected a concrete policy definition.

## PolicyDefinition

The definition lives in the module that owns the meaning of the policy.

```ts
// packages/foobar/policies/policies.ts
import { z } from 'zod';
import { collectSpecs, definePolicy } from '@agentg/framework/policies';

export const foobarRulesPolicy = definePolicy({
  id: 'foobar.rules',
  kind: 'FoobarRule',
  moduleId: 'foobar',
  version: 1,

  spec: z.object({
    target: z.string(),
    mode: z.enum(['enabled', 'disabled']),
    limit: z.number().int().positive().nullable()
  }),

  resolve: collectSpecs()
});

export const foobarSettingsPolicy = definePolicy({
  id: 'foobar.settings',
  kind: 'FoobarSetting',
  moduleId: 'foobar',
  version: 1,

  spec: z.object({
    key: z.string(),
    value: z.string()
  }),

  resolve(specs) {
    return Object.fromEntries(specs.map((spec) => [spec.key, spec.value]));
  }
});

export const policies = [foobarRulesPolicy, foobarSettingsPolicy] as const;
```

### Definition Fields

`id` is the stable developer-facing definition id. It is used for the catalog,
diagnostics, form metadata, and definition uniqueness. It is not a YAML instance
identity.

`kind` is the policy document type. YAML instances use it to bind to a
`PolicyDefinition`. It is the primary key for validator and resolver selection.

`moduleId` is the owner of the policy meaning. It is used for discovery,
filtering, ownership, and event routing. It is not a domain API for that module.

`version` is the contract version for this `kind`'s `spec` and resolver. It is
used for catalog diagnostics and form cache invalidation.

`spec` is the `zod` form for the YAML document body. It provides validation and
the TypeScript `Spec` type.

`resolve` is a plain function that builds the final policy value from all valid
`spec` values. The policy value type is inferred from its return type.
TypeScript requires a top-level object or array, and the framework checks at
runtime that the result is JSON-safe.

The policy entrypoint must be pure: no database, events, TDLib, module setup,
RPC clients, or other side effects.

## Resolver Helpers

A resolver builds the final policy value from all active `spec` values of one
`kind`.

If `resolve` is omitted, the framework uses the default resolver:

```ts
resolve: collectSpecs();
```

`collectSpecs` returns all `spec` values in deterministic order. Infrastructure
defines the base order by `metadata.name`. If a policy needs priority, priority
must be a `spec` field, not `metadata`.

The initial helpers are plain resolver functions:

```ts
collectSpecs();
recordBy((spec) => spec.key);
singleSpec({ empty: emptySpec });
```

`recordBy` rejects duplicate keys as resolver errors. `singleSpec` returns the
only `spec`, uses `empty` for `[]`, and rejects more than one instance as a
resolver error.

Custom resolvers are allowed:

```ts
resolve(specs) {
  return Object.fromEntries(specs.map((spec) => [spec.key, spec.value]));
}
```

Generic YAML merge is forbidden. Each `kind` owns its own composition semantics
through its resolver.

The resolver runs on the policy server. This means:

- invalid composition never reaches the store;
- `setInstance` gives the external agent an honest answer about whether the
  policy is applicable;
- all consumers receive the same policy value;
- `usePolicy` remains a live-cache adapter;
- the resolver must be pure and deterministic.

If a module needs a richer helper, it builds that helper locally on top of the
plain policy value.

## PolicyInstance

One active YAML document. It is not an intention log; it is the current
declarative state.

```yaml
apiVersion: agentg.dev/v1
kind: FoobarRule
metadata:
  name: alphaEnabled
  labels:
    area: demo
spec:
  target: alpha
  mode: enabled
  limit: 10
```

### Instance Fields

`apiVersion` is the envelope format version for the policy document. It is not
the domain `spec` version. The first contract is `agentg.dev/v1`.

`kind` selects the `PolicyDefinition`. The value must match `definition.kind`.

`metadata` is the service envelope for storage and control-plane operations. It
does not reach `usePolicy`.

`metadata.name` is the instance name inside `kind`. Together with `kind`, it
forms identity: `kind + metadata.name`.

`metadata.labels` is the control-plane taxonomy for search, filtering, and UI.
It does not reach the policy value.

Labels are `Record<string, string>`. Keys must be camelCase, and values must be
non-empty strings.

`spec` is the policy body. It is validated with `definition.spec` and passed
into the resolver.

Identity rules:

- `kind + metadata.name` must be unique in the whole store;
- `metadata.name` must be a camelCase stem compatible with a file name;
- the file adapter stores the document at the canonical path derived from
  identity;
- path/identity mismatch at startup is a store error;
- duplicate identity at startup is a store error.

## Policy Value

Policy value is what the `usePolicy` getter returns.

For `foobarRulesPolicy` with the default resolver:

```ts
const getRules = usePolicy(foobarRulesPolicy);
```

`getRules` is typed as:

```ts
() => readonly {
  target: string;
  mode: 'enabled' | 'disabled';
  limit: number | null;
}[]
```

For `foobarSettingsPolicy` with a custom resolver:

```ts
const getSettings = usePolicy(foobarSettingsPolicy);
```

`getSettings` is typed as:

```ts
() => Readonly<Record<string, string>>;
```

Domain code does not receive `apiVersion`, `kind`, `metadata`, `moduleId`, or
`policyId`, because it is already operating inside a concrete policy.

An empty valid store is a valid state:

- `collectSpecs()` returns an empty readonly array;
- custom resolvers receive `[]`;
- if a policy cannot operate without an instance, the custom resolver must throw
  explicitly for `[]`.

## Endpoint API

The generic endpoint contract is defined in `@agentg/framework/policies`.
`@agentg/policies` exposes that contract as an infrastructure endpoint.

There are two distinct surfaces:

- control API: called only by the external agent/operator edge to manage policy
  instances;
- execution API: called by the framework policy client to read resolved policy
  values for modules.

Domain modules do not call the policy endpoint directly and never edit their
own policies.

### Control API

```ts
listPolicyKinds(): readonly PolicyKindDescriptor[];
listInstances(input: { kind?: string; moduleId?: string; labels?: Record<string, string> }): readonly PolicyDocument[];
getInstance(input: PolicyIdentity): PolicyDocument;
setInstance(input: { document: PolicyDocument }): PolicyMutationResult;
deleteInstance(input: PolicyIdentity): PolicyMutationResult;
```

`listPolicyKinds()` returns `kind`, `moduleId`, `version`, `id`, and `form`. It
does not return resolver functions or module-local types.

`setInstance` validates the document with `spec`, builds the next active set,
runs the resolver, and only then stores the document. `deleteInstance` does the
same for the active set without the deleted document.

`setInstance` and `deleteInstance` are single-instance operations in the first
slice. Batch update is not part of the first contract.

### Execution API

```ts
getPolicyValue(input: { kind: string }): PolicyValue;
```

`getPolicyValue({ kind })` returns the resolved policy value for framework
`usePolicy(...)`.

### Wire Types

```ts
type JsonValue =
  | null
  | boolean
  | number
  | string
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };
type PolicyValue = readonly JsonValue[] | { readonly [key: string]: JsonValue };

type PolicyIdentity = { kind: string; name: string };

type PolicyDocument = {
  apiVersion: 'agentg.dev/v1';
  kind: string;
  metadata: { name: string; labels?: Record<string, string> };
  spec: JsonValue;
};

type PolicyKindDescriptor = {
  id: string;
  kind: string;
  moduleId: string;
  version: number;
  form: { spec: JsonValue; examples?: readonly PolicyDocument[] };
};

type PolicyErrorCode =
  | 'unknown_kind'
  | 'invalid_api_version'
  | 'invalid_document'
  | 'invalid_spec'
  | 'resolver_error'
  | 'non_json_value'
  | 'duplicate_identity'
  | 'path_identity_mismatch'
  | 'store_conflict';

type PolicyError = {
  code: PolicyErrorCode;
  message: string;
  identity?: PolicyIdentity;
  fieldPath?: readonly string[];
};

type PolicyMutationResult =
  | {
      status: 'applied';
      operation: 'set' | 'delete';
      identity: PolicyIdentity;
      policyValueChanged: boolean;
    }
  | {
      status: 'rejected';
      operation: 'set' | 'delete';
      identity?: PolicyIdentity;
      policyValueChanged: false;
      error: PolicyError;
    };
```

`PolicyMutationResult` is the direct command result, not a compatibility
envelope. Transport/protocol failures stay RPC errors; expected policy contract
rejections return `status: 'rejected'`.

## Failure Model

- Invalid mutation returns `status: 'rejected'` and does not change the store.
- Transport/protocol failures return RPC errors.
- Before opening the endpoint, the policy server loads the store, validates
  instances, and resolves the policy value for every known `kind`.
- Policy server startup fails on unreadable file, invalid YAML, unknown kind,
  invalid spec, resolver error, duplicate identity, or path/identity mismatch.
- Consumer startup does not fail because there are no initial instances.
- Consumer startup fails when the endpoint is unavailable or `getPolicyValue`
  fails.
- After successful startup, `usePolicy` keeps the last-good value on refetch
  failure.
- Event publish failure does not roll back an already applied store write. The
  result stays `applied`, the error is logged, and consumers refresh after the
  next successful event or restart.

## Module Consumption API

A module receives the current policy body through `usePolicy(definition)`.
Domain code does not create `policiesClient`, does not subscribe to events, does
not read YAML, and does not run the resolver.

```ts
// packages/foobar/src/module.ts
import { foobarRulesPolicy, foobarSettingsPolicy } from '../policies/policies.js';

export const foobarModule = defineModule('foobar', {
  config: readConfig,

  setup({ resource, usePolicy }) {
    const getRules = usePolicy(foobarRulesPolicy);
    const getSettings = usePolicy(foobarSettingsPolicy);

    const foobar = resource('foobar', () =>
      createFoobar({
        getRules,
        getSettings
      })
    );

    return {
      getFoobar: getFoobarProcedure({ foobar })
    };
  }
});
```

In domain code, the value looks like a normal object or array:

```ts
// packages/foobar/src/foobar.ts
type FoobarOptions = {
  getRules: () => readonly FoobarRuleSpec[];
  getSettings: () => Readonly<Record<string, string>>;
};

export function createFoobar(options: FoobarOptions) {
  return {
    modeFor(target: string): 'enabled' | 'disabled' {
      return options.getRules().find((rule) => rule.target === target)?.mode ?? 'disabled';
    },

    setting(key: string): string | undefined {
      return options.getSettings()[key];
    }
  };
}
```

`usePolicy` returns a live getter: the function identity is stable, and every
call reads the current policy snapshot. After an update, the next `getRules()`
or `getSettings()` call sees new data.

The first slice supports only object/array policy values. A saved getter result
is a snapshot; call the getter again to observe an update. Snapshots are
readonly, and runtime mutation is rejected through frozen values.

`usePolicy(definition)` contract:

- returns a getter of type `() => PolicyValueOf<typeof definition>`;
- with omitted `resolve`, that type matches the result of `collectSpecs()`;
- reading before successful startup throws a development error;
- registers a startup process in framework module setup;
- calls `getPolicyValue({ kind })` on startup;
- calls `getPolicyValue({ kind })` again on update;
- atomically replaces the latest snapshot;
- keeps the last-good value and logs on update/refetch error;
- does not recompute already running jobs.

## Update Delivery

`policies.instances.changed` does not contain the instances or the policy value.

```ts
type PolicyInstancesChanged = {
  kind: string;
  moduleId: string;
};
```

On this event, `usePolicy(definition)`:

1. ignores events for another `kind`;
2. calls `getPolicyValue({ kind: definition.kind })`;
3. atomically replaces the latest snapshot.

If refetch fails, `usePolicy` keeps the last-good value, logs the error, and
does not fail the consumer after successful startup. The event bus is not the
source of truth. After restart, the module always gets the current policy value
from the endpoint.

## PolicyStore

Persistent instance storage. The first adapter is file-based:

```text
config/policies/foobar-rule/alphaEnabled.yaml
config/policies/foobar-rule/betaDisabled.yaml
```

The file structure is for humans and the adapter only. APIs must query by
`kind`, `moduleId`, `metadata.name`, and `labels`, not by path.

Adapter contract:

```ts
type PolicyStore = {
  loadAll(): Promise<readonly PolicyDocument[]>;
  set(document: PolicyDocument): Promise<void>;
  delete(identity: PolicyIdentity): Promise<void>;
};
```

The file adapter:

- writes only the canonical path;
- replaces files atomically through a temp file in the same directory and
  rename;
- cleans unfinished temp files on startup;
- deletes by identity, not by arbitrary path;
- does not expose a path-based API.

## Discovery Definitions

Definitions are declared in modules:

```text
packages/telegram/policies/policies.ts
packages/history-sync/policies/policies.ts
packages/foobar/policies/policies.ts
```

The catalog is generated at build time from `packages/*/policies/policies.ts`.
The generated catalog belongs to the composition layer:

```text
packages/policies/src/generated/policyCatalog.ts
```

Generated catalog files are not edited by hand. The catalog imports only policy
entrypoints, not package roots of domain modules and not module runtime or
resources.

The composition layer starts the endpoint:

```ts
createPolicyServer({ catalog, store });
```

Catalog invariants:

- `definition.id` must be globally unique;
- `definition.kind` must be globally unique;
- duplicate definitions fail policy server construction/startup.

## How to Add a New Policy

This is a runbook for the executor that introduces a new policy into an
existing module.

1. Find the domain decision that is currently hardcoded and must become
   configurable. The policy must affect only new operations; do not reconnect
   already running work.
2. Create or update `packages/<module>/policies/policies.ts`.
3. Declare `definePolicy(...)`:
   - `id`: stable developer-facing id, for example `foobar.rules`;
   - `kind`: UpperCamelCase document kind, for example `FoobarRule`;
   - `moduleId`: kebab-case id of the owning module;
   - `version`: `spec` contract version;
   - `spec`: `zod` form for the YAML document body;
   - `resolve`: pure resolver if default `collectSpecs()` is not enough.
4. Export the definition and the `policies` array from that file:

```ts
export const foobarRulesPolicy = definePolicy({
  id: 'foobar.rules',
  kind: 'FoobarRule',
  moduleId: 'foobar',
  spec: foobarRuleSpec,
  version: 1
});

export const policies = [foobarRulesPolicy] as const;
```

5. Add initial YAML instances to `config/policies/<kebab-kind>/<name>.yaml`. For
   `FoobarRule`, the canonical directory is `config/policies/foobar-rule`.
   `metadata.name` must match the file name without `.yaml`.

```yaml
apiVersion: agentg.dev/v1
kind: FoobarRule
metadata:
  name: alphaEnabled
  labels:
    area: demo
spec:
  target: alpha
  mode: enabled
```

6. Run `npm run policies:generate`. Do not edit the generated catalog by hand.
7. In module setup, get a getter through `usePolicy(definition)` and pass it
   into the domain resource/service:

```ts
setup({ resource, usePolicy }) {
  const getRules = usePolicy(foobarRulesPolicy);

  const foobar = resource('foobar', () =>
    createFoobar({
      getRules
    })
  );

  return {
    getFoobar: getFoobarProcedure({ foobar })
  };
}
```

8. In domain code, read only the getter. Do not create `policiesClient`, do not
   subscribe to policy events manually, do not read YAML, and do not run the
   resolver in the consuming module.
9. For live updates, the external agent/operator edge calls the policy endpoint
   control API: `setInstance` or `deleteInstance`. Domain modules must not call
   these procedures. Manual YAML edits are startup input and are picked up on
   the next policy endpoint start.
10. Add tests:
    - resolver rejects conflicting or invalidly composed specs;
    - consumer behavior is driven through the getter;
    - initial YAML instance passes catalog/store startup when new config is
      added.
11. Verify the slice:
    - `npm run policies:generate`;
    - `npm run check:policies`;
    - `npm run check:<module>` for the consuming module;
    - `npm run check:modules` before full integration.

## First Consumer

The first consumer is Telegram files: policy value replaces hardcoded rule
tables, while safety checks and behavior selection rules stay in domain code.

## Application Rules

- Policy changes affect only new operations.
- Invalid updates do not change the active policy value.
- Logs record applied and rejected changes.
- Mutations run sequentially.

## First Implementation Slice

1. Add `packages/framework/src/policies/**`: `definePolicy`, resolver helpers,
   `createPolicyServer`, `createPolicyClient`, and `usePolicy` integration.
2. Add `packages/policies`: endpoint process, composition entrypoint, and
   generated catalog.
3. Implement file-based `PolicyStore`.
4. Add the build-time generator for `packages/*/policies/policies.ts`.
5. Add `@agentg/framework/policies` subpath export.
6. Add `usePolicy(definition)` to framework module setup.
7. Move the first hardcoded rules into YAML instances.
8. Connect `usePolicy(...)` in the first consuming module.

## Test Contract

- invalid YAML/spec does not change active instances;
- resolver error does not change active instances;
- non-JSON policy value is rejected as `non_json_value`;
- duplicate identity fails policy server startup;
- duplicate `definition.id` or `definition.kind` fails policy server
  construction/startup;
- path/identity mismatch fails the startup file adapter;
- `setInstance` and `deleteInstance` return `status: 'rejected'` with
  structured `PolicyError` for expected rejections;
- read procedures return RPC/contract errors for invalid input or unknown kind;
- `setInstance` validates spec and resolver before write;
- `deleteInstance` validates resolver before delete;
- rejected mutation returns `status: 'rejected'` and does not change the store;
- `setInstance` writes the canonical path atomically;
- `listInstances({ kind })` returns valid active instances;
- `getPolicyValue({ kind })` returns resolved policy value;
- event contains only `{ kind, moduleId }`;
- `usePolicy(definition)` refetches policy value on event;
- `usePolicy(definition)` returns getter `() => PolicyValueOf<typeof definition>`;
- `usePolicy(definition)` keeps getter identity after update;
- getter returns latest snapshot after update;
- refetch failure keeps last-good value;
- foreign event is ignored;
- omitted `resolve` uses `collectSpecs()`;
- empty store gives an empty array for `collectSpecs()`;
- empty store calls custom resolver with `[]`;
- `recordBy` rejects duplicate key;
- `singleSpec` rejects more than one instance;
- reading policy value before successful startup throws a development error;
- consumer startup does not fail without initial instances;
- missing policies endpoint fails startup/configuration;
- domain code does not create `policiesClient` and does not subscribe to policy
  events manually;
- consuming module does not parse YAML, does not know file paths, and does not
  run the resolver.
