/**
 * T15 icon idiom, per-file contract
 * (plan 2026-10-18-capabilities-workbench-rework, Test row).
 *
 * One `it` per touched production file. Every `it` reads the RENDERED OUTPUT
 * (not the source text) and asserts two properties:
 *
 * 1. Every `<svg>` in the output came from a ui-kit icon component. The ui-kit
 *    icon factory stamps `xmlns` through its defaultProps; the hand-rolled
 *    inline svgs carry no xmlns attribute. So "no inline svg remains" is
 *    observable as "no svg element lacks an xmlns attribute". A vacuous pass
 *    is prevented by also requiring at least one svg in each mount.
 * 2. No emoji glyph (✓ ✗ ⚡ 🔒 band) survives in any text node.
 *
 * SkillMarkdownViewer additionally pins the shared `.markdown-body` theme:
 * its output root must carry `markdown-body`, and no hand-rolled h2 utility
 * leftovers (`text-2xs` / `tracking-wider` / `uppercase`) may ride inline.
 */

import React from 'react';
import { render } from '@testing-library/react';
import { McpServerCard } from '../mcp/McpServerCard';
import { SkillTelemetryCard } from '../skills/SkillTelemetryCard';
import { CustomProtocolsTab } from '../connectors/CustomProtocolsTab';
import { SkillIntegrationBar } from '../skills/SkillIntegrationBar';
import { SkillMarkdownViewer } from '../skills/SkillMarkdownViewer';
import type { ConnectorItem } from '@/lib/api-client';
import type { SkillRow } from '../skills/SkillCard';
import type { CapabilityItem } from '@/lib/capabilities-data';

jest.mock('react-markdown', () => ({
  __esModule: true,
  default: function MockReactMarkdown(props: {
    components: Record<
      string,
      (componentProps: { children?: React.ReactNode; className?: string }) => React.ReactNode
    >;
  }) {
    return (
      <div data-testid="icon-idiom-harness">
        {props.components.h2 ? (
          props.components.h2({ children: 'Getting Started' })
        ) : (
          <h2>Getting Started</h2>
        )}
        {props.components.code({ className: 'language-bash', children: 'abcdefghij one\n' })}
      </div>
    );
  },
}));

jest.mock('remark-gfm', () => () => {});

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), prefetch: jest.fn() }),
}));

const EMOJI = /[\u2600-\u27BF]|[\u{1F000}-\u{1FFFF}]|\uFE0F/u;

/** svgs whose signature betrays a hand-rolled inline source (no xmlns stamp). */
const iconSignatureLeaks = (container: HTMLElement) =>
  Array.from(container.querySelectorAll('svg')).filter((svg) => !svg.getAttribute('xmlns'));
const expectOnlyUiKitIcons = (container: HTMLElement) => {
  expect(container.querySelectorAll('svg')).not.toHaveLength(0);
  expect(iconSignatureLeaks(container)).toEqual([]);
};

const connectorServer = (): ConnectorItem => ({
  id: 'conn-idiom-1',
  workspaceId: 'ws-1',
  name: 'Idiom Probe Server',
  type: 'mcp',
  status: 'active',
  config: { transport: 'stdio', command: 'python' },
  configVersion: 1,
  createdAt: '2026-10-01T00:00:00Z',
  updatedAt: '2026-10-01T00:00:00Z',
  lastSyncedAt: '2026-10-01T00:00:00Z',
});

const pipelineItem = (name: string): CapabilityItem => ({
  id: 'item-idiom-1',
  name,
  category: 'skills',
  description: 'Fixture skill for the icon idiom contract.',
  status: 'active',
  enabled: true,
  version: '1.0.0',
  author: 'Vaeloom Core Team',
  source: 'built-in',
  runtime: 'python',
  tags: ['career'],
  triggers: ['review resume'],
  markdownDoc: `# ${name}`,
  requiredScope: 'workspace.read',
  trustClass: 'core_trusted',
  autonomy: 'supervised',
  usageCount: 3,
  lastUsedAt: '2026-10-01T00:00:00Z',
  createdAt: '2026-09-01T00:00:00Z',
  updatedAt: '2026-10-01T00:00:00Z',
});

