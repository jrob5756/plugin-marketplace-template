#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

import {
  ensureDir,
  listPluginDirs,
  pathExists,
  readJson,
  readYaml,
  rmrf,
  writeJson,
} from './util.mjs';
import * as claude from './transpilers/claude.mjs';
import * as codex from './transpilers/codex.mjs';
import * as copilot from './transpilers/copilot.mjs';
import * as opencode from './transpilers/opencode.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const PLUGINS_DIR = path.join(REPO_ROOT, 'plugins');
const DIST_DIR = path.join(REPO_ROOT, 'dist');
const MARKETPLACE_YAML = path.join(REPO_ROOT, 'marketplace.yaml');
const PLUGIN_SCHEMA = path.join(__dirname, 'schemas', 'plugin.schema.json');
const MARKETPLACE_SCHEMA = path.join(__dirname, 'schemas', 'marketplace.schema.json');

const TARGETS = {
  claude: claude,
  codex: codex,
  copilot: copilot,
  opencode: opencode,
};

// Per-target output paths for the generated marketplace.json. Targets that
// have no marketplace concept (e.g. OpenCode) are omitted; they emit
// per-bundle README.md files from inside their transpiler instead.
const MARKETPLACE_FILES = {
  claude: ['.claude-plugin', 'marketplace.json'],
  codex: ['.agents', 'plugins', 'marketplace.json'],
  copilot: ['.github', 'plugin', 'marketplace.json'],
};

function parseArgs(argv) {
  const args = { validateOnly: false, clean: false, plugin: null, target: null };
  for (const arg of argv) {
    if (arg === '--validate-only' || arg === '--validate') args.validateOnly = true;
    else if (arg === '--clean') args.clean = true;
    else if (arg.startsWith('--plugin=')) args.plugin = arg.slice('--plugin='.length);
    else if (arg.startsWith('--target=')) args.target = arg.slice('--target='.length);
    else if (arg === '--help' || arg === '-h') {
      printUsage();
      process.exit(0);
    } else {
      console.error(`Unknown argument: ${arg}`);
      printUsage();
      process.exit(1);
    }
  }
  if (args.target && !TARGETS[args.target]) {
    console.error(`Unknown target: ${args.target}. Valid: ${Object.keys(TARGETS).join(', ')}`);
    process.exit(1);
  }
  return args;
}

function printUsage() {
  console.log(`Usage: node tools/build.mjs [options]

Options:
  --target=<name>      Build only this target (${Object.keys(TARGETS).join(' | ')})
  --plugin=<name>      Build only this plugin
  --validate-only      Validate plugin.yaml files without writing anything
  --clean              Remove dist/ before building (or alone to just clean)
  -h, --help           Show this message
`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.clean && !args.plugin && !args.target) {
    await rmrf(DIST_DIR);
    console.log(`✓ Cleaned ${path.relative(REPO_ROOT, DIST_DIR)}/`);
    if (process.argv.length === 3) return;
  }

  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);
  const validatePlugin = ajv.compile(await readJson(PLUGIN_SCHEMA));
  const validateMarketplace = ajv.compile(await readJson(MARKETPLACE_SCHEMA));

  // Load every plugin.yaml
  const pluginDirs = await listPluginDirs(PLUGINS_DIR);
  const plugins = [];
  let errors = 0;

  for (const dir of pluginDirs) {
    const yamlPath = path.join(dir, 'plugin.yaml');
    if (!(await pathExists(yamlPath))) {
      console.warn(`⚠ ${path.relative(REPO_ROOT, dir)}/: no plugin.yaml — skipped`);
      continue;
    }
    const plugin = await readYaml(yamlPath);
    if (!validatePlugin(plugin)) {
      console.error(`✗ ${path.relative(REPO_ROOT, yamlPath)}:`);
      for (const err of validatePlugin.errors) {
        console.error(`    ${err.instancePath || '(root)'} ${err.message}`);
      }
      errors++;
      continue;
    }
    if (plugin.name !== path.basename(dir)) {
      console.error(
        `✗ ${path.relative(REPO_ROOT, yamlPath)}: name "${plugin.name}" does not match directory "${path.basename(dir)}"`,
      );
      errors++;
      continue;
    }
    plugins.push({ plugin, pluginDir: dir });
  }

  // Marketplace
  let marketplace = null;
  if (await pathExists(MARKETPLACE_YAML)) {
    marketplace = await readYaml(MARKETPLACE_YAML);
    if (!validateMarketplace(marketplace)) {
      console.error(`✗ ${path.relative(REPO_ROOT, MARKETPLACE_YAML)}:`);
      for (const err of validateMarketplace.errors) {
        console.error(`    ${err.instancePath || '(root)'} ${err.message}`);
      }
      errors++;
    }
  } else {
    console.error(`✗ marketplace.yaml not found at repo root`);
    errors++;
  }

  if (errors > 0) {
    console.error(`\n${errors} validation error(s).`);
    process.exit(1);
  }
  console.log(`✓ Validated ${plugins.length} plugin(s) and marketplace.yaml`);

  if (args.validateOnly) return;

  // Filter plugins
  const selected = args.plugin
    ? plugins.filter((p) => p.plugin.name === args.plugin)
    : plugins;
  if (args.plugin && selected.length === 0) {
    console.error(`✗ No plugin named "${args.plugin}" found.`);
    process.exit(1);
  }

  const targetNames = args.target ? [args.target] : Object.keys(TARGETS);

  await ensureDir(DIST_DIR);

  for (const targetName of targetNames) {
    const target = TARGETS[targetName];
    for (const { plugin, pluginDir } of selected) {
      await target.transpile({ plugin, pluginDir, outRoot: DIST_DIR });
      console.log(`  ✓ ${targetName}/${plugin.name}`);
    }
  }

  // Marketplace files — only regenerate when building all plugins for both targets.
  if (!args.plugin && !args.target) {
    for (const targetName of targetNames) {
      const target = TARGETS[targetName];
      const marketplacePath = MARKETPLACE_FILES[targetName];
      if (!marketplacePath) continue;
      const entries = plugins
        .map(({ plugin }) => target.marketplaceEntry({ plugin }))
        .filter((entry) => entry !== null);
      const marketplaceOut = {
        name: marketplace.name,
        owner: marketplace.owner,
        metadata: {
          description: marketplace.description,
          version: marketplace.version,
          pluginRoot: `./dist/${targetName}`,
        },
        plugins: entries,
      };
      const outFile = path.join(REPO_ROOT, ...marketplacePath);
      await writeJson(outFile, marketplaceOut);
      console.log(`  ✓ ${path.relative(REPO_ROOT, outFile)}`);
    }
  }

  console.log(`\n✓ Build complete.`);
}

main().catch((err) => {
  console.error(err.stack ?? err.message ?? err);
  process.exit(1);
});
