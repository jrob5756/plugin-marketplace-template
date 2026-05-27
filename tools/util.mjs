import { promises as fs } from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';

export async function readYaml(filePath) {
  const text = await fs.readFile(filePath, 'utf8');
  return yaml.load(text);
}

export async function readJson(filePath) {
  const text = await fs.readFile(filePath, 'utf8');
  return JSON.parse(text);
}

export async function writeJson(filePath, value) {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, JSON.stringify(value, null, 2) + '\n', 'utf8');
}

export async function writeText(filePath, text) {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, text, 'utf8');
}

export async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

export async function rmrf(dirPath) {
  await fs.rm(dirPath, { recursive: true, force: true });
}

export async function pathExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

export async function copyDir(srcDir, destDir, { skip = [] } = {}) {
  await ensureDir(destDir);
  const entries = await fs.readdir(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    if (skip.some((s) => entry.name === s || entry.name.startsWith(s))) continue;
    const src = path.join(srcDir, entry.name);
    const dest = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      await copyDir(src, dest, { skip });
    } else if (entry.isSymbolicLink()) {
      const target = await fs.readlink(src);
      await fs.symlink(target, dest);
    } else {
      await fs.copyFile(src, dest);
    }
  }
}

export async function copyFile(src, dest) {
  await ensureDir(path.dirname(dest));
  await fs.copyFile(src, dest);
}

export async function listPluginDirs(pluginsRoot) {
  const entries = await fs.readdir(pluginsRoot, { withFileTypes: true });
  return entries
    .filter((e) => e.isDirectory() && !e.name.startsWith('.') && !e.name.startsWith('_'))
    .map((e) => path.join(pluginsRoot, e.name))
    .sort();
}

/**
 * Format a JS value as YAML for prepending into a generated markdown file.
 * Uses block style for arrays and double-quoted scalars where needed.
 */
export function dumpYamlFrontmatter(obj, { quoteStrings = 'double' } = {}) {
  const opts = {
    lineWidth: -1,
    noRefs: true,
    quotingType: quoteStrings === 'single' ? "'" : '"',
    forceQuotes: false,
  };
  return `---\n${yaml.dump(obj, opts)}---\n`;
}

/**
 * Strip a leading YAML frontmatter block from a markdown body.
 * Returns the body without the frontmatter.
 */
export function stripFrontmatter(text) {
  if (!text.startsWith('---\n') && !text.startsWith('---\r\n')) return text;
  const end = text.indexOf('\n---', 4);
  if (end < 0) return text;
  let cut = end + 4;
  if (text[cut] === '\r') cut++;
  if (text[cut] === '\n') cut++;
  return text.slice(cut);
}

/**
 * Pretty-print a JSON value preserving the schemastore ordering convention.
 */
export function stableStringify(obj) {
  return JSON.stringify(obj, null, 2) + '\n';
}
