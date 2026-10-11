import { SHELL_METACHARACTERS, parseCommandLineArgs } from '../connectors/types';

/**
 * The argv guard guards subprocess construction, so it gets direct tests.
 *
 * `SHELL_METACHARACTERS` used to be a second, weaker definition
 * (`/[;&|`$><\n\r]/`) living beside `MCP_SHELL_METACHARS` in
 * `AddCapabilityModal`. The connector-create path -- the one that actually
 * spawns an MCP stdio subprocess -- used the weaker copy, so `^`, `%` and `!`
 * reached the child process unchallenged while the modal rejected them.
 */
describe('SHELL_METACHARACTERS', () => {
  const rejected = [';', '&', '|', '`', '$', '>', '<', '\r', '\n', '^', '%', '!'];

  it.each(rejected)('rejects %j', (char) => {
    expect(SHELL_METACHARACTERS.test(`safe${char}payload`)).toBe(true);
  });

  it.each(['node', 'npx', '-y', '@modelcontextprotocol/server-filesystem', '/tmp/vault'])(
    'allows the ordinary argv entry %j',
    (arg) => {
      expect(SHELL_METACHARACTERS.test(arg)).toBe(false);
    },
  );

  it('is the single definition used by both the connector and the MCP modal path', async () => {
    // The modal imports the exported constant rather than re-declaring a
    // regex. A divergent copy here would let the two paths disagree again.
    const source = await import('node:fs/promises').then((fs) =>
      fs.readFile(require.resolve('../AddCapabilityModal'), 'utf8'),
    );
    expect(source).toContain('SHELL_METACHARACTERS');
    // No inline character class remains for the modal to own.
    expect(source).not.toMatch(/const\s+MCP_SHELL_METACHARS\s*=\s*\//);
  });
});

describe('parseCommandLineArgs', () => {
  it('splits a quoted command line into argv', () => {
    const result = parseCommandLineArgs('npx -y @modelcontextprotocol/server-filesystem /tmp');
    expect(result).toEqual({
      ok: true,
      argv: ['npx', '-y', '@modelcontextprotocol/server-filesystem', '/tmp'],
    });
  });

  it('preserves a double-quoted argument containing spaces', () => {
    const result = parseCommandLineArgs('node "C:/Program Files/server/index.js"');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.argv).toEqual(['node', 'C:/Program Files/server/index.js']);
    }
  });

  it('refuses an argument that tries to chain a command', () => {
    const result = parseCommandLineArgs('node server.js; rm -rf /');
    expect(result.ok).toBe(false);
  });

  it('refuses command substitution', () => {
    const result = parseCommandLineArgs('node $(whoami).js');
    expect(result.ok).toBe(false);
  });

  it('refuses backtick substitution', () => {
    const result = parseCommandLineArgs('node `whoami`.js');
    expect(result.ok).toBe(false);
  });

  it('refuses an argument that only the stricter definition rejects', () => {
    // These three are the characters the connector path used to let through.
    expect(parseCommandLineArgs('node server^cmd.js').ok).toBe(false);
    expect(parseCommandLineArgs('node 100%done.js').ok).toBe(false);
    expect(parseCommandLineArgs('node bang!file.js').ok).toBe(false);
  });

  it('treats an empty command line as an empty argv, not an error', () => {
    expect(parseCommandLineArgs('   ')).toEqual({ ok: true, argv: [] });
  });
});
