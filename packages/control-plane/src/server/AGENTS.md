# Server Rules

- The server owns only Control Plane HTTP, WebSocket RPC, event streaming, and
  registry snapshot reads.
- Do not serve module provider assets through module RPC. Provider frontend code
  is bundled by Vite in this module boundary.
- RPC calls from the browser must resolve through registry procedure URLs.
- Keep server responses JSON-RPC-like over the existing WebSocket envelope used
  by the browser host.
