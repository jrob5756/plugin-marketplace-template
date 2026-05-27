# Agents — Authoring Guide

How to design, write, and ship custom agents. Tool-agnostic best practices for
agents that work well across Claude Code and GitHub Copilot.

For tool-specific frontmatter fields and file locations, see
[claude.md](claude.md) and [copilot.md](copilot.md).

---

## What an agent is

An agent is a **persona** with its own system prompt, tool restrictions, and
(optionally) model. Exact frontmatter fields, file names, and activation UI
vary by platform; this guide stays at the conceptual layer. Two activation
paths:

1. **User selection** — the user picks the agent from a dropdown, types
   `@agent-name`, or passes `--agent <name>` on the CLI.
2. **Subagent delegation** — an orchestrator agent recognizes a subtask and
   delegates based on the candidate agent's `description`.

Unlike skills, agents load their **full body immediately** when activated. They
do not use progressive disclosure.

---

## Agent vs Skill

| Dimension          | Agent                                        | Skill                                                      |
| ------------------ | -------------------------------------------- | ---------------------------------------------------------- |
| Purpose            | Persistent persona with behavior + tools     | Capability or workflow loaded on demand                    |
| Context            | Isolated context window (as subagent)        | Inline in current conversation (unless forked)             |
| Tool restrictions  | Allowlist / denylist                         | Generally inherits caller's tools                          |
| Model selection    | Can pin model and effort                     | Limited model control                                      |
| Loading            | Full prompt loaded on activation             | Three-stage progressive disclosure                         |
| Portability        | Tool-specific format                         | Open standard (`agentskills.io`)                           |
| Handoffs           | Platform-specific; some tools support workflow handoffs | None                                                       |

**Choose an agent when you need:** tool restrictions, model routing, context
isolation, handoffs, or a persistent persona.

**Choose a skill when you need:** portable domain knowledge, bundled scripts,
or many capabilities competing for selective auto-loading.

For the portable skill format, see the Agent Skills spec (`agentskills.io`) and
[skills.md](skills.md).

---

## Writing effective descriptions

The `description` field determines whether the orchestrator delegates to this
agent. Get it wrong and the agent never fires.

### Formula: WHAT + WHEN + BOUNDARY

1. **WHAT** the agent specializes in (domain expertise)
2. **WHEN** to use it ("Use for…", imperative)
3. **BOUNDARY** to prevent misuse ("NEVER call X directly outside this agent")

### Principles

- **50–200 characters.** Often shown as placeholder text in the chat input.
- **Imperative phrasing.** "Use for all ADO-related tasks" beats "Can handle
  ADO tasks."
- **Be pushy.** Agents tend to under-trigger. Add "Use proactively" or
  "Regardless of the complexity of the task."
- **Set boundaries.** Explicitly state what should **not** invoke this agent.
- **Tool-owning agents need exclusivity claims** — see Tool Isolation below.

### Good examples

```yaml
# Tool-owning agent with exclusivity boundary
description: >
  Azure DevOps specialist for managing work items, repositories, pull requests,
  pipelines, wikis, test plans, and more. Use for all ADO-related tasks.
  NEVER call ADO MCP tools directly outside of this agent.
```

```yaml
# Proactive agent with broad trigger
description: >
  Web research specialist. Use proactively for searching the web, finding
  documentation, fetching article content, or researching topics across
  multiple sources.
```

```yaml
# Focused agent with complexity override
description: >
  Browser automation with playwright mcp. Use for all playwright-based tasks,
  regardless of the complexity of the task. NEVER call playwright mcp tools
  directly outside of this agent.
```

### Bad examples

| Anti-pattern                        | Why it fails                                                  |
| ----------------------------------- | ------------------------------------------------------------- |
| `"You are a software engineer"`     | No focus, no boundary, no trigger criteria                    |
| `"Helps with code review"`          | Not imperative, doesn't say when to invoke                    |
| `"Runs eslint and prettier"`        | Implementation-focused — describe user intent instead         |
| `"For when you need to debug code"` | Vague trigger; will lose to any other agent                   |

---

## Body structure

The body becomes the agent's system prompt. Keep it focused and scannable.

### Size constraints

- **Hard cap:** ~30,000 characters in most tools.
- **Target:** 500–3,000 characters for most agents.
- Move detailed reference material to separate files loaded via Markdown links.

### Recommended sections

```markdown
You are a [role] specializing in [domain].

## When Invoked
What to do first; entry-point procedure.

## Core Workflow
### For [Scenario A]
1. Step 1
2. Step 2

### For [Scenario B]
1. Step 1
2. Step 2

## Available Tools
Quick-reference table grouped by domain.

## Output Guidelines
Format rules; what to include/exclude.

## Constraints
Hard rules, security boundaries, what NOT to do.
```

### Structural tips

- **Start with a clear identity.** "You are a [role] specialized in [purpose]."
- **Use imperative language.** "Always do X." "Never do Y."
- **Document tools inline** with a grouped reference table.
- **Define output format explicitly** — headings, citations, code blocks.
- **Include reasoning behind rules.** "Use `date-fns` because moment.js is
  deprecated."
