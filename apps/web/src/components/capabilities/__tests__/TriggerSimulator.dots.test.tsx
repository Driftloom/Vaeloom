import React from 'react';
import { render } from '@testing-library/react';

import { TriggerSimulatorModal } from '../skills/TriggerSimulatorModal';
import type { SkillRow } from '../skills/SkillCard';

/**
 * Task 14 dot census sites 5 and 6 (`TriggerSimulatorModal.tsx`): the matched
 * skill rows carried raw `w-1.5 h-1.5 rounded-pill bg-success|bg-warning` chips.
 *
 * No external calls or stores are mounted: the modal is presentational around
 * `matchTriggerHits`, and its default simulated query
 * ("...my resume for ATS compliance...") matches both fixtures below without
 * any user interaction. The selector asserts StatusDot's signature prefix for
 * its dot node, which the raw pill spans never used, so each assertion is RED
 * against the pre-conversion markup.
 */

/** StatusDot dot node only: the prefix excludes badges and raw pill spans. */
const dotNode = (color: string) =>
  `[class^="relative inline-flex rounded-full"][class*="${color}"]`;

const skillRow = (
  key: string,
  name: string,
  opts: { enabled: boolean; triggers: string[] },
): SkillRow => ({
  key,
  item: {
    id: `item-${key}`,
    name,
    category: 'skills',
    tags: [],
    description: `${name} skill`,
    enabled: opts.enabled,
    source: 'built-in',
    usageCount: 0,
    lastUsedAt: null,
    markdownDoc: '',
    triggers: opts.triggers,
  },
  installed: true,
  bundled: false,
  slug: null,
  serverBacked: false,
});

function renderSimulator() {
  return render(
    <TriggerSimulatorModal
      isOpen
      onClose={jest.fn()}
      installedSkills={[
        skillRow('sim-active', 'resume auditor', { enabled: true, triggers: ['resume'] }),
        skillRow('sim-disabled', 'ats gate', { enabled: false, triggers: ['ats compliance'] }),
      ]}
    />,
  );
}

describe('TriggerSimulatorModal status dots', () => {
  it('marks matched active skills with a StatusDot (bg-success)', () => {
    renderSimulator();
    // Modal mounts via createPortal(document.body): the dots are not inside
    // render()'s container.
    expect(document.body.querySelector(dotNode('bg-success'))).toBeTruthy();
  });

  it('marks matched disabled skills with a StatusDot (bg-warning)', () => {
    renderSimulator();
    expect(document.body.querySelector(dotNode('bg-warning'))).toBeTruthy();
  });
});
