import { describe, it, expect, beforeAll } from 'vitest';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');

let validatePlugin;
let validateMarketplace;

beforeAll(async () => {
  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);
  validatePlugin = ajv.compile(
    JSON.parse(
      await readFile(path.join(REPO_ROOT, 'tools/schemas/plugin.schema.json'), 'utf8'),
    ),
  );
  validateMarketplace = ajv.compile(
    JSON.parse(
      await readFile(path.join(REPO_ROOT, 'tools/schemas/marketplace.schema.json'), 'utf8'),
    ),
  );
});

// Helper: produce a minimal valid plugin manifest so individual tests can
// tweak one field at a time.
function basePlugin(overrides = {}) {
  return {
    name: 'sample',
    version: '1.0.0',
    description: 'A test plugin.',
    ...overrides,
  };
}

describe('plugin.schema.json — required fields', () => {
  it('accepts a minimal valid manifest', () => {
    expect(validatePlugin(basePlugin())).toBe(true);
  });

  it('requires name', () => {
    const p = basePlugin();
    delete p.name;
    expect(validatePlugin(p)).toBe(false);
    expect(JSON.stringify(validatePlugin.errors)).toMatch(/name/);
  });

  it('requires version', () => {
    const p = basePlugin();
    delete p.version;
    expect(validatePlugin(p)).toBe(false);
    expect(JSON.stringify(validatePlugin.errors)).toMatch(/version/);
  });

  it('requires description', () => {
    const p = basePlugin();
    delete p.description;
    expect(validatePlugin(p)).toBe(false);
    expect(JSON.stringify(validatePlugin.errors)).toMatch(/description/);
  });

  it('rejects non-semver versions', () => {
    expect(validatePlugin(basePlugin({ version: '1.0' }))).toBe(false);
    expect(validatePlugin(basePlugin({ version: '1.0.0' }))).toBe(true);
    expect(validatePlugin(basePlugin({ version: '1.0.0-beta.1' }))).toBe(true);
  });

  it('rejects unknown root keys', () => {
    expect(validatePlugin(basePlugin({ totallyMadeUp: 'x' }))).toBe(false);
  });
});

describe('plugin.schema.json — mcpServers polymorphism', () => {
  it('accepts a relative path string', () => {
    expect(validatePlugin(basePlugin({ mcpServers: './.mcp.json' }))).toBe(true);
  });

  it('rejects a non-./ path string', () => {
    expect(validatePlugin(basePlugin({ mcpServers: 'mcp.json' }))).toBe(false);
  });

  it('accepts an inline mcpServers object', () => {
    expect(
      validatePlugin(
        basePlugin({ mcpServers: { mcpServers: { foo: { command: 'echo' } } } }),
      ),
    ).toBe(true);
  });
});

describe('plugin.schema.json — hooks polymorphism', () => {
  it('accepts a path string', () => {
    expect(validatePlugin(basePlugin({ hooks: './hooks/hooks.json' }))).toBe(true);
  });

  it('accepts {path, targets}', () => {
    expect(
      validatePlugin(
        basePlugin({ hooks: { path: './hooks/hooks.json', targets: ['claude'] } }),
      ),
    ).toBe(true);
  });

  it('rejects an unknown target name', () => {
    expect(
      validatePlugin(
        basePlugin({ hooks: { path: './x', targets: ['banana'] } }),
      ),
    ).toBe(false);
  });

  it('accepts an inline hooks event map', () => {
    expect(
      validatePlugin(
        basePlugin({ hooks: { SessionStart: [{ hooks: [] }] } }),
      ),
    ).toBe(true);
  });
});

describe('plugin.schema.json — agents', () => {
  const baseAgent = {
    name: 'a',
    path: './agents/a.md',
    description: 'd',
  };

  it('accepts a minimal agent', () => {
    expect(validatePlugin(basePlugin({ agents: [baseAgent] }))).toBe(true);
  });

  it('rejects agent paths that do not start with ./', () => {
    expect(
      validatePlugin(basePlugin({ agents: [{ ...baseAgent, path: 'agents/a.md' }] })),
    ).toBe(false);
  });

  it('rejects glob patterns in claude.tools (Claude has no glob support)', () => {
    expect(
      validatePlugin(
        basePlugin({
          agents: [{ ...baseAgent, claude: { tools: ['server/*'] } }],
        }),
      ),
    ).toBe(false);
  });

  it('accepts glob patterns in copilot.tools', () => {
    expect(
      validatePlugin(
        basePlugin({
          agents: [{ ...baseAgent, copilot: { tools: ['server/*'] } }],
        }),
      ),
    ).toBe(true);
  });

  it('allows unknown fields inside per-target blocks (forward compat)', () => {
    expect(
      validatePlugin(
        basePlugin({
          agents: [
            {
              ...baseAgent,
              claude: { someFutureField: 'works' },
              copilot: { handoffs: { a: 'b' } },
              opencode: { newKnob: 42 },
            },
          ],
        }),
      ),
    ).toBe(true);
  });

  it('still type-checks known per-target fields', () => {
    expect(
      validatePlugin(
        basePlugin({
          agents: [{ ...baseAgent, claude: { effort: 'planetary' } }],
        }),
      ),
    ).toBe(false);
  });
});

describe('plugin.schema.json — skills', () => {
  const baseSkill = {
    name: 's',
    path: './skills/s',
    description: 'longer than ten characters please',
  };

  it('accepts a minimal skill', () => {
    expect(validatePlugin(basePlugin({ skills: [baseSkill] }))).toBe(true);
  });

  it('rejects descriptions shorter than 10 chars', () => {
    expect(
      validatePlugin(basePlugin({ skills: [{ ...baseSkill, description: 'short' }] })),
    ).toBe(false);
  });
});

describe('marketplace.schema.json', () => {
  it('accepts a minimal valid marketplace', () => {
    expect(
      validateMarketplace({
        name: 'm',
        version: '1.0.0',
        owner: { name: 'Owner' },
      }),
    ).toBe(true);
  });

  it('requires version', () => {
    expect(
      validateMarketplace({ name: 'm', owner: { name: 'Owner' } }),
    ).toBe(false);
  });

  it('requires owner', () => {
    expect(validateMarketplace({ name: 'm', version: '1.0.0' })).toBe(false);
  });
});
