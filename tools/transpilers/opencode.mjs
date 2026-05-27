import path from 'node:path';
import { promises as fs } from 'node:fs';
import {
  copyDir,
  copyFile,
  dumpYamlFrontmatter,
  ensureDir,
  pathExists,
  readJson,
  rmrf,
  stripFrontmatter,
  writeJson,
  writeText,
} from '../util.mjs';

const TARGET = 'opencode';

// Order matches the field reference in docs/opencode.md.
const AGENT_FIELD_ORDER = [
  'description',
  'mode',
  'model',
  'variant',
  'temperature',
  'top_p',
  'steps',
  'hidden',
  'color',
  'disable',
  'permission',
];

const SKILL_FIELD_ORDER = [
  'name',
  'description',
  'license',
  'compatibility',
  'metadata',
];

function orderKeys(obj, order) {
  const out = {};
  for (const key of order) {
    if (obj[key] !== undefined) out[key] = obj[key];
  }
  for (const key of Object.keys(obj)) {
    if (out[key] === undefined) out[key] = obj[key];
  }
  return out;
}

/**
 * Transpile one plugin into dist/opencode/<name>/.
 *
 * Output shape mirrors the layout a user would drop into a project as
 * `.opencode/` (or symlink). MCP config is emitted as a separate
 * opencode.mcp.json fragment that the user merges into their opencode.json
 * (no per-plugin manifest exists in OpenCode itself).
 */
export async function transpile({ plugin, pluginDir, outRoot }) {
  const outDir = path.join(outRoot, TARGET, plugin.name);
  await rmrf(outDir);
  await ensureDir(outDir);

  await writeAgents({ plugin, pluginDir, outDir });
  await writeSkills({ plugin, pluginDir, outDir });
  await writeMcp({ plugin, pluginDir, outDir });
  await writeScripts({ plugin, pluginDir, outDir });
  await maybeWarnHooks({ plugin });
  await writeReadme({ plugin, pluginDir, outDir });
}

async function writeAgents({ plugin, pluginDir, outDir }) {
  for (const agent of plugin.agents ?? []) {
    const srcPath = path.join(pluginDir, agent.path);
    const body = stripFrontmatter(await fs.readFile(srcPath, 'utf8'));

    const opencode = agent.opencode ?? {};
    const fm = pruneUndefined({
      description: agent.description,
      ...opencode,
    });

    // If a Claude agent is gated `user-invocable: false` for Copilot and has
    // no explicit opencode.mode, default it to "subagent" since the intent
    // is the same: hide from the user's primary picker.
    if (
      fm.mode === undefined &&
      agent.copilot?.['user-invocable'] === false
    ) {
      fm.mode = 'subagent';
    }

    // Carry the Claude color over to OpenCode when the author didn't specify
    // one. Both fields accept the same named-color vocabulary for the eight
    // standard hues, and OpenCode silently ignores unknown values.
    if (fm.color === undefined && agent.claude?.color) {
      fm.color = agent.claude.color;
    }

    const ordered = orderKeys(fm, AGENT_FIELD_ORDER);
    const frontmatter = dumpYamlFrontmatter(ordered, { quoteStrings: 'double' });
    const outFile = path.join(outDir, '.opencode', 'agents', `${agent.name}.md`);
    await writeText(outFile, frontmatter + '\n' + body.trimStart());
  }
}

async function writeSkills({ plugin, pluginDir, outDir }) {
  for (const skill of plugin.skills ?? []) {
    const srcDir = path.join(pluginDir, skill.path);
    const skillSrc = path.join(srcDir, 'SKILL.md');
    const body = stripFrontmatter(await fs.readFile(skillSrc, 'utf8'));

    const fm = pruneUndefined({
      name: skill.name,
      description: skill.description,
      ...(skill.opencode ?? {}),
    });

    const ordered = orderKeys(fm, SKILL_FIELD_ORDER);
    const frontmatter = dumpYamlFrontmatter(ordered, { quoteStrings: 'double' });
    const skillOutDir = path.join(outDir, '.opencode', 'skills', skill.name);
    await ensureDir(skillOutDir);

    await copyDir(srcDir, skillOutDir, { skip: ['SKILL.md'] });
    await writeText(path.join(skillOutDir, 'SKILL.md'), frontmatter + '\n' + body.trimStart());
  }
}

/**
 * Convert a Claude/Copilot-style .mcp.json (top-level `mcpServers` key with
 * `type: stdio | http | sse | ws`) into an OpenCode-compatible fragment with
 * `mcp` and `type: local | remote`. We emit it as a standalone file
 * `opencode.mcp.json` that the user merges into their own opencode.json.
 */
