# AgentG Codex MCP

Codex-facing MCP server for AgentG Gateway.

The server connects to Agent Gateway over WebSocket and exposes explicit MCP
tools for the Gateway methods that are allowed for external agent clients.

Defaults:

- `GATEWAY_WS_URL=ws://127.0.0.1:8787/`
- optional `GATEWAY_TOKEN`, sent as `Authorization: Bearer ...`

## Codex Config

Add the server to the project config at `.codex/config.toml`:

```toml
[mcp_servers.agentg_codex]
command = "node"
args = [
  "--import",
  "tsx",
  "/Users/pavel/projects/agentg/packages/codex-mcp/src/server.ts"
]
cwd = "/Users/pavel/projects/agentg"
startup_timeout_sec = 20
tool_timeout_sec = 60
env_vars = ["GATEWAY_TOKEN"]

[mcp_servers.agentg_codex.env]
GATEWAY_WS_URL = "ws://127.0.0.1:8787/"
```

Codex must restart or reload MCP configuration before the server appears in an
already running session.
