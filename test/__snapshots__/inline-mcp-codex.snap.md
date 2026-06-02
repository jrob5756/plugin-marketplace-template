=== .codex-plugin/plugin.json ===
{
  "name": "inline-mcp",
  "version": "0.1.0",
  "description": "Fixture: mcpServers declared inline rather than via path.",
  "mcpServers": "./.mcp.json"
}

=== .mcp.json ===
{
  "mcpServers": {
    "echo-server": {
      "type": "stdio",
      "command": "echo",
      "args": [
        "hello"
      ]
    }
  }
}

=== agents/echo.md ===
---
name: echo
description: An echo agent that uses the inline MCP server.
---

Echo agent body.