async function writeMcp({ plugin, pluginDir, outDir }) {
  if (!plugin.mcpServers) return;
  const src = await readJson(path.join(pluginDir, plugin.mcpServers));
  const servers = src.mcpServers ?? {};
  if (Object.keys(servers).length === 0) return;

  const mcp = {};
  for (const [name, entry] of Object.entries(servers)) {
    mcp[name] = convertMcpEntry(entry);
  }

  await writeJson(path.join(outDir, 'opencode.mcp.json'), { mcp });
}

function convertMcpEntry(entry) {
  const type = entry.type ?? (entry.url ? 'remote' : 'stdio');

  if (type === 'stdio' || type === 'local') {
    const out = { type: 'local' };
    const command = [entry.command, ...(entry.args ?? [])].filter(Boolean);
    out.command = command;
    if (entry.env && Object.keys(entry.env).length > 0) out.environment = entry.env;
    if (entry.cwd) out.cwd = entry.cwd;
    return out;
  }

  // http / sse / ws / remote — all expressed as `type: remote` in OpenCode.
  const out = { type: 'remote', url: entry.url };
  if (entry.headers) out.headers = entry.headers;
  return out;
}

async function writeScripts({ plugin, pluginDir, outDir }) {
  const scriptsDir = path.join(pluginDir, 'scripts');
  if (!(await pathExists(scriptsDir))) return;
  // Scripts live inside `.opencode/scripts/` so the whole `.opencode/` tree is
  // self-contained and can be symlinked into a project as a unit.
  await copyDir(scriptsDir, path.join(outDir, '.opencode', 'scripts'), {
    skip: ['__pycache__', '.pytest_cache'],
  });
}

async function maybeWarnHooks({ plugin }) {
  if (!plugin.hooks) return;
  console.warn(
    `  ⚠ ${plugin.name}: hooks are not transpiled to OpenCode in this build. ` +
      `OpenCode has no declarative hooks file — express the same behavior as a ` +
      `JS/TS plugin under .opencode/plugins/. See docs/opencode.md#4-plugins.`,
  );
}

async function writeReadme({ plugin, pluginDir, outDir }) {
  const hasMcp =
    plugin.mcpServers &&
    (await pathExists(path.join(outDir, 'opencode.mcp.json')));
  const hasScripts = await pathExists(path.join(outDir, '.opencode', 'scripts'));

  const lines = [];
  lines.push(`# ${plugin.name} — OpenCode bundle`);
  lines.push('');
  if (plugin.description) {
    lines.push(plugin.description);
    lines.push('');
  }
  lines.push('## Install');
  lines.push('');
  lines.push('Copy or symlink the `.opencode/` directory into your project root:');
  lines.push('');
  lines.push('```bash');
  lines.push(`# from this directory`);
  lines.push(`cp -R .opencode /path/to/your/project/`);
  lines.push('```');
  lines.push('');
  lines.push('Or install globally:');
  lines.push('');
  lines.push('```bash');
  lines.push(`mkdir -p ~/.config/opencode`);
  lines.push(`cp -R .opencode/* ~/.config/opencode/`);
  lines.push('```');
  lines.push('');
  if (hasMcp) {
    lines.push('## MCP servers');
    lines.push('');
    lines.push(
      'Merge `opencode.mcp.json` into your `opencode.json` (or `~/.config/opencode/opencode.json`) — copy the `mcp` block:',
    );
    lines.push('');
    lines.push('```bash');
    lines.push(`cat opencode.mcp.json`);
    lines.push('```');
    lines.push('');
  }
  if (plugin.hooks) {
    lines.push('## Hooks');
    lines.push('');
    lines.push(
      `> ⚠ This plugin defines hooks (\`hooks/hooks.json\` in the source). OpenCode has no declarative hooks; port them to a JS/TS plugin under \`.opencode/plugins/\`. See [docs/opencode.md](https://github.com/jrob5756/plugins/blob/main/docs/opencode.md#4-plugins).`,
    );
    lines.push('');
  }
  if (hasScripts) {
    lines.push('## Scripts');
    lines.push('');
    lines.push(
      'Helper scripts are installed under `.opencode/scripts/`. Reference them from agents or generated plugin code by absolute path.',
    );
    lines.push('');
  }
  await writeText(path.join(outDir, 'README.md'), lines.join('\n'));
}

function pruneUndefined(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) continue;
    if (Array.isArray(v) && v.length === 0) continue;
    if (typeof v === 'object' && v !== null && !Array.isArray(v) && Object.keys(v).length === 0) continue;
    out[k] = v;
  }
  return out;
}

/**
 * OpenCode has no marketplace registry — bundles are distributed as
 * `.opencode/` directories users copy into their project or global config.
 * Returning null tells build.mjs to skip marketplace.json generation for
 * this target.
 */
export function marketplaceEntry() {
  return null;
}
