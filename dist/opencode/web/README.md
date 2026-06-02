# web — OpenCode bundle

Web research specialist agent with search and deep research skills

## Install

Copy or symlink the `.opencode/` directory into your project root:

```bash
# from this directory
cp -R .opencode /path/to/your/project/
```

Or install globally:

```bash
mkdir -p ~/.config/opencode
cp -R .opencode/* ~/.config/opencode/
```

## MCP servers

Merge `opencode.mcp.json` into your `opencode.json` (or `~/.config/opencode/opencode.json`) — copy the `mcp` block:

```bash
cat opencode.mcp.json
```

## Hooks

> ⚠ This plugin defines hooks. OpenCode has no declarative hooks; port them to a JS/TS plugin under `.opencode/plugins/`. See your marketplace's `docs/opencode.md` for the JS plugin pattern, or add `targets: [claude, copilot]` to the hooks declaration in plugin.yaml to opt out of OpenCode-bound hook emission.
