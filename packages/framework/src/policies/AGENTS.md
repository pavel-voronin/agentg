# Framework Policies Source

- This folder owns the generic policy contract for module definitions, policy
  value resolution, endpoint procedures, and module consumption.
- Keep this code domain-neutral. Module-specific policy definitions and default
  instances belong to the module packages and config directory.
- `definePolicy` describes a policy kind and its `zod` spec.
- Resolver helpers are plain pure functions from validated specs to a JSON-safe
  policy value.
- `createPolicyServer` owns validation, resolver execution, mutation results,
  and policy update events.
- `createPolicyClient` owns the typed RPC client for the policy endpoint.
- Module code consumes policies only through the getter returned by
  `usePolicy(definition)` from module setup. Do not expose YAML parsing, store
  paths, or resolver execution to consuming modules.
