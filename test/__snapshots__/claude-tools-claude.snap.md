=== .claude-plugin/plugin.json ===
{
  "$schema": "https://json.schemastore.org/claude-code-plugin-manifest.json",
  "name": "claude-tools",
  "description": "Fixture: claude tools array → CSV join + disallowedTools + copilot description with apostrophe.",
  "version": "0.1.0",
  "agents": [
    "./agents/dev.md"
  ]
}

=== agents/dev.md ===
---
name: dev
description: Helper that's tool-restricted.
tools: Read, Edit, Grep
disallowedTools: Bash, Write
color: blue
---

A tool-restricted dev agent body.
