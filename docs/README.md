# Plugin Authoring Docs

This folder documents how to author plugin assets for this repository. Plugins
live under `plugins/` as source-of-truth and are transpiled to tool-specific
formats under `dist/` (Claude Code, GitHub Copilot, and OpenCode).

The docs are split along the same axis as the build:

## Tool-specific references

Format, frontmatter, directory layout, and manifest schemas for one specific
agent host.

| Doc                        | Scope                                                                  |
| -------------------------- | ---------------------------------------------------------------------- |
| [claude.md](claude.md)     | Claude Code plugin layout, `plugin.json`, asset frontmatter, marketplace |
| [codex.md](codex.md)       | OpenAI Codex CLI plugin layout, `.codex-plugin/plugin.json`, hooks, MCP, interface block |
| [copilot.md](copilot.md)   | GitHub Copilot / VS Code plugin layout, `plugin.json`, `marketplace.json`, asset frontmatter |
| [opencode.md](opencode.md) | OpenCode project layout, `opencode.json`, agents/commands/skills/plugins, permissions |

Use these when you need the exact field, file location, or precedence rule for
a given host.

## Tool-agnostic authoring guides

Concepts, best practices, and patterns grounded in open standards
([Agent Skills](https://agentskills.io/specification),
[Model Context Protocol](https://modelcontextprotocol.io/), etc.). Each guide
ends with a `## References` section listing the web resources it was built
from.

| Doc                                 | Scope                                                                        |
| ----------------------------------- | ---------------------------------------------------------------------------- |
| [agents.md](agents.md)              | Designing agents: descriptions, body structure, tools, models, handoffs      |
| [skills.md](skills.md)              | Authoring Agent Skills: progressive disclosure, descriptions, bundled assets |
| [hooks.md](hooks.md)                | Hook events, I/O contract, security, performance, conditional activation     |
| [mcp-servers.md](mcp-servers.md)    | Plugin-side concerns of bundling MCP servers (protocol itself: see [modelcontextprotocol.io](https://modelcontextprotocol.io/)) |

Use these when you are deciding **what** to build or **how** to structure it;
then drop into the tool-specific reference for **exact field names**.

## Conventions

- Every doc ends with a `## References` section citing the official docs,
  open standards, and community sources used to write it.
- Tool-agnostic guides cross-reference [claude.md](claude.md) and
  [copilot.md](copilot.md) for host-specific schemas rather than duplicating
  them.
- Tool-specific references defer to the authoring guides for generic best
  practices rather than restating them.
