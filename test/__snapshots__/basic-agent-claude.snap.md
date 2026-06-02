=== .claude-plugin/plugin.json ===
{
  "$schema": "https://json.schemastore.org/claude-code-plugin-manifest.json",
  "name": "basic-agent",
  "description": "Fixture: single agent, no other components",
  "version": "0.1.0",
  "agents": [
    "./agents/helper.md"
  ]
}

=== agents/helper.md ===
---
name: helper
description: A helper agent for testing.
color: blue
---

You are a helper.

## Job

Help with things.
