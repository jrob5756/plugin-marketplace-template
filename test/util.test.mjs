import { describe, it, expect } from 'vitest';
import {
  assertNoFrontmatter,
  detectFrontmatter,
  normalizeHooks,
  normalizeMcpServers,
  orderKeys,
  pruneUndefined,
  safeResolve,
  stripFrontmatter,
} from '../tools/util.mjs';

describe('safeResolve', () => {
  const root = '/tmp/plugin';

  it('resolves a simple relative path inside the root', () => {
    expect(safeResolve(root, './agents/foo.md')).toBe('/tmp/plugin/agents/foo.md');
  });

  it('resolves the root itself', () => {
    expect(safeResolve(root, '.')).toBe('/tmp/plugin');
  });

  it('rejects parent-directory traversal', () => {
    expect(() => safeResolve(root, './../escape.md')).toThrow(/escapes plugin root/);
  });

  it('rejects deeply-traversing relative paths', () => {
    expect(() => safeResolve(root, './a/b/../../../escape.md')).toThrow(/escapes plugin root/);
  });

  it('rejects absolute paths outside the root', () => {
    expect(() => safeResolve(root, '/etc/passwd')).toThrow(/escapes plugin root/);
  });

  it('refuses paths that look like the root prefix but escape', () => {
    expect(() => safeResolve('/tmp/plug', '/tmp/plugin-other/file')).toThrow(
      /escapes plugin root/,
    );
  });
});

describe('detectFrontmatter / assertNoFrontmatter', () => {
  it('returns null on plain markdown', () => {
    expect(detectFrontmatter('plain body\nwith content')).toBeNull();
  });

  it('detects unix-newline frontmatter', () => {
    const body = '---\nname: x\ndescription: y\n---\nbody';
    expect(detectFrontmatter(body)).toContain('name: x');
  });

  it('detects CRLF-newline frontmatter', () => {
    const body = '---\r\nname: x\r\n---\r\nbody';
    expect(detectFrontmatter(body)).not.toBeNull();
  });

  it('passes plain bodies through assertNoFrontmatter', () => {
    expect(() => assertNoFrontmatter('x.md', 'no frontmatter')).not.toThrow();
  });

  it('throws on bodies that start with frontmatter', () => {
    expect(() =>
      assertNoFrontmatter('agents/foo.md', '---\nname: foo\n---\nbody'),
    ).toThrow(/agents\/foo\.md/);
  });

  it('error message points authors at plugin.yaml', () => {
    expect(() => assertNoFrontmatter('x.md', '---\nx: 1\n---\n')).toThrow(/plugin\.yaml/);
  });
});

describe('stripFrontmatter (deprecated but still exported)', () => {
  it('strips a leading YAML block', () => {
    expect(stripFrontmatter('---\nname: x\n---\nbody\n')).toBe('body\n');
  });

  it('passes plain bodies through', () => {
    expect(stripFrontmatter('plain body')).toBe('plain body');
  });
});

describe('normalizeHooks', () => {
  it('returns null for undefined', () => {
    expect(normalizeHooks(undefined)).toBeNull();
    expect(normalizeHooks(null)).toBeNull();
  });

  it('wraps a string path', () => {
    expect(normalizeHooks('./hooks.json')).toEqual({ path: './hooks.json' });
  });

  it('preserves {path, targets} as-is', () => {
    expect(normalizeHooks({ path: './x', targets: ['claude'] })).toEqual({
      path: './x',
      targets: ['claude'],
    });
  });

  it('treats other objects as inline event maps', () => {
    const inline = { SessionStart: [{ hooks: [] }] };
    expect(normalizeHooks(inline)).toEqual({ inline });
  });
});

describe('normalizeMcpServers', () => {
  it('returns null when not declared', () => {
    expect(normalizeMcpServers(undefined)).toBeNull();
  });

  it('wraps a string path', () => {
    expect(normalizeMcpServers('./.mcp.json')).toEqual({ path: './.mcp.json' });
  });

  it('treats objects as inline', () => {
    const inline = { mcpServers: { x: { command: 'foo' } } };
    expect(normalizeMcpServers(inline)).toEqual({ inline });
  });
});

describe('pruneUndefined', () => {
  it('drops undefined values', () => {
    expect(pruneUndefined({ a: 1, b: undefined, c: 'x' })).toEqual({ a: 1, c: 'x' });
  });

  it('drops empty arrays and empty objects', () => {
    expect(pruneUndefined({ a: [], b: {}, c: 'keep' })).toEqual({ c: 'keep' });
  });

  it('preserves null and false', () => {
    expect(pruneUndefined({ a: null, b: false, c: 0 })).toEqual({ a: null, b: false, c: 0 });
  });

  it('preserves non-empty arrays and nested objects', () => {
    expect(pruneUndefined({ a: [1], b: { k: 1 } })).toEqual({ a: [1], b: { k: 1 } });
  });
});

describe('orderKeys', () => {
  it('places ordered keys first, preserving the requested order', () => {
    expect(Object.keys(orderKeys({ c: 3, a: 1, b: 2 }, ['a', 'b', 'c']))).toEqual([
      'a',
      'b',
      'c',
    ]);
  });

  it('appends unknown keys after ordered keys in insertion order', () => {
    expect(Object.keys(orderKeys({ z: 1, a: 2, m: 3 }, ['a']))).toEqual(['a', 'z', 'm']);
  });

  it('omits ordered keys that are not present', () => {
    expect(Object.keys(orderKeys({ a: 1 }, ['a', 'missing', 'also-missing']))).toEqual(['a']);
  });
});
