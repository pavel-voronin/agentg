# Server Rules

- Do not import, depend on, wrap, call, or adapt deleted old-contour packages such as `@agentg/events`, `@agentg/service-directory`,
  `@agentg/database`. If one appears necessary, stop and report the boundary violation before editing code.

- The server owns only Control Plane HTTP, WebSocket RPC, event streaming, and
  registry snapshot reads.
- Do not serve module provider assets through module RPC. Provider frontend code
  is bundled by Vite in this module boundary.
- Do not add deleted service-directory or module RPC dependencies.
- RPC calls from the browser must resolve through registry procedure URLs.
- Keep server responses JSON-RPC-like over the existing WebSocket envelope used
  by the browser host.
