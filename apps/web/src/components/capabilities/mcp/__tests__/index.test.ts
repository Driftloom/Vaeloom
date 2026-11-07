/**
 * The barrel is the module's whole public surface. `McpConfigModal` was deleted
 * for being unreachable; its only remaining reference was an `export *` line
 * here, which is exactly how a deleted component would leak back in while still
 * "not being used" anywhere. Pin the barrel so that cannot happen silently.
 */
import * as mcpBarrel from '..';

describe('mcp barrel exports', () => {
  it('does not re-export the deleted McpConfigModal', () => {
    expect(mcpBarrel).not.toHaveProperty('McpConfigModal');
  });

  it('still re-exports the live component surface', () => {
    for (const required of [
      'McpServerCard',
      'McpTemplateGallery',
      'McpToolInspectPanel',
      'McpManifestTab',
      'McpActivityLog',
      'useMcpServers',
    ]) {
      expect(mcpBarrel).toHaveProperty(required);
    }
  });
});
