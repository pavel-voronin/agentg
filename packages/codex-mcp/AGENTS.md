# Codex MCP Package

- This package owns the Codex-facing MCP server for AgentG Gateway.
- Keep it separate from `packages/claude-plugin`; do not import, edit, or share
  runtime code with the Claude package.
- The MCP server must connect only to Agent Gateway. It must not call internal
  module RPC services directly.
- Expose explicit tools for Gateway-owned external methods. Do not add a generic
  arbitrary method tool.
- Keep tool inputs small and JSON-only. Gateway and the serving modules own the
  final procedure contracts.
