import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import { AgentAutonomySelector } from '../AgentAutonomySelector';
import { AUTONOMY_OPTIONS, type AutonomyMode } from '../types';

/**
 * These buttons have always carried role="radio". They had no radiogroup owner,
 * every option was its own tab stop, and Tooltip put a div between the group
 * and each radio. The assertions below are the contract the ARIA radio pattern
 * actually requires.
 *
 * Expectations are derived from AUTONOMY_OPTIONS rather than hard-coded. The
 * first draft assumed an order of [suggest, autonomous, approval_required] and
 * the real array is [suggest, approval_required, autonomous], so half the
 * assertions failed for reasons that had nothing to do with the component.
 */

const FIRST = AUTONOMY_OPTIONS[0];
const SECOND = AUTONOMY_OPTIONS[1];
const THIRD = AUTONOMY_OPTIONS[2];

function renderSelector(mode: AutonomyMode = FIRST.value) {
  const onChange = jest.fn();
  const view = render(<AgentAutonomySelector autonomyMode={mode} onAutonomyChange={onChange} />);
  const radios = () => screen.getAllByRole('radio') as HTMLButtonElement[];
  return { onChange, radios, group: () => screen.getByRole('radiogroup'), unmount: view.unmount };
}

describe('AgentAutonomySelector radiogroup', () => {
  it('exposes a radiogroup that owns the radios', () => {
    renderSelector();
    expect(screen.getByRole('radiogroup', { name: 'Agent autonomy' })).toBeTruthy();
  });

  it('marks exactly one radio as checked', () => {
    const { radios } = renderSelector(SECOND.value);
    const checked = radios().filter((r) => r.getAttribute('aria-checked') === 'true');
    expect(checked).toHaveLength(1);
    expect(checked[0]?.textContent).toBe(SECOND.label);
  });

  it('is a single tab stop via roving tabindex', () => {
    const { radios } = renderSelector(FIRST.value);
    const tabbable = radios().filter((r) => r.getAttribute('tabindex') === '0');
    expect(tabbable).toHaveLength(1);
    expect(tabbable[0]?.textContent).toBe(FIRST.label);
  });

  it('moves selection and focus right on ArrowRight', () => {
    const { onChange, radios, group } = renderSelector(FIRST.value);
    fireEvent.keyDown(group(), { key: 'ArrowRight' });
    expect(onChange).toHaveBeenCalledWith(SECOND.value);
    expect(document.activeElement).toBe(radios()[1]);
  });

  it('wraps backwards from the first option', () => {
    const { onChange, radios, group } = renderSelector(FIRST.value);
    fireEvent.keyDown(group(), { key: 'ArrowLeft' });
    expect(onChange).toHaveBeenCalledWith(THIRD.value);
    expect(document.activeElement).toBe(radios()[2]);
  });

  it('wraps forwards from the last option', () => {
    const { onChange, radios, group } = renderSelector(THIRD.value);
    fireEvent.keyDown(group(), { key: 'ArrowRight' });
    expect(onChange).toHaveBeenCalledWith(FIRST.value);
    expect(document.activeElement).toBe(radios()[0]);
  });

  it('supports Home and End', () => {
    const { onChange, radios, group } = renderSelector(SECOND.value);
    fireEvent.keyDown(group(), { key: 'End' });
    expect(onChange).toHaveBeenLastCalledWith(THIRD.value);
    expect(document.activeElement).toBe(radios()[2]);
    fireEvent.keyDown(group(), { key: 'Home' });
    expect(onChange).toHaveBeenLastCalledWith(FIRST.value);
    expect(document.activeElement).toBe(radios()[0]);
  });

  it('describes each radio with its hint rather than a hover-only tooltip', () => {
    const { radios } = renderSelector();
    const describedBy = radios()[0]?.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    const hint = document.getElementById(describedBy as string);
    expect(hint?.textContent?.length).toBeGreaterThan(0);
  });

  it('keeps radios as direct children of the group', () => {
    const { radios, group } = renderSelector();
    const owner = group();
    for (const radio of radios()) {
      expect(radio.parentElement).toBe(owner);
    }
  });
});
