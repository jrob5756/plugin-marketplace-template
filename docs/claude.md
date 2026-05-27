# Claude Code Plugin Reference

Frontmatter and configuration rules for every component a Claude Code plugin can
ship, plus the full `plugin.json` manifest structure. Authoritative source:
the official [Claude Code Plugins docs](https://code.claude.com/docs/en/plugins).

> **Note:** This page reflects the official Claude Code plugins specification.
> Community conventions (e.g. the FengGuanyun `plugin-dev` skills) are noted
> separately when they extend but do not contradict the official spec.

**For tool-agnostic authoring guidance**, see:
[agents.md](agents.md), [skills.md](skills.md), [hooks.md](hooks.md),
[mcp-servers.md](mcp-servers.md). This file documents Claude-specific
**format** only.

---

## Plugin Directory Layout

A complete plugin layout (every component directory is optional):

```
my-plugin/
├── .claude-plugin/
│   └── plugin.json          # Manifest (optional)
├── skills/                  # Skills as <name>/SKILL.md directories
│   └── pdf-processor/
│       ├── SKILL.md
│       ├── reference.md     # (optional)
│       └── scripts/         # (optional)
├── commands/                # Skills as flat .md files (legacy form — prefer skills/)
├── agents/                  # Subagent .md files
├── output-styles/           # Output style definitions
├── themes/                  # Color theme JSON files (experimental)
├── monitors/                # Background monitor configs (experimental)
│   └── monitors.json
├── hooks/
│   └── hooks.json           # Hook configuration
├── bin/                     # Executables added to the Bash tool's PATH
├── settings.json            # Plugin-level default settings
├── .mcp.json                # MCP server definitions
├── .lsp.json                # LSP server configurations
└── scripts/                 # Hook/utility scripts (referenced via ${CLAUDE_PLUGIN_ROOT})
```

**Critical rules:**

- The manifest is **optional**. When omitted, Claude Code auto-discovers
  components from default locations and derives the plugin name from the
  directory name.
- `.claude-plugin/` contains **only** `plugin.json`. Every component directory
  (`commands/`, `agents/`, `skills/`, `hooks/`, `output-styles/`, `themes/`,
  `monitors/`) must live at the **plugin root**, not inside `.claude-plugin/`.
- `CLAUDE.md` at the plugin root is **not loaded** as project context. Ship
  instructions through skills, agents, or hooks instead.
- Use **kebab-case** for plugin and component names (lowercase + hyphens, no
  spaces).
- Use `${CLAUDE_PLUGIN_ROOT}` for every intra-plugin path. Never hardcode
  absolute paths, `./` paths from cwd, or `~/` shortcuts.
- **Single-file plugin (v2.1.142+):** A plugin with a `SKILL.md` at its root
  and no `skills/` subdirectory loads automatically as a single-skill plugin.

### File locations reference

| Component         | Path                                  |
| ----------------- | ------------------------------------- |
| Manifest          | `.claude-plugin/plugin.json`          |
| Skills            | `skills/<name>/SKILL.md`              |
| Commands (legacy) | `commands/<name>.md`                  |
| Agents            | `agents/<name>.md`                    |
| Output styles     | `output-styles/<name>.md`             |
| Themes            | `themes/<name>.json`                  |
| Hooks             | `hooks/hooks.json`                    |
| MCP servers       | `.mcp.json`                           |
| LSP servers       | `.lsp.json`                           |
| Monitors          | `monitors/monitors.json`              |
| Executables       | `bin/`                                |
| Plugin settings   | `settings.json`                       |

---

## `plugin.json` Manifest

Located at `.claude-plugin/plugin.json`. **The only required field is `name`.**
Claude Code ignores unrecognized top-level fields (warning only), so a single
manifest can double as an `npm` or `package.json`-style file. Field-level type
errors still fail.

### Full Schema

```jsonc
{
  // --- Identity ---
  "$schema": "https://json.schemastore.org/claude-code-plugin-manifest.json",
  "name": "plugin-name",                  // REQUIRED — kebab-case, no spaces
  "displayName": "Plugin Name",           // v2.1.143+; UI label; falls back to name
  "version": "1.0.0",                     // Pins the plugin. Omit → git commit SHA
  "description": "Brief plugin description",

  // --- Metadata ---
  "author": {
    "name": "Author Name",
    "email": "author@example.com",
    "url": "https://github.com/author"
  },
  "homepage": "https://docs.example.com/plugin",
  "repository": "https://github.com/author/plugin",
  "license": "MIT",                       // SPDX identifier
  "keywords": ["keyword1", "keyword2"],

  // --- Component paths (see Path Behavior Rules) ---
  "skills":       "./custom/skills/",     // ADDS to default skills/
  "commands":     ["./custom/cmd.md"],    // REPLACES default commands/
  "agents":       ["./custom/agents/reviewer.md"], // REPLACES default agents/
  "hooks":        "./config/hooks.json",  // Merges with defaults
  "mcpServers":   "./mcp-config.json",    // Merges with defaults
  "outputStyles": "./styles/",            // REPLACES default output-styles/
  "lspServers":   "./.lsp.json",          // Merges with defaults

  // --- Experimental ---
  "experimental": {
    "themes":   "./themes/",              // REPLACES default themes/
    "monitors": "./monitors.json"         // REPLACES default monitors/
  },

  // --- Extension features ---
  "userConfig": { /* see User Configuration */ },
  "channels":   [ /* see Channels */ ],
  "dependencies": [
    "helper-lib",
    { "name": "secrets-vault", "version": "~2.1.0" }
  ]
}
```

### Field reference

#### Required

| Field  | Type   | Notes                                                                  |
| ------ | ------ | ---------------------------------------------------------------------- |
| `name` | string | Unique identifier (kebab-case, no spaces). Used for namespacing skills (`/<plugin-name>:<skill>`). |

#### Metadata

| Field         | Type   | Notes                                                                    |
| ------------- | ------ | ------------------------------------------------------------------------ |
| `$schema`     | string | JSON Schema URL for editor autocomplete. Ignored at load time.           |
| `displayName` | string | v2.1.143+. UI label. May contain spaces and any casing. Not used for namespacing. |
| `version`     | string | Optional SemVer. If set, pins the plugin — users only get updates when you bump it. If omitted, the git commit SHA is used so every commit counts as a new version. If also set in the marketplace entry, `plugin.json` wins. |
| `description` | string | Brief explanation of plugin purpose.                                     |
| `author`      | object | `{ name, email?, url? }`. `name` required when `author` is present.      |
| `homepage`    | URL    | Documentation URL.                                                       |
| `repository`  | URL    | Source code repository URL.                                              |
| `license`     | string | SPDX identifier (`MIT`, `Apache-2.0`, …).                                |
| `keywords`    | string[] | Discovery tags.                                                        |

#### Component paths

| Field                   | Type                       | Default behavior              | Notes                                                       |
| ----------------------- | -------------------------- | ----------------------------- | ----------------------------------------------------------- |
| `skills`                | string \| string[]         | **Adds** to `skills/`         | Custom skill directories containing `<name>/SKILL.md`.      |
| `commands`              | string \| string[]         | **Replaces** `commands/`      | Custom flat `.md` skill files or directories.               |
| `agents`                | string \| string[]         | **Replaces** `agents/`        | Custom agent files.                                         |
| `hooks`                 | string \| array \| object  | Merges                        | File path(s) or inline hooks object.                        |
| `mcpServers`            | string \| array \| object  | Merges                        | File path(s) or inline MCP server configs.                  |
| `outputStyles`          | string \| string[]         | **Replaces** `output-styles/` | Custom output style files/directories.                      |
| `lspServers`            | string \| array \| object  | Merges                        | LSP configs for code intelligence.                          |
| `experimental.themes`   | string \| string[]         | **Replaces** `themes/`        | Color theme files/directories.                              |
| `experimental.monitors` | string \| string[]         | **Replaces** `monitors/`      | Background monitor configurations.                          |

#### Extension features

| Field          | Type     | Notes                                                                  |
| -------------- | -------- | ---------------------------------------------------------------------- |
| `userConfig`   | object   | Values Claude Code prompts the user for at enable time. See [User configuration](#user-configuration). |
| `channels`     | object[] | Channel declarations for message injection (Telegram, Slack, Discord style). |
| `dependencies` | array    | Other plugins this plugin requires, optionally with SemVer constraints. |

### Path behavior rules

Whether a custom path **replaces** or **extends** the default folder depends on
the field. Two failure modes to know:

- **`commands`, `agents`, `outputStyles`, `experimental.themes`,
  `experimental.monitors` replace the default.** Setting `commands` skips
  `commands/`. To keep the default and add more, list both:
  `"commands": ["./commands/", "./extras/"]`.
- **`skills` adds to the default.** `skills/` is always scanned; manifest
  entries load alongside it.
- **`hooks`, `mcpServers`, `lspServers` have their own merge rules.** See each
  section for how multiple sources combine.

When a plugin has both a default folder and a matching manifest key that
replaces it, Claude Code v2.1.140+ flags the ignored folder in `/doctor`,
`claude plugin list`, and the `/plugin` detail view.

All paths must be **relative to the plugin root** and **start with `./`**.

### Minimal vs complete examples

**Minimal** (auto-discovery handles everything):

```json
{ "name": "hello-world" }
```

**Recommended for distribution:**

```json
{
  "name": "code-review-assistant",
  "version": "1.0.0",
  "description": "Automates code review with style checks and suggestions",
  "author": { "name": "Jane Developer", "email": "jane@example.com" },
  "homepage": "https://docs.example.com/code-review",
  "repository": "https://github.com/janedev/code-review-assistant",
  "license": "MIT",
  "keywords": ["code-review", "automation", "quality", "ci-cd"]
}
```

### User configuration

Declare values Claude Code prompts for when the plugin is enabled:

```json
{
  "userConfig": {
    "api_endpoint": {
      "type": "string",
      "title": "API endpoint",
      "description": "Your team's API endpoint",
      "required": true,
      "default": "https://api.example.com"
    },
    "api_token": {
      "type": "string",
      "title": "API token",
      "description": "API authentication token",
      "sensitive": true
    }
  }
}
```

| Option        | Required | Notes                                                                    |
| ------------- | -------- | ------------------------------------------------------------------------ |
| `type`        | Yes      | `string`, `number`, `boolean`, `directory`, or `file`                    |
| `title`       | Yes      | Label shown in the configuration dialog                                  |
| `description` | Yes      | Help text shown beneath the field                                        |
| `sensitive`   | No       | Masks input; stores value in system keychain (≈2 KB total limit, shared with OAuth tokens) |
| `required`    | No       | Validation fails when the field is empty                                 |
| `default`     | No       | Value used when the user provides nothing                                |
| `multiple`    | No       | For `string` type, allow an array of strings                             |
| `min` / `max` | No       | Bounds for `number` type                                                 |

**Substitution:** Values are available as `${user_config.KEY}` in MCP/LSP/hook
commands and monitor commands. Non-sensitive values can also be substituted in
skill and agent content. All values are exported to plugin subprocesses as
`CLAUDE_PLUGIN_OPTION_<KEY>` env vars.

---

## Asset Frontmatter Rules

### 1. Skills — `skills/<name>/SKILL.md` (or flat `commands/<name>.md`)

The primary plugin component. Skills are model-invoked when their description
matches the task context. Plugins prefix invocations as
`/<plugin-name>:<skill-name>`.

```yaml
---
description: Review code for bugs, security, and performance   # REQUIRED
disable-model-invocation: true                                 # optional
---

When reviewing code, check for:
- Potential bugs or edge cases
- Security concerns
- Performance issues
```

| Field                      | Required | Type    | Notes                                                                                  |
| -------------------------- | -------- | ------- | -------------------------------------------------------------------------------------- |
| `description`              | **Yes**  | string  | What the skill does and when to use it. Claude reads this to decide when to invoke.    |
| `name`                     | No       | string  | Skill invocation name. Defaults to the parent directory basename. Required if you point `skills` to the plugin root or move the file. |
| `disable-model-invocation` | No       | boolean | When `true`, the skill loads only when the user explicitly types `/<plugin>:<skill>`.  |

For tool-agnostic guidance on writing effective skill descriptions,
structuring `SKILL.md`, and organizing bundled references, see
[skills.md](skills.md).

**Plugin-specific behavior:**

- Skills receive arguments via `$ARGUMENTS` (raw text after the skill name).

- Plugin skills are always **namespaced** as `/<plugin-name>:<skill-name>` to
  prevent conflicts.
- If a skill directory has no frontmatter `name`, the **directory basename** is
  used as the invocation name.
- When `skills` points to a directory that contains `SKILL.md` directly (e.g.
  `"skills": ["./"]`), the frontmatter `name` determines the invocation name.
- A plugin with `SKILL.md` at the root and no `skills/` subdirectory is loaded
  as a single-skill plugin in v2.1.142+.

> **Community convention (FengGuanyun `plugin-dev`):** Skills also commonly
> include `references/`, `examples/`, `scripts/`, and `assets/` subdirectories
> for progressive disclosure. Not required by the spec — Claude loads any file
> the SKILL.md references.

---

### 2. Agents — `agents/<name>.md`

Specialized subagents Claude can invoke automatically for specific tasks. For
tool-agnostic guidance on writing effective agent descriptions, prompt bodies,
and delegation boundaries, see [agents.md](agents.md).

```yaml
---
name: agent-name
description: What this agent specializes in and when Claude should invoke it
model: sonnet
effort: medium
maxTurns: 20
tools: [Read, Grep, Bash]
disallowedTools: [Write, Edit]
skills: [code-review]
isolation: worktree
background: false
memory: short
---

Detailed system prompt for the agent describing its role, expertise, and behavior.
```

| Field             | Type    | Notes                                                                       |
| ----------------- | ------- | --------------------------------------------------------------------------- |
| `name`            | string  | Agent identifier                                                            |
| `description`     | string  | What the agent specializes in and when Claude should invoke it              |
| `model`           | string  | Model preference                                                            |
| `effort`          | string  | Effort level                                                                |
| `maxTurns`        | number  | Max conversation turns                                                      |
| `tools`           | array   | Allowed tools                                                               |
| `disallowedTools` | array   | Blocked tools                                                               |
| `skills`          | array   | Plugin skills the agent may use                                             |
| `memory`          | string  | Memory configuration                                                        |
| `background`      | boolean | Run as a background agent                                                   |
| `isolation`       | string  | Only valid value is `"worktree"`                                            |

**Forbidden fields (security):** `hooks`, `mcpServers`, and `permissionMode` are
**not supported** for plugin-shipped agents. Claude Code rejects them.

Plugin agents appear in `/agents`, can be invoked manually, and Claude can
dispatch them automatically based on task context.

---

### 3. Commands (legacy) — `commands/<name>.md`

Flat-file form of skills. Use `skills/` for new plugins; `commands/` is
preserved for backward compatibility. Same frontmatter as Skills above.

---

### 4. Hooks — `hooks/hooks.json` (no frontmatter)

Event handlers that automatically respond to Claude Code lifecycle events.
Configuration is JSON; can also be inline in `plugin.json` under `hooks`. For
tool-agnostic hook design guidance, see [hooks.md](hooks.md).

```jsonc
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "\"${CLAUDE_PLUGIN_ROOT}\"/scripts/format-code.sh"
          }
        ]
      }
    ]
  }
}
```

#### Hook types

| Type       | Behavior                                                                  |
| ---------- | ------------------------------------------------------------------------- |
| `command`  | Execute a shell command or script                                         |
| `http`     | Send the event JSON as a POST request to a URL                            |
| `mcp_tool` | Call a tool on a configured MCP server                                    |
| `prompt`   | Evaluate a prompt with an LLM (uses `$ARGUMENTS` placeholder for context) |
| `agent`    | Run an agentic verifier with tools for complex verification tasks         |

#### Lifecycle events (full list)

| Event                  | When it fires                                                                    |
| ---------------------- | -------------------------------------------------------------------------------- |
| `SessionStart`         | Session begins or resumes                                                        |
| `Setup`                | `--init-only`, or `--init`/`--maintenance` in `-p` mode; for one-time CI prep   |
| `UserPromptSubmit`     | User submits a prompt, before Claude processes it                                |
| `UserPromptExpansion`  | A user-typed command expands into a prompt; can block expansion                  |
| `PreToolUse`           | Before a tool call; can block                                                    |
| `PermissionRequest`    | When a permission dialog appears                                                 |
| `PermissionDenied`     | A tool call is denied by the auto mode classifier; return `{retry: true}` to allow retry |
| `PostToolUse`          | A tool call succeeds                                                             |
| `PostToolUseFailure`   | A tool call fails                                                                |
| `PostToolBatch`        | A batch of parallel tool calls resolves, before the next model call              |
| `Notification`         | Claude Code sends a notification                                                 |
| `SubagentStart`        | A subagent is spawned                                                            |
| `SubagentStop`         | A subagent finishes                                                              |
| `TaskCreated`          | A task is being created via TaskCreate                                           |
| `TaskCompleted`        | A task is being marked as completed                                              |
| `Stop`                 | Claude finishes responding                                                       |
| `StopFailure`          | The turn ends due to an API error (output/exit code are ignored)                 |
| `TeammateIdle`         | An agent-team teammate is about to go idle                                       |
| `InstructionsLoaded`   | A CLAUDE.md or `.claude/rules/*.md` file is loaded into context                  |
| `ConfigChange`         | A configuration file changes during a session                                    |
| `CwdChanged`           | The working directory changes (e.g. Claude runs `cd`); useful for `direnv`       |
| `FileChanged`          | A watched file changes on disk; the `matcher` field specifies filenames          |
| `WorktreeCreate`       | A worktree is being created via `--worktree` or `isolation: "worktree"`          |
| `WorktreeRemove`       | A worktree is being removed                                                      |
| `PreCompact`           | Before context compaction                                                        |
| `PostCompact`          | After context compaction                                                         |
| `Elicitation`          | An MCP server requests user input during a tool call                             |
| `ElicitationResult`    | After a user responds to an MCP elicitation, before the response is returned     |
| `SessionEnd`           | A session terminates                                                             |

#### Hook entry fields

| Field     | Required          | Type    | Notes                                              |
| --------- | ----------------- | ------- | -------------------------------------------------- |
| `type`    | Yes               | string  | One of the types above                             |
| `command` | If `command` type | string  | Use `${CLAUDE_PLUGIN_ROOT}` for plugin paths       |
| `prompt`  | If `prompt` type  | string  | Natural-language instructions (`$ARGUMENTS` placeholder) |
| `url`     | If `http` type    | string  | Endpoint to POST event JSON                        |
| `timeout` | No                | number  | Timeout in seconds                                 |
| `matcher` | On group          | string  | Tool name, regex, or `*`                           |

**Path quoting:** In shell-form hooks, wrap the path:
`"${CLAUDE_PLUGIN_ROOT}"/scripts/x.sh`. In exec-form (`args`), pass the variable
as a single argument with no quoting.

---

### 5. MCP Servers — `.mcp.json` (no frontmatter)

Model Context Protocol server definitions. Can also be inline in `plugin.json`
under `mcpServers`. For tool-agnostic MCP design and transport guidance, see
[mcp-servers.md](mcp-servers.md).

```jsonc
{
  "mcpServers": {
    "plugin-database": {
      "command": "${CLAUDE_PLUGIN_ROOT}/servers/db-server",
      "args": ["--config", "${CLAUDE_PLUGIN_ROOT}/config.json"],
      "env": { "DB_PATH": "${CLAUDE_PLUGIN_ROOT}/data" }
    },
    "plugin-api-client": {
      "command": "npx",
      "args": ["@company/mcp-server", "--plugin-mode"],
      "cwd": "${CLAUDE_PLUGIN_ROOT}"
    }
  }
}
```

Standard MCP server configuration applies. Plugin MCP servers start
automatically when the plugin is enabled and appear as standard MCP tools.

---

### 6. LSP Servers — `.lsp.json` (no frontmatter)

Language Server Protocol configs that give Claude real-time code intelligence
(diagnostics, go-to-definition, find references, hover).

```jsonc
{
  "go": {
    "command": "gopls",
    "args": ["serve"],
    "extensionToLanguage": { ".go": "go" }
  }
}
```

**Required fields:**

| Field                 | Notes                                       |
| --------------------- | ------------------------------------------- |
| `command`             | LSP binary to execute (must be in `PATH`)   |
| `extensionToLanguage` | Maps file extensions to language identifiers |

**Optional fields:** `args`, `transport` (`stdio` default, or `socket`), `env`,
`initializationOptions`, `settings`, `workspaceFolder`, `startupTimeout`,
`shutdownTimeout`, `restartOnCrash`, `maxRestarts`.

> Users must install the language server binary separately. The plugin only
> configures connection details.

---

### 7. Monitors (experimental) — `monitors/monitors.json`

Background watchers that deliver every stdout line to Claude as a notification
for the lifetime of the session. Requires Claude Code v2.1.105+.

```jsonc
[
  {
    "name": "deploy-status",
    "command": "\"${CLAUDE_PLUGIN_ROOT}\"/scripts/poll-deploy.sh ${user_config.api_endpoint}",
    "description": "Deployment status changes"
  },
  {
    "name": "error-log",
    "command": "tail -F ./logs/error.log",
    "description": "Application error log",
    "when": "on-skill-invoke:debug"
  }
]
```

| Field         | Required | Notes                                                                       |
| ------------- | -------- | --------------------------------------------------------------------------- |
| `name`        | Yes      | Identifier unique within the plugin                                         |
| `command`     | Yes      | Persistent background process command                                       |
| `description` | Yes      | Short summary shown in task panel/notifications                             |
| `when`        | No       | `"always"` (default) or `"on-skill-invoke:<skill-name>"`                    |

Monitors run only in interactive CLI sessions, unsandboxed at the same trust
level as hooks, and are skipped where the Monitor tool is unavailable.
Disabling a plugin mid-session does not stop monitors already running.

---

### 8. Themes (experimental) — `themes/<name>.json`

Color themes shown in `/theme`.

```json
{
  "name": "Dracula",
  "base": "dark",
  "overrides": {
    "claude": "#bd93f9",
    "error":  "#ff5555",
    "success": "#50fa7b"
  }
}
```

`base` selects a preset (`dark`/`light`); `overrides` is a sparse map of color
tokens. Plugin themes are read-only — pressing `Ctrl+E` in `/theme` copies the
theme into `~/.claude/themes/` for the user to edit.

---

### 9. Output Styles — `output-styles/<name>.md`

Output style definitions discovered automatically. See the [Output Styles
docs](https://code.claude.com/docs/en/output-styles) for the frontmatter spec.

---

### 10. Executables — `bin/`

Files placed in `bin/` are added to the Bash tool's `PATH` while the plugin is
enabled. They are invokable as bare commands in any Bash tool call.

---

### 11. Plugin Settings — `settings.json` (no frontmatter)

Default configuration applied when the plugin is enabled. **Only two keys are
currently supported:**

| Key                  | Purpose                                                                    |
| -------------------- | -------------------------------------------------------------------------- |
| `agent`              | Activate one of the plugin's custom agents as the main thread (applies its system prompt, tool restrictions, and model). |
| `subagentStatusLine` | Subagent status line configuration                                         |

```json
{ "agent": "security-reviewer" }
```

Settings from `settings.json` take priority over `settings` declared in
`plugin.json`. Unknown keys are silently ignored.

> **Important:** The "Plugin Settings" pattern using
> `.claude/<plugin-name>.local.md` is a **community convention** from the
> FengGuanyun `plugin-dev` skills, not part of the official spec. For
> first-class user configuration, use the manifest's `userConfig` field
> instead.

---

## Marketplace (`.claude-plugin/marketplace.json`)

A marketplace is a catalog that lets you distribute plugins. Place
`.claude-plugin/marketplace.json` at the repository root.

```jsonc
{
  "name": "my-plugins",                         // REQUIRED, kebab-case, public-facing
  "owner": {                                    // REQUIRED
    "name": "Your Name",
    "email": "contact@example.com"              // optional
  },
  "description": "Curated plugins for our team",
  "version": "1.0.0",
  "metadata": {
    "pluginRoot": "./plugins"                   // prepended to relative plugin sources
  },
  "allowCrossMarketplaceDependenciesOn": [],    // other marketplaces deps may reference
  "plugins": [                                  // REQUIRED
    {
      "name": "code-formatter",                 // REQUIRED
      "source": "./plugins/formatter",          // REQUIRED — see Plugin sources
      "description": "Automatic code formatting on save",
      "version": "2.1.0",
      "author": { "name": "DevTools Team" },
      "strict": true                            // default; see Strict mode
      // …any plugin.json field may be specified here too
    }
  ]
}
```

### Reserved marketplace names

The following names are reserved for Anthropic and cannot be used by
third-party marketplaces: `claude-code-marketplace`, `claude-code-plugins`,
`claude-plugins-official`, `anthropic-marketplace`, `anthropic-plugins`,
`agent-skills`, `anthropic-agent-skills`, `knowledge-work-plugins`,
`life-sciences`. Names that impersonate official marketplaces (e.g.
`official-claude-plugins`, `anthropic-tools-v2`) are also blocked.

### Plugin sources

| Source        | Form                                                          | Notes                                                          |
| ------------- | ------------------------------------------------------------- | -------------------------------------------------------------- |
| Relative path | `"./plugins/my-plugin"`                                       | Resolves relative to the marketplace root; **must** start with `./`. No `../`. |
| `github`      | `{ "source": "github", "repo": "owner/repo", "ref"?, "sha"? }` | GitHub repo. Pin with `ref` (branch/tag) and/or `sha`         |
| `url`         | `{ "source": "url", "url": "https://…", "ref"?, "sha"? }`     | Any git URL (HTTPS or SSH). `.git` suffix optional             |
| `git-subdir`  | `{ "source": "git-subdir", "url", "path", "ref"?, "sha"? }`   | Sparse partial clone of a subdirectory in a monorepo           |
| `npm`         | `{ "source": "npm", "package", "version"?, "registry"? }`     | Installed via `npm install`                                    |

### Strict mode

Per plugin entry, `strict` controls whether `plugin.json` is the authority for
component definitions:

| `strict`         | Behavior                                                                              |
| ---------------- | ------------------------------------------------------------------------------------- |
| `true` (default) | `plugin.json` is the authority. The marketplace entry may **supplement** with extra components. |
| `false`          | The marketplace entry is the **entire** definition. If `plugin.json` also declares components, the plugin fails to load. |

Use `strict: false` when the marketplace operator wants full control and the
plugin repo provides only raw files.

---

## Cross-Cutting Rules

### Environment variables

Claude Code substitutes three variables inline anywhere they appear in skill
content, agent content, hook commands, monitor commands, and MCP/LSP server
configs. All three are also exported as environment variables to hook
processes and MCP/LSP subprocesses.

| Variable                | Resolves to                                                                          |
| ----------------------- | ------------------------------------------------------------------------------------ |
| `${CLAUDE_PLUGIN_ROOT}` | Absolute path to the plugin's installation directory. **Treat as ephemeral** — changes when the plugin updates. Previous version's directory is kept for ~7 days after an update. |
| `${CLAUDE_PLUGIN_DATA}` | Persistent directory (`~/.claude/plugins/data/{id}/`) that survives plugin updates. Use for installed deps (`node_modules`, venvs), caches, generated code, and anything that should persist across versions. Created automatically the first time it is referenced. |
| `${CLAUDE_PROJECT_DIR}` | Project root (same as the value hooks receive in `CLAUDE_PROJECT_DIR`).               |

**Quoting:** In shell-form hooks and monitor commands, wrap in double quotes
(`"${CLAUDE_PLUGIN_ROOT}"`). In exec-form (`args`), pass without quoting.

When a plugin updates mid-session, hooks/monitors/MCP/LSP keep using the old
version's path. Run `/reload-plugins` to switch hooks, MCP, and LSP to the new
path; monitors require a session restart.

### Naming

| Asset             | Convention                                  | Example                       |
| ----------------- | ------------------------------------------- | ----------------------------- |
| Plugin            | kebab-case, no spaces                       | `code-review-assistant`       |
| Skill directory   | kebab-case                                  | `pdf-processor/`              |
| Command (legacy)  | kebab-case `.md`                            | `review-pr.md`                |
| Agent             | kebab-case `.md`                            | `code-reviewer.md`            |
| Monitor `name`    | Unique within plugin                        | `deploy-status`               |
| Marketplace name  | kebab-case, not in the reserved list        | `acme-tools`                  |

### Version management

Claude Code resolves a plugin's version from the first of these that is set:

1. `version` in `plugin.json`
2. `version` in the marketplace entry
3. Git commit SHA of the plugin's source (for `github`, `url`, `git-subdir`,
   and relative paths in a git-hosted marketplace)
4. `unknown` (for `npm` sources or local non-git directories)

> **Warning:** If you set `version` in `plugin.json`, you **must bump it every
> release**. Pushing commits without bumping is a no-op because Claude Code
> sees the same version string and keeps the cached copy. For internal/team
> plugins under active development, omit `version` and let the commit SHA
> change automatically.

Avoid setting `version` in both `plugin.json` and the marketplace entry —
`plugin.json` always wins silently.

### Path traversal & caching

Installed plugins **cannot reference files outside their directory** — paths
like `../shared-utils` fail because those files are not copied to the cache
(`~/.claude/plugins/cache`).

To share files within a marketplace, use **symlinks**:

- Inside the plugin's own directory → preserved as a relative symlink.
- Elsewhere within the same marketplace → dereferenced (content copied).
- Outside the marketplace → **skipped for security**.

### Validation

```bash
claude plugin validate ./my-plugin            # full validation
claude plugin validate ./my-plugin --strict   # treat warnings as errors
/plugin validate .                            # inside Claude Code
```

`claude plugin validate` reports unrecognized manifest fields as warnings
(useful for one manifest that doubles as `package.json`). Pass `--strict` in CI
to treat warnings as errors.

When pointed at a marketplace directory, the validator checks `marketplace.json`
schema, duplicate plugin names, source path traversal, and version
mismatches. Point it at a plugin directory to also check `plugin.json`, skill
and agent frontmatter, and `hooks/hooks.json` JSON syntax.

---

## References

### Official Claude Code documentation (authoritative)

| Source                           | URL                                                        |
| -------------------------------- | ---------------------------------------------------------- |
| Plugins (overview & quickstart)  | https://code.claude.com/docs/en/plugins                    |
| Plugins reference (schemas, CLI) | https://code.claude.com/docs/en/plugins-reference          |
| Plugin marketplaces              | https://code.claude.com/docs/en/plugin-marketplaces        |
| Plugin dependencies              | https://code.claude.com/docs/en/plugin-dependencies        |
| Discover and install plugins     | https://code.claude.com/docs/en/discover-plugins           |
| Skills                           | https://code.claude.com/docs/en/skills                     |
| Subagents                        | https://code.claude.com/docs/en/sub-agents                 |
| Hooks                            | https://code.claude.com/docs/en/hooks                      |
| Hooks reference                  | https://code.claude.com/docs/en/hooks-reference            |
| Channels reference               | https://code.claude.com/docs/en/channels-reference         |
| MCP                              | https://code.claude.com/docs/en/mcp                        |
| Settings                         | https://code.claude.com/docs/en/settings                   |
| Tools reference (Monitor tool)   | https://code.claude.com/docs/en/tools-reference            |
| Docs index (machine-readable)    | https://code.claude.com/docs/llms.txt                      |

### Standards & cross-tool specs

| Source                                  | URL                                                    |
| --------------------------------------- | ------------------------------------------------------ |
| Agent Skills open standard              | https://agentskills.io/specification                   |
| Anthropic reference skills              | https://github.com/anthropics/skills                   |
| Model Context Protocol                  | https://modelcontextprotocol.io/                       |
| Language Server Protocol                | https://microsoft.github.io/language-server-protocol/  |
| Semantic Versioning                     | https://semver.org/                                    |
| SPDX license list                       | https://spdx.org/licenses/                             |

### Community resources (extend but do not contradict the spec)

| Source                                                      | URL                                                                                                                    |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Anthropic community plugins marketplace                     | https://github.com/anthropics/claude-plugins-community                                                                 |
| FengGuanyun `plugin-dev` skills (plugin authoring patterns) | https://github.com/FengGuanyun/claude-plugins/tree/main/marketplaces/claude-plugins-official/plugins/plugin-dev/skills |
