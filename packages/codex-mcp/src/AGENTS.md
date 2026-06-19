# Codex MCP Source

- `server.ts` owns the MCP protocol server, Gateway WebSocket client, tool
  definitions, and tool-to-Gateway routing.
- Do not add a generic Gateway method caller.
- Do not import domain modules or internal module RPC clients here.
- All calls must go through Agent Gateway WebSocket.
