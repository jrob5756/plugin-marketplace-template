import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtemp, rm, readFile, readdir, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readYaml } from '../tools/util.mjs';
import * as claude from '../tools/transpilers/claude.mjs';
import * as codex from '../tools/transpilers/codex.mjs';
import * as copilot from '../tools/transpilers/copilot.mjs';
import * as opencode from '../tools/transpilers/opencode.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.join(__dirname, 'fixtures');
const TARGETS = { claude, codex, copilot, opencode };

let workDir;

beforeAll(async () => {
  workDir = await mkdtemp(path.join(tmpdir(), 'plugin-marketplace-test-'));
});

afterAll(async () => {
  if (workDir) await rm(workDir, { recursive: true, force: true });
});

/** Walk a directory recursively and return a sorted list of relative paths. */
async function listFiles(root, sub = '') {
  const dir = sub ? path.join(root, sub) : root;
  const entries = await readdir(dir, { withFileTypes: true });
  const out = [];
  for (const e of entries) {
    const rel = sub ? path.join(sub, e.name) : e.name;
    if (e.isDirectory()) {
      out.push(...(await listFiles(root, rel)));
    } else {
      out.push(rel);
    }
  }
  return out.sort();
}

/** Build a fixture for one target into a fresh tmp out-root. Returns the dist directory. */
async function buildFixture(fixtureName, targetName) {
  const pluginDir = path.join(FIXTURES, fixtureName);
  const plugin = await readYaml(path.join(pluginDir, 'plugin.yaml'));
  const outRoot = path.join(workDir, fixtureName + '-' + targetName);
  await TARGETS[targetName].transpile({ plugin, pluginDir, outRoot });
  return path.join(outRoot, targetName, plugin.name);
}

/** Concatenate every file in a built dist tree into a single deterministic string. */
async function distSnapshot(distDir) {
  const files = await listFiles(distDir);
  const chunks = [];
  for (const rel of files) {
    const abs = path.join(distDir, rel);
    const body = await readFile(abs, 'utf8');
    chunks.push('=== ' + rel + ' ===\n' + body);
  }
  return chunks.join('\n');
}

const fixtures = ['basic-agent', 'basic-skill', 'inline-mcp', 'hooks-targets'];

for (const fixture of fixtures) {
  describe(`transpile fixture: ${fixture}`, () => {
    for (const target of ['claude', 'codex', 'copilot', 'opencode']) {
      it(`${target} output matches snapshot`, async () => {
        const dist = await buildFixture(fixture, target);
        const snap = await distSnapshot(dist);
        await expect(snap).toMatchFileSnapshot(
          path.join(__dirname, '__snapshots__', `${fixture}-${target}.snap.md`),
        );
      });
    }
  });
}

describe('frontmatter is rejected, not silently stripped', () => {
  it('throws a clear error when an agent body has leading frontmatter', async () => {
    const pluginDir = await mkdtemp(path.join(tmpdir(), 'fm-test-'));
    try {
      const { writeFile, mkdir } = await import('node:fs/promises');
      await mkdir(path.join(pluginDir, 'agents'), { recursive: true });
      await writeFile(
        path.join(pluginDir, 'plugin.yaml'),
        'name: fm\nversion: 1.0.0\ndescription: test\nagents:\n  - { name: a, path: ./agents/a.md, description: d }\n',
      );
      await writeFile(
        path.join(pluginDir, 'agents/a.md'),
        '---\nname: a\n---\nbody\n',
      );
      const plugin = await readYaml(path.join(pluginDir, 'plugin.yaml'));
      const outRoot = path.join(workDir, 'fm-reject');
      await expect(
        claude.transpile({ plugin, pluginDir, outRoot }),
      ).rejects.toThrow(/frontmatter/);
    } finally {
      await rm(pluginDir, { recursive: true, force: true });
    }
  });
});

describe('hooks targets restriction', () => {
  it('omits hooks from opencode output when targets excludes opencode', async () => {
    const dist = await buildFixture('hooks-targets', 'opencode');
    const files = await listFiles(dist);
    // OpenCode never emits a hooks file (no format), so we verify the warning
    // path didn't trigger via the README content.
    const readme = await readFile(path.join(dist, 'README.md'), 'utf8');
    expect(readme).not.toMatch(/## Hooks/);
  });

  it('emits hooks in claude output when targets includes claude', async () => {
    const dist = await buildFixture('hooks-targets', 'claude');
    const files = await listFiles(dist);
    expect(files).toContain('hooks/hooks.json');
  });
});

describe('inline mcpServers', () => {
  it('claude emits .mcp.json from the inline declaration', async () => {
    const dist = await buildFixture('inline-mcp', 'claude');
    const mcp = JSON.parse(await readFile(path.join(dist, '.mcp.json'), 'utf8'));
    expect(mcp.mcpServers['echo-server'].command).toBe('echo');
  });

  it('opencode converts the inline declaration into a local-type server', async () => {
    const dist = await buildFixture('inline-mcp', 'opencode');
    const mcp = JSON.parse(await readFile(path.join(dist, 'opencode.mcp.json'), 'utf8'));
    expect(mcp.mcp['echo-server'].type).toBe('local');
    expect(mcp.mcp['echo-server'].command).toEqual(['echo', 'hello']);
  });
});
