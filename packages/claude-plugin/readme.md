# AgentG Channel

Claude Code channel server for AgentG Gateway.

The plugin is intentionally thin:

- connects to AgentG Gateway over WebSocket
- forwards `telegram.message.created` as Claude channel notifications
- exposes one minimal read-only MCP tool, `list_recent_messages`

Gateway defaults:

- `AGENTG_GATEWAY_WS_URL=ws://127.0.0.1:8787/`
- optional `AGENTG_GATEWAY_TOKEN`, sent as `?token=...`

## Gateway auth

By default there is no plugin-to-gateway auth. This is intended for local
development where the gateway listens on localhost.

To enable token auth, set the same token on both sides:

```sh
# AgentG Gateway
AGENT_GATEWAY_TOKEN=...

# Claude plugin
AGENTG_GATEWAY_TOKEN=...
```

The plugin sends `AGENTG_GATEWAY_TOKEN` to the gateway as the WebSocket query
parameter `?token=...`.

## Claude MCP config

Put this config in the `.mcp.json` file for the directory where Claude Code is
started. For example, if a systemd service starts Claude with
`cwd=/home/pavel/agent`, the production config belongs at
`/home/pavel/agent/.mcp.json`, while the plugin itself can live in
`/home/pavel/agent/plugins/agentg`.

```json
{
  "mcpServers": {
    "agentg": {
      "command": "bun",
      "args": [
        "run",
        "--cwd",
        "/Users/pavel/projects/agentg/packages/claude-plugin",
        "--silent",
        "start"
      ]
    }
  }
}
```

Start Claude with the channel enabled:

```sh
claude --dangerously-load-development-channels server:agentg
```

Or test it as a local plugin:

```sh
claude --plugin-dir /Users/pavel/projects/agentg/packages/claude-plugin --dangerously-load-development-channels server:agentg
```
