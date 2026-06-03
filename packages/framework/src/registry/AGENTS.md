# Registry Framework Code

- Do not hide material facts from the user. Explicitly disclose API changes,
  signature changes, compatibility paths, fallback behavior, architectural
  violations, failed checks, risky assumptions, and any workaround before or
  when presenting the change.
- `contracts.ts` owns manifest, lease, and snapshot data contracts.
- `connector.ts` owns the generic Registry connector contract.
- `remote.ts` owns the standard remote Registry connector.
- `self.ts` owns the bootstrap connector used by the Registry runner.
- `client.ts` owns the low-level remote Registry client.
- `registry.ts` owns in-memory topology state and lease expiry.
- `module.ts` owns the deployable Registry module definition.
- Keep Registry generic infrastructure here. Do not import deployable
  packages such as `@agentg/registry`.
- Do not add module RPC, query/mutation vocabulary, compatibility envelopes, event
  registration, or procedure lookup RPC methods.
- Consumers derive routing and extension lookup locally from snapshots.
- The deployable registry package must stay a thin runner over this
  framework code.
