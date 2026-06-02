# Codex CLI Plugin Reference

> **Status**: Codex CLI (`openai/codex`, the Rust rewrite shipped April 2025
> and still on 0.x as of mid-2026) has a full plugin system implemented in
> the binary but **no public documentation**. Everything here is reverse
> engineered from the source. Expect subtle changes.

Authoritative source: [`openai/codex`](https://github.com/openai/codex)
(specifically `codex-rs/core-plugins/src/`, `codex-rs/hooks/src/`,
`codex-rs/external-agent-migration/src/`).

## Where Codex looks for plugins

Codex resolves plugin manifests in two locations, in priority order:

1. `.codex-plugin/plugin.json` — native
2. `.claude-plugin/plugin.json` — compatibility shim for Claude Code plugins

Installed plugins live under `$CODEX_HOME/plugins/cache/{marketplace}/{name}/{version}/`
(default `$CODEX_HOME = ~/.codex`).

This template emits the **native** layout under `dist/codex/<plugin>/`. Since
Codex also reads the Claude shim, you can install via either of:

- `dist/codex/<plugin>/` (native)
- `dist/claude/<plugin>/` (Codex falls back to it)

## Manifest format

```json
{
  "name": "my-plugin",
  "version": "1.0.0",
  "description": "What this plugin does",
  "keywords": ["coding", "github"],
  "interface": {
    "displayName": "My Plugin",
    "shortDescription": "One-liner",
    "developerName": "Acme",
    "category": "productivity",
    "websiteURL": "https://example.com",
    "defaultPrompt": ["Summarize my inbox", "Draft a reply"],
    "brandColor": "#4A90D9",
    "logo": "./logo.png"
  },
  "skills":     "./skills",
  "mcpServers": "./.mcp.json",
  "hooks":      "./hooks/hooks.json"
}
```

All `*Path`-style fields must start with `./` and must not escape the
plugin root. Codex rejects `..`.

## Source format mapping

In your `plugin.yaml`:

```yaml
codex:
  shortDescription: "One-liner shown in marketplace listings"
  longDescription: "Full markdown description"
  category: productivity
  capabilities: [mcp, skills]
  defaultPrompt:
    - "Summarize my inbox"
    - "Draft a reply"
  brandColor: "#4A90D9"
  composerIcon: "./icon.png"
  logo: "./logo.png"
  screenshots: ["./screenshot1.png"]
```

The transpiler synthesizes the manifest's `interface` block from:

- `displayName` (top-level) → `interface.displayName`
- `author.name` (top-level) → `interface.developerName`
- `homepage` (top-level) → `interface.websiteURL`
- `codex.*` → `interface.*` for everything else

## Skills

Codex consumes the same `SKILL.md` files Claude Code does. Each skill lives
in a subdirectory of the `skills/` root with its frontmatter generated from
`plugin.yaml`. Bundled assets (`references/`, `scripts/`, ...) are copied
verbatim.

## Agents

> Subagents in Codex are **TOML files** under `.codex/agents/` (project) or
> `$CODEX_HOME/agents/` (user), not part of a plugin manifest at all. The
> auto-migration code in `codex-rs/external-agent-migration/` renames Claude
> `.claude/agents/*.md` into the TOML form on first launch.

This template's Codex bundle (`dist/codex/<plugin>/`) **does not emit
agents** — Codex's plugin loader wouldn't read them from a plugin manifest
anyway. The build emits a warning at every codex transpile that lists how
many agents were skipped.

Two ways to ship agents to Codex users:

1. **Easy**: also publish the Claude bundle (`dist/claude/<plugin>/`). Codex
   reads `.claude-plugin/plugin.json` as a fallback and its
   `external-agent-migration` code converts `.claude/agents/*.md` into the
   Codex TOML format on first launch.
2. **Native**: hand-author `.codex/agents/<name>.toml` and install separately.
   A native TOML emitter for this template is on the roadmap once the
   migration shape stabilises upstream.

## MCP servers

Codex reads `mcpServers` from a path declared in the manifest, using the
same Claude/Copilot-style schema:

```json
{
  "mcpServers": {
    "linear": { "command": "linear-mcp-server", "args": ["--workspace", "myteam"] }
  }
}
```

### ⚠️ Codex does NOT expand `${CLAUDE_PLUGIN_ROOT}`

Unlike Claude Code and VS Code Copilot, Codex does **not** substitute
`${CLAUDE_PLUGIN_ROOT}` (or any equivalent variable) inside MCP server
`command` and `args`. Plugins that bundle a server binary and reference it
via `${CLAUDE_PLUGIN_ROOT}/scripts/my-mcp.js` will break on Codex.

The build emits a warning at every Codex transpile that detects this
pattern. Two options for plugin authors:

1. Use an executable on `PATH` (e.g. `npx -y my-mcp-package@latest`)
2. Wrap the bundled binary in a `SessionStart` hook that exports an
   absolute path to it, and reference that variable in `args`

## Hooks

Codex supports a richer hook event set than Claude Code (10 events vs Claude's
fewer). Names (canonical strings):

```
PreToolUse, PostToolUse, PermissionRequest, PreCompact, PostCompact,
SessionStart, UserPromptSubmit, SubagentStart, SubagentStop, Stop
```

Each hook supports `type: command | prompt | agent`, with optional `matcher`,
`timeout`, and `statusMessage` fields.

To restrict hook emission to specific targets, use the source field:

```yaml
hooks:
  path: ./hooks/hooks.json
  targets: [claude, copilot, codex]  # add 'codex' here when intentional
```

Without `targets:`, hooks emit for all targets that support declarative
hooks (everything except OpenCode).

## AGENTS.md

Codex natively reads `AGENTS.md` per the [agents.md](https://agents.md)
cross-tool spec, walking up from CWD to project root, concatenating files in
order, and injecting as user instructions. Configurable via
`project_doc_max_bytes` and `project_doc_fallback_filenames` in
`config.toml`. No transpilation needed.

## Marketplace

Codex looks for a marketplace at `.agents/plugins/marketplace.json` OR
`.claude-plugin/marketplace.json`. This template emits the former; the
build's marketplace metadata is identical to the Claude marketplace.

Install policies (`AVAILABLE`, `INSTALLED_BY_DEFAULT`, `NOT_AVAILABLE`)
and auth policies (`ON_INSTALL`, `ON_USE`) are configurable per-plugin in
Codex's marketplace schema. This template emits the minimal form;
customize the generated `marketplace.json` if you need them.

## Stability caveats

- Codex semver is still `0.x` (no stability commitment)
- The `.codex-plugin/` directory name has already changed once
  (`.claude-plugin/` → `.codex-plugin/`)
- The app-server's `plugin/list` and `plugin/installed` endpoints carry
  explicit "do not call from production clients yet" warnings
- The hooks event set is more likely to grow than shrink
- The `interface` schema is the youngest part of the system and most
  likely to add fields

If a plugin breaks on a Codex update, check `codex-rs/core-plugins/src/manifest.rs`
upstream before assuming this transpiler is the bug.

## References

- [`openai/codex`](https://github.com/openai/codex) — source
- [`codex-rs/core-plugins/src/manifest.rs`](https://github.com/openai/codex/blob/main/codex-rs/core-plugins/src/manifest.rs) — manifest schema
- [`codex-rs/hooks/src/lib.rs`](https://github.com/openai/codex/blob/main/codex-rs/hooks/src/lib.rs) — hook event list
- [`codex-rs/external-agent-migration/src/lib.rs`](https://github.com/openai/codex/blob/main/codex-rs/external-agent-migration/src/lib.rs) — Claude→Codex migration code
- [agents.md](https://agents.md) — cross-tool AGENTS.md spec
