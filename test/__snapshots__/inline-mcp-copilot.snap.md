=== .github/plugin/plugin.json ===
{
  "name": "inline-mcp",
  "description": "Fixture: mcpServers declared inline rather than via path.",
  "version": "0.1.0",
  "mcpServers": ".mcp.json"
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

=== agents/echo.agent.md ===
---
name: echo
description: 'An echo agent that uses the inline MCP server.'
---

Echo agent body.
