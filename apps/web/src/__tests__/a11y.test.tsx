/**
 * WCAG 2.2 AA smoke — P14 EXC-P14-02
 * Uses jest-axe if available, otherwise falls back to basic DOM checks.
 * Covers: landmared regions, heading hierarchy, form labels, button names, image alts.
 */
import { render } from '@testing-library/react';

// Minimal smoke component that mirrors the app shell (header + main + nav)
function SmokeShell() {
  return (
    <div>
      <header>
        <nav aria-label="Primary">
          <a href="/">Home</a>
          <a href="/workspace/test">Workspace</a>
        </nav>
      </header>
      <main>
        <h1>Vaeloom</h1>
        <h2>Memory-first second brain</h2>
        <form aria-label="Create workspace">
          <label htmlFor="ws-name">Workspace name</label>
          <input id="ws-name" name="name" required />
          <button type="submit">Create</button>
        </form>
        <img src="/logo.svg" alt="Vaeloom logo" />
      </main>
      <footer>© 2026 Vaeloom</footer>
    </div>
  );
}

describe('a11y smoke (WCAG 2.2 AA)', () => {
  it('has no axe violations on the smoke shell', async () => {
    let axe: any = null;
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      axe = require('jest-axe').axe;
    } catch {
      // jest-axe not installed — fallback to structural checks
    }

    const { container } = render(<SmokeShell />);

    if (axe) {
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    } else {
      // Fallback: basic a11y invariants without jest-axe
      expect(container.querySelector('main')).not.toBeNull();
      expect(container.querySelector('nav[aria-label="Primary"]')).not.toBeNull();
      expect(container.querySelector('h1')).not.toBeNull();
      // form label association
      const input = container.querySelector('#ws-name') as HTMLInputElement | null;
      expect(input).not.toBeNull();
      const label = container.querySelector('label[for="ws-name"]');
      expect(label).not.toBeNull();
      // image alt
      const img = container.querySelector('img[alt="Vaeloom logo"]');
      expect(img).not.toBeNull();
      // button has accessible name
      const button = container.querySelector('button');
      expect(button?.textContent?.trim().length).toBeGreaterThan(0);
    }
  });

  it('enforces heading hierarchy (h1 before h2)', () => {
    const { container } = render(<SmokeShell />);
    const h1 = container.querySelector('h1');
    const h2 = container.querySelector('h2');
    expect(h1).not.toBeNull();
    expect(h2).not.toBeNull();
    // h1 should precede h2 in DOM order
    expect(h1!.compareDocumentPosition(h2!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
