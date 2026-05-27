# Skills — Authoring Guide

How to design, write, and ship Agent Skills that trigger reliably and load
efficiently. Tool-agnostic best practices grounded in the
[Agent Skills specification](https://agentskills.io/specification) and intended
to work across Claude Code, GitHub Copilot CLI, VS Code, and any other host
that implements the standard.

For tool-specific frontmatter fields, invocation controls, naming/path rules,
and file locations, see [claude.md](claude.md) and [copilot.md](copilot.md).

---

## What a skill is

A skill is a folder containing a `SKILL.md` plus optional bundled resources
(scripts, references, examples, assets). Agents load skills on demand when
their description matches the user's task.

Skills differ from agents in one key way: **progressive disclosure**.

### The three-stage loading model

1. **Discovery** (~100 tokens per skill). Only the `name` + `description` are
   loaded at startup for every installed skill.
2. **Activation.** When the description matches the user's request, the full
   `SKILL.md` body loads into context.
3. **Execution.** As the agent works, it loads bundled files (scripts,
   references, examples) on demand.

Because of this model, you can install **many** skills without bloating
context. Only relevant content loads.

---

## Skill vs Agent vs Prompt vs Instruction

| Use a…                                | When you need…                                                          |
| ------------------------------------- | ----------------------------------------------------------------------- |
| **Skill** (`SKILL.md`)                | Portable capability that loads on demand; bundled scripts/resources     |
| **Agent** (`.agent.md` / `.md`)       | Persistent persona with tool restrictions, model preference, handoffs   |
| **Prompt**                            | One-shot reusable prompt invoked manually                               |
| **Instruction**                       | Always-on rules or coding standards applied by the host                 |

See [agents.md](agents.md) for the full agent-vs-skill matrix.

---

## Writing effective descriptions

The `description` carries the **entire burden of triggering**. If it doesn't
convey *when* the skill is useful, the agent never reaches for it.

### Formula: WHAT + WHEN + KEYWORDS

1. **WHAT** the skill does (capabilities)
2. **WHEN** to use it ("Use this skill when…", imperative)
3. **KEYWORDS** users might say (trigger phrases)

### Principles

- **Stay under 1024 characters.** Longer descriptions get truncated.
- **Imperative phrasing.** "Use this skill when…" beats "This skill does…"
- **Focus on user intent**, not implementation details.
- **Be pushy.** Skills tend to under-trigger. Add "even if they don't
  explicitly mention X."
- **Include DO NOT TRIGGER guidance** when competing with similar skills.

### Good examples

```yaml
# Keyword-dense trigger list
description: |
  Git workflow shortcuts for common operations. Triggers: acp, add commit push,
  commit and push, bacp, branch and PR, sync, pull rebase.
```

```yaml
# Intent-focused with explicit triggers and anti-triggers
description: |
  Build apps with the Claude API or Anthropic SDK. TRIGGER when: code imports
  anthropic or @anthropic-ai/sdk. DO NOT TRIGGER when: code imports openai.
```

```yaml
# Capability-focused with indirect triggers
description: |
  Analyze CSV and tabular data — summary statistics, derived columns, charts.
  Use when the user has a CSV, TSV, or Excel file, even if they don't
  explicitly mention 'CSV' or 'analysis'.
```

### Anti-patterns

| Anti-pattern                                 | Why it fails                                                     |
| -------------------------------------------- | ---------------------------------------------------------------- |
| `"Helps with PDFs"`                          | No capabilities, no triggers                                     |
| `"Runs pdfplumber to parse text"`            | Implementation-focused; should describe user intent              |
| `"This skill is for working with files"`     | Too broad; will compete poorly with every other file-related skill |
| Description over 1024 chars                  | Truncated or rejected                                            |
| Mismatched directory name and `name` field   | Skill silently fails to load                                     |

---

## Tool-specific frontmatter

Keep this guide focused on the **portable** parts of Agent Skills: triggering,
progressive disclosure, body structure, and bundled resources.

Host-specific frontmatter fields — including slash-command argument hints,
manual/automatic invocation controls, experimental context modes, and strict
naming/path validation rules — belong in [claude.md](claude.md) and
[copilot.md](copilot.md), because those details vary by implementation.

---

## SKILL.md body structure

### Size constraints

- **Hard target:** under 500 lines / ~5,000 tokens.
- Move detailed procedures to `references/` files.
- Add what the agent **lacks** — don't explain what the model already knows.

### Recommended sections

For **workflow skills** (multi-action dispatch):

```markdown
## Dispatch
User phrase → action mapping table.

## Constraints
Hard rules (security, tool restrictions) visible on every activation.

## Workflows / Actions
One `###` per workflow, with:
- "When to use" annotation
- Inputs / outputs
- Steps (or pointer to a reference file)

## Quick Reference
Copy-pasteable commands (optional).
```

For **reference / knowledge skills**:

```markdown
## When to Use Each Guide
Task → file routing table.

## Quick Reference
Common commands.

## Guidelines
Global rules.
```

### Structural patterns

| Pattern                          | Use when                                                | Example         |
| -------------------------------- | ------------------------------------------------------- | --------------- |
| **Dispatch table + references**  | Multiple complex workflows sharing context              | `dependabot`    |
| **Inline dispatch**              | Workflows are short (<15 lines each)                    | `git-workflow`  |
| **Router + domain variants**     | Same capability across platforms or languages           | `claude-api`    |
| **Task-based routing table**     | Mix of simple inline and complex referenced tasks       | `azure-devops`  |

---

## Bundled resources

A skill folder may include any of the following subdirectories. None are
required, but the conventions below are widely understood.

| Directory     | Purpose                                                              | Loaded?                   |
| ------------- | -------------------------------------------------------------------- | ------------------------- |
| `references/` | Detailed docs, schemas, deep API references                          | On demand when referenced |
| `examples/`   | Working samples users can copy and adapt                             | On demand                 |
| `scripts/`    | Executable helpers (Python/Bash). `chmod +x` for shell scripts       | Executed, not always read |
| `assets/`     | Templates, icons, fonts used **in output** (not loaded into context) | Never auto-loaded         |

### When to use a reference file

**Use references when:**

- SKILL.md would exceed ~500 lines.
- Individual workflows are >5 steps with detailed procedures.
- Content is only needed for specific sub-tasks.
- Multiple domain variants exist (e.g. per-language guidance).

**Keep inline when:**

- Constraints / gotchas must be visible on every activation.
- Dispatch tables and routing logic.
- Shared rules that apply across all workflows.
- Total SKILL.md stays under 500 lines.

### Rules for references

- Keep references **one level deep** from SKILL.md. Deep nesting confuses the
  agent.
- Tell the agent **when** to load each file, not just "see references/x.md."
- For large references (>300 lines), include a table of contents.
- 5 MB per-file cap is a common community convention (awesome-copilot
  validator).

---

## Invocation controls

Whether a skill appears in a `/` menu, can auto-load, or can run in a forked
context is a **host capability**, not part of the portable authoring model.
Document those flags in the tool-specific references instead of duplicating
them here: [claude.md](claude.md) and [copilot.md](copilot.md).

---

## Anti-patterns

| Anti-pattern                                | Better approach                                                    |
| ------------------------------------------- | ------------------------------------------------------------------ |
| Vague description ("Helps with PDFs")       | Use the WHAT + WHEN + KEYWORDS formula                             |
| Implementation-focused description          | Describe user intent and trigger phrases                           |
| Menu of equal options                       | Pick a default; mention alternatives briefly                       |
| Explaining what the agent already knows     | Cut it; add only what the agent **lacks**                          |
| Deeply nested references                    | One level deep from SKILL.md                                       |
| Massive SKILL.md (>500 lines)               | Move detail to `references/`; keep dispatch and constraints inline |
| No bundled-file routing                     | Tell the agent **when** to load each reference                     |
| Single skill doing everything               | Split into smaller skills with focused descriptions                |
| Overfitting triggers to one failed query    | Generalize — don't add keywords specific to a single user prompt   |
| No testing                                  | Write ~20 eval queries (10 should-trigger, 10 should-not), iterate |

---

## Debugging skills

1. **Check YAML syntax.** Tabs in frontmatter cause silent load failures.
2. **Verify host-specific naming/path rules.** Some tools require the skill
   identifier to match the directory name or registered path; mismatches can
   silently skip loading.
3. **List loaded skills.** In hosts that expose it, `/skills` shows what
   registered.
4. **Inspect debug logs.** VS Code: gear icon in Chat → "Show Agent Debug
   Logs." Claude Code: `claude --debug`.
5. **Run eval queries.** Write 20 prompts (half should trigger the skill,
   half should not) and adjust the description until both halves behave.
6. **Validate against the spec.** `skills-ref validate ./my-skill`
   ([skills-ref library](https://github.com/agentskills/agentskills/tree/main/skills-ref)).

---

## Minimal template

```
my-skill/
├── SKILL.md
├── references/
│   └── detailed-guide.md     # loaded on demand
└── examples/
    └── working-example.sh
```

```yaml
---
name: my-skill
description: |
  [WHAT the skill does.] Use when the user [WHEN to invoke], or asks to
  "[trigger phrase 1]", "[trigger phrase 2]", "[trigger phrase 3]".
  DO NOT trigger when [exclusion if needed].
---

# My Skill

## When to Use
Specific scenarios this skill handles.

## Workflow
1. Step 1
2. Step 2
3. Step 3

## Additional Resources

### Reference Files
- **[references/detailed-guide.md](references/detailed-guide.md)** — load when [condition].

### Examples
- **[examples/working-example.sh](examples/working-example.sh)** — adaptable starting point.
```

---

## References

### Standards & official documentation

| Source                                          | URL                                                                                  |
| ----------------------------------------------- | ------------------------------------------------------------------------------------ |
| Agent Skills open standard                      | https://agentskills.io/specification                                                 |
| Agent Skills · Authoring best practices         | https://agentskills.io/skill-creation/best-practices                                 |
| Agent Skills · Optimizing descriptions          | https://agentskills.io/skill-creation/optimizing-descriptions                        |
| VS Code · Agent Skills                          | https://code.visualstudio.com/docs/copilot/customization/agent-skills                |
| Claude Code · Skills                            | https://code.claude.com/docs/en/skills                                               |
| Anthropic reference skills                      | https://github.com/anthropics/skills                                                 |
| skills-ref validator                            | https://github.com/agentskills/agentskills/tree/main/skills-ref                      |

### Format references in this repo

| Source                | URL                       |
| --------------------- | ------------------------- |
| Claude format spec    | [claude.md](claude.md)    |
| Copilot format spec   | [copilot.md](copilot.md)  |
| Agent authoring guide | [agents.md](agents.md)    |
| Hook authoring guide  | [hooks.md](hooks.md)      |
| MCP server guide      | [mcp-servers.md](mcp-servers.md) |

### Community

| Source                          | URL                                                  |
| ------------------------------- | ---------------------------------------------------- |
| Awesome Copilot · Skills        | https://github.com/github/awesome-copilot/tree/main/skills |
| FengGuanyun · plugin-dev skills | https://github.com/FengGuanyun/claude-plugins/tree/main/marketplaces/claude-plugins-official/plugins/plugin-dev/skills |
