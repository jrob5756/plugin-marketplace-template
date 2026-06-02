import { describe, it, expect, vi } from 'vitest';
import { parseArgs } from '../tools/build.mjs';

// Fake `targets` registry so tests don't depend on which transpilers exist.
const FAKE_TARGETS = { claude: {}, copilot: {}, opencode: {}, codex: {} };

// Build a test harness that captures exit codes + log output without
// actually exiting or logging.
function harness() {
  const exited = [];
  const messages = { log: [], error: [] };
  return {
    exit: (code) => exited.push(code),
    log: {
      log: (...a) => messages.log.push(a.join(' ')),
      error: (...a) => messages.error.push(a.join(' ')),
    },
    exited,
    messages,
  };
}

describe('parseArgs', () => {
  it('returns defaults for no args', () => {
    const h = harness();
    const args = parseArgs([], { targets: FAKE_TARGETS, exit: h.exit, log: h.log });
    expect(args).toEqual({
      validateOnly: false,
      clean: false,
      plugin: null,
      target: null,
      allowWarnings: false,
    });
    expect(h.exited).toEqual([]);
  });

  it('parses --validate-only and --validate as the same flag', () => {
    const h = harness();
    expect(
      parseArgs(['--validate-only'], { targets: FAKE_TARGETS, exit: h.exit, log: h.log })
        .validateOnly,
    ).toBe(true);
    expect(
      parseArgs(['--validate'], { targets: FAKE_TARGETS, exit: h.exit, log: h.log })
        .validateOnly,
    ).toBe(true);
  });

  it('parses --clean', () => {
    const h = harness();
    expect(
      parseArgs(['--clean'], { targets: FAKE_TARGETS, exit: h.exit, log: h.log }).clean,
    ).toBe(true);
  });

  it('parses --allow-warnings', () => {
    const h = harness();
    expect(
      parseArgs(['--allow-warnings'], { targets: FAKE_TARGETS, exit: h.exit, log: h.log })
        .allowWarnings,
    ).toBe(true);
  });

  it('parses --plugin=name', () => {
    const h = harness();
    expect(
      parseArgs(['--plugin=foo-bar'], { targets: FAKE_TARGETS, exit: h.exit, log: h.log })
        .plugin,
    ).toBe('foo-bar');
  });

  it('parses --target=name when target is registered', () => {
    const h = harness();
    expect(
      parseArgs(['--target=claude'], { targets: FAKE_TARGETS, exit: h.exit, log: h.log })
        .target,
    ).toBe('claude');
    expect(h.exited).toEqual([]);
  });

  it('rejects unknown --target=name with exit code 1', () => {
    const h = harness();
    parseArgs(['--target=banana'], { targets: FAKE_TARGETS, exit: h.exit, log: h.log });
    expect(h.exited).toEqual([1]);
    expect(h.messages.error[0]).toMatch(/Unknown target: banana/);
  });

  it('rejects unknown args with exit code 1', () => {
    const h = harness();
    parseArgs(['--bogus'], { targets: FAKE_TARGETS, exit: h.exit, log: h.log });
    expect(h.exited).toEqual([1]);
    expect(h.messages.error[0]).toMatch(/Unknown argument: --bogus/);
  });

  it('handles --help and exits 0', () => {
    const h = harness();
    parseArgs(['--help'], { targets: FAKE_TARGETS, exit: h.exit, log: h.log });
    expect(h.exited).toEqual([0]);
    expect(h.messages.log[0]).toMatch(/Usage:/);
  });

  it('handles -h short form', () => {
    const h = harness();
    parseArgs(['-h'], { targets: FAKE_TARGETS, exit: h.exit, log: h.log });
    expect(h.exited).toEqual([0]);
  });

  it('combines flags', () => {
    const h = harness();
    const args = parseArgs(
      ['--clean', '--target=claude', '--plugin=web', '--allow-warnings'],
      { targets: FAKE_TARGETS, exit: h.exit, log: h.log },
    );
    expect(args).toEqual({
      validateOnly: false,
      clean: true,
      plugin: 'web',
      target: 'claude',
      allowWarnings: true,
    });
  });
});
