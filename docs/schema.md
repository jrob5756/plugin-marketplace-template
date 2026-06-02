# `plugin.yaml` schema reference

This is the authoritative reference for the source format every plugin in
this marketplace uses. The schema lives in machine-readable form at
[`tools/schemas/plugin.schema.json`](../tools/schemas/plugin.schema.json) and
is enforced on every build (`npm run validate`). Editors that respect the
`yaml-language-server` modeline get inline validation as you type.

## At a glance

```yaml
# yaml-language-server: $schema=https://raw.githubusercontent.com/jrob5756/plugin-marketplace-template/main/tools/schemas/plugin.schema.json

name: my-plugin                 # required, kebab-case, matches dir
version: 1.0.0                  # required, semver
description: "What it does"     # required, 1-1024 chars

author:
  name: Jane Doe
  email: jane@example.com       # optional
  url: https://example.com      # optional

repository: https://github.com/...
homepage: https://...
license: MIT
keywords: [tag1, tag2]

# MCP servers: either a path to a .mcp.json file OR an inline object.
mcpServers: ./.mcp.json
# mcpServers:
#   mcpServers:
#     my-server: { type: stdio, command: npx, args: [-y, my-pkg] }

# Hooks: path, inline, or {path, targets} to restrict emission.
hooks: ./hooks/hooks.json
# hooks: { path: ./hooks/hooks.json, targets: [claude, copilot] }

agents: [...]                   # see below
skills: [...]                   # see below
```

## Required fields

| Field | Why |
|---|---|
| `name` | Plugin identifier, must match the parent directory name |
| `version` | Semver — required so downstream marketplaces have a consistent update story |
| `description` | Shown in marketplace listings, max 1024 chars |

## Agents

```yaml
agents:
  - name: my-agent              # required, kebab-case
    path: ./agents/my-agent.md  # required, must start with ./ and stay inside plugin root
    description: >-             # required, used by every target
      Long trigger description. Controls when other agents delegate here.
    argument-hint: "hint text"  # optional, shared across targets

    claude:                     # Claude Code overrides
      model: sonnet             # sonnet | opus | haiku | inherit | full ID
      effort: medium            # low | medium | high | xhigh | max
      maxTurns: 20
      tools: [Read, Glob, Grep] # OMIT to inherit all tools
      disallowedTools: [Write]
      memory: project
      background: false
      isolation: worktree
      color: green

    copilot:                    # GitHub Copilot overrides
      model: claude-haiku-4.5
      tools: [read, search, web, 'myserver/*']
      user-invocable: false
      disable-model-invocation: false
      target: vscode            # vscode | github-copilot
      agents: '*'               # subagent allowlist

    opencode:                   # OpenCode overrides
      mode: subagent            # primary | subagent | all
      model: anthropic/claude-sonnet-4-5
      temperature: 0.1
      steps: 10
      color: green
      permission:
        bash: { "*": ask, "git *": allow }
```

### Per-target field policy

Each `claude:`, `copilot:`, `opencode:` block accepts additional unknown
fields (`additionalProperties: true` at the per-target level) so authors can
use newly-released native features before this schema catches up. Known
fields are still type-checked.

There is **no cross-target inference**. `copilot.user-invocable: false`
does NOT cause OpenCode to set `mode: subagent`. `claude.color` does NOT
flow into OpenCode. If you want the same behavior across targets, set the
field explicitly in each block.

### Tool field shape per target

- **Claude** (`claude.tools`): array of exact tool names. Globs like
  `server/*` are rejected by the schema — list each tool by name, or omit
  the field to inherit all tools.
- **Copilot** (`copilot.tools`): array, supports `server/*` globs. Emitted
  as inline flow style: `tools: [read, search, ...]`.
- **OpenCode**: uses the `permission` object instead of `tools`.

## Skills

```yaml
skills:
  - name: my-skill              # required, kebab-case, matches subdir
    path: ./skills/my-skill     # required, dir containing SKILL.md
    description: |              # required, 10-1024 chars
      What it does and when to use it. Triggers: keyword1, keyword2.
    argument-hint: "[opt] hint" # optional, shared

    claude:                     # rarely needed
      disable-model-invocation: false

    copilot:                    # rarely needed
      user-invocable: false
      disable-model-invocation: false
      context: inline           # inline | fork

    opencode:                   # rarely needed
      license: MIT
      compatibility: opencode
      metadata: { audience: maintainers }
```

Bundled subdirectories under `path` (`references/`, `examples/`, `scripts/`,
`assets/`) are copied recursively to all targets unchanged.

## MCP servers

`mcpServers:` accepts two shapes:

```yaml
# Shape 1: external file
mcpServers: ./.mcp.json

# Shape 2: inline (good for tiny configs)
mcpServers:
  mcpServers:
    web-search:
      type: stdio
      command: npx
      args: [-y, open-websearch@latest]
```

Both shapes feed all three targets. The OpenCode transpiler converts the
Claude/Copilot shape (`type: stdio | http`) into OpenCode's shape
(`type: local | remote`) automatically.

## Hooks

`hooks:` accepts three shapes:

```yaml
# Shape 1: path
hooks: ./hooks/hooks.json

# Shape 2: inline
hooks:
  SessionStart:
    - hooks:
        - type: command
          command: "echo started"

# Shape 3: {path, targets} — restrict emission
hooks:
  path: ./hooks/hooks.json
  targets: [claude, copilot]    # OpenCode silently dropped (no declarative hooks)
```

Without `targets:`, the build warns when emitting an OpenCode bundle for a
plugin that defines hooks, because OpenCode has no declarative hooks file.
Add `targets: [claude, copilot]` (or include `opencode` and supply a JS/TS
plugin under `.opencode/plugins/` yourself) to silence the warning.

## Source markdown rules

Agent (`agents/<name>.md`) and skill (`skills/<name>/SKILL.md`) bodies
**must not contain YAML frontmatter**. Per-target frontmatter is generated
from `plugin.yaml` at build time — duplicating it in source would split the
source of truth. The build errors loudly if frontmatter is detected.

## Paths and security

Every `path:` in `plugin.yaml` is resolved against the plugin's own
directory. Paths that escape the plugin root (via `..` or absolute paths)
are rejected at build time. All paths must start with `./`.

## Bundled scripts

A directory named `scripts/` at the plugin root is copied verbatim into
every target's output. Use this for helper scripts referenced from agent
prompts via `${CLAUDE_PLUGIN_ROOT}/scripts/...`. Note that OpenCode does
NOT honor `${CLAUDE_PLUGIN_ROOT}` — for OpenCode-targeting plugins, use
absolute paths or env vars set in `environment:`.

## See also

- [`docs/agents.md`](agents.md) — agent design and tool restrictions
- [`docs/skills.md`](skills.md) — skill triggers and bundled assets
- [`docs/hooks.md`](hooks.md) — hook patterns
- [`docs/mcp-servers.md`](mcp-servers.md) — MCP server config patterns
- [`docs/claude.md`](claude.md) — Claude Code native format
- [`docs/copilot.md`](copilot.md) — Copilot native format
- [`docs/opencode.md`](opencode.md) — OpenCode native format
