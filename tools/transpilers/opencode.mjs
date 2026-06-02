import path from 'node:path';
import { promises as fs } from 'node:fs';
import {
  assertNoFrontmatter,
  copyDir,
  dumpYamlFrontmatter,
  ensureDir,
  normalizeHooks,
  normalizeMcpServers,
  orderKeys,
  pathExists,
  pruneUndefined,
  readJson,
  rmrf,
  safeResolve,
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
    if (agent.targets && !agent.targets.includes(TARGET)) continue;
    const srcPath = safeResolve(pluginDir, agent.path);
    const body = await fs.readFile(srcPath, 'utf8');
    assertNoFrontmatter(srcPath, body);

    const fm = pruneUndefined({
      description: agent.description,
      ...(agent.opencode ?? {}),
    });

    const ordered = orderKeys(fm, AGENT_FIELD_ORDER);
    const frontmatter = dumpYamlFrontmatter(ordered, { quoteStrings: 'double' });
    const outFile = path.join(outDir, '.opencode', 'agents', `${agent.name}.md`);
    await writeText(outFile, frontmatter + '\n' + body.trimStart());
  }
}

async function writeSkills({ plugin, pluginDir, outDir }) {
  for (const skill of plugin.skills ?? []) {
    const srcDir = safeResolve(pluginDir, skill.path);
    const skillSrc = path.join(srcDir, 'SKILL.md');
    const body = await fs.readFile(skillSrc, 'utf8');
    assertNoFrontmatter(skillSrc, body);

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
  const declared = normalizeMcpServers(plugin.mcpServers);
  if (!declared) return;
  const src = declared.path
    ? await readJson(safeResolve(pluginDir, declared.path))
    : declared.inline;
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
  const scriptsDir = safeResolve(pluginDir, './scripts');
  if (!(await pathExists(scriptsDir))) return;
  // Scripts live inside `.opencode/scripts/` so the whole `.opencode/` tree is
  // self-contained and can be symlinked into a project as a unit.
  await copyDir(scriptsDir, path.join(outDir, '.opencode', 'scripts'), {
    skip: ['__pycache__', '.pytest_cache'],
  });
}

async function maybeWarnHooks({ plugin }) {
  const hooks = normalizeHooks(plugin.hooks);
  if (!hooks) return;
  // Authors who explicitly scope hooks to other targets opt out of the warning.
  if (hooks.targets && !hooks.targets.includes(TARGET)) return;
  console.warn(
    `  ⚠ ${plugin.name}: hooks are not transpiled to OpenCode in this build. ` +
      `OpenCode has no declarative hooks file — express the same behavior as a ` +
      `JS/TS plugin under .opencode/plugins/, or add ` +
      `\`targets: [claude, copilot]\` to the hooks declaration in plugin.yaml ` +
      `to silence this warning.`,
  );
}

async function writeReadme({ plugin, pluginDir, outDir }) {
  const hasMcp =
    plugin.mcpServers !== undefined &&
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
  const hooks = normalizeHooks(plugin.hooks);
  if (hooks && (!hooks.targets || hooks.targets.includes(TARGET))) {
    lines.push('## Hooks');
    lines.push('');
    lines.push(
      `> ⚠ This plugin defines hooks. OpenCode has no declarative hooks; port them to a JS/TS plugin under \`.opencode/plugins/\`. See your marketplace's \`docs/opencode.md\` for the JS plugin pattern, or add \`targets: [claude, copilot]\` to the hooks declaration in plugin.yaml to opt out of OpenCode-bound hook emission.`,
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

/**
 * OpenCode has no marketplace registry — bundles are distributed as
 * `.opencode/` directories users copy into their project or global config.
 * Returning null tells build.mjs to skip marketplace.json generation for
 * this target.
 */
export function marketplaceEntry() {
  return null;
}
