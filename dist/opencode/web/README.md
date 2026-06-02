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
