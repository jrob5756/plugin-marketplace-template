import path from 'node:path';
import { promises as fs } from 'node:fs';
import {
  copyDir,
  copyFile,
  dumpYamlFrontmatter,
  ensureDir,
  pathExists,
  rmrf,
  stripFrontmatter,
  writeJson,
  writeText,
} from '../util.mjs';

const TARGET = 'claude';

const AGENT_FIELD_ORDER = [
  'name',
  'description',
  'model',
  'effort',
  'maxTurns',
  'tools',
  'disallowedTools',
  'skills',
  'memory',
  'background',
  'isolation',
  'color',
];

const MANIFEST_FIELD_ORDER = [
  '$schema',
  'name',
  'displayName',
  'description',
  'version',
  'author',
  'homepage',
  'repository',
  'license',
  'keywords',
  'agents',
  'skills',
  'hooks',
  'mcpServers',
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
 * Transpile one plugin into dist/claude/<name>/.
 */
export async function transpile({ plugin, pluginDir, outRoot }) {
  const outDir = path.join(outRoot, TARGET, plugin.name);
  await rmrf(outDir);
  await ensureDir(outDir);

  await writeManifest({ plugin, outDir });
  await writeAgents({ plugin, pluginDir, outDir });
  await writeSkills({ plugin, pluginDir, outDir });
  await copySharedAssets({ plugin, pluginDir, outDir });
}

async function writeManifest({ plugin, outDir }) {
  const manifest = {
    $schema: 'https://json.schemastore.org/claude-code-plugin-manifest.json',
    name: plugin.name,
    description: plugin.description,
    version: plugin.version,
    author: plugin.author,
    homepage: plugin.homepage,
    repository: plugin.repository,
    license: plugin.license,
    keywords: plugin.keywords,
  };
  if (plugin.agents?.length) {
    manifest.agents = plugin.agents.map((a) => `./agents/${a.name}.md`);
  }
  if (plugin.skills?.length) {
    manifest.skills = plugin.skills.map((s) => `./skills/${s.name}`);
  }
  if (plugin.hooks) manifest.hooks = './hooks/hooks.json';
  if (plugin.mcpServers) manifest.mcpServers = './.mcp.json';

  const ordered = orderKeys(pruneUndefined(manifest), MANIFEST_FIELD_ORDER);
  await writeJson(path.join(outDir, '.claude-plugin', 'plugin.json'), ordered);
}

async function writeAgents({ plugin, pluginDir, outDir }) {
  for (const agent of plugin.agents ?? []) {
    const srcPath = path.join(pluginDir, agent.path);
    const body = stripFrontmatter(await fs.readFile(srcPath, 'utf8'));

    const fm = pruneUndefined({
      name: agent.name,
      description: agent.description,
      ...(agent.claude ?? {}),
    });

    // Claude convention: tools field is a comma-separated string, not a YAML array.
    if (Array.isArray(fm.tools)) fm.tools = fm.tools.join(', ');
    if (Array.isArray(fm.disallowedTools)) fm.disallowedTools = fm.disallowedTools.join(', ');

    const ordered = orderKeys(fm, AGENT_FIELD_ORDER);
    const frontmatter = dumpYamlFrontmatter(ordered, { quoteStrings: 'double' });
    const outFile = path.join(outDir, 'agents', `${agent.name}.md`);
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
      'argument-hint': skill['argument-hint'],
      ...(skill.claude ?? {}),
    });

    const frontmatter = dumpYamlFrontmatter(fm, { quoteStrings: 'double' });
    const skillOutDir = path.join(outDir, 'skills', skill.name);
    await ensureDir(skillOutDir);

    // Copy bundled assets first (references/, examples/, scripts/, assets/, etc.),
    // then write the freshly generated SKILL.md so it overrides any source copy.
    await copyDir(srcDir, skillOutDir, { skip: ['SKILL.md'] });
    await writeText(path.join(skillOutDir, 'SKILL.md'), frontmatter + '\n' + body.trimStart());
  }
}

async function copySharedAssets({ plugin, pluginDir, outDir }) {
  if (plugin.mcpServers) {
    await copyFile(path.join(pluginDir, plugin.mcpServers), path.join(outDir, '.mcp.json'));
  }
  if (plugin.hooks) {
    await copyFile(path.join(pluginDir, plugin.hooks), path.join(outDir, 'hooks', 'hooks.json'));
  }
  // Copy plugin-level scripts/ verbatim if present
  const scriptsDir = path.join(pluginDir, 'scripts');
  if (await pathExists(scriptsDir)) {
    await copyDir(scriptsDir, path.join(outDir, 'scripts'), {
      skip: ['__pycache__', '.pytest_cache'],
    });
  }
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
 * Return the marketplace plugin entry pointing at this plugin's dist output.
 */
export function marketplaceEntry({ plugin }) {
  const entry = {
    name: plugin.name,
    source: `./${plugin.name}`,
    description: plugin.description,
    version: plugin.version,
  };
  if (plugin.skills?.length) {
    entry.skills = plugin.skills.map((s) => `./skills/${s.name}`);
  }
  return pruneUndefined(entry);
}