const skillRow = (name: string): SkillRow => ({
  key: `key-${name}`,
  item: pipelineItem(name),
  installed: true,
  bundled: true,
  slug: name,
  serverBacked: true,
});

describe('IconIdiom (T15)', () => {
  it('McpServerCard: every icon is a ui-kit icon; no inline svg, no emoji', () => {
    const server = connectorServer();
    // Both pause states mount in this one `it`: the active row holds
    // PauseIcon + TrashIcon, the paused row holds PlayIcon + TrashIcon.
    const active = render(
      <McpServerCard
        server={server}
        onSelect={() => undefined}
        onTogglePause={() => Promise.resolve()}
      />,
    );
    const paused = render(
      <McpServerCard
        server={{ ...server, status: 'paused' }}
        onSelect={() => undefined}
        onTogglePause={() => Promise.resolve()}
      />,
    );

    expectOnlyUiKitIcons(active.container);
    expectOnlyUiKitIcons(paused.container);
    expect(
      `${active.container.textContent ?? ''}${paused.container.textContent ?? ''}`,
    ).not.toMatch(EMOJI);
  });

  it('SkillTelemetryCard: every icon is a ui-kit icon; no inline svg, no emoji', () => {
    const { container } = render(
      <SkillTelemetryCard
        row={skillRow('ats-audit')}
        onOpenPlayground={() => undefined}
        onCopyDoc={() => undefined}
      />,
    );

    // Both quick actions render in the default state: download + copy.
    expectOnlyUiKitIcons(container);
    expect(container.textContent ?? '').not.toMatch(EMOJI);
  });

  it('CustomProtocolsTab: every icon is a ui-kit icon; no inline svg, no emoji', () => {
    const noop = () => undefined;
    const { container } = render(
      <CustomProtocolsTab
        customConnectors={[connectorServer()]}
        builtinServers={[]}
        builtinError={null}
        dynamicError={null}
        busyAction={null}
        healthLoading={false}
        onRetryLoad={noop}
        onOpenAddCustom={noop}
        onConfigureBuiltin={noop}
        onTestConnection={noop}
        onOpenHealthModal={noop}
        onInspectTools={noop}
        onPendingDisconnect={noop}
      />,
    );

    // The probe row mounts the trash control and the add affordance.
    expectOnlyUiKitIcons(container);
    expect(container.textContent ?? '').not.toMatch(EMOJI);
  });

  it('SkillIntegrationBar: every icon is a ui-kit icon; no inline svg, no emoji', () => {
    // The scope string arms every icon surface in this file: the mapped
    // specialist badge (CpuIcon), the launch action (MessageIcon), the memory
    // link (BrainIcon) and the documents link (FileTextIcon).
    const row = skillRow('ats-audit');
    row.item.requiredScope = 'memory.read, system.document.compile';
    const { container } = render(<SkillIntegrationBar row={row} workspaceId="ws-1" />);

    expectOnlyUiKitIcons(container);
    expect(container.textContent ?? '').not.toMatch(EMOJI);
  });

  it('SkillMarkdownViewer: root adopts markdown-body; no h2 utility leftovers; no emoji', () => {
    const { container } = render(<SkillMarkdownViewer content={'# Docs'} />);

    const root = container.firstElementChild;
    expect(root).not.toBeNull();
    expect(root?.className).toContain('markdown-body');

    // The h2 override was retired with the T6 pin; leftover hand-rolled
    // utilities must not ride inline on any h2 the output carries.
    const h2s = Array.from(container.querySelectorAll('h2'));
    expect(h2s.length).toBeGreaterThan(0);
    expect(h2s.filter((h) => /text-2xs|tracking-wider|uppercase/.test(h.className ?? ''))).toEqual(
      [],
    );

    // The viewer surfaces no icons itself (text-only copy affordance), so the
    // >= 1-svg vacuous-pass guard does not apply; the leak-check alone still
    // pins that every svg it might ever render carries the ui-kit stamp.
    expect(iconSignatureLeaks(container)).toEqual([]);
    expect(container.textContent ?? '').not.toMatch(EMOJI);
  });
});
