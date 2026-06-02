=== .claude-plugin/plugin.json ===
{
  "$schema": "https://json.schemastore.org/claude-code-plugin-manifest.json",
  "name": "basic-skill",
  "description": "Fixture: single skill, no agents",
  "version": "0.1.0",
  "skills": [
    "./skills/my-skill"
  ]
}

=== skills/my-skill/SKILL.md ===
---
name: my-skill
description: |
  A skill that does things. Triggers: thing, stuff, etc.
---

# My Skill

Body of the skill.
