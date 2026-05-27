# GitHub Copilot Plugin Reference

Frontmatter rules for every asset a Copilot plugin can ship, plus the full
`plugin.json` manifest structure.

**For tool-agnostic authoring guidance**, see:
[agents.md](agents.md), [skills.md](skills.md), [hooks.md](hooks.md),
[mcp-servers.md](mcp-servers.md). This file documents Copilot-specific
**format** only (full source list in [References](#references)).

---

## Plugin Directory Layout

A Copilot plugin is a folder containing a `plugin.json` manifest plus
component directories. The manifest can live in any of these locations (checked
in this order):

1. `.plugin/plugin.json`
2. `plugin.json` (root)
3. `.github/plugin/plugin.json` ← convention used by `awesome-copilot`
4. `.claude-plugin/plugin.json` ← cross-tool compatibility

Recommended layout:

```
my-plugin/
├── .github/plugin/plugin.json    # Manifest (Copilot convention)
├── README.md                     # Recommended
├── agents/
│   └── <name>.agent.md           # Custom agents
├── skills/
│   └── <skill-name>/
│       ├── SKILL.md              # Required for each skill
│       └── <bundled assets>      # Scripts, templates, examples
├── instructions/
│   └── <name>.instructions.md    # File-pattern instructions
├── prompts/
│   └── <name>.prompt.md          # Slash-command prompts
├── hooks/
│   ├── hooks.json                # Hook configuration
│   └── scripts/                  # Hook scripts
├── .mcp.json                     # MCP server definitions
└── workflows/
    └── <name>.md                 # Agentic Workflows (GitHub Actions)
```

**Rules:**

- Plugin and asset folder/file names use **kebab-case** (lowercase + hyphens).
- The `name` field in `plugin.json` must equal the plugin's directory name.
- Marketplace plugins (multiple plugins in one repo) are registered in
  `.github/plugin/marketplace.json` and/or `.claude-plugin/marketplace.json`.
- VS Code auto-detects the plugin format. Claude-format plugins also expose
  `${CLAUDE_PLUGIN_ROOT}`; pure Copilot-format plugins do not.

---

## `plugin.json` Manifest

The only required field is `name`. Everything else is optional.

### Full Schema

```jsonc
{
  // --- Required ---
  "name": "plugin-name",              // kebab-case, ≤64 chars, must match folder name

  // --- Metadata (optional) ---
  "description": "Short summary",     // ≤1024 chars
  "version": "1.0.0",                 // Semantic versioning
  "author": {
    "name": "Author Name",            // required if author present
    "email": "author@example.com",
    "url": "https://example.com"
  },
  "homepage": "https://example.com/plugin",
  "repository": "https://github.com/user/plugin-name",
  "license": "MIT",                   // SPDX identifier
  "keywords": ["testing", "ci-cd"],   // lowercase, hyphenated
  "category": "testing",              // CLI only
  "tags": ["unit-tests"],             // CLI only

  // --- Component paths (optional; defaults apply) ---
  "agents": "agents/",                // string | string[]; default: agents/
  "skills": "skills/",                // string | string[]; default: skills/
  "commands": "commands/",            // string | string[]; CLI only, no default
  "hooks": "hooks.json",              // string | inline object
  "mcpServers": ".mcp.json",          // string | inline object
  "lspServers": "lsp.json"            // CLI only
}
```

### Field Rules

| Field         | Required | Type             | Notes                                                                |
| ------------- | -------- | ---------------- | -------------------------------------------------------------------- |
| `name`        | Yes      | string           | `^[a-z0-9][a-z0-9-]{0,63}$`; no slashes, dots, colons, or namespaces |
| `description` | No       | string           | ≤1024 chars                                                          |
| `version`     | No       | string           | SemVer. Bump when publishing changes                                 |
| `author`      | No       | object           | `name` required; `email`, `url` optional                             |
| `homepage`    | No       | URL              | Plugin landing page                                                  |
| `repository`  | No       | URL              | Source repository                                                    |
| `license`     | No       | SPDX string      | `MIT`, `Apache-2.0`, `UNLICENSED`, …                                 |
| `keywords`    | No       | string[]         | Lowercase, hyphenated tags                                           |
| `agents`      | No       | string \| array  | Defaults to `agents/`                                                |
| `skills`      | No       | string \| array  | Defaults to `skills/`                                                |
| `commands`    | No       | string \| array  | CLI only; no default                                                 |
| `hooks`       | No       | string \| object | File path **or** inline hooks object                                 |
| `mcpServers`  | No       | string \| object | File path **or** inline MCP server map                               |
| `lspServers`  | No       | string \| object | CLI only                                                             |

> **Critical:** `name` is validated strictly. Slashes (`myorg/plugin`), colons,
> uppercase, or invalid characters cause the plugin to **silently fail to
> load**. The same rule applies to skill `name` fields.

### Minimal vs Recommended Examples

**Minimal:**

```json
{ "name": "hello-world" }
```

**Recommended for distribution:**

```json
{
  "name": "my-dev-tools",
  "description": "React development utilities",
  "version": "1.2.0",
  "author": { "name": "Jane Doe", "email": "jane@example.com" },
  "license": "MIT",
  "keywords": ["react", "frontend"],
  "agents": "agents/",
  "skills": ["skills/", "extra-skills/"],
  "hooks": "hooks.json",
  "mcpServers": ".mcp.json"
}
```

### Marketplace Registry (`marketplace.json`)

For repos that publish multiple plugins, register them in
`.github/plugin/marketplace.json`:

```jsonc
{
  "name": "my-marketplace",
  "owner": { "name": "Your Org", "email": "plugins@example.com" },
  "metadata": { "description": "Curated plugins", "version": "1.0.0" },
  "plugins": [
    {
      "name": "frontend-design",            // required
      "source": "./plugins/frontend-design", // required; relative path, GitHub ref, or URL
      "description": "GUI scaffolding",
      "version": "2.1.0"
      // any plugin.json field (author, keywords, agents, skills, hooks, …)
      // may be overridden here
    }
  ]
}
```

Marketplace plugin entries support a `strict: boolean` field (default `true`)
for full schema validation; set to `false` for relaxed/legacy validation.

---

## Asset Frontmatter Rules

VS Code and Copilot CLI auto-discover assets from conventional folders. Each
asset type below documents the YAML frontmatter it supports.

### 1. Custom Agents — `agents/<name>.agent.md`

Specialized personas with their own tools, model, and instructions.

```yaml
---
description: 'Generate an implementation plan'   # required (awesome-copilot rule, single quotes)
name: 'Plan Agent'                               # optional, defaults to filename
argument-hint: 'feature to plan'                 # optional
tools: ['search', 'web/fetch', 'github/*']       # optional, recommended
model: 'Claude Sonnet 4.5 (copilot)'             # strongly recommended
agents: ['reviewer', 'implementer']              # subagent allowlist; '*' = all, [] = none
user-invocable: true                             # default true; false = hidden from picker
disable-model-invocation: false                  # default false; true = block subagent use
target: vscode                                   # vscode | github-copilot
mcp-servers: [...]                               # for target: github-copilot only
handoffs:                                        # optional sequential workflow
  - label: 'Start Implementation'
    agent: 'implementer'
    prompt: 'Now implement the plan above.'
    send: false                                  # default false
    model: 'GPT-5 (copilot)'                     # optional
hooks:                                           # preview; agent-scoped hooks
  PostToolUse:
    - type: command
      command: './scripts/format.sh'
---

You are a planning agent. Collect context, then produce a numbered plan…
```

| Field                      | Required                | Type                | Notes                                                                            |
| -------------------------- | ----------------------- | ------------------- | -------------------------------------------------------------------------------- |
| `description`              | **Yes** (awesome-copilot) | string (single-quoted) | Non-empty; shown as placeholder in chat input                                  |
| `name`                     | No                      | string              | Human-readable display name; defaults to filename                                |
| `argument-hint`            | No                      | string              | Hint text in the chat input                                                      |
| `tools`                    | No                      | string[]            | Tool / tool-set names. `<server>/*` includes all of an MCP server                |
| `model`                    | No (recommended)        | string \| string[]  | `Model Name (vendor)`, e.g. `Claude Sonnet 4.5 (copilot)`. Array = fallback list |
| `agents`                   | No                      | string[] \| `'*'`   | Allowed subagents. Requires the `agent` tool in `tools`                          |
| `user-invocable`           | No                      | boolean             | Default `true`. `false` hides from agents dropdown                               |
| `disable-model-invocation` | No                      | boolean             | Default `false`. `true` blocks invocation as a subagent                          |
| `target`                   | No                      | enum                | `vscode` (default) or `github-copilot`                                           |
| `mcp-servers`              | No                      | object[]            | Only for `target: github-copilot`                                                |
| `handoffs`                 | No                      | object[]            | See sub-fields below                                                             |
| `hooks` (Preview)          | No                      | object              | Agent-scoped hooks. Requires `chat.useCustomAgentHooks: true`                    |

**Handoff sub-fields:** `label` (required), `agent` (required), `prompt`,
`send` (default `false`), `model`.

**Body conventions:**

- Markdown. Prepended to the user prompt when the agent is active.
- Reference tools with `#tool:<tool-name>` (e.g. `#tool:web/fetch`).
- Reference workspace files with relative Markdown links.

**Claude format alternative** (`.claude/agents/<name>.md`):

```yaml
---
name: agent-name                              # required
description: What the agent does
tools: 'Read, Grep, Glob, Bash'               # comma-separated string
disallowedTools: 'Write, Edit'                # comma-separated string
---
```

---

### 2. Agent Skills — `skills/<skill-name>/SKILL.md`

Portable, on-demand capability bundles (Agent Skills open standard).

```yaml
---
name: skill-name                              # required, kebab-case, must match dir name
description: 'What the skill does and when to use it'   # required, 10-1024 chars, single-quoted
argument-hint: '[test file] [options]'        # optional
user-invocable: true                          # default true
disable-model-invocation: false               # default false
context: inline                               # inline (default) | fork (experimental)
---

# Skill Instructions

Detailed instructions, procedures, and examples. Reference bundled assets with
Markdown links: [test template](./test-template.js).
```

| Field                      | Required | Type    | Notes                                                                          |
| -------------------------- | -------- | ------- | ------------------------------------------------------------------------------ |
| `name`                     | **Yes**  | string  | kebab-case, ≤64 chars, no slashes/dots/colons. **Must match parent dir name**  |
| `description`              | **Yes**  | string  | 10-1024 chars; describe capabilities **and** trigger conditions                |
| `argument-hint`            | No       | string  | Hint text shown when invoked as slash command                                  |
| `user-invocable`           | No       | boolean | Default `true`. `false` hides from `/` menu (agent can still auto-load)        |
| `disable-model-invocation` | No       | boolean | Default `false`. `true` requires manual invocation only                        |
| `context`                  | No       | enum    | `inline` (default) or `fork` (run in subagent context, experimental)           |

For skill body structure, trigger-writing, and bundled-resource authoring,
see [skills.md](skills.md). This section covers Copilot-specific frontmatter and
loading rules only.

**Bundled resource directories (all optional):**

| Directory     | Purpose                                                                    |
| ------------- | -------------------------------------------------------------------------- |
| `references/` | Reference docs loaded as needed                                            |
| `examples/`   | Working samples users can copy and adapt                                   |
| `scripts/`    | Executable helpers (must be `chmod +x` for shell scripts)                  |
| `assets/`     | Templates, icons, fonts used **in output** (not loaded into context)       |

> **Critical:** Names with prefixes like `myorg/skill` or `myorg:skill` cause
> the skill to **silently fail to load**. When distributed via a plugin, VS
> Code/CLI automatically prefixes the slash command as `/<plugin>:<skill>`.

---

### 3. Custom Instructions — `instructions/<name>.instructions.md`

File-pattern-targeted coding standards.

```yaml
---
description: 'Coding conventions for Python files'   # required (awesome-copilot), single-quoted
applyTo: '**/*.py'                                   # required (awesome-copilot); '**' = all files
name: 'Python Standards'                             # optional, display name
---

# Python coding standards

- Follow PEP 8.
- Use type hints for all function signatures.
- Use 4 spaces for indentation.
```

| Field         | Required (awesome-copilot) | Type           | Notes                                                          |
| ------------- | -------------------------- | -------------- | -------------------------------------------------------------- |
| `description` | **Yes**                    | string (quoted) | Non-empty; shown on hover in Chat view                        |
| `applyTo`     | **Yes**                    | glob string    | Comma-separated globs, e.g. `'**/*.js, **/*.ts'`. `'**'` = all |
| `name`        | No                         | string         | Display name; defaults to filename                             |

**Without `applyTo`, instructions are not auto-applied** — they can only be
attached manually to a chat request.

**Always-on alternatives** (no frontmatter needed):

| File                                  | Purpose                                              |
| ------------------------------------- | ---------------------------------------------------- |
| `.github/copilot-instructions.md`     | Workspace-wide always-on instructions                |
| `AGENTS.md`                           | Cross-agent always-on instructions (workspace root)  |
| `CLAUDE.md`, `.claude/CLAUDE.md`      | Claude-compatible always-on instructions             |
| `.claude/rules/*.md`                  | Claude rules; use `paths: ['**']` instead of `applyTo` |

For general guidance on writing concise, example-driven instructions that do
not duplicate repository-wide rules, see [agents.md](agents.md). This section
covers Copilot-specific frontmatter, file matching, and discovery only.

---

### 4. Prompt Files — `prompts/<name>.prompt.md`

Reusable slash-command prompts.

```yaml
---
description: 'Generate a React form component'   # optional (recommended)
name: 'Create React Form'                        # optional, /-menu name
argument-hint: 'form name and fields'            # optional
agent: 'agent'                                   # ask | agent | plan | <custom-agent-name>
model: 'GPT-5 (copilot)'                         # optional
tools: ['edit', 'search', 'github/*']            # optional
---

Generate a React form component named ${input:formName}.
Use Markdown links to reference files: [styles](../src/styles.css).
Reference tools with #tool:edit syntax.
```

| Field           | Required | Type               | Notes                                                                          |
| --------------- | -------- | ------------------ | ------------------------------------------------------------------------------ |
| `description`   | No       | string             | Brief summary                                                                  |
| `name`          | No       | string             | Slash-menu name; defaults to filename                                          |
| `argument-hint` | No       | string             | Chat input hint                                                                |
| `agent`         | No       | enum \| string     | `ask`, `agent`, `plan`, or a custom agent name. Defaults to `agent` if `tools` set |
| `model`         | No       | string \| string[] | `Model Name (vendor)`; array = ordered fallback list                           |
| `tools`         | No       | string[]           | Tool / tool-set names. `<server>/*` includes all tools of an MCP server        |

**Body conventions:**

- Markdown. Invoked with `/<name>` in chat.
- Use `${input:varName}` or `${input:varName:placeholder}` for user prompts.
- Use built-in variables like `${selection}`.
- Reference files via Markdown links; reference tools via `#tool:<tool-name>`.

**Tool list priority** (when both an agent and prompt define `tools`): the
prompt file wins.

---

### 5. Hooks — `hooks.json` or `hooks/hooks.json` (no frontmatter)

Shell-command automation triggered by lifecycle events.

```jsonc
{
  "hooks": {
    "PreToolUse": [
      {
        "type": "command",                       // required; must be "command"
        "command": "./scripts/validate.sh",      // default cross-platform command
        "windows": "powershell -File .\\scripts\\validate.ps1",
        "linux": "./scripts/validate-linux.sh",
        "osx": "./scripts/validate-mac.sh",
        "cwd": ".",                              // relative to repo root
        "env": { "LOG_LEVEL": "info" },
        "timeout": 15                            // seconds; default 30
      }
    ],
    "PostToolUse": [
      {
        "type": "command",
        "command": "npx prettier --write \"$TOOL_INPUT_FILE_PATH\""
      }
    ]
  }
}
```

**Claude-format matcher syntax also parsed** (matchers are currently *ignored*
in VS Code — every hook runs on every matching event):

```jsonc
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          { "type": "command", "command": "${CLAUDE_PLUGIN_ROOT}/scripts/format.sh" }
        ]
      }
    ]
  }
}
```

**Hook entry fields:**

| Field     | Required          | Type   | Notes                                                  |
| --------- | ----------------- | ------ | ------------------------------------------------------ |
| `type`    | Yes               | string | Must be `"command"`                                    |
| `command` | At least one of `command`/`windows`/`linux`/`osx` | string | Cross-platform fallback                  |
| `windows` | No                | string | Windows override                                       |
| `linux`   | No                | string | Linux override                                         |
| `osx`     | No                | string | macOS override                                         |
| `cwd`     | No                | string | Working directory (relative to repo root)              |
| `env`     | No                | object | Extra environment variables                            |
| `timeout` | No                | number | Seconds. Default `30`                                  |

**Supported events** (`PascalCase` in VS Code; CLI uses `lowerCamelCase` and
is auto-converted):

| Event              | Fires when                                |
| ------------------ | ----------------------------------------- |
| `SessionStart`     | First prompt of a new session             |
| `UserPromptSubmit` | User submits a prompt                     |
| `PreToolUse`       | Before agent invokes any tool             |
| `PostToolUse`      | After a tool completes successfully       |
| `PreCompact`       | Before conversation context is compacted  |
| `SubagentStart`    | Subagent is spawned                       |
| `SubagentStop`     | Subagent completes                        |
| `Stop`             | Agent session ends                        |

**I/O contract:**

- Hook receives JSON on stdin (common fields: `timestamp`, `cwd`, `sessionId`,
  `hookEventName`, `transcript_path`, plus event-specific fields).
- Hook returns JSON on stdout (`continue`, `stopReason`, `systemMessage`,
  `hookSpecificOutput`).
- Exit code `0` = parse stdout as JSON. Exit code `2` = blocking error
  (stderr fed back to model). Other = non-blocking warning.

**Plugin-specific notes:**

- Plugin format detection determines the location:
  - **Copilot-format plugins:** `hooks.json` at the plugin root.
  - **Claude-format plugins:** `hooks/hooks.json`.
- Use `${CLAUDE_PLUGIN_ROOT}` to reference scripts inside Claude-format
  plugins. This token is **not** available in pure Copilot-format plugins.
- For `PreToolUse`, the most restrictive permission decision across all hooks
  wins: `deny` > `ask` > `allow`.

**Awesome-copilot hook README convention** (`hooks/<name>/README.md`):

```yaml
---
name: 'Format on save'                  # required, human-readable
description: 'Runs Prettier after edits' # required, single-quoted, non-empty
tags: ['formatting', 'prettier']         # optional
---
```

The folder must also contain a `hooks.json`. Hook events are extracted from the
JSON file, not from the README frontmatter.

---

### 6. MCP Servers — `.mcp.json` (no frontmatter)

Model Context Protocol server definitions. Can also be inline in `plugin.json`
under `mcpServers`.

> **Note:** The plugin `.mcp.json` top-level key is `mcpServers` (not `servers`
> as in workspace `mcp.json`).

```jsonc
{
  "mcpServers": {
    "plugin-database": {
      "command": "${CLAUDE_PLUGIN_ROOT}/servers/db-server",   // or absolute / npx
      "args": ["--config", "${CLAUDE_PLUGIN_ROOT}/config.json"],
      "env": { "DB_PATH": "${CLAUDE_PLUGIN_ROOT}/data" },
      "cwd": "${CLAUDE_PLUGIN_ROOT}",
      "envFile": "${CLAUDE_PLUGIN_ROOT}/.env"
    },
    "plugin-api": {
      "type": "http",                                          // stdio (default) | sse | http | ws
      "url": "https://mcp.example.com/sse",
      "headers": { "Authorization": "Bearer ${API_TOKEN}" }
    }
  }
}
```

**Token expansion** is performed by VS Code for these fields: `command`,
`args`, `cwd`, `env`, `envFile`, `url`, `headers`. `${CLAUDE_PLUGIN_ROOT}` is
also injected as an environment variable into the server process.

**Conflict resolution:** Plugin MCP servers use **last-wins** precedence by
server name. They are implicitly trusted when the plugin is installed (no
separate trust prompt).

---

### 7. Agentic Workflows — `workflows/<name>.md`

GitHub Actions automations written in Markdown (gh-aw spec). Optional asset
type; common in `awesome-copilot`.

```yaml
---
name: 'Daily Issues Report'                      # required, human-readable
description: 'Posts a daily issues summary'      # required, single-quoted
on:                                              # required (gh-aw)
  schedule:
    - cron: '0 9 * * *'
permissions:                                     # required (least-privilege)
  issues: read
  contents: read
safe-outputs:                                    # required (gh-aw)
  - create-issue-comment
---

Summarize all issues opened in the last 24 hours…
```

| Field          | Required | Type   | Notes                                                |
| -------------- | -------- | ------ | ---------------------------------------------------- |
| `name`         | Yes      | string | Human-readable name                                  |
| `description`  | Yes      | string | Single-quoted, non-empty                             |
| `on`           | Yes      | object | GitHub Actions trigger config                        |
| `permissions`  | Yes      | object | Use least-privilege                                  |
| `safe-outputs` | Yes      | array  | gh-aw safe output declarations                       |

**Restrictions:**

- Only `.md` files allowed. `.yml`, `.yaml`, `.lock.yml` blocked by CI.
- Compile with `gh aw compile --validate` before publishing.

---

## Cross-Cutting Rules

### Naming

| Asset             | Convention                              | Example                       |
| ----------------- | --------------------------------------- | ----------------------------- |
| Plugin            | kebab-case, ≤64 chars, no slashes       | `my-dev-tools`                |
| Agent file        | `<name>.agent.md`, kebab-case           | `code-reviewer.agent.md`      |
| Skill directory   | kebab-case, ≤64 chars                   | `webapp-testing/`             |
| Skill `name`      | **Must match parent directory**         | `name: webapp-testing`        |
| Instructions file | `<name>.instructions.md`                | `python-style.instructions.md`|
| Prompt file       | `<name>.prompt.md`                      | `create-react-form.prompt.md` |
| Hook folder       | kebab-case folder + `hooks.json`        | `hooks/format-on-save/`       |
| Workflow file     | `<name>.md` in `workflows/`             | `daily-issues-report.md`      |

### `description` formatting (awesome-copilot)

For agents, skills, instructions, hooks, and workflows, wrap the `description`
value in **single quotes**:

```yaml
description: 'Brief, specific summary'   # ✅
description: "Brief, specific summary"   # ❌ awesome-copilot validator rejects
description: Brief, specific summary     # ❌ same
```

> Writing effective descriptions, body voice, and anti-patterns are covered
> in the tool-agnostic authoring guides: [agents.md](agents.md),
> [skills.md](skills.md), [hooks.md](hooks.md).

### Auto-Discovery

When a plugin is installed, VS Code and Copilot CLI automatically discover:

1. `plugin.json` from the first matching location (see [Plugin Directory Layout](#plugin-directory-layout)).
2. `.agent.md` (or `.md`) files in the `agents` path(s).
3. Subdirectories of the `skills` path(s) containing a `SKILL.md`.
4. The hook file (`hooks.json` or `hooks/hooks.json`).
5. `.mcp.json` (or inline `mcpServers` in `plugin.json`).

Custom paths in `plugin.json` **supplement** the defaults; they never replace
them.

### Precedence (Copilot CLI / VS Code)

| Resource    | Rule                | Order                                                                 |
| ----------- | ------------------- | --------------------------------------------------------------------- |
| Agents      | First-loaded wins   | User → project `.github/agents` → project `.claude/agents` → plugins  |
| Skills      | First-loaded wins   | Project `.github/skills` → `.agents/skills` → `.claude/skills` → user → plugins |
| MCP servers | **Last-loaded wins**| User config → plugins → `--additional-mcp-config` (highest)           |
| Built-ins   | Always present, never overridable                                                   |

### Cross-tool Compatibility

A single plugin repo can target VS Code, Copilot CLI, **and** Claude Code:

- Place `plugin.json` at the root or `.github/plugin/plugin.json` for Copilot
  conventions; symlink or copy to `.claude-plugin/plugin.json` for Claude.
- Use **plain kebab-case** for all `name` fields — namespace prefixes silently
  fail across all three tools.
- `${CLAUDE_PLUGIN_ROOT}` is available in Claude-format plugins (and is also
  honored by VS Code for hooks/MCP). For pure Copilot plugins, prefer absolute
  paths set via env vars or rely on `cwd`.

### Validation

- `npm run plugin:validate` (awesome-copilot) checks manifest structure,
  required fields, single-quoted descriptions, file naming, and references.
- `npm run skill:validate` checks skill folder structure and SKILL.md
  frontmatter.
- VS Code: right-click in Chat view → **Diagnostics** to see loaded
  customizations and any validation errors.
- Copilot CLI: `copilot plugin install ./path/to/plugin` surfaces validation
  errors on install.

---

## References

### Primary sources

| Source | URL |
| ------ | --- |
| github/awesome-copilot — community marketplace | https://github.com/github/awesome-copilot |
| awesome-copilot · AGENTS.md (conventions, validators, required fields) | https://github.com/github/awesome-copilot/blob/main/AGENTS.md |
| awesome-copilot · CONTRIBUTING.md | https://github.com/github/awesome-copilot/blob/main/CONTRIBUTING.md |
| Awesome Copilot website | https://awesome-copilot.github.com/ |
| Awesome Copilot · llms.txt (machine-readable index) | https://awesome-copilot.github.com/llms.txt |

### VS Code Copilot customization docs

| Source | URL |
| ------ | --- |
| Customize AI in VS Code (overview) | https://code.visualstudio.com/docs/copilot/customization/overview |
| Customization concepts | https://code.visualstudio.com/docs/copilot/concepts/customization |
| Agent plugins (Preview) | https://code.visualstudio.com/docs/copilot/customization/agent-plugins |
| Custom agents | https://code.visualstudio.com/docs/copilot/customization/custom-agents |
| Agent Skills | https://code.visualstudio.com/docs/copilot/customization/agent-skills |
| Custom instructions | https://code.visualstudio.com/docs/copilot/customization/custom-instructions |
| Prompt files | https://code.visualstudio.com/docs/copilot/customization/prompt-files |
| Agent hooks (Preview) | https://code.visualstudio.com/docs/copilot/customization/hooks |
| MCP servers | https://code.visualstudio.com/docs/copilot/customization/mcp-servers |
| MCP configuration reference | https://code.visualstudio.com/docs/copilot/reference/mcp-configuration |
| Agent tools | https://code.visualstudio.com/docs/copilot/agents/agent-tools |
| Subagents | https://code.visualstudio.com/docs/copilot/agents/subagents |
| Security | https://code.visualstudio.com/docs/copilot/security |

### GitHub Copilot CLI docs

| Source | URL |
| ------ | --- |
| CLI plugin reference (plugin.json, marketplace.json, precedence) | https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-plugin-reference |
| CLI command reference | https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-command-reference |
| Creating a plugin for Copilot CLI | https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/plugins-creating |
| Creating a plugin marketplace | https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/plugins-marketplace |
| Finding and installing plugins | https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/plugins-finding-installing |
| Using hooks (Copilot coding agent) | https://docs.github.com/en/copilot/how-tos/use-copilot-agents/coding-agent/use-hooks |
| Creating custom agents (org-level) | https://docs.github.com/en/copilot/how-tos/use-copilot-agents/coding-agent/create-custom-agents |

### Open standards & cross-tool specs

| Source | URL |
| ------ | --- |
| Agent Skills specification (agentskills.io) | https://agentskills.io/specification |
| Agent Skills · optimizing descriptions | https://agentskills.io/skill-creation/optimizing-descriptions |
| Agent Skills · authoring best practices | https://agentskills.io/skill-creation/best-practices |
| Anthropic reference skills | https://github.com/anthropics/skills |
| Model Context Protocol | https://modelcontextprotocol.io/ |
| Language Server Protocol | https://microsoft.github.io/language-server-protocol/ |
| Semantic Versioning | https://semver.org/ |
| SPDX license list | https://spdx.org/licenses/ |
| Claude Code · Sub-agents | https://code.claude.com/docs/en/sub-agents |
| Claude Code · Plugin marketplaces | https://code.claude.com/docs/en/plugin-marketplaces |
| GitHub Agentic Workflows (gh-aw) | https://github.github.com/gh-aw/reference/workflow-structure/ |

