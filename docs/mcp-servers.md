# MCP Servers in Plugins

A short note on the plugin-specific concerns of shipping
[Model Context Protocol](https://modelcontextprotocol.io/) servers. For
everything else — the protocol itself, transports, message formats, SDKs —
defer to the upstream MCP spec and the server's own documentation.

For tool-specific declaration schemas (`.mcp.json`, `userConfig`, input
variables, env vars), see [claude.md](claude.md#5-mcp-servers--mcpjson-no-frontmatter)
and [copilot.md](copilot.md#6-mcp-servers--mcpjson-no-frontmatter).

---

## When to ship an MCP server in a plugin

| Need                                                          | Ship MCP? |
| ------------------------------------------------------------- | --------- |
| Wrap a remote API your users will call from chat              | ✅ Yes    |
| Expose internal data sources to the model                     | ✅ Yes    |
| Run a one-shot script                                         | ❌ Hook or skill |
| Provide reusable prose / instructions                         | ❌ Skill  |
| Apply a small file/text transformation                        | ❌ Skill with a bundled script |

If a static skill or hook gets the job done, prefer it — MCP servers add a
long-running process to every session that loads them.

---

## Bundling patterns

There are three common ways to wire an MCP server into a plugin:

1. **Reference an external server** (npm/pypi/binary the user installs
   separately). Just declare it in `.mcp.json`; nothing bundled.
2. **Bundle a server binary** in `bin/` or `servers/` and launch it with
   `${CLAUDE_PLUGIN_ROOT}/...` (Claude-format plugins only — see
   [claude.md](claude.md) for the path-variable behavior).
3. **Bundle source + a build step.** Author the server in your repo; require
   `npm install` / `pip install` in the README; declare the launch command in
   `.mcp.json`.

Prefer option 1 when possible — fewer moving parts and your plugin stays
declarative.

---

## Naming and pre-allowing tools

Hosts namespace MCP tools differently:

| Host        | Tool identifier                                       |
| ----------- | ----------------------------------------------------- |
| Claude Code | `mcp__plugin_<plugin>_<server>__<tool>`               |
| Copilot CLI | Similar `mcp__plugin_...` namespacing                 |
| VS Code     | `<server>/<tool>` in the tool picker                  |

When a command, agent, or skill in your plugin depends on a specific MCP
tool, pre-allow it in that asset's frontmatter so the user isn't prompted
mid-flow. See [claude.md](claude.md) and [copilot.md](copilot.md) for the
exact `allowed-tools` / `tools` syntax per host.

---

## Secrets and configuration

- Never bake API keys into `.mcp.json`. Reference env vars
  (`${env:API_KEY}` style) and document them in the README.
- For interactive collection, use the host's user-config mechanism:
  - **Claude:** `userConfig` block in `plugin.json` (`sensitive: true` for
    secrets). See [claude.md](claude.md#user-configuration).
  - **VS Code / Copilot:** workspace `mcp.json` input variables
    (`password: true`). See [copilot.md](copilot.md).
- Prefer OAuth or short-lived tokens over long-lived static credentials when
  the server supports them.

---

## Cross-tool portability checklist

- [ ] Server launch command works without absolute paths from the plugin
      author's machine.
- [ ] All secrets come from env vars or user config — never committed.
- [ ] Tool names are stable; renaming breaks every `allowed-tools` entry
      that references them.
- [ ] README documents: required env vars, install steps (if any),
      transport, and which assets in the plugin depend on this server.
- [ ] Tested in at least one Claude-format and one Copilot-format build of
      the plugin.

---

## Anti-patterns

| Anti-pattern                                | Fix                                                                |
| ------------------------------------------- | ------------------------------------------------------------------ |
| Shipping a server when a hook would do      | Use a hook for one-shot, deterministic side effects                |
| Hardcoded absolute paths in `command`/`args` | Use `${CLAUDE_PLUGIN_ROOT}` (Claude) or rely on `PATH`             |
| Secrets in `.mcp.json`                      | Env vars or host user-config; document in README                   |
| Re-implementing a public API as MCP "just because" | Ship a skill or instruction that calls the API directly       |
| Many overlapping servers in one plugin      | Split into multiple plugins so users can install à la carte        |

---

## References

| Source                                | URL                                                                            |
| ------------------------------------- | ------------------------------------------------------------------------------ |
| Model Context Protocol (spec)         | https://modelcontextprotocol.io/                                               |
| MCP SDKs and reference servers        | https://github.com/modelcontextprotocol                                        |
| VS Code · MCP servers                 | https://code.visualstudio.com/docs/copilot/customization/mcp-servers           |
| VS Code · MCP configuration reference | https://code.visualstudio.com/docs/copilot/reference/mcp-configuration         |
| Claude Code · MCP                     | https://code.claude.com/docs/en/mcp                                            |
| Claude Code · Plugins reference (MCP) | https://code.claude.com/docs/en/plugins-reference                              |

### Format references in this repo

| Source              | URL                       |
| ------------------- | ------------------------- |
| Claude format spec  | [claude.md](claude.md)    |
| Copilot format spec | [copilot.md](copilot.md)  |
