=== .claude-plugin/plugin.json ===
{
  "$schema": "https://json.schemastore.org/claude-code-plugin-manifest.json",
  "name": "hooks-targets",
  "description": "Fixture: hooks scoped to specific targets, suppressing OpenCode warning.",
  "version": "0.1.0",
  "agents": [
    "./agents/hooked.md"
  ],
  "hooks": "./hooks/hooks.json"
}

=== agents/hooked.md ===
---
name: hooked
description: An agent in a plugin that ships hooks scoped to claude+copilot only.
---

Hooked agent body.

=== hooks/hooks.json ===
{
  "SessionStart": [
    {
      "hooks": [
        { "type": "command", "command": "echo session started" }
      ]
    }
  ]
}
