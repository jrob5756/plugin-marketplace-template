=== .github/plugin/plugin.json ===
{
  "name": "hooks-targets",
  "description": "Fixture: hooks scoped to specific targets, suppressing OpenCode warning.",
  "version": "0.1.0",
  "hooks": "hooks/hooks.json"
}

=== agents/hooked.agent.md ===
---
name: hooked
description: 'An agent in a plugin that ships hooks scoped to claude+copilot only.'
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
