# RPC Framework Code

- Do not import, depend on, wrap, call, or adapt deleted old-contour packages such as `@agentg/events`, `@agentg/service-directory`,
  `@agentg/database`. If one appears necessary, stop and report the boundary violation before editing code.

- Do not hide material facts from the user. Explicitly disclose API changes,
  signature changes, compatibility paths, fallback behavior, architectural
  violations, failed checks, risky assumptions, and any workaround before or
  when presenting the change.
- `rpc.ts` owns the generic RPC contract.
- `httpRpc.ts` owns the default HTTP JSON RPC implementation.
- Keep module/domain logic out of this folder.
- Do not add query/mutation vocabulary, module RPC, compatibility envelopes, or
  domain-specific procedure routing here.
