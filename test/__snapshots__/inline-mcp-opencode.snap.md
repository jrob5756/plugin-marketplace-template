=== .opencode/agents/echo.md ===
---
description: An echo agent that uses the inline MCP server.
---

Echo agent body.

=== README.md ===
# inline-mcp — OpenCode bundle

Fixture: mcpServers declared inline rather than via path.

## Install

Copy or symlink the `.opencode/` directory into your project root:

```bash
# from this directory
cp -R .opencode /path/to/your/project/
```

Or install globally:

```bash
mkdir -p ~/.config/opencode
cp -R .opencode/* ~/.config/opencode/
```

## MCP servers

Merge `opencode.mcp.json` into your `opencode.json` (or `~/.config/opencode/opencode.json`) — copy the `mcp` block:

```bash
cat opencode.mcp.json
```

=== opencode.mcp.json ===
{
  "mcp": {
    "echo-server": {
      "type": "local",
      "command": [
        "echo",
        "hello"
      ]
    }
  }
}
