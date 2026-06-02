import path from 'node:path';
import { promises as fs } from 'node:fs';
import {
  assertNoFrontmatter,
  copyDir,
  copyFile,
  dumpYamlFrontmatter,
  ensureDir,
  normalizeHooks,
  normalizeMcpServers,
  orderKeys,
  pathExists,
  pruneUndefined,
  rmrf,
  safeResolve,
  writeJson,
  writeText,
} from '../util.mjs';

const TARGET = 'copilot';

const AGENT_FIELD_ORDER = [
  'name',
  'description',
  'argument-hint',
  'model',
  'tools',
  'agents',
  'user-invocable',
  'disable-model-invocation',
  'target',
];

const SKILL_FIELD_ORDER = [
  'name',
  'description',
  'argument-hint',
  'user-invocable',
  'disable-model-invocation',
  'context',
];

const MANIFEST_FIELD_ORDER = [
  'name',
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

/**
 * Transpile one plugin into dist/copilot/<name>/.
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
    name: plugin.name,
    description: plugin.description,
    version: plugin.version,
    author: plugin.author,
    homepage: plugin.homepage,
    repository: plugin.repository,
    license: plugin.license,
    keywords: plugin.keywords,
  };
  // Copilot uses auto-discovery from default paths. We only set custom paths
  // when they differ from defaults; here we keep defaults so the manifest
  // stays minimal.
  const hooks = normalizeHooks(plugin.hooks);
  if (hooks && (!hooks.targets || hooks.targets.includes(TARGET))) {
    manifest.hooks = 'hooks/hooks.json';
  }
  if (normalizeMcpServers(plugin.mcpServers)) manifest.mcpServers = '.mcp.json';

  const ordered = orderKeys(pruneUndefined(manifest), MANIFEST_FIELD_ORDER);
  await writeJson(path.join(outDir, '.github', 'plugin', 'plugin.json'), ordered);
}

async function writeAgents({ plugin, pluginDir, outDir }) {
  for (const agent of plugin.agents ?? []) {
    if (agent.targets && !agent.targets.includes(TARGET)) continue;
    const srcPath = safeResolve(pluginDir, agent.path);
    const body = await fs.readFile(srcPath, 'utf8');
    assertNoFrontmatter(srcPath, body);

    const fm = pruneUndefined({
      name: agent.name,
      description: agent.description,
      'argument-hint': agent['argument-hint'],
      ...(agent.copilot ?? {}),
    });

    const ordered = orderKeys(fm, AGENT_FIELD_ORDER);
    // Copilot/awesome-copilot convention: single-quoted descriptions + flow-style tools.
    const frontmatter = flowStyleTools(
      forceSingleQuotedDescription(
        dumpYamlFrontmatter(ordered, { quoteStrings: 'single' }),
      ),
    );
    const outFile = path.join(outDir, 'agents', `${agent.name}.agent.md`);
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
      'argument-hint': skill['argument-hint'],
      ...(skill.copilot ?? {}),
    });

    const ordered = orderKeys(fm, SKILL_FIELD_ORDER);
    const frontmatter = forceSingleQuotedDescription(
      dumpYamlFrontmatter(ordered, { quoteStrings: 'single' }),
    );
    const skillOutDir = path.join(outDir, 'skills', skill.name);
    await ensureDir(skillOutDir);

    await copyDir(srcDir, skillOutDir, { skip: ['SKILL.md'] });
    await writeText(path.join(skillOutDir, 'SKILL.md'), frontmatter + '\n' + body.trimStart());
  }
}

async function copySharedAssets({ plugin, pluginDir, outDir }) {
  const mcp = normalizeMcpServers(plugin.mcpServers);
  if (mcp) {
    const mcpOut = path.join(outDir, '.mcp.json');
    if (mcp.path) {
      await copyFile(safeResolve(pluginDir, mcp.path), mcpOut);
    } else {
      await writeJson(mcpOut, mcp.inline);
    }
  }
  const hooks = normalizeHooks(plugin.hooks);
  if (hooks && (!hooks.targets || hooks.targets.includes(TARGET))) {
    const hooksOut = path.join(outDir, 'hooks', 'hooks.json');
    if (hooks.path) {
      await copyFile(safeResolve(pluginDir, hooks.path), hooksOut);
    } else {
      await writeJson(hooksOut, hooks.inline);
    }
  }
  const scriptsDir = safeResolve(pluginDir, './scripts');
  if (await pathExists(scriptsDir)) {
    await copyDir(scriptsDir, path.join(outDir, 'scripts'), {
      skip: ['__pycache__', '.pytest_cache'],
    });
  }
}

/**
 * Awesome-copilot requires `description:` values to be single-quoted scalars.
 * js-yaml emits plain scalars when the content is safe, so we post-process the
 * one line that matters. Multi-line block scalars (|, >) are left alone since
 * they are also acceptable to the validator.
 */
function forceSingleQuotedDescription(yamlStr) {
  return yamlStr.replace(/^description:[ \t]*(.*)$/m, (line, value) => {
    if (!value || /^['"|>[{]/.test(value)) return line;
    const escaped = value.replace(/'/g, "''");
    return `description: '${escaped}'`;
  });
}

/**
 * Convert a top-level block-style `tools:` array into inline flow style:
 *   tools:
 *     - read
 *     - 'enghub/*'
 *   →  tools: [read, 'enghub/*']
 * Single-quotes entries containing `/` or `*` (server-glob style) to match the
 * awesome-copilot convention.
 */
function flowStyleTools(yamlStr) {
  return yamlStr.replace(/^tools:\n((?:  - .+(?:\n|$))+)/m, (_, block) => {
    const items = block
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const raw = line.replace(/^ {2}- /, '');
        const unquoted = raw.replace(/^'(.*)'$/, '$1').replace(/^"(.*)"$/, '$1');
        return /[/*]/.test(unquoted) ? `'${unquoted}'` : unquoted;
      })
      .join(', ');
    return `tools: [${items}]\n`;
  });
}

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
