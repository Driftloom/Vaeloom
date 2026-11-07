import React from 'react';
import { render } from '@testing-library/react';

import { SkillTelemetryCard } from '../skills/SkillTelemetryCard';
import type { SkillRow } from '../skills/SkillCard';

/**
 * Task 14 dot census site 4 (`SkillTelemetryCard.tsx`). The "Test Playground"
 * button carried a raw `w-1.5 h-1.5 rounded-pill bg-success animate-pulse`
 * chip. The card is purely presentational (type-only imports), so it mounts
 * without any preview-workbench state — chosen over skipping the dedicated
 * spec because the import graph stays clean.
 *
 * The pulse assertion pins the D1 conversion idiom: the CSS `animate-pulse`
 * glow becomes StatusDot's `animate-ping` overlay (visual approximation,
 * disclosed in the task report).
 */

/** StatusDot dot node only: the prefix excludes raw pill spans. */
const dotNode = (color: string) =>
  `[class^="relative inline-flex rounded-full"][class*="${color}"]`;

const row: SkillRow = {
  key: 'skills-resume-doctor',
  item: {
    id: 'item-resume-doctor',
    name: 'resume doctor',
    category: 'skills',
    tags: [],
    description: 'Checks resumes for compliance.',
    enabled: true,
    source: 'built-in',
    usageCount: 3,
    lastUsedAt: '2026-10-01T00:00:00Z',
    markdownDoc: '',
    trustClass: 'core_trusted',
    triggers: ['resume'],
  },
  installed: true,
  bundled: false,
  slug: null,
  serverBacked: false,
};

describe('SkillTelemetryCard status dot', () => {
  it('renders the playground dot as a pulsing StatusDot (bg-success + ping overlay)', () => {
    const { container } = render(
      <SkillTelemetryCard row={row} onOpenPlayground={jest.fn()} onCopyDoc={jest.fn()} />,
    );
    expect(container.querySelector(dotNode('bg-success'))).toBeTruthy();
    expect(container.querySelector('[class*="animate-ping"]')).toBeTruthy();
  });
});
