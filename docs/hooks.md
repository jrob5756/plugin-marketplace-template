# Hooks — Authoring Guide

How to design event-driven automation that fires reliably, fails safely, and
returns the right kind of decision to the agent. Tool-agnostic guidance for
hooks shipped with a plugin or in user/workspace settings.

For host-specific event catalogs, naming, and JSON schemas, see
[claude.md](claude.md#4-hooks--hookshooksjson-no-frontmatter) and
[copilot.md](copilot.md#5-hooks--hooksjson-or-hookshooksjson-no-frontmatter).

---

## What a hook is

A hook executes a deterministic action (shell command, HTTP call, or LLM
prompt) in response to a lifecycle event. Hooks complement instructions and
agents:

| Mechanism      | Best for                                            |
| -------------- | --------------------------------------------------- |
| **Instructions** | Always-on guidance for the model                  |
| **Agents**     | Persistent personas with tool restrictions          |
| **Skills**     | On-demand capabilities triggered by user intent     |
| **Hooks**      | **Deterministic, code-driven automation** at lifecycle points — guaranteed outcomes regardless of the model |

Use hooks when you need a guarantee. "Block `DROP TABLE` no matter how the
agent was prompted" is a hook job; "be careful with SQL" is an instructions
job.

---

## When to use which event

Different tools support different event sets. The events below are the common
portable lifecycle concepts across Claude Code, Copilot CLI, and VS Code;
host docs list the full catalogs and exact names.

| Event              | Fires…                                          | Use for                                              |
| ------------------ | ----------------------------------------------- | ---------------------------------------------------- |
| `SessionStart`     | Beginning of a new session                      | Inject context, load env vars, validate project state |
| `UserPromptSubmit` | User submits a prompt, before the model sees it | Audit requests, inject system context, block by policy |
| `PreToolUse`       | Before any tool call                            | Validate or block dangerous operations, modify input |
| `PostToolUse`      | After a tool succeeds                           | Run formatters, log results, trigger follow-ups      |
| `SubagentStart`    | A subagent is spawned                           | Track nested agent usage, init subagent resources    |
| `SubagentStop`     | A subagent finishes                             | Aggregate results, cleanup                           |
| `Stop`             | The agent finishes responding                   | Verify completeness, generate reports                |
| `PreCompact`       | Before context compaction                       | Export important context, save state                 |
| `Notification`     | The host emits a notification                   | Forward to email, Slack, Teams, etc.                 |

> Claude Code adds many more events (`PermissionDenied`, `PostToolBatch`,
> `FileChanged`, `CwdChanged`, etc.). See [claude.md](claude.md) for the full
> list.

### Designing for the right event

- **Validation belongs in `PreToolUse`.** Returning `deny` is the only way to
  block before damage is done.
- **Reaction belongs in `PostToolUse`.** Format on save, lint, or log here.
- **Context injection** at `SessionStart` or `UserPromptSubmit` is cheaper
  than putting the same content in instructions (it doesn't burn tokens until
  the event fires).
- **Completeness checks** belong in `Stop`. Return `decision: block` with a
  reason to force the agent to continue.

---

## Hook types

Not every host supports every hook type. Treat `command` as the portable
baseline, then layer in richer host-specific types only when you need them.

| Type       | Behavior                                                      | When to use                                            |
| ---------- | ------------------------------------------------------------- | ------------------------------------------------------ |
| `command`  | Execute a shell command or script                             | Fast, deterministic checks; file operations            |
| `prompt`   | Evaluate an LLM prompt with event context                     | Context-aware decisions ("is this prompt about prod?") |
| `http`     | POST the event JSON to a URL                                  | Forwarding to webhooks, audit pipelines                |
| `mcp_tool` | Call a tool on a configured MCP server                        | Reuse logic already exposed via MCP                    |
| `agent`    | Run an agentic verifier with its own tools                    | Complex verification tasks                             |

> Support diverges by host. Claude Code currently exposes the broadest hook-type
> surface; Copilot/VS Code center on command hooks. See [claude.md](claude.md#hook-types)
> and [copilot.md](copilot.md#5-hooks--hooksjson-or-hookshooksjson-no-frontmatter)
> for exact support.

### Prompt-based vs command hooks

- **Prompt hooks** are great for fuzzy decisions: "evaluate whether this file
  write looks safe."
- **Command hooks** are great for deterministic checks: "deny any path
  containing `.env`."
- Mix both: a fast command hook short-circuits obvious cases, then a prompt
  hook handles ambiguous ones.

---

## I/O contract

### Input (stdin)

Every hook receives structured JSON on stdin. A typical payload includes a
session identifier, current working directory, event name, timestamp, and
additional event-specific fields.

```json
{
  "timestamp": "2026-05-21T10:30:00.000Z",
  "cwd": "/path/to/workspace",
  "sessionId": "session-identifier",
  "hookEventName": "PreToolUse"
}
```

For tool-related events, hosts commonly add tool name, tool input, and tool
output/result fields. For prompt-related events, they add the submitted prompt.

> **Naming diverges across hosts.** You will see differences like snake_case vs
> camelCase property names (`tool_input.file_path` vs `tool_input.filePath`) and
> PascalCase vs lowerCamelCase event names. Normalize these inside the script and
> check [claude.md](claude.md#4-hooks--hookshooksjson-no-frontmatter) or
> [copilot.md](copilot.md#5-hooks--hooksjson-or-hookshooksjson-no-frontmatter)
> for exact payloads.

### Output (stdout)

Hooks write structured JSON to stdout. At a high level, hosts support the same
core outcomes:

| Outcome             | Purpose                                                           |
| ------------------- | ----------------------------------------------------------------- |
| Continue            | Allow execution to proceed                                        |
| Warn                | Surface a message without blocking                                |
| Block / deny        | Stop the current action                                           |
| Modify input/context | Change the tool input or add explanatory context before execution |

Common response fields include `continue`, `stopReason`, `systemMessage`, and
host-specific envelopes such as `hookSpecificOutput`. Use the smallest response
shape that expresses the outcome you need.

### Exit codes

| Exit | Meaning                                                             |
| ---- | ------------------------------------------------------------------- |
| `0`  | Success — host parses stdout as the hook result                     |
| `2`  | Blocking error — stop processing, feed stderr/result back to model  |
| other | Non-blocking warning — show/log the problem, then continue         |

### `PreToolUse` permission decisions

`PreToolUse` is where hooks can approve, ask, deny, or rewrite a tool call.
When multiple hooks apply, the most restrictive decision usually wins:

`deny` > `ask` > `allow`

See the tool-specific docs for the exact response envelope used to express
those decisions.

---

## Security

### Input validation

Hooks receive untrusted input from the model. Validate everything.

```bash
#!/bin/bash
set -euo pipefail

input=$(cat)
tool_name=$(echo "$input" | jq -r '.tool_name // .toolName // empty')

# Reject anything that isn't a known tool name
if [[ ! "$tool_name" =~ ^[a-zA-Z0-9_]+$ ]]; then
  echo '{"decision": "deny", "reason": "Invalid tool name"}' >&2
  exit 2
fi
```

### Path safety

Check every path argument for traversal and sensitive files.

```bash
file_path=$(echo "$input" | jq -r '.tool_input.file_path // .tool_input.filePath // empty')

if [[ "$file_path" == *".."* ]]; then
  echo '{"decision": "deny", "reason": "Path traversal detected"}' >&2
  exit 2
fi

if [[ "$file_path" == *".env"* ]]; then
  echo '{"decision": "deny", "reason": "Sensitive file"}' >&2
  exit 2
fi
```

### Quote all variables

```bash
project_dir=$(echo "$input" | jq -r '.cwd')

# GOOD: Quoted
echo "$file_path"
cd "$project_dir"

# BAD: Unquoted — shell injection risk
echo $file_path
cd $project_dir
```

### Secrets

- Never hardcode tokens, keys, or passwords in hook scripts.
- Read secrets from environment variables or the OS keychain.
- Don't log sensitive input fields.

---

## Performance

### Parallel execution

All matching hooks run **in parallel** within a single event. Design for
independence:

- Hooks don't see each other's output.
- Ordering is non-deterministic.
- Avoid shared state. If you must, use file locks.

### Timeouts

Timeouts are host-specific. In practice they are usually short enough that hook
logic should complete in seconds, not minutes.

Set lower timeouts for fast checks:

```json
{
  "type": "command",
  "command": "bash check.sh",
  "timeout": 5
}
```

### Optimization

1. Use **command hooks for quick deterministic checks** — they're cheaper than
   prompt hooks.
2. Use **prompt hooks for complex reasoning** — but only when needed.
3. **Cache validation results** in a workspace-local cache or tool-provided
   data directory keyed by file hash.
4. **Minimize I/O in hot paths** (`PreToolUse`/`PostToolUse` fire constantly).

---

## Conditional activation patterns

### Flag-file activation

Make a hook conditional on a project marker file:

```bash
#!/bin/bash
set -euo pipefail

input=$(cat)
workspace_dir=$(echo "$input" | jq -r '.cwd')
flag_file="$workspace_dir/.enable-strict-validation"
if [ ! -f "$flag_file" ]; then
  exit 0   # silently skip
fi
# … rest of hook logic
```

### Configuration-based activation

Read project config to decide whether to fire:

```bash
config_file="$workspace_dir/.hook-config.json"
if [ -f "$config_file" ]; then
  enabled=$(jq -r '.strictMode // false' "$config_file")
  [ "$enabled" = "true" ] || exit 0
fi
```

Document the activation mechanism in your plugin README.

---

## Hook configuration formats

Most hook systems expose one of two structural patterns. Keep the comparison at
this level in shared docs; use the tool-specific references for full schemas.

### Flat form (settings / VS Code / Copilot)

```jsonc
{
  "hooks": {
    "PostToolUse": [
      {
        "type": "command",
        "command": "npx prettier --write \"$TOOL_INPUT_FILE_PATH\""
      }
    ]
  }
}
```

### Matcher form (Claude Code / plugin hooks)

```jsonc
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          { "type": "command", "command": "./scripts/format.sh" }
        ]
      }
    ]
  }
}
```

> **Format diverges by host.** Claude uses grouped matcher objects; Copilot and
> VS Code primarily document a flat event-to-hook map. Some hosts parse both,
> but may ignore matcher semantics.

> **Location and property naming also differ.** Claude-format plugins typically
> use `hooks/hooks.json`; Copilot-format plugins typically use `hooks.json` at
> the plugin root. See [claude.md](claude.md#4-hooks--hookshooksjson-no-frontmatter)
> and [copilot.md](copilot.md#5-hooks--hooksjson-or-hookshooksjson-no-frontmatter)
> before publishing.

---

## Anti-patterns

| Anti-pattern                                     | Better approach                                                  |
| ------------------------------------------------ | ---------------------------------------------------------------- |
| Hardcoded paths                                  | Use the workspace path from stdin or host-provided path variables |
| Trusting tool input without validation           | Validate every field                                             |
| Long-running hooks                               | Cache, use shorter timeouts, push slow work async                |
| Relying on hook execution order                  | Hooks run in parallel — design for independence                  |
| Modifying global state unpredictably             | Hooks fire constantly; side effects compound                     |
| Logging sensitive input                          | Strip secrets before logging                                     |
| Returning invalid JSON                           | Validate with `jq` before printing                               |
| Missing shebang line                             | Always start with `#!/bin/bash` or `#!/usr/bin/env bash`         |
| Script not executable                            | `chmod +x script.sh` and commit the bit                          |
| Assuming live reload of hook config              | Confirm whether the host reloads dynamically or only on restart  |

---

## Debugging hooks

1. **Enable host-specific debug output.** For example, Claude Code exposes
   `claude --debug`; VS Code exposes the **GitHub Copilot Chat Hooks** output
   channel. See [claude.md](claude.md#4-hooks--hookshooksjson-no-frontmatter)
   and [copilot.md](copilot.md#5-hooks--hooksjson-or-hookshooksjson-no-frontmatter)
   for host details.
2. **Look for registration messages** at session start to confirm the hook
   loaded.
3. **Test scripts manually** with synthetic stdin:

   ```bash
   echo '{"cwd":".","hookEventName":"PreToolUse","tool_name":"Write","tool_input":{"file_path":"/test"}}' | \
     bash ./hooks/validate.sh
   echo "Exit code: $?"
   ```

4. **Validate JSON output.**

   ```bash
   output=$(./hook.sh < test-input.json)
   echo "$output" | jq .
   ```

5. **Use the host's hook-inspection surface** (for example Claude Code's
   `/hooks`) to verify what is actually loaded in the current session.

---

## References

### Official documentation

| Source                                  | URL                                                                   |
| --------------------------------------- | --------------------------------------------------------------------- |
| VS Code · Agent hooks (Preview)         | https://code.visualstudio.com/docs/copilot/customization/hooks        |
| Claude Code · Hooks                     | https://code.claude.com/docs/en/hooks                                 |
| Claude Code · Hooks reference           | https://code.claude.com/docs/en/hooks-reference                       |
| GitHub Copilot · Using hooks            | https://docs.github.com/en/copilot/how-tos/use-copilot-agents/coding-agent/use-hooks |

### Format references in this repo

| Source                | URL                       |
| --------------------- | ------------------------- |
| Claude format spec    | [claude.md](claude.md)    |
| Copilot format spec   | [copilot.md](copilot.md)  |
| Agent authoring guide | [agents.md](agents.md)    |
| Skill authoring guide | [skills.md](skills.md)    |
| MCP server guide      | [mcp-servers.md](mcp-servers.md) |

### Community

| Source                          | URL                                                  |
| ------------------------------- | ---------------------------------------------------- |
| Awesome Copilot · Hooks         | https://github.com/github/awesome-copilot/tree/main/hooks |
