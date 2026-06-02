# Plugin Marketplace Workspace

A multi-target plugin marketplace for **Claude Code**, **GitHub Copilot**
(VS Code + Copilot CLI), **OpenCode**, and **OpenAI Codex CLI**. Plugins are
authored once in a tool-agnostic source format, then transpiled into each
tool's native plugin format.

```
plugins/<name>/         ← single source of truth (edit here)
  ↓ npm run build
dist/claude/<name>/     ← Claude Code plugin (generated)
dist/copilot/<name>/    ← Copilot plugin (generated)
dist/opencode/<name>/   ← OpenCode bundle (generated)
```

Adding a fifth target is a drop-in transpiler — see
[Adding a transpile target](#adding-a-transpile-target).

---

## Layout

### Source

```
plugins/<plugin-name>/
├── plugin.yaml            # Manifest: identity, metadata, agents, skills, hooks, mcp
├── .mcp.json              # MCP server definitions (optional, copied verbatim)
├── hooks/hooks.json       # Hook definitions (optional, copied verbatim)
├── agents/<name>.md       # Agent body (NO frontmatter — generated)
├── skills/<name>/
│   ├── SKILL.md           # Skill body (NO frontmatter — generated)
│   └── references/        # Bundled assets — copied recursively
└── scripts/               # Plugin scripts (optional, copied verbatim)
```

### Generated output (do not edit)

```
dist/
├── claude/<plugin>/
│   ├── .claude-plugin/plugin.json
│   ├── agents/<name>.md              ← Claude frontmatter prepended
│   ├── skills/<name>/SKILL.md        ← Claude frontmatter prepended
│   ├── .mcp.json
│   ├── hooks/hooks.json
│   └── scripts/
├── copilot/<plugin>/
│   ├── .github/plugin/plugin.json
│   ├── agents/<name>.agent.md        ← Copilot frontmatter + .agent.md suffix
│   ├── skills/<name>/SKILL.md        ← Copilot frontmatter prepended
│   ├── .mcp.json
│   ├── hooks/hooks.json
│   └── scripts/
└── opencode/<plugin>/
    ├── .opencode/
    │   ├── agents/<name>.md          ← OpenCode frontmatter prepended
    │   ├── skills/<name>/SKILL.md    ← OpenCode frontmatter prepended
    │   └── scripts/                  ← copied if present
    ├── opencode.mcp.json             ← `mcp` block to merge into opencode.json
    └── README.md                     ← install instructions
```

### Repo-root files

```
marketplace.yaml                       ← single source of marketplace metadata
.claude-plugin/marketplace.json        ← generated; points at dist/claude/
.github/plugin/marketplace.json        ← generated; points at dist/copilot/
                                        (OpenCode has no marketplace.json — see dist/opencode/<name>/README.md)
package.json                           ← npm run build / validate / clean
tools/                                 ← build tool + schemas + transpilers
docs/                                  ← authoring guides (claude.md, codex.md, copilot.md, opencode.md, etc.)
```

---

## Build commands

| Command | What it does |
|---|---|
| `npm run build` | Validate everything, then transpile **all plugins × all targets** and regenerate both marketplace.json files. |
| `npm run build -- --plugin=<name>` | Build just one plugin (both targets). Skips marketplace regeneration. |
| `npm run build -- --target=<name>` | Build only one target (`claude`, `codex`, `copilot`, or `opencode`). |
| `npm run validate` | JSON-schema-validate `plugin.yaml` files + `marketplace.yaml` without writing anything. |
| `npm run clean` | Wipe `dist/`. |

First-time setup: `npm install`.

---

## `plugin.yaml` schema

The full schema lives at `tools/schemas/plugin.schema.json`. Only `name` is
strictly required. Per-target fields go under `claude:`, `codex:`, `copilot:`,
or `opencode:` blocks; shared fields sit at the component root.

### Top-level

```yaml
name: my-plugin                       # required, kebab-case, matches dir
description: "What the plugin does"
version: 1.2.3                         # semver

author:
  name: Jane Doe
  email: jane@example.com              # optional
  url: https://example.com             # optional

repository: https://github.com/...
homepage: https://...
license: MIT
keywords: [tag1, tag2]

mcpServers: ./.mcp.json                # path to .mcp.json (omit if no MCP)
hooks: ./hooks/hooks.json              # path to hooks.json (omit if no hooks)

agents: [...]                          # see below
skills: [...]                          # see below
```

### Agents

```yaml
agents:
  - name: my-agent                     # required, kebab-case
    path: ./agents/my-agent.md         # required, path to body (no frontmatter)
    description: >-                    # required, used by both targets
      Long trigger description. Controls when other agents delegate here.
    argument-hint: "hint text"         # optional, shared

    claude:                            # Claude-specific overrides
      model: sonnet                    # sonnet | opus | haiku | inherit | full ID
      effort: medium                   # low | medium | high | xhigh | max
      maxTurns: 20
      tools: [Read, Glob, Grep]        # OMIT to inherit all tools (recommended for MCP-owning agents)
      disallowedTools: [Write]
      memory: project                  # user | project | local
      background: false
      isolation: worktree
      color: green                     # any string (8 named colors + hex)

    copilot:                           # Copilot-specific overrides
      model: claude-haiku-4.5
      tools: [read, search, web, 'myserver/*']   # server/* glob supported; emitted as inline flow style
      user-invocable: false
      disable-model-invocation: false
      target: vscode                   # vscode | github-copilot
      agents: '*'                      # subagent allowlist

    opencode:                          # OpenCode-specific overrides
      mode: subagent                   # primary | subagent | all
      model: anthropic/claude-sonnet-4-5   # provider/model-id
      variant: high
      temperature: 0.1
      steps: 10
      hidden: false
      color: green                     # hex or named token (primary/accent/...)
      permission:                      # see docs/opencode.md#permissions
        bash: { "*": ask, "git *": allow }
```

**Key per-target differences to know:**

- **Tool globs**: Copilot supports `server/*`. Claude does **not** — list every
  tool by name, or **omit `tools` entirely to inherit all tools**. The schema
  rejects glob patterns in `claude.tools`. OpenCode uses the `permission`
  object instead of `tools` to gate access.
- **Copilot toolset names** (use these, not the Claude-style file primitives):
  `read`, `edit`, `search`, `execute`, `web`, `browser`, `agent`, `todo`,
  `vscode`, plus `<server>/*` globs for MCP. The transpiler emits
  `tools:` as inline flow style (`tools: [read, search, ...]`).
- **`color`**: Claude and OpenCode both honor a `color` field with overlapping
  8-name vocabulary (red, blue, green, yellow, purple, orange, pink, cyan);
  the schema accepts any string. The OpenCode transpiler falls back to
  `claude.color` when `opencode.color` is unset.
- **`user-invocable`, `disable-model-invocation`**: Copilot-only fields. The
  OpenCode transpiler treats `copilot.user-invocable: false` (with no
  explicit `opencode.mode`) as a signal to emit `mode: subagent`.
- **`model`**: Different vocabulary per target. Claude: `sonnet`/`opus`/
  `haiku` or full IDs. Copilot: `claude-haiku-4.5`, `gpt-5`, etc. OpenCode:
  `provider/model-id` (e.g. `anthropic/claude-sonnet-4-5`).
- **Descriptions** are emitted single-quoted in Copilot output (required by
  awesome-copilot validator), double-quoted in Claude and OpenCode output.

### Skills

Skills are mostly portable — most don't need per-target blocks at all.

```yaml
skills:
  - name: my-skill                     # required, kebab-case, matches dir
    path: ./skills/my-skill            # required, dir containing SKILL.md
    description: |                     # required (10-1024 chars)
      What the skill does and when to use it. Triggers: keyword1, keyword2.
    argument-hint: "[option] hint"     # optional, shared

    claude:                            # rarely needed
      disable-model-invocation: false

    copilot:                           # rarely needed
      user-invocable: false
      disable-model-invocation: false
      context: inline                  # inline | fork (experimental)

    opencode:                          # rarely needed
      license: MIT
      compatibility: opencode
      metadata: { audience: maintainers }
```

Bundled subdirectories (`references/`, `examples/`, `scripts/`, `assets/`) are
copied recursively to both targets unchanged.

### `marketplace.yaml`

```yaml
name: my-plugins                       # required, kebab-case
description: "Marketplace summary"
version: 0.1.0                          # semver
owner:                                 # required
  name: Your Name
```

Plugin entries in the generated `marketplace.json` files are derived
automatically from every `plugins/*/plugin.yaml` — never hand-edited.

---

## Common workflows

### Adding a new plugin

1. `mkdir plugins/my-plugin`
2. Create `plugins/my-plugin/plugin.yaml` (minimum: `name: my-plugin` + a
   description and at least one agent or skill).
3. Add body files: `plugins/my-plugin/agents/<agent>.md` and/or
   `plugins/my-plugin/skills/<skill>/SKILL.md`. **No frontmatter** in these
   files — it's generated.
4. (Optional) Add `.mcp.json`, `hooks/hooks.json`, `scripts/`.
5. `npm run build` — validates, transpiles, regenerates marketplace files.
6. Bump `marketplace.yaml` version.

### Adding an agent to an existing plugin

1. Add the body at `plugins/<plugin>/agents/<agent>.md` (no frontmatter).
2. Add an entry under `agents:` in `plugins/<plugin>/plugin.yaml`.
3. Bump the plugin's `version`.
4. `npm run build`.

### Adding a skill

Same pattern: body at `plugins/<plugin>/skills/<skill>/SKILL.md` (no
frontmatter), entry under `skills:` in `plugin.yaml`, bump version, build.

### Adding hooks or MCP servers

- **Hooks**: create `plugins/<plugin>/hooks/hooks.json`, add
  `hooks: ./hooks/hooks.json` to `plugin.yaml`.
- **MCP servers**: create `plugins/<plugin>/.mcp.json`, add
  `mcpServers: ./.mcp.json` to `plugin.yaml`.

The Claude and Copilot targets copy both files verbatim. The OpenCode target:

- **MCP**: converts `.mcp.json` (`{ mcpServers: { x: { type: "stdio"|"http", ... } } }`)
  into a fragment file `dist/opencode/<plugin>/opencode.mcp.json` with the
  OpenCode shape (`{ mcp: { x: { type: "local"|"remote", command: [...] } } }`).
  Users merge the `mcp` block into their own `opencode.json`.
- **Hooks**: not yet transpiled. The build warns when a plugin defines hooks
  and the generated `README.md` notes the limitation. OpenCode has no
  declarative hooks file — hooks are JS/TS plugin event handlers under
  `.opencode/plugins/`. Port manually if needed.

### Adding a transpile target

Each target is a module under `tools/transpilers/<target>.mjs` exporting two
functions:

- `transpile({ plugin, pluginDir, outRoot })` — writes the plugin's output
  under `<outRoot>/<target>/<plugin.name>/`.
- `marketplaceEntry({ plugin })` — returns the entry object for that target's
  marketplace registry. **Return `null`** if the target has no marketplace
  concept (e.g. OpenCode); the build skips its marketplace file generation.

Register the new target in `tools/build.mjs`:

```js
import * as mytarget from './transpilers/mytarget.mjs';
const TARGETS = { claude, copilot, opencode, mytarget };
```

If the target has a marketplace file, add its path to the `MARKETPLACE_FILES`
map in the same file. Otherwise omit it — the build will skip marketplace
generation for that target.

---

## Authoring guides (deeper reading)

The authoritative schema reference is [`docs/schema.md`](docs/schema.md).

Tool-agnostic best practices for each artifact type:

- [`docs/agents.md`](docs/agents.md) — agent descriptions, tool restrictions,
  model selection
- [`docs/skills.md`](docs/skills.md) — skill triggers, progressive disclosure,
  bundled resources
- [`docs/hooks.md`](docs/hooks.md) — hook events, I/O contract, security,
  performance, conditional activation
- [`docs/mcp-servers.md`](docs/mcp-servers.md) — bundling MCP servers in
  plugins (protocol itself: see [modelcontextprotocol.io](https://modelcontextprotocol.io/))

Tool-specific format references:

- [`docs/claude.md`](docs/claude.md) — Claude Code plugin format
- [`docs/codex.md`](docs/codex.md) — OpenAI Codex CLI plugin format
- [`docs/copilot.md`](docs/copilot.md) — Copilot plugin format
- [`docs/opencode.md`](docs/opencode.md) — OpenCode project format

---

## FAQ

**Why can't I just edit `dist/`?**
It's regenerated on every build. Your edit will be erased the next time
anyone runs `npm run build`. Always edit `plugins/<name>/`.

**Why is frontmatter stripped from source `.md` files?**
The source format is one declarative YAML manifest — duplicating frontmatter
in the markdown would force two sources of truth that could drift. The
transpiler synthesizes per-target frontmatter from `plugin.yaml`.

**Do I need to keep the two marketplace.json files in sync manually?**
No. They're both build outputs. Editing them by hand will be overwritten on
the next `npm run build`.

**My plugin's MCP server uses `${PLUGIN_ROOT}` / `${CLAUDE_PLUGIN_ROOT}`. Will it work in both targets?**
`${CLAUDE_PLUGIN_ROOT}` is honored by VS Code/Copilot too, so it's the
portable choice for Claude and Copilot. The transpiler copies `.mcp.json`
verbatim to those targets, so the variable resolves correctly. **OpenCode
does not honor `${CLAUDE_PLUGIN_ROOT}`** — for plugins targeting OpenCode,
prefer absolute paths or env vars set in `environment:`.

**Can a plugin define agent or skill files in a non-default directory?**
Yes — the `path` field on each agent/skill entry can point anywhere under
the plugin root. The build still emits them into the conventional
`agents/<name>.<ext>` and `skills/<name>/SKILL.md` paths in `dist/`.

**Will Claude really ignore an unsupported `color` value or a glob in `tools`?**
- `color`: silently ignored if outside the 8 named colors.
- Glob in `tools`: the agent will look for a literal tool named `myserver/*`,
  not find it, and behave as if you granted no MCP tools. The schema now
  rejects glob patterns in `claude.tools` to prevent this — use Copilot
  globs only, or list each Claude tool by name, or omit `tools` to inherit.
