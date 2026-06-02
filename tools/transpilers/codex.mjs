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

const TARGET = 'codex';

// PluginManifest field order from openai/codex:codex-rs/core-plugins/src/manifest.rs.
// `interface` is Codex's marketplace-display block (displayName, icons, etc.).
const MANIFEST_FIELD_ORDER = [
  'name',
  'version',
  'description',
  'keywords',
  'interface',
  'skills',
  'mcpServers',
  'apps',
  'hooks',
];

const INTERFACE_FIELD_ORDER = [
  'displayName',
  'shortDescription',
  'longDescription',
  'developerName',
  'category',
  'capabilities',
  'websiteURL',
  'privacyPolicyURL',
  'termsOfServiceURL',
  'defaultPrompt',
  'brandColor',
  'composerIcon',
  'logo',
  'screenshots',
];

const SKILL_FIELD_ORDER = ['name', 'description', 'argument-hint'];

/**
 * Transpile one plugin into dist/codex/<name>/.
 *
 * Codex CLI (openai/codex) ships its own .codex-plugin/plugin.json schema and
 * also reads .claude-plugin/plugin.json as a fallback. We emit the native
 * Codex layout for the components Codex's plugin loader actually consumes:
 * skills, hooks, mcpServers, and the `interface` marketplace-display block.
 *
 * Codex does NOT load agents from plugin manifests. Subagents in Codex live
 * as TOML files under `.codex/agents/` (project) or `$CODEX_HOME/agents/`
 * (user) and are installed separately. We do not emit agents into this
 * bundle — authors with agents should also ship the dist/claude/ bundle
 * (Codex picks up agents from `.claude/agents/*.md` via its migration code:
 * `openai/codex:codex-rs/external-agent-migration/src/lib.rs`).
 *
 * Notable incompatibility with Claude / Copilot: Codex does NOT honor a
 * `${CLAUDE_PLUGIN_ROOT}` / `${CODEX_PLUGIN_ROOT}` env var inside plugin MCP
 * server commands. Plugin authors targeting Codex must either install their
 * commands on `PATH` or use absolute paths in `command`. The transpiler emits
 * a console warning when it detects a plugin-rooted path expression.
 *
 * See docs/codex.md for the format reference.
 */
export async function transpile({ plugin, pluginDir, outRoot }) {
  const outDir = path.join(outRoot, TARGET, plugin.name);
  await rmrf(outDir);
  await ensureDir(outDir);

  await writeManifest({ plugin, outDir });
  maybeWarnAgents({ plugin });
  await writeSkills({ plugin, pluginDir, outDir });
  await copySharedAssets({ plugin, pluginDir, outDir });
}

async function writeManifest({ plugin, outDir }) {
  const manifest = {
    name: plugin.name,
    version: plugin.version,
    description: plugin.description,
    keywords: plugin.keywords,
  };

  // Codex's `interface` block is the marketplace-display surface
  // (displayName, brand color, screenshots). Synthesize it from the
  // tool-agnostic fields we already have.
  const codexBlock = plugin.codex ?? {};
  const iface = pruneUndefined({
    displayName: plugin.displayName ?? codexBlock.displayName,
    shortDescription: codexBlock.shortDescription,
    longDescription: codexBlock.longDescription,
    developerName: plugin.author?.name ?? codexBlock.developerName,
    category: codexBlock.category,
    capabilities: codexBlock.capabilities,
    websiteURL: plugin.homepage ?? codexBlock.websiteURL,
    privacyPolicyURL: codexBlock.privacyPolicyURL,
    termsOfServiceURL: codexBlock.termsOfServiceURL,
    defaultPrompt: codexBlock.defaultPrompt,
    brandColor: codexBlock.brandColor,
    composerIcon: codexBlock.composerIcon,
    logo: codexBlock.logo,
    screenshots: codexBlock.screenshots,
  });
  if (Object.keys(iface).length > 0) {
    manifest.interface = orderKeys(iface, INTERFACE_FIELD_ORDER);
  }

  if (plugin.skills?.length) manifest.skills = './skills';

  if (normalizeMcpServers(plugin.mcpServers)) manifest.mcpServers = './.mcp.json';

  const hooks = normalizeHooks(plugin.hooks);
  if (hooks && (!hooks.targets || hooks.targets.includes(TARGET))) {
    manifest.hooks = './hooks/hooks.json';
  }

  const ordered = orderKeys(pruneUndefined(manifest), MANIFEST_FIELD_ORDER);
  await writeJson(path.join(outDir, '.codex-plugin', 'plugin.json'), ordered);
}

function maybeWarnAgents({ plugin }) {
  if (!plugin.agents?.length) return;
  console.warn(
    `  ⚠ ${plugin.name}: ${plugin.agents.length} agent(s) defined but not ` +
      `emitted in the Codex bundle. Codex loads subagents from ` +
      `.codex/agents/*.toml or $CODEX_HOME/agents/, not from plugin manifests. ` +
      `Install agents via the dist/claude/ bundle (Codex auto-migrates ` +
      `.claude/agents/*.md to TOML) or hand-author .codex/agents/<name>.toml.`,
  );
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
      ...(skill.codex ?? {}),
    });

    const ordered = orderKeys(fm, SKILL_FIELD_ORDER);
    const frontmatter = dumpYamlFrontmatter(ordered, { quoteStrings: 'double' });
    const skillOutDir = path.join(outDir, 'skills', skill.name);
    await ensureDir(skillOutDir);

    // Bundled assets (references/, scripts/, examples/, ...) copied verbatim.
    await copyDir(srcDir, skillOutDir, { skip: ['SKILL.md'] });
    await writeText(
      path.join(skillOutDir, 'SKILL.md'),
      frontmatter + '\n' + body.trimStart(),
    );
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
    await maybeWarnPluginRoot({ pluginDir, mcpFile: mcpOut, pluginName: plugin.name });
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
 * Codex does not expand ${CLAUDE_PLUGIN_ROOT} (or any equivalent variable)
 * inside MCP server command/args. Warn at build time so the plugin author
 * has a chance to either rewrite the command or document the gap.
 */
async function maybeWarnPluginRoot({ pluginDir, mcpFile, pluginName }) {
  try {
    const text = await fs.readFile(mcpFile, 'utf8');
    if (/\$\{?CLAUDE_PLUGIN_ROOT|\$\{?CODEX_PLUGIN_ROOT/.test(text)) {
      console.warn(
        `  ⚠ ${pluginName}: MCP config references \${CLAUDE_PLUGIN_ROOT} or ` +
          `\${CODEX_PLUGIN_ROOT}, but Codex CLI does not expand these in plugin ` +
          `MCP commands. Use an absolute path or an executable on \$PATH instead.`,
      );
    }
  } catch {
    /* file unreadable: skip warning */
  }
}

/**
 * Return the marketplace plugin entry pointing at this plugin's dist output.
 * Codex consumes marketplace.json at either `.agents/plugins/marketplace.json`
 * or `.claude-plugin/marketplace.json`; build.mjs uses the former.
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
