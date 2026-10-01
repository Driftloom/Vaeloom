import { readFileSync } from 'fs';
import { resolve } from 'path';

import { fireEvent, render, screen } from '@testing-library/react';

import { Switch } from '../forms/Switch';

// This package has no `@testing-library/jest-dom` dependency, so assertions are
// written against real DOM properties rather than the `toBeInTheDocument` family.

const REPO_ROOT = resolve(__dirname, '..', '..', '..', '..', '..');
const SWITCH_SOURCE = readFileSync(
  resolve(REPO_ROOT, 'packages', 'ui-kit', 'src', 'components', 'forms', 'Switch.tsx'),
  'utf8',
);
const GLOBALS_CSS = readFileSync(
  resolve(REPO_ROOT, 'apps', 'web', 'src', 'styles', 'globals.css'),
  'utf8',
);

const knobClassFor = (checked: boolean): string => {
  const { container, unmount } = render(
    <Switch checked={checked} onChange={jest.fn()} label="Dark mode" />,
  );
  const knob = container.querySelector('span[aria-hidden="true"]') as HTMLElement;
  const classes = knob.className.split(/\s+/);
  unmount();
  return classes.find((c) => c.startsWith('bg-')) as string;
};

describe('Switch knob fill is token-driven, not a raw literal', () => {
  it('contains no bg-white literal in the component source', () => {
    // The knob was hard-coded `bg-white`, which rendered an invisible control in
    // the light theme (1.16:1 against the --border-subtle track) and a 2.05:1
    // one in high-contrast.
    expect(SWITCH_SOURCE).not.toContain('bg-white');
  });

  it('uses --action-fg for the checked knob', () => {
    expect(knobClassFor(true)).toBe('bg-action-fg');
  });

  it('uses the --switch-knob custom property for the resting knob', () => {
    expect(knobClassFor(false)).toBe('bg-[rgb(var(--switch-knob))]');
  });

  it('declares --switch-knob in the dark, light and high-contrast theme blocks', () => {
    // Not just "declared somewhere" — all three, with the per-theme value. A
    // missing block would silently inherit another theme's knob and reintroduce
    // the low-contrast state this token exists to prevent.
    const blockFor = (start: string, end: string) =>
      GLOBALS_CSS.slice(GLOBALS_CSS.indexOf(start), GLOBALS_CSS.indexOf(end));
    const value = (block: string) =>
      (block.match(/--switch-knob:\s*([^;]+);/) as RegExpMatchArray)[1]?.trim();

    expect(value(blockFor(':root,\n.dark {', '.light {'))).toBe('255 255 255');
    expect(value(blockFor('.light {', '.high-contrast,'))).toBe('23 26 43');
    expect(value(blockFor('.high-contrast,', '@media (prefers-contrast: more)'))).toBe('0 0 0');
  });

  it('keeps the checked knob on --action-fg, which all three themes set to white', () => {
    // --action is the same indigo in every theme, so a white knob is the only
    // fill that clears 3:1 on it everywhere (6.29:1).
    const actionFg = [...GLOBALS_CSS.matchAll(/--action-fg:\s*([^;]+);/g)].map((m) => m[1]?.trim());
    expect(actionFg).toHaveLength(3);
    expect(new Set(actionFg)).toEqual(new Set(['255 255 255']));
  });
});

describe('Switch label does not double-fire onChange', () => {
  it('fires exactly once with the flipped value on a label click', () => {
    // The label carried BOTH htmlFor and onClick, so a label click invoked
    // onChange twice: once from the handler, once from the click htmlFor
    // forwards to the button. It looked like a no-op only because both calls
    // passed the same !checked value.
    const onChange = jest.fn();
    render(<Switch checked={false} onChange={onChange} label="Dark mode" />);

    fireEvent.click(screen.getByText('Dark mode'));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('fires exactly once with the flipped value on a direct button click', () => {
    const onChange = jest.fn();
    render(<Switch checked onChange={onChange} label="Dark mode" />);

    fireEvent.click(screen.getByRole('switch'));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it('fires exactly once per click when the label is clicked repeatedly', () => {
    const onChange = jest.fn();
    render(<Switch checked={false} onChange={onChange} label="Auto-apply" />);
    const label = screen.getByText('Auto-apply');

    fireEvent.click(label);
    fireEvent.click(label);

    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it('associates the label with the control so the name is exposed', () => {
    render(<Switch checked={false} onChange={jest.fn()} label="Auto-apply" />);
    const control = screen.getByRole('switch', { name: 'Auto-apply' });
    const label = screen.getByText('Auto-apply');
    expect(label.getAttribute('for')).toBe(control.getAttribute('id'));
  });
});

describe('Switch disabled state blocks both activation paths', () => {
  it('does not fire from a button click', () => {
    const onChange = jest.fn();
    render(<Switch checked={false} onChange={onChange} label="Dark mode" disabled />);

    const control = screen.getByRole('switch') as HTMLButtonElement;
    expect(control.disabled).toBe(true);
    fireEvent.click(control);

    expect(onChange).not.toHaveBeenCalled();
  });

  it('does not fire from a label click, so the two paths agree', () => {
    // The label used to gate on `disabled` in its own handler while the button
    // relied on the native attribute. Now the native attribute is the single
    // gate, and it is what suppresses the click htmlFor forwards — so neither
    // path can be re-enabled on its own.
    const onChange = jest.fn();
    render(<Switch checked={false} onChange={onChange} label="Dark mode" disabled />);

    fireEvent.click(screen.getByText('Dark mode'));

    expect(onChange).not.toHaveBeenCalled();
  });

  it('keeps the disabled affordance on the label', () => {
    render(<Switch checked={false} onChange={jest.fn()} label="Dark mode" disabled />);
    const classes = screen.getByText('Dark mode').className.split(/\s+/);
    expect(classes).toContain('cursor-not-allowed');
    expect(classes).toContain('opacity-50');
  });
});
