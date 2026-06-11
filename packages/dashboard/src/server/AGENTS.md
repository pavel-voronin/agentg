# Server Rules

- The server owns only Dashboard HTTP, WebSocket RPC, event streaming, and
  explicit Dashboard procedure dispatch.
- Do not serve module provider assets through module RPC. Provider frontend code
  is bundled by Vite in this module boundary.
- RPC calls from the browser must resolve to explicitly registered Dashboard
  procedures.
- Keep server responses JSON-RPC-like over the existing WebSocket envelope used
  by the browser host.
