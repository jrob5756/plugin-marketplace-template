# OpenCode Plugin Reference

Frontmatter and configuration rules for every component an
[OpenCode](https://opencode.ai) project can ship, plus the full `opencode.json`
manifest structure. Authoritative source: the official
[OpenCode docs](https://opencode.ai/docs/) and the
[anomalyco/opencode](https://github.com/anomalyco/opencode) repository (the
project was previously published as `sst/opencode` and that URL still
redirects).

> **Note:** OpenCode has no `plugin.json` manifest equivalent to Claude Code or
> Copilot. A "plugin" in OpenCode is **either** a JS/TS module loaded by the
> runtime **or** a set of conventionally-located markdown files (agents,
> commands, skills) discovered under `.opencode/` or `~/.config/opencode/`.
> The closest thing to a manifest is `opencode.json` — but it is a
> _configuration_ file, not a plugin package descriptor.

**For tool-agnostic authoring guidance**, see:
[agents.md](agents.md), [skills.md](skills.md), [hooks.md](hooks.md),
[mcp-servers.md](mcp-servers.md). This file documents OpenCode-specific
**format** only.

---

## Project Directory Layout

OpenCode discovers customisations from two roots — a per-project root and a
global root — and merges them. Both share the same structure:

```
# Per-project
.opencode/
├── plugins/                  # JS/TS plugin modules (auto-loaded at startup)
│   └── <name>.{ts,js}
├── tools/                    # Custom tool definitions (JS/TS)
│   └── <name>.{ts,js}
├── agents/                   # Custom agent markdown files
│   └── <name>.md
├── commands/                 # Slash command markdown files
│   └── <name>.md
├── skills/                   # Skills as <name>/SKILL.md directories
│   └── <name>/SKILL.md
├── themes/                   # Color themes
│   └── <name>.json
└── package.json              # (optional) deps that `bun install` will install

# Global (XDG)
~/.config/opencode/
├── plugins/                  # Same structure, global scope
├── tools/
├── agents/
├── commands/
├── skills/<name>/SKILL.md
├── themes/*.json
├── AGENTS.md                 # Global always-on rules
├── opencode.json             # Global config
└── tui.json                  # Global TUI config

# Repo / project root
opencode.json                 # Project config (or opencode.jsonc)
tui.json                      # Project TUI config (or tui.jsonc)
AGENTS.md                     # Project rules (or any parent up to git root)
```

**Critical rules:**

- There is **no central manifest** describing the project's components.
  Discovery is **convention-based**: drop files in the right directory and
  OpenCode picks them up.
- Per-project (`.opencode/`) and global (`~/.config/opencode/`) directories
  are merged — project entries take precedence on name conflict.
- Plugin/tool/agent/command/skill files use **kebab-case** names. The
  **filename** (without extension) becomes the component name; there is no
  explicit `name` field for agents, commands, or tools.
- Skills are the exception — the directory name **must** match the `name`
  field inside `SKILL.md` (validated against `^[a-z0-9]+(-[a-z0-9]+)*$`).
- OpenCode reads Claude Code's `CLAUDE.md` and `.claude/skills/` as fallbacks
  for cross-tool compatibility. See
  [Cross-tool compatibility](#cross-tool-compatibility).

### File locations reference

| Component               | Path                                                            |
| ----------------------- | --------------------------------------------------------------- |
| Project config          | `opencode.json` or `opencode.jsonc` (repo root)                 |
| Global config           | `~/.config/opencode/opencode.json`                              |
| TUI config              | `tui.json` (repo root) or `~/.config/opencode/tui.json`         |
| Rules (always-on)       | `AGENTS.md` (walks up to git root); `~/.config/opencode/AGENTS.md` |
| Agents                  | `.opencode/agents/<name>.md`                                    |
| Commands                | `.opencode/commands/<name>.md`                                  |
| Skills                  | `.opencode/skills/<name>/SKILL.md`                              |
| Plugin modules          | `.opencode/plugins/<name>.{ts,js}`                              |
| Custom tools            | `.opencode/tools/<name>.{ts,js}`                                |
| Themes                  | `.opencode/themes/<name>.json`                                  |
| MCP servers             | Inline in `opencode.json` under `mcp`                            |
| LSP servers             | Inline in `opencode.json` under `lsp`                            |
| Hooks                   | Implemented via plugins — no standalone hooks file              |
| Credentials             | `~/.local/share/opencode/auth.json` (managed via `/connect`)    |

---

## `opencode.json` Configuration

The top-level configuration file. There is no required field, but a
`$schema` reference is conventional so editors can autocomplete the rest.

### Full Schema

```jsonc
{
  // --- Schema reference ---
  "$schema": "https://opencode.ai/config.json",

  // --- Defaults ---
  "model": "anthropic/claude-sonnet-4-5",          // Default model (provider/model)
  "small_model": "anthropic/claude-haiku-4-5",     // Cheap model for titles/summaries
  "default_agent": "build",                         // Primary agent on startup
  "share": "manual",                                // "manual" | "auto" | "disabled"
  "autoupdate": true,                               // true | false | "notify"
  "shell": "/bin/zsh",                              // Shell for bash tool
  "snapshot": true,                                 // Per-edit snapshot/undo
  "lsp": true,                                      // Enable built-in LSPs
  "formatter": true,                                // Enable built-in formatters
  "username": "jane",                                // Identity used in shared sessions
  "logLevel": "INFO",                                // DEBUG | INFO | WARN | ERROR
  "enabled_providers": ["anthropic"],                // Allowlist providers
  "disabled_providers": ["github-copilot"],          // Denylist providers (mutually exclusive with above)

  // --- Components (all optional; map shapes) ---
  "provider": {  /* see Providers */ },
  "agent":    {  /* see Agents (JSON form) */ },
  "command":  {  /* see Commands (JSON form) */ },
  "mcp":      {  /* see MCP Servers */ },
  "tools":    {  /* tool enable/disable map */ },
  "permission": { /* see Permissions */ },

  // --- Plugins (npm packages) ---
  "plugin": ["opencode-wakatime", "@my-org/custom-plugin"],

  // --- Always-on extra context files ---
  "instructions": [
    "CONTRIBUTING.md",
    "docs/guidelines.md",
    ".cursor/rules/*.md",
    "packages/*/AGENTS.md",
    "https://raw.githubusercontent.com/my-org/shared/main/style.md"
  ],

  // --- Skill discovery overrides ---
  "skills": {
    "paths": [".opencode/skills", "vendored/skills"],
    "urls":  ["https://example.com/team-skills.json"]
  },

  // --- Org / enterprise ---
  "reference":  "https://config.example.com/opencode.json",  // remote config layer
  "enterprise": { /* enterprise org settings */ },
  "tool_output": { /* per-tool output formatting */ },
  "experimental": { /* opt-in experimental features */ },

  // --- Behavioural tuning ---
  "compaction": { "auto": true, "prune": true, "reserved": 10000 },
  "watcher":    { "ignore": ["node_modules/**", "dist/**"] },
  "server":     { "port": 4096 },
  "attachment": {
    "image": {
      "auto_resize": true,
      "max_width": 2000,
      "max_height": 2000,
      "max_base64_bytes": 5242880
    }
  }
}
```

### Top-level field reference

| Field           | Type             | Notes                                                                |
| --------------- | ---------------- | -------------------------------------------------------------------- |
| `$schema`             | string                  | URL of JSON schema for autocomplete. Ignored at load.                  |
| `model`               | string                  | Default model, format `provider/model-id`.                              |
| `small_model`         | string                  | Cheaper model used for titles, summaries, and short reasoning tasks.   |
| `default_agent`       | string                  | Agent activated on startup (defaults to `build`).                      |
| `share`               | enum                    | `"manual"` (default), `"auto"`, or `"disabled"`.                       |
| `autoupdate`          | boolean \| `"notify"`    | Auto-update the OpenCode binary. `"notify"` only alerts.               |
| `shell`               | string                  | Shell binary used for the `bash` tool.                                 |
| `snapshot`            | boolean                 | Enable per-edit snapshot/undo.                                         |
| `username`            | string                  | Identity used in shared sessions.                                      |
| `logLevel`            | enum                    | `"DEBUG"` \| `"INFO"` \| `"WARN"` \| `"ERROR"`.                         |
| `enabled_providers`   | string[]                | Allowlist of provider IDs. Mutually exclusive with `disabled_providers`.|
| `disabled_providers`  | string[]                | Denylist of provider IDs.                                              |
| `lsp`                 | boolean \| object        | `true` enables all built-ins; object form configures individual LSPs.  |
| `formatter`           | boolean \| object        | Same shape as `lsp`.                                                   |
| `provider`            | object                  | Provider configs and per-model overrides — see [Providers](#providers).|
| `agent`               | object                  | Agent definitions (alternative to markdown files).                     |
| `command`             | object                  | Command definitions (alternative to markdown files).                   |
| `mcp`                 | object                  | MCP server definitions — see [MCP Servers](#mcp-servers).              |
| `tools`               | object                  | Tool enable/disable map (supports globs).                              |
| `permission`          | string \| object         | Permission rules — see [Permissions](#permissions).                    |
| `plugin`              | string[]                | npm package names; installed automatically via `bun install`.          |
| `instructions`        | string[]                | Extra always-on context files (paths, globs, or URLs).                 |
| `skills`              | object                  | Skill discovery overrides: `paths: string[]`, `urls: string[]`.        |
| `compaction`          | object                  | Auto-compaction settings.                                              |
| `watcher`             | object                  | File watcher ignore globs.                                             |
| `server`              | object                  | Embedded server settings (`port`).                                     |
| `attachment`          | object                  | Image attachment auto-resize policy.                                   |
| `reference`           | string                  | URL of a remote config layer pulled in at load time.                   |
| `enterprise`          | object                  | Enterprise/org-managed settings.                                       |
| `tool_output`         | object                  | Per-tool output formatting overrides.                                  |
| `experimental`        | object                  | Opt-in experimental features.                                          |

> **Deprecated keys:** `mode` (replaced by `agent`), `autoshare` (replaced by
> `share`), and `layout` are accepted for backward compatibility but should
> not be used in new configs.

### Config locations and precedence

OpenCode merges config from multiple sources. Later layers override earlier
ones; non-conflicting keys from all layers are preserved.

| Priority | Source                                                                  |
| -------- | ----------------------------------------------------------------------- |
| 1 (lowest) | `.well-known/opencode` remote endpoint (org-wide defaults)            |
| 2        | `~/.config/opencode/opencode.json`                                      |
| 3        | `OPENCODE_CONFIG` env var (custom path)                                  |
| 4        | `opencode.json` in project root                                          |
| 5        | `.opencode/` directories (agents, commands, plugins, …)                  |
| 6        | `OPENCODE_CONFIG_DIR` env var (custom directory; same layout as `.opencode/`) |
| 7        | `OPENCODE_CONFIG_CONTENT` env var (inline JSON)                          |
| 8        | `/Library/Application Support/opencode/` (macOS) / `/etc/opencode/` (Linux) / `%ProgramData%\opencode` (Windows) |
| 9 (highest) | macOS MDM `.mobileconfig` (enforced, not overridable)               |

> `OPENCODE_CONFIG_DIR` swaps in a custom directory that is searched for
> `agents/`, `commands/`, `plugins/`, etc. — the same way `.opencode/` is —
> and overrides matching entries from the standard locations.

### Minimal vs full example

**Minimal:**

```json
{ "$schema": "https://opencode.ai/config.json" }
```

**Recommended for a team:**

```json
{
  "$schema": "https://opencode.ai/config.json",
  "model": "anthropic/claude-sonnet-4-5",
  "small_model": "anthropic/claude-haiku-4-5",
  "default_agent": "build",
  "share": "manual",
  "plugin": ["opencode-wakatime"],
  "instructions": ["CONTRIBUTING.md", ".cursor/rules/*.md"],
  "permission": {
    "edit": "ask",
    "bash": { "*": "ask", "git *": "allow", "npm *": "allow" }
  }
}
```

---

## Asset Frontmatter Rules

### 1. Agents — `.opencode/agents/<name>.md`

Specialized personas with their own model, tools, and permissions. The
**filename** (without `.md`) becomes the agent name; there is no `name`
field in frontmatter. For tool-agnostic guidance on agent descriptions,
prompts, and delegation boundaries, see [agents.md](agents.md).

OpenCode distinguishes two agent **modes**: `primary` (user-facing,
Tab-cycleable) and `subagent` (invoked by other agents, programmatically, or
via `@mention`). Built-in primary agents are `build` (full access) and
`plan` (read-only / `ask` for edits). Built-in subagents are `general`,
`explore`, and `scout`.

```yaml
---
description: Reviews code for quality, bugs, and performance      # REQUIRED
mode: subagent                                  # primary | subagent | all (default: all)
model: anthropic/claude-sonnet-4-5              # provider/model-id
variant: high                                   # provider-defined variant
temperature: 0.1
top_p: 0.9
steps: 10                                       # max agentic iterations
hidden: false                                   # hide from @ autocomplete (subagents)
color: "#ff6b6b"                                # hex or named (primary, accent, …)
disable: false
permission:
  edit: deny
  bash:
    "*": ask
    "git diff": allow
    "git log*": allow
    "grep *": allow
  webfetch: deny
  skill:
    "documents-*": allow
---

You are a code reviewer. Focus on:
- Code quality and best practices
- Potential bugs and edge cases
- Performance implications
```

| Field         | Required | Type                                    | Notes                                                                          |
| ------------- | -------- | --------------------------------------- | ------------------------------------------------------------------------------ |
| `description` | **Yes**  | string                                  | Used for `@` autocomplete and subagent selection by the model.                 |
| `mode`        | No       | `"primary"` \| `"subagent"` \| `"all"`   | Default: `"all"`. `primary` shows in Tab cycle; `subagent` invokable via `@`. |
| `model`       | No       | string                                  | `provider/model-id`; falls back to top-level `model`.                          |
| `variant`     | No       | string                                  | Provider-defined (e.g. Anthropic `high`/`max`; OpenAI `minimal`/`low`/…/`xhigh`).|
| `temperature` | No       | number                                  | 0.0–1.0.                                                                       |
| `top_p`       | No       | number                                  | 0.0–1.0.                                                                       |
| `steps`       | No       | integer                                 | Max agentic iterations before a forced text-only reply.                        |
| `hidden`      | No       | boolean                                 | Hide from `@` autocomplete (subagents only).                                   |
| `color`       | No       | string                                  | Hex `#RRGGBB`, or theme token: `primary`, `secondary`, `accent`, `success`, `warning`, `error`, `info`. |
| `disable`     | No       | boolean                                 | Disable the agent entirely.                                                    |
| `prompt`      | No       | string                                  | Literal system prompt **or** `{file:./relative/path}` reference. The body of the markdown file serves the same purpose; use `prompt` in JSON form. |
| `permission`  | No       | object                                  | Per-agent permission overrides — see [Permissions](#permissions).              |
| `tools`       | No       | object                                  | **Deprecated.** Use `permission` instead.                                      |

**Body conventions:**

- Markdown; becomes the agent's system prompt.
- Reference files with `@path/to/file` to inject content.
- Reference shell command output with `` !`command` ``.

#### JSON form (alternative)

You can also define agents under `agent` in `opencode.json`. JSON-defined
agents take precedence over markdown agents with the same name.

```json
{
  "agent": {
    "code-reviewer": {
      "description": "Reviews code for best practices and potential issues",
      "mode": "subagent",
      "model": "anthropic/claude-sonnet-4-5",
      "variant": "high",
      "temperature": 0.1,
      "steps": 10,
      "color": "accent",
      "prompt": "{file:./prompts/code-review.txt}",
      "permission": {
        "edit": "deny",
        "bash": { "*": "ask", "git *": "allow" }
      },
      "options": {},
      "reasoningEffort": "high"
    }
  }
}
```

The `prompt` field accepts a literal string or a `{file:./relative/path.txt}`
reference. Unknown keys (e.g. `reasoningEffort`) are passed through to the
model provider as options.

**Create interactively:**

```bash
opencode agent create
```

Walks through location (global/project), description, generated system
prompt, and permissions; writes the markdown file for you.

---

### 2. Commands — `.opencode/commands/<name>.md`

Slash-command prompts invoked as `/<filename>` in the TUI. Commands are
**user-invoked** (the LLM does not auto-select them). The filename (without
`.md`) becomes the command name.

```yaml
---
description: Run tests with coverage             # REQUIRED — shown in /-menu
agent: build                                     # optional — agent to run with
model: anthropic/claude-haiku-4-5                # optional — override model
subtask: false                                   # optional — force subagent invocation
---

Run the full test suite with coverage report.
Focus on the failing tests and suggest fixes.

Recent commits:
!`git log --oneline -10`

Review the diff:
@.git/HEAD
```

| Field         | Required | Type    | Notes                                                                  |
| ------------- | -------- | ------- | ---------------------------------------------------------------------- |
| `description` | **Yes**  | string  | Shown in TUI `/` autocomplete.                                         |
| `agent`       | No       | string  | Agent to run the command with. If a subagent, triggers subagent mode.  |
| `model`       | No       | string  | Override the default/agent model for this command.                     |
| `subtask`     | No       | boolean | Force subagent invocation even if the named agent is `primary`.        |

#### Template placeholders

| Placeholder        | Resolves to                                                  |
| ------------------ | ------------------------------------------------------------ |
| `$ARGUMENTS`       | Full argument string after the command name.                 |
| `$1`, `$2`, …      | Positional args (space- or quote-separated).                 |
| `` !`command` ``   | Shell command output, injected at prompt-build time.          |
| `@path/to/file`    | File contents, injected at prompt-build time.                |

**Example with arguments:**

```yaml
---
description: Create a new React component
---

Create a React component named $ARGUMENTS with TypeScript.
```

Invoked as `/component Button`.

#### JSON form

```json
{
  "command": {
    "test": {
      "template": "Run the full test suite. Focus on failing tests.",
      "description": "Run tests with coverage",
      "agent": "build",
      "model": "anthropic/claude-haiku-4-5"
    }
  }
}
```

| Field         | Required | Notes                                         |
| ------------- | -------- | --------------------------------------------- |
| `template`    | **Yes**  | The prompt template (body, in markdown form). |
| `description` | **Yes**  | Same as the markdown frontmatter field.       |
| `agent`       | No       | Same.                                         |
| `model`       | No       | Same.                                         |

Custom commands override built-ins of the same name. Built-ins include
`/init`, `/undo`, `/redo`, `/share`, `/help`, `/connect`, `/models`,
`/theme`.

---

### 3. Skills — `.opencode/skills/<name>/SKILL.md`

Reusable behaviour bundles loaded **on-demand** by the agent via the `skill`
tool when the description matches the task. Unlike commands, skills are
model-invoked, not user-invoked. For tool-agnostic guidance on description
quality, progressive disclosure, and bundled assets, see
[skills.md](skills.md).

```yaml
---
name: git-release                          # REQUIRED — must match directory name
description: Create consistent releases and changelogs    # REQUIRED — 1–1024 chars
license: MIT                               # optional
compatibility: opencode                    # optional
metadata:                                  # optional — string-to-string map
  audience: maintainers
  workflow: github
---

## What I do
- Draft release notes from merged PRs
- Propose a version bump

## When to use me
Use this when preparing a tagged release.
```

| Field           | Required | Type   | Notes                                                                       |
| --------------- | -------- | ------ | --------------------------------------------------------------------------- |
| `name`          | **Yes**  | string | 1–64 chars, regex `^[a-z0-9]+(-[a-z0-9]+)*$`. **Must match directory name.**|
| `description`   | **Yes**  | string | 1–1024 chars; describe capability **and** trigger conditions.               |
| `license`       | No       | string | SPDX identifier.                                                            |
| `compatibility` | No       | string | Tool the skill targets (e.g. `opencode`).                                   |
| `metadata`      | No       | object | Free-form string-to-string map for tooling/discovery.                       |

**Skill search paths** (first match per `<name>` wins):

| Order | Path                              | Notes                                  |
| ----- | --------------------------------- | -------------------------------------- |
| 1     | `.opencode/skills/<name>/SKILL.md` | Project, native                        |
| 2     | `.claude/skills/<name>/SKILL.md`   | Project, Claude compat                 |
| 3     | `.agents/skills/<name>/SKILL.md`   | Project, agent compat                  |
| 4     | `~/.config/opencode/skills/<name>/SKILL.md` | Global, native                |
| 5     | `~/.claude/skills/<name>/SKILL.md` | Global, Claude compat (disable with `OPENCODE_DISABLE_CLAUDE_CODE_SKILLS=1`) |
| 6     | `~/.agents/skills/<name>/SKILL.md` | Global, agent compat                   |

Path traversal walks up from CWD to the git worktree root.

**Skill loading permission:**

```json
{
  "permission": {
    "skill": {
      "*": "allow",
      "pr-review": "allow",
      "internal-*": "deny",
      "experimental-*": "ask"
    }
  }
}
```

---

### 4. Plugins — `.opencode/plugins/<name>.{ts,js}`

JavaScript/TypeScript modules that subscribe to lifecycle events and/or
register custom tools. There is **no frontmatter and no manifest** —
the export shape is the contract.

```typescript
import type { Plugin } from "@opencode-ai/plugin"

export const MyPlugin: Plugin = async ({
  project, client, $, directory, worktree,
}) => {
  return {
    // Event handlers (see Lifecycle events below)
    "session.idle": async ({ event }) => {
      // Session went idle
    },
    "tool.execute.before": async (input, output) => {
      // input.tool === "bash" | "read" | "apply_patch" | …
      // Mutate output.args to modify the call
    },

    // Custom tools (registered for this session)
    tool: {
      mytool: tool({
        description: "Do a thing",
        args: { query: tool.schema.string() },
        async execute(args, ctx) {
          return `did ${args.query}`
        },
      }),
    },
  }
}
```

#### Plugin context

| Property    | Description                                                  |
| ----------- | ------------------------------------------------------------ |
| `project`   | Current project metadata.                                    |
| `directory` | Current working directory.                                   |
| `worktree`  | Git worktree root path.                                      |
| `client`    | `@opencode-ai/sdk` client for API calls back into OpenCode.  |
| `$`         | Bun's shell API (`Bun.$`) for running shell commands.        |

#### Distribution

| Channel    | How                                                                                       |
| ---------- | ----------------------------------------------------------------------------------------- |
| Local file | Drop `<name>.ts` or `<name>.js` in `.opencode/plugins/` or `~/.config/opencode/plugins/`. |
| npm        | Publish a package and list it in `plugin: ["my-pkg"]` in `opencode.json`. Bun installs at startup; cached in `~/.cache/opencode/node_modules/`. |
| Local deps | Add a `package.json` in the config dir; `bun install` runs automatically on startup.      |

#### Load order

1. Global config npm plugins (`~/.config/opencode/opencode.json` `plugin: […]`)
2. Project config npm plugins (`opencode.json` `plugin: […]`)
3. Global plugin directory (`~/.config/opencode/plugins/`)
4. Project plugin directory (`.opencode/plugins/`)

Identical npm packages (same name + version) are deduplicated.

#### Lifecycle events (full list)

OpenCode does not have a separate "hooks" feature — hooks are subscribed to
through the plugin event system. For tool-agnostic hook design guidance, see
[hooks.md](hooks.md).

| Category       | Events                                                                                                  |
| -------------- | ------------------------------------------------------------------------------------------------------- |
| Command        | `command.executed`                                                                                      |
| File           | `file.edited`, `file.watcher.updated`                                                                   |
| Installation   | `installation.updated`                                                                                  |
| LSP            | `lsp.client.diagnostics`, `lsp.updated`                                                                 |
| Message        | `message.part.removed`, `message.part.updated`, `message.removed`, `message.updated`                    |
| Permission     | `permission.asked`, `permission.replied`                                                                |
| Server         | `server.connected`                                                                                      |
| Session        | `session.created`, `session.compacted`, `session.deleted`, `session.diff`, `session.error`, `session.idle`, `session.status`, `session.updated` |
| Todo           | `todo.updated`                                                                                          |
| Shell          | `shell.env`                                                                                             |
| Tool           | `tool.execute.before`, `tool.execute.after`                                                             |
| TUI            | `tui.prompt.append`, `tui.command.execute`, `tui.toast.show`                                            |
| Experimental   | `experimental.session.compacting`                                                                       |

#### Common hook patterns

```typescript
// Catch-all listener for any event
event: async ({ event }) => {
  if (event.type === "session.idle") { /* … */ }
},

// Pure event listener for a specific event
"session.idle": async ({ event }) => { /* … */ },

// Modify tool args before execution
"tool.execute.before": async (input, output) => {
  if (input.tool === "bash") output.args.command = `nice ${output.args.args.command}`
},

// Inject shell env vars
"shell.env": async (input, output) => {
  output.env.PROJECT_ROOT = input.cwd
},

// Steer auto-compaction (experimental)
"experimental.session.compacting": async (input, output) => {
  output.context.push("## Extra context to preserve…")
  // OR: output.prompt = "Full custom compaction prompt…"
},
```

> **Gotcha:** When intercepting patch edits, match on
> `input.tool === "apply_patch"` (not `"patch"`), and use
> `output.args.patchText` (not `filePath`).

---

### 5. Custom Tools — `.opencode/tools/<name>.{ts,js}`

Standalone tools the agent can call directly, without going through MCP. The
filename becomes the tool name; multiple named exports get the prefix form
`<filename>_<exportname>` (e.g. `math.ts` with `add` export → `math_add`).
Custom tools can override built-ins of the same name.

```typescript
import { tool } from "@opencode-ai/plugin"

export default tool({
  description: "Query the team database",
  args: {
    query: tool.schema.string().describe("SQL query"),
    limit: tool.schema.number().optional().describe("Max rows"),
  },
  async execute(args, ctx) {
    const { agent, sessionID, messageID, directory, worktree } = ctx
    // …
    return `rows for ${args.query}`
  },
})
```

The `tool()` helper, the `Plugin` type, and `tool.schema` (re-exported Zod)
come from the [`@opencode-ai/plugin`](https://www.npmjs.com/package/@opencode-ai/plugin)
package.

---

### 6. MCP Servers — inline under `mcp` in `opencode.json`

Model Context Protocol server definitions. No separate `.mcp.json` file; MCP
config lives inline in the main config. For tool-agnostic MCP design and
transport guidance, see [mcp-servers.md](mcp-servers.md).

#### Local (stdio) MCP server

```jsonc
{
  "mcp": {
    "my-local-mcp": {
      "type": "local",
      "command": ["npx", "-y", "my-mcp-command"],
      "enabled": true,
      "environment": { "MY_ENV_VAR": "value" },
      "timeout": 5000
    }
  }
}
```

| Field         | Required | Type     | Notes                                |
| ------------- | -------- | -------- | ------------------------------------ |
| `type`        | **Yes**  | `"local"`| Identifies a stdio server.           |
| `command`     | **Yes**  | string[] | Command + args to start the server.  |
| `environment` | No       | object   | Env vars for the server process.     |
| `enabled`     | No       | boolean  | Enable/disable at startup.           |
| `timeout`     | No       | number   | Tool-fetch timeout (ms, default 5000).|

#### Remote (HTTP/SSE) MCP server

```jsonc
{
  "mcp": {
    "my-remote-mcp": {
      "type": "remote",
      "url": "https://mcp.example.com/mcp",
      "enabled": true,
      "headers": { "Authorization": "Bearer {env:MY_API_KEY}" },
      "oauth": {
        "clientId": "{env:MY_MCP_CLIENT_ID}",
        "clientSecret": "{env:MY_MCP_CLIENT_SECRET}",
        "scope": "tools:read tools:execute"
      },
      "timeout": 5000
    }
  }
}
```

| Field     | Required | Type             | Notes                                                                  |
| --------- | -------- | ---------------- | ---------------------------------------------------------------------- |
| `type`    | **Yes**  | `"remote"`       | Identifies an HTTP/SSE server.                                          |
| `url`     | **Yes**  | string           | Remote server URL.                                                      |
| `enabled` | No       | boolean          | Enable/disable.                                                         |
| `headers` | No       | object           | Request headers. `{env:VAR}` interpolation supported.                   |
| `oauth`   | No       | object \| `false` | OAuth config; set `false` to disable auto-detection on 401 responses.  |
| `timeout` | No       | number           | Tool-fetch timeout (ms, default 5000).                                  |

**OAuth flow:** On a 401, OpenCode initiates Dynamic Client Registration
(RFC 7591) and stores tokens in `~/.local/share/opencode/mcp-auth.json`.
Manage via CLI: `opencode mcp auth <name>`, `opencode mcp list`,
`opencode mcp logout <name>`, `opencode mcp debug <name>`.

#### Tool naming and permissions

MCP tools are exposed to the model as `<server-name>_<tool-name>` (e.g.
server `gh_grep` exposing `search` → tool `gh_grep_search`). Gate them with
the same permission system used for built-ins:

```json
{ "permission": { "mymcp_*": "ask" } }
```

Per-agent control:

```json
{
  "tools": { "my-mcp*": false },
  "agent": {
    "my-agent": { "tools": { "my-mcp*": true } }
  }
}
```

---

### 7. LSP Servers — inline under `lsp` in `opencode.json`

LSP integration provides real-time diagnostics back to the model. Disabled
by default; enable all built-ins with `"lsp": true`.

```jsonc
{
  "lsp": {
    "typescript": { "disabled": false },
    "rust": {
      "command": ["rust-analyzer"],
      "env": { "RUST_LOG": "debug" }
    },
    "custom-lsp": {
      "command": ["custom-lsp-server", "--stdio"],
      "extensions": [".custom"],
      "initialization": {
        "preferences": { "importModuleSpecifierPreference": "relative" }
      }
    }
  }
}
```

| Field            | Type     | Notes                                                                |
| ---------------- | -------- | -------------------------------------------------------------------- |
| `disabled`       | boolean  | Disable this LSP.                                                    |
| `command`        | string[] | Command to start the server. Optional for built-ins.                  |
| `extensions`     | string[] | File extensions this server handles.                                 |
| `env`            | object   | Env vars when starting the server.                                   |
| `initialization` | object   | LSP `initialize` request options.                                    |

**Built-in LSP server keys (partial):** `astro`, `bash`, `clangd`, `csharp`,
`clojure-lsp`, `dart`, `deno`, `elixir-ls`, `eslint`, `fsharp`, `gleam`,
`gopls`, `hls`, `jdtls`, `julials`, `kotlin-ls`, `lua-ls`, `nixd`,
`ocaml-lsp`, `oxlint`, `php`, `prisma`, `pyright`, `razor`, `ruby-lsp`,
`rust`, `sourcekit-lsp`, `svelte`, `terraform`, `tinymist`, `typescript`,
`vue`, `yaml-ls`, `zls`.

Many auto-install on project detection. LSP queries can also be permission-
gated as `"lsp": "ask"`.

---

### 8. Themes — `.opencode/themes/<name>.json`

Color themes selectable via `/theme` in the TUI or pinned in `tui.json`:

```json
{
  "$schema": "https://opencode.ai/tui.json",
  "theme": "tokyonight"
}
```

#### Custom theme schema

```jsonc
{
  "$schema": "https://opencode.ai/theme.json",
  "defs": { "mycolor": "#2E3440" },
  "theme": {
    "primary":   { "dark": "#88C0D0", "light": "#5E81AC" },
    "secondary": { "dark": "#81A1C1", "light": "#81A1C1" },
    "accent":    { "dark": "#8FBCBB", "light": "#8FBCBB" },
    "error":     { "dark": "#BF616A", "light": "#BF616A" },
    "warning":   { "dark": "#D08770", "light": "#D08770" },
    "success":   { "dark": "#A3BE8C", "light": "#A3BE8C" },
    "info":      { "dark": "#88C0D0", "light": "#5E81AC" },
    "text":      { "dark": "#D8DEE9", "light": "#2E3440" },
    "textMuted": { "dark": "#4C566A", "light": "#3B4252" },
    "background":{ "dark": "#2E3440", "light": "#ECEFF4" },
    "border":    { "dark": "#434C5E", "light": "#4C566A" }
    // …diff*, markdown*, syntax* tokens
  }
}
```

Color values: hex string, ANSI number `0`–`15`, named color reference
(`"primary"`), a dark/light object `{"dark": "…", "light": "…"}`, or
`"none"` (terminal default).

**Theme search order** (later layers override earlier; highest number wins):

| Order | Location                                          |
| ----- | ------------------------------------------------- |
| 1     | Built-in (shipped with the binary)                |
| 2     | `~/.config/opencode/themes/*.json`                |
| 3     | `<project-root>/.opencode/themes/*.json`          |
| 4     | `./.opencode/themes/*.json` (current directory)   |

**Built-in themes:** `opencode` (default), `system` (terminal-adaptive),
`tokyonight`, `everforest`, `ayu`, `catppuccin`, `catppuccin-macchiato`,
`gruvbox`, `kanagawa`, `nord`, `matrix`, `one-dark`, and more.

---

### 9. Rules — `AGENTS.md` (no frontmatter)

Always-on instructions loaded into every prompt. OpenCode walks up from CWD
to the git worktree root, then falls through to the global config dir, then
(unless disabled) the Claude Code equivalents.

| Location                            | Scope                                                       |
| ----------------------------------- | ----------------------------------------------------------- |
| `<project-root>/AGENTS.md`          | Project (commit to git).                                    |
| Any parent dir up to git root       | Walked automatically.                                       |
| `~/.config/opencode/AGENTS.md`      | Global personal rules.                                      |
| `CLAUDE.md` in project dir          | Fallback if no `AGENTS.md`.                                 |
| `~/.claude/CLAUDE.md`               | Fallback if no global `AGENTS.md` (disable with env var).   |

First match per category wins; `AGENTS.md` always beats `CLAUDE.md`.

Generate one from a project scan with `/init`.

**Extra always-on files** via `opencode.json` `instructions`:

```json
{
  "instructions": [
    "CONTRIBUTING.md",
    "docs/guidelines.md",
    ".cursor/rules/*.md",
    "packages/*/AGENTS.md",
    "https://raw.githubusercontent.com/my-org/shared/main/style.md"
  ]
}
```

Globs and remote URLs (5 s fetch timeout) are supported. There is **no
built-in file-pattern conditional scoping** (unlike Cursor's `*.py` rules).
The conventional workaround is to teach `AGENTS.md` to lazy-load specific
rule files:

```markdown
For TypeScript code: @docs/typescript-guidelines.md
For React components: @docs/react-patterns.md
```

---

## Permissions

OpenCode gates every tool invocation through a permission system. There are
three actions: `"allow"`, `"ask"`, `"deny"`.

### Shorthand

```json
{ "permission": "allow" }          // allow everything
{ "permission": { "*": "ask" } }   // ask for everything
```

### Granular form (last matching rule wins)

```json
{
  "permission": {
    "bash": {
      "*": "ask",
      "git *": "allow",
      "npm *": "allow",
      "rm *": "deny",
      "grep *": "allow"
    },
    "edit": {
      "*": "deny",
      "packages/web/src/content/docs/*.mdx": "allow"
    },
    "webfetch": "deny",
    "skill": { "internal-*": "deny" }
  }
}
```

### Available permission keys

| Key                  | Gates                                                                            |
| -------------------- | -------------------------------------------------------------------------------- |
| `read`               | `read` tool (path match). `.env`/`.env.*` denied by default; `.env.example` ok. |
| `edit`               | `write`, `edit`, `apply_patch`.                                                  |
| `glob`               | `glob` tool.                                                                     |
| `grep`               | `grep` tool.                                                                     |
| `list`               | `list` tool.                                                                     |
| `bash`               | `bash` tool (command-string match).                                              |
| `task`               | `task` tool (subagent dispatch).                                                 |
| `skill`              | `skill` tool (skill-name match).                                                 |
| `external_directory` | Any tool touching paths outside the project root. Default `"ask"`.               |
| `todowrite`          | `todowrite` and `todoread`.                                                      |
| `question`           | `question` tool.                                                                 |
| `webfetch`           | `webfetch` (URL match).                                                          |
| `websearch`          | `websearch` (query match).                                                       |
| `lsp`                | LSP queries.                                                                     |
| `doom_loop`          | Repeat-call detection (same tool with identical input 3×). Default `"ask"`.      |
| `repo_clone`         | Repository cloning (used by `scout`).                                            |
| `repo_overview`      | Repository overview.                                                             |

`~/projects/*` and `$HOME/projects/*` expand to absolute paths in patterns.

> **Pattern-capable vs action-only keys:** Only a subset of permission keys
> accept the `{ "pattern": action }` map form: `read`, `edit`, `glob`,
> `grep`, `list`, `bash`, `task`, `skill`, `external_directory`, `lsp`,
> `repo_clone`, `repo_overview`. The remaining keys (`todowrite`,
> `question`, `webfetch`, `websearch`, `doom_loop`) are **action-only** —
> set them to a single `"allow"`, `"ask"`, or `"deny"` value.

### Per-agent override

```json
{
  "permission": { "bash": { "*": "ask", "git *": "allow" } },
  "agent": {
    "build": {
      "permission": {
        "bash": { "*": "ask", "git *": "allow", "git push *": "deny" }
      }
    }
  }
}
```

Agent permissions merge with the top-level; agent-level rules take
precedence on overlap.

---

## Providers

`provider/model-id` is the canonical model address. Configure providers
and per-model overrides under `provider`:

```jsonc
{
  "provider": {
    "anthropic": {
      "options": {
        "apiKey": "{env:ANTHROPIC_API_KEY}",
        "baseURL": "https://api.anthropic.com/v1",
        "timeout": 600000,
        "chunkTimeout": 30000,
        "setCacheKey": true
      },
      "models": {
        "claude-sonnet-4-5-20250929": {
          "options": {
            "thinking": { "type": "enabled", "budgetTokens": 16000 }
          }
        }
      }
    },
    "my-local-llm": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "My Local LLM",
      "options": { "baseURL": "http://localhost:1234/v1" },
      "models": {
        "my-model": { "name": "My Model Name" }
      }
    }
  }
}
```

**Model variants** (provider-specific):

| Provider  | Built-in variants                                  |
| --------- | -------------------------------------------------- |
| Anthropic | `high`, `max`                                      |
| OpenAI    | `none`, `minimal`, `low`, `medium`, `high`, `xhigh` |
| Google    | `low`, `high`                                      |

Custom variants:

```json
{
  "provider": {
    "openai": {
      "models": {
        "gpt-5": {
          "variants": {
            "thinking": { "reasoningEffort": "high", "textVerbosity": "low" },
            "fast":     { "disabled": true }
          }
        }
      }
    }
  }
}
```

**Credentials** are stored in `~/.local/share/opencode/auth.json` and
managed via `/connect` in the TUI. 75+ providers are supported via
Models.dev (Anthropic, OpenAI, Azure OpenAI, Amazon Bedrock, OpenRouter,
Cerebras, Cloudflare, DeepSeek, DeepInfra, Fireworks, GitHub Copilot OAuth,
ChatGPT OAuth, OpenCode Zen, and more).

---

## Marketplace and Distribution

> **OpenCode has no first-party marketplace.** The
> [ecosystem page](https://opencode.ai/docs/ecosystem) lists ~40+ community
> plugins, and the [awesome-opencode](https://github.com/awesome-opencode/awesome-opencode)
> repo and `opencode.cafe` site aggregate community resources. Plugins are
> distributed as **npm packages** and installed by listing them in
> `opencode.json`:
>
> ```json
> { "plugin": ["opencode-wakatime", "@my-org/custom-plugin"] }
> ```

Agents, commands, skills, themes, and custom tools are **not** distributable
through `plugin: []` — they must be authored in (or copied into) the
project's `.opencode/` directory or the user's global config directory. A
plugin npm package _can_ register **custom tools and hook event handlers**
at runtime through the SDK, but file-based assets (agents, commands,
skills, themes) cannot be auto-installed by listing the package.

---

## Cross-Cutting Rules

### Environment variables

| Variable                              | Resolves to / effect                                                  |
| ------------------------------------- | --------------------------------------------------------------------- |
| `OPENCODE_CONFIG`                     | Path to a custom config file (overrides project/global default).      |
| `OPENCODE_CONFIG_DIR`                 | Custom config directory; searched for agents, commands, plugins.      |
| `OPENCODE_CONFIG_CONTENT`             | Inline JSON config (highest user-level priority).                     |
| `OPENCODE_TUI_CONFIG`                 | Path to a custom TUI config file.                                     |
| `OPENCODE_INSTALL_DIR`                | Custom binary install path.                                            |
| `OPENCODE_DISABLE_CLAUDE_CODE`        | Disable all `.claude/` compatibility.                                 |
| `OPENCODE_DISABLE_CLAUDE_CODE_PROMPT` | Disable only `~/.claude/CLAUDE.md` fallback.                          |
| `OPENCODE_DISABLE_CLAUDE_CODE_SKILLS` | Disable only `.claude/skills/` fallback.                              |
| `XDG_BIN_DIR`                         | XDG-spec-compliant install path.                                       |
| `COLORTERM`                           | Set to `truecolor`/`24bit` for full theme support.                    |

**Provider env vars** (subset): `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`,
`AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY`/`AWS_PROFILE`/`AWS_REGION`/
`AWS_BEARER_TOKEN_BEDROCK`, `AZURE_RESOURCE_NAME`,
`AZURE_COGNITIVE_SERVICES_RESOURCE_NAME`, `DIGITALOCEAN_ACCESS_TOKEN`,
`CLOUDFLARE_ACCOUNT_ID`/`CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_API_KEY`/
`CLOUDFLARE_GATEWAY_ID`.

**Interpolation:** Inside string config values, `{env:VAR_NAME}` is
expanded at load time (used in `provider.options.apiKey`, MCP `headers`,
OAuth `clientSecret`, etc.).

### Naming

| Asset                  | Convention                                          | Example                |
| ---------------------- | --------------------------------------------------- | ---------------------- |
| Project                | Whatever the repo root is — no name validation.     | `my-app/`              |
| Config file            | `opencode.json` or `opencode.jsonc`                 | `opencode.json`        |
| TUI config             | `tui.json` or `tui.jsonc`                           | `tui.json`             |
| Agent file             | kebab-case `.md`; filename = agent name.            | `code-reviewer.md`     |
| Command file           | kebab-case `.md`; filename = `/command` name.       | `run-tests.md`         |
| Skill directory + `name` | regex `^[a-z0-9]+(-[a-z0-9]+)*$`, ≤64 chars.       | `git-release/`         |
| Plugin module          | kebab-case `.ts`/`.js`.                             | `format-on-save.ts`    |
| Custom tool            | kebab-case `.ts`/`.js`; multiple exports → `<file>_<export>`. | `math.ts` → `math_add` |
| Theme                  | kebab-case `.json`; filename = theme name.          | `my-theme.json`        |
| Provider id            | kebab-case key in `provider`.                       | `amazon-bedrock`       |
| MCP server id          | kebab-case key in `mcp`. Tool prefix = key + `_`.   | `gh_grep` → `gh_grep_search` |

### Cross-tool compatibility

OpenCode is **the most permissive** of the major coding agents about reading
other tools' configs:

| Other tool's file                  | Status in OpenCode                                                  |
| ---------------------------------- | ------------------------------------------------------------------- |
| `AGENTS.md`                        | Native primary rules file.                                          |
| `CLAUDE.md` (project)              | Used as fallback when no `AGENTS.md` exists in the same dir.        |
| `~/.claude/CLAUDE.md`              | Used as fallback when no `~/.config/opencode/AGENTS.md` exists.     |
| `.claude/skills/`                  | Searched for skills (Claude compat).                                |
| `~/.claude/skills/`                | Searched globally (Claude compat).                                  |
| `.cursor/rules/*.md`               | Loadable via `instructions: [".cursor/rules/*.md"]`.                |
| `.github/copilot-instructions.md`  | **Not** auto-loaded; can be referenced via `instructions: [...]`.   |
| `.claude/commands/`                | **Not** auto-loaded — use `.opencode/commands/` instead.            |
| Copilot extension format           | **Not** supported.                                                  |

Disable Claude compatibility via the `OPENCODE_DISABLE_CLAUDE_CODE*` env
vars listed above.

### Validation

OpenCode has no `validate` CLI subcommand. Validation relies on:

- JSON schema autocompletion in editors via the `$schema` references
  (`https://opencode.ai/config.json`, `https://opencode.ai/tui.json`,
  `https://opencode.ai/theme.json`).
- Skill `name` is validated against `^[a-z0-9]+(-[a-z0-9]+)*$` at load time;
  mismatched dir/name fails silently with a log message.
- MCP tool fetch respects `timeout` (default 5000 ms) before being marked
  unavailable.
- LSP servers report startup failures in the diagnostics pane.

For automated linting, use a generic JSON-schema validator (e.g.
`ajv-cli`) against the schemas above.

---

## SDK overview

| Package                          | Purpose                                                                       |
| -------------------------------- | ----------------------------------------------------------------------------- |
| `@opencode-ai/plugin` (npm)      | `Plugin` type and `tool()` helper for authoring plugins and custom tools.     |
| `@opencode-ai/sdk` (npm)         | Server-control SDK for external integrations (Discord bots, Neovim, CI). Exposes `createOpencode` (embedded server) and `createOpencodeClient` (connect to existing). Namespaces: `global`, `app`, `project`, `path`, `config`, `session`, `find`, `file`, `tui`, `auth`, `event`. |

`session.prompt` supports structured output via
`format: { type: "json_schema", schema: {…} }`. Real-time events are
available through `event.subscribe()` (SSE stream).

---

## Implications for this repo's transpiler

This repo's [AGENTS.md](../AGENTS.md) frames OpenCode as a possible **third
transpile target** alongside Claude and Copilot. OpenCode is not a drop-in
target — a future `tools/transpilers/opencode.mjs` has to do real
conversions, not file copies:

| Source artifact in `plugins/<name>/`  | Action for `dist/opencode/<name>/`                                            |
| ------------------------------------- | ----------------------------------------------------------------------------- |
| `plugin.yaml` (top-level fields)      | Merge into project `opencode.json` (no per-plugin manifest equivalent).        |
| `agents/<name>.md` (no frontmatter)   | Emit `agents/<name>.md` with OpenCode frontmatter (`description`, `mode`, `model`, `permission`, …). |
| `skills/<name>/SKILL.md` + bundled    | Emit `skills/<name>/SKILL.md` — `name` and `description` fields map directly; other Claude/Copilot skill fields drop. |
| `.mcp.json`                           | **Convert** into entries under `mcp` in `opencode.json` (no standalone file). |
| `hooks/hooks.json`                    | **Convert** into `plugins/<name>.ts` event handlers (JSON hooks have no native form). |
| `scripts/`                            | Copy verbatim; shell-invoked from plugin code rather than declarative hooks.   |
| `${CLAUDE_PLUGIN_ROOT}` references    | Rewrite to absolute paths or to plugin-context values — OpenCode does not honour this variable. |

There is also **no marketplace registry** to generate for OpenCode (unlike
`.claude-plugin/marketplace.json` and `.github/plugin/marketplace.json`).
Distribution happens through npm packages listed in users' `opencode.json`
`plugin: [...]`, or by users copying `.opencode/` directories into their
projects.

---

## References

### Official OpenCode documentation (authoritative)

| Source                              | URL                                       |
| ----------------------------------- | ----------------------------------------- |
| Docs index                          | https://opencode.ai/docs/                 |
| Config reference                    | https://opencode.ai/docs/config           |
| Config JSON schema                  | https://opencode.ai/config.json           |
| TUI config schema                   | https://opencode.ai/tui.json              |
| Theme schema                        | https://opencode.ai/theme.json            |
| Agents                              | https://opencode.ai/docs/agents           |
| Commands                            | https://opencode.ai/docs/commands         |
| Skills                              | https://opencode.ai/docs/skills           |
| Plugins                             | https://opencode.ai/docs/plugins          |
| Custom tools                        | https://opencode.ai/docs/custom-tools     |
| MCP servers                         | https://opencode.ai/docs/mcp-servers      |
| Permissions                         | https://opencode.ai/docs/permissions      |
| LSP                                 | https://opencode.ai/docs/lsp              |
| Themes                              | https://opencode.ai/docs/themes           |
| Models                              | https://opencode.ai/docs/models           |
| Providers                           | https://opencode.ai/docs/providers        |
| Rules / `AGENTS.md`                 | https://opencode.ai/docs/rules            |
| SDK                                 | https://opencode.ai/docs/sdk              |
| Ecosystem (community plugins)       | https://opencode.ai/docs/ecosystem        |

### Source / packages

| Source                              | URL                                                                       |
| ----------------------------------- | ------------------------------------------------------------------------- |
| GitHub repository                   | https://github.com/anomalyco/opencode (formerly `sst/opencode`)            |
| Plugin SDK source                   | https://github.com/anomalyco/opencode/tree/main/packages/plugin           |
| SDK types                           | https://github.com/anomalyco/opencode/tree/main/packages/sdk/js/src/gen   |
| npm: `opencode-ai` (CLI)            | https://www.npmjs.com/package/opencode-ai                                 |
| npm: `@opencode-ai/plugin`          | https://www.npmjs.com/package/@opencode-ai/plugin                         |
| npm: `@opencode-ai/sdk`             | https://www.npmjs.com/package/@opencode-ai/sdk                            |

### Format references in this repo

| Source                | URL                              |
| --------------------- | -------------------------------- |
| Claude format spec    | [claude.md](claude.md)           |
| Copilot format spec   | [copilot.md](copilot.md)         |
| Agent authoring guide | [agents.md](agents.md)           |
| Skill authoring guide | [skills.md](skills.md)           |
| Hook authoring guide  | [hooks.md](hooks.md)             |
| MCP server guide      | [mcp-servers.md](mcp-servers.md) |

### Community

| Source                                            | URL                                                          |
| ------------------------------------------------- | ------------------------------------------------------------ |
| awesome-opencode (curated list)                   | https://github.com/awesome-opencode/awesome-opencode         |
| opencode.cafe (community aggregator)              | https://opencode.cafe/                                       |