- **Show preferred and avoided patterns** with concrete examples.

---

## Design patterns

| Pattern              | Use when                                              | Example                              |
| -------------------- | ----------------------------------------------------- | ------------------------------------ |
| **Domain Expert**    | Deep knowledge of one technology                      | Terraform specialist, ADO specialist |
| **Workflow Automator** | Multi-step process with clear sequencing            | Release manager, PR reviewer         |
| **Quality Gate**     | Enforces standards and checks                         | Accessibility auditor, security reviewer |
| **Orchestrator**     | Delegates to subagents, validates results             | Plan → implement → review pipeline   |
| **Mentor**           | Teaches via Socratic questioning, doesn't write code  | Learning-focused agent               |
| **Research Assistant** | Searches, fetches, summarizes; returns sources     | Web researcher, docs lookup          |

---

## Tool configuration

### Principle of least privilege

Only enable the tools the agent needs. Fewer tools means clearer purpose,
better focus, and stronger security.

| Agent type            | Typical tool set                                       |
| --------------------- | ------------------------------------------------------ |
| Read-only / reviewer  | Read, Glob, Grep, search                               |
| Implementation        | Above + Edit, Write, terminal                          |
| External service      | Only that service's MCP tools                          |
| Orchestrator          | The agent-dispatch tool plus read tools for validation |

### Tool isolation in descriptions

For agents that own a set of MCP tools, enforce isolation in **both** the
description and the body:

```yaml
description: "... NEVER call ADO MCP tools directly outside of this agent ..."
```

This prevents other agents or the main conversation from bypassing tool
restrictions. Pair with a project-level `copilot-instructions.md` or
`CLAUDE.md` rule reinforcing the same boundary.

### Tool list size

- Most tools enforce a **128-tool hard cap per request.** Exceeding it is a
  load-time error.
- Even well below the cap, large tool lists degrade focus and inflate prompt
  size. Prefer narrow allowlists.

---

## Model selection

| Task complexity                              | Tier      | Cost multiplier |
| -------------------------------------------- | --------- | --------------- |
| Search, fetch, simple dispatch               | Fast      | 0.0–0.33×       |
| Coding, review, synthesis, judgment          | Balanced  | 1×              |
| Architecture, deep debugging, complex visual | Capable   | 3–30×           |

### When to use each tier

**Fast** (Haiku / GPT mini / Gemini Flash) — the agent primarily:

- Searches APIs or documentation
- Dispatches CRUD operations to external services
- Performs lookups or simple routing

**Balanced** (Sonnet / GPT standard / Gemini Pro) — the agent:

- Writes or reviews code
- Synthesizes information from multiple sources
- Makes judgment calls about correctness or quality

**Capable** (Opus / GPT top tier) — the agent:

- Plans architecture or weighs complex trade-offs
- Debugs across many interconnected files
- Handles multi-step visual or spatial reasoning (browser automation, design)

### Cost-conscious routing

Capable models cost roughly 9× more per request than fast ones. Route simple
tasks aggressively to cheap models. Many built-in exploration/research agents
use fast-tier models even though they're general-purpose.

---

## Invocation control matrix

Platforms expose these controls under different field names. Treat this as a
conceptual matrix; for exact schema names, see [claude.md](claude.md) and
[copilot.md](copilot.md). In VS Code/Copilot, the nearest fields are
`user-invocable` and `disable-model-invocation`.

| User-selectable? | Auto-delegation enabled? | In dropdown? | Auto-delegated? | Use case                      |
| ---------------- | ------------------------ | ------------ | --------------- | ----------------------------- |
| `true` (default) | `true` (default)         | Yes          | Yes             | General-purpose               |
| `false`          | `true`                   | No           | Yes             | Subagent-only background spec |
| `true`           | `false`                  | Yes          | No              | On-demand only                |
| `false`          | `false`                  | No           | No              | Effectively disabled          |

---

## Handoffs (workflow chaining)

Handoffs create guided transitions between agents. Some platforms expose them
as first-class UI actions (notably VS Code/Copilot); elsewhere, use the same
pattern with orchestrator prompts and explicit next-step instructions.

```yaml
# Conceptual example — exact handoff schema is platform-specific.
handoffs:
  - label: Start Implementation
    agent: implementation
    prompt: Now implement the plan outlined above.
    send: false
  - label: Run Tests
    agent: tester
    prompt: Run the test suite and report failures.
    send: true
```

See [copilot.md](copilot.md) for a concrete frontmatter schema.

### Best practices

- Use **action-oriented labels.** "Start Implementation" beats "Next."
- Default `send: false` so users review the prompt before submission.
- Set `send: true` only for well-defined, safe transitions.
- Keep chains **linear.** Avoid complex branching.
- Handoffs preserve conversation context across switches.

---

## Anti-patterns

