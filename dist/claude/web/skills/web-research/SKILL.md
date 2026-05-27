---
name: web-research
description: |
  Web search and deep research workflows. Use when the user wants to look
  something up, search the web, research a topic, find documentation, or
  get a well-sourced answer. Triggers: search, look up, find, research,
  what is, how does, compare, web search, find docs, look into, investigate,
  deep dive, explore topic. Use this skill when the user asks a factual
  question that requires external information, even if they don't
  explicitly say "search" or "research."
argument-hint: "[search | research] [question or topic]"
---

# Web Research

Search the web or conduct deep multi-angle research. Parse the user's request to determine which workflow to run.

## Dispatch

| User says | Workflow |
|-----------|----------|
| "search", "look up", "find", "what is", "how does", short factual question | **Search** |
| "research", "deep dive", "investigate", "compare", broad/multi-faceted topic | **Research** |

**Default:** Use **Search** for simple questions. Use **Research** when the topic has multiple dimensions, requires comparing alternatives, or the user explicitly asks for thorough coverage.

## Constraints

- **Ground every claim in source evidence** — never present unsourced assertions as fact.
- **Prefer official sources** — documentation > official blogs > community content > forums.
- **Note freshness** — mention if information may be outdated.
- **State uncertainty explicitly** — when information is unavailable or conflicting, say so.
- **Always use the `web-searcher` subagent** — never call web-search MCP tools directly.

## Subagent Prompt Template

Use this template for all `web-searcher` subagent calls:

```
You are a focused research assistant. Your only job is to answer the following research question as accurately and concisely as possible.

<research_question>
[question or angle]
</research_question>

<instructions>
- Search the web using multiple engines for broad coverage.
- Fetch full content from the most promising results using available web fetch tools.
- Return factual findings with inline source URLs for every key claim.
- Prefer official sources (documentation, official blogs) over community content.
- Note content freshness — mention if information may be outdated.
- If initial results aren't relevant, try alternative keywords or phrasings.
- Focus on reporting what the sources say; state uncertainty explicitly when information is unavailable or conflicting.
</instructions>
```

## Output Format

Structure all responses with:

1. **Summary** — Key findings in 2–3 sentences answering the question directly.
2. **Details** — Organized by subtopic with bullet points; include code examples in fenced blocks with language tags where relevant.
3. **Sources** — List all URLs used:
   ```
   ## Sources
   - [Title or Description](https://url.com) - Brief note on what this covers
   ```

---

## Workflows

### Search — Quick Web Lookup

**When to use:** The user has a focused question that can be answered with a single search pass — a factual question, error message lookup, API reference, or simple "how do I" query.

1. **Understand the query:**
   - Restate the core question in one sentence.
   - Identify key search terms — the most specific, disambiguating words.
   - Decide if the query needs 1 focused search or 2–3 with different phrasings.

2. **Search:** Dispatch a single `web-searcher` subagent with the question.

   | Scenario | Approach |
   |----------|----------|
   | Simple factual question | Single focused search with specific terms |
   | Ambiguous or broad topic | 2–3 searches with different phrasings |
   | Code or API question | Search for official docs first, then examples |
   | Troubleshooting | Search the exact error message, then broaden |
   | GitHub project info | Use `fetchGithubReadme` for project overviews |

3. **Format the response** using the standard output format above.

**Output:** A concise, well-cited answer with sources.

---

### Research — Deep Multi-Angle Investigation

**When to use:** The user has a broad question with multiple dimensions — comparisons, best practices, trade-offs, current state of a technology, or anything requiring comprehensive coverage.

1. **Understand the request:**
   - Restate the core question or goal in one sentence.
   - Identify the **key dimensions** to research (concepts, comparisons, best practices, current state, examples, caveats).
   - Choose **3–5 focused research angles** — one per subagent — that together give complete coverage. Each angle must be meaningfully different.
   - Present this plan as a short bulleted list so the user can see what will be researched.

2. **Parallel research:** Dispatch **3–5 `web-searcher` subagents simultaneously** — all in a single parallel batch. Scale by complexity:
   - Simple, focused questions → 3 subagents
   - Broad, multi-faceted topics → 5 subagents

   Use these categories as inspiration for research angles:

   | Angle | Description |
   |-------|-------------|
   | Conceptual | What is it? Core definitions, history, how it works. |
   | Comparative | How does it compare to alternatives? Trade-offs? |
   | Best Practices | Official recommendations, community conventions, pitfalls. |
   | Current State | Latest version, recent changes, known issues, roadmap. |
   | Examples | Real-world usage examples, tutorials, code samples. |
   | Caveats | Limitations, edge cases, gotchas, security concerns. |

3. **Synthesize:**
   - **Reconcile conflicts** — note discrepancies, explain which source is more authoritative.
   - **Eliminate redundancy** — merge overlapping findings.
   - **Structure clearly** — use headings, bullet points, tables, or code blocks.
   - **Cite sources** — every key claim links to a source URL.
   - **Surface gaps** — state explicitly if research was inconclusive on any angle.

4. **Format the response** using the standard output format above. Present only synthesized findings — omit raw subagent output.

**Output:** A comprehensive, well-structured response with sources covering all research angles.
