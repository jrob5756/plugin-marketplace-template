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
 * Detect a leading YAML frontmatter block in a markdown body. Returns the
 * raw frontmatter (between the `---` markers) if present, otherwise null.
 *
 * The build never strips frontmatter silently — agents/skills bodies must be
 * frontmatter-free in source. Callers use this to throw a helpful error.
 */
export function detectFrontmatter(text) {
  if (!text.startsWith('---\n') && !text.startsWith('---\r\n')) return null;
  const end = text.indexOf('\n---', 4);
  if (end < 0) return null;
  return text.slice(4, end);
}

/**
 * Assert that a file body has no leading YAML frontmatter. If it does, throw
 * a clear error pointing the author at the schema. Per-target frontmatter is
 * generated from plugin.yaml — duplicating it in source would split the
 * source of truth.
 */
export function assertNoFrontmatter(filePath, body) {
  if (detectFrontmatter(body) !== null) {
    throw new Error(
      `${filePath}: leading YAML frontmatter detected. Source agent/skill ` +
        `bodies must be frontmatter-free — declare metadata in plugin.yaml ` +
        `instead. Per-target frontmatter is generated at build time.`,
    );
  }
}

/**
 * Resolve `relativePath` against `baseDir` and refuse to leave the base
 * directory. Returns the absolute resolved path on success; throws on
 * traversal. Use for every source path read by the build.
 */
export function safeResolve(baseDir, relativePath) {
  const resolved = path.resolve(baseDir, relativePath);
  const baseAbs = path.resolve(baseDir);
  if (resolved !== baseAbs && !resolved.startsWith(baseAbs + path.sep)) {
    throw new Error(
      `path escapes plugin root: '${relativePath}' resolves to '${resolved}', ` +
        `outside of '${baseAbs}'. Use only paths within the plugin directory.`,
    );
  }
  return resolved;
}

/**
 * Normalize the polymorphic `hooks:` field in plugin.yaml into a single shape:
 *   { path?: string, inline?: object, targets?: string[] }
 * Accepts: undefined, a string path, an inline hooks object, or
 * `{ path: ..., targets: [...] }`. Returns null if no hooks are declared.
 */
export function normalizeHooks(hooks) {
  if (hooks === undefined || hooks === null) return null;
  if (typeof hooks === 'string') return { path: hooks };
  if (typeof hooks === 'object') {
    // Disambiguate {path,targets} from an inline hooks event map by checking
    // for the `path` key.
    if (typeof hooks.path === 'string') {
      return { path: hooks.path, targets: hooks.targets };
    }
    return { inline: hooks };
  }
  throw new Error(`invalid hooks value: ${JSON.stringify(hooks)}`);
}

/**
 * Normalize the polymorphic `mcpServers:` field in plugin.yaml. Returns one
 * of { path: string } or { inline: object }, or null when not declared.
 */
export function normalizeMcpServers(mcp) {
  if (mcp === undefined || mcp === null) return null;
  if (typeof mcp === 'string') return { path: mcp };
  if (typeof mcp === 'object') return { inline: mcp };
  throw new Error(`invalid mcpServers value: ${JSON.stringify(mcp)}`);
}

/**
 * @deprecated retained for backward compatibility — use assertNoFrontmatter.
 * Strip a leading YAML frontmatter block from a markdown body. Returns the
 * body without the frontmatter.
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

/**
 * Drop `undefined`, empty arrays, and empty objects from a shallow object.
 * Used by all transpilers when assembling manifest / frontmatter objects to
 * avoid emitting `key: null`, `key: []`, `key: {}` artifacts.
 */
export function pruneUndefined(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) continue;
    if (Array.isArray(v) && v.length === 0) continue;
    if (
      typeof v === 'object' &&
      v !== null &&
      !Array.isArray(v) &&
      Object.keys(v).length === 0
    ) {
      continue;
    }
    out[k] = v;
  }
  return out;
}

/**
 * Return a new object with keys ordered first by `order` (if present), then
 * by insertion order of remaining keys. Used to keep manifest field order
 * stable across builds.
 */
export function orderKeys(obj, order) {
  const out = {};
  for (const key of order) {
    if (obj[key] !== undefined) out[key] = obj[key];
  }
  for (const key of Object.keys(obj)) {
    if (out[key] === undefined) out[key] = obj[key];
  }
  return out;
}