| Anti-pattern                            | Better approach                                          |
| --------------------------------------- | -------------------------------------------------------- |
| Monolithic agent doing five jobs        | Split into focused agents with one purpose each          |
| `"You are a software engineer"` description | Add domain, triggers, and boundaries                 |
| No tool restrictions on a reviewer      | Use a read-only tool set                                 |
| Implementation-focused description      | Describe user intent and trigger phrases                 |
| Conflicting instructions                | Align with repo `.editorconfig`, `AGENTS.md`, etc.       |
| Explaining what the model already knows | Cut it; add only what the agent **lacks**                |
| No defined output format                | Specify headings, citations, code-block expectations     |
| 30,000-char prompt                      | Move detail to referenced files                          |
| "Let me just quickly…" syndrome         | Orchestrator should delegate, not do the work itself     |
| Trusting self-reported completion       | Validate subagent results with a separate check          |
| Specification substitution              | Forbid the subagent from swapping the user's tech choice |

---

## Debugging agents

1. **Check YAML syntax.** Tabs, missing quotes, or malformed arrays cause
   silent load failures.
2. **Verify tool names.** Invalid names are silently ignored — the agent runs
   without the expected tools.
3. **List loaded agents.** `/agents` in chat (VS Code or Claude Code) shows
   every registered agent and source.
4. **Inspect debug logs.** VS Code: gear icon in Chat → "Show Agent Debug
   Logs." Claude Code: `claude --debug`.
5. **Test triggering.** Write ~10 prompts that should delegate to the agent
   and verify it activates. Adjust the description until they all hit.

---

## Minimal template

Illustrative only — exact frontmatter keys, file names, and supported fields
vary by platform. See [claude.md](claude.md) and [copilot.md](copilot.md).

```yaml
---
description: >
  [Role] specialist for [domain]. Use for [specific triggers].
  NEVER call [scoped tools] directly outside this agent.
name: my-agent
tools: [read, search, myServer/*]
model: <tool-specific model name>
---

You are a [role] specialist. Your role is to [core capability].

## When Invoked
1. Understand what the user needs.
2. [First action]
3. [Second action]
4. Return a concise summary with sources.

## Core Workflow

### For [Scenario A]
1. Step 1
2. Step 2

### For [Scenario B]
1. Step 1
2. Step 2

## Output Guidelines
- Be concise — return only the information requested.
- Structure data with Markdown tables, lists, or code blocks.
- Include source URLs for every key claim.

## Constraints
- Never [forbidden action].
- Always [required action].
```

---

## References

### Official documentation

| Source                                   | URL                                                                                       |
| ---------------------------------------- | ----------------------------------------------------------------------------------------- |
| VS Code · Custom agents                  | https://code.visualstudio.com/docs/copilot/customization/custom-agents                    |
| VS Code · Agent skills                   | https://code.visualstudio.com/docs/copilot/customization/agent-skills                     |
| VS Code · Agent tools                    | https://code.visualstudio.com/docs/copilot/agents/agent-tools                             |
| VS Code · Subagents                      | https://code.visualstudio.com/docs/copilot/agents/subagents                               |
| GitHub Copilot · Custom agents config    | https://docs.github.com/en/copilot/reference/custom-agents-configuration                  |
| GitHub Copilot · Org custom agents       | https://docs.github.com/en/copilot/how-tos/use-copilot-agents/coding-agent/create-custom-agents |
| GitHub Copilot · Model comparison        | https://docs.github.com/en/copilot/reference/ai-models/model-comparison                   |
| Claude Code · Sub-agents                 | https://code.claude.com/docs/en/sub-agents                                                |
| Claude Code · Plugins reference (agents) | https://code.claude.com/docs/en/plugins-reference                                         |

### Format references in this repo

| Source                | URL                       |
| --------------------- | ------------------------- |
| Claude format spec    | [claude.md](claude.md)    |
| Copilot format spec   | [copilot.md](copilot.md)  |
| Skill authoring guide | [skills.md](skills.md)    |
| Hook authoring guide  | [hooks.md](hooks.md)      |
| MCP server guide      | [mcp-servers.md](mcp-servers.md) |

### Standards & cross-tool specs

| Source                                    | URL                                                  |
| ----------------------------------------- | ---------------------------------------------------- |
| Agent Skills specification (`agentskills.io`) | https://agentskills.io/specification              |
| Agent Skills · optimizing descriptions    | https://agentskills.io/skill-creation/optimizing-descriptions |
| Agent Skills · best practices             | https://agentskills.io/skill-creation/best-practices |
| Model Context Protocol                    | https://modelcontextprotocol.io/                     |

### Community

| Source                             | URL                                                                                        |
| ---------------------------------- | ------------------------------------------------------------------------------------------ |
| Awesome Copilot · Agents           | https://github.com/github/awesome-copilot/tree/main/agents                                 |
| Awesome Copilot · Agent guidelines | https://github.com/github/awesome-copilot/blob/main/instructions/agents.instructions.md    |
