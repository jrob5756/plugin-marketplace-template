=== .github/plugin/plugin.json ===
{
  "name": "claude-tools",
  "description": "Fixture: claude tools array → CSV join + disallowedTools + copilot description with apostrophe.",
  "version": "0.1.0"
}

=== agents/dev.agent.md ===
---
name: dev
description: 'Helper that''s tool-restricted.'
tools: [read, edit, search, 'github/*', 'web-search/*']
---

A tool-restricted dev agent body.
