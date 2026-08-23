import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { gotoWorkspace, login } from './helpers';

const CORE_ROUTES: Array<[string, string]> = [
  ['dashboard', ''],
  ['/chat', '/chat'],
  ['/memory', '/memory'],
  ['/files', '/files'],
  ['/history', '/history'],
  ['/jobs', '/jobs'],
  ['/applications', '/applications'],
  ['/resume', '/resume'],
  ['/schedule', '/schedule'],
  ['/connectors', '/connectors'],
  ['/approvals', '/approvals'],
  ['/settings', '/settings'],
];

test.describe('a11y — real pages, both themes', () => {
  for (const theme of ['dark', 'light'] as const) {
    test(`axe: zero serious/critical across core routes (${theme})`, async ({ page }) => {
      test.setTimeout(240_000);
      const wsId = await login(page);
      await page.evaluate((t) => localStorage.setItem('theme', t), theme);
      for (const [, seg] of CORE_ROUTES) {
        await gotoWorkspace(page, wsId, seg);
        await page.waitForTimeout(1200);
        const results = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
          .analyze();
        const bad = results.violations.filter(
          (v) => v.impact === 'serious' || v.impact === 'critical',
        );
        expect(
          bad.map((v) => `${v.id}(${v.nodes.length})`),
          `serious/critical violations on ${seg} (${theme})`,
        ).toEqual([]);
      }
    });
  }
});

test.describe('responsive overflow', () => {
  for (const width of [320, 375, 414, 768, 1024, 1440]) {
    test(`no accidental horizontal overflow @${width}`, async ({ page }) => {
      const wsId = await login(page);
      await page.setViewportSize({ width, height: 850 });
      for (const [name, seg] of CORE_ROUTES) {
        await page.goto(`/workspace/${wsId}${seg}`, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(900);
        const overX = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        // Intentional scroll containers (kanban/calendar/tables) are inside
        // overflow-x-auto wrappers; the PAGE itself must not scroll sideways.
        expect(overX, `${name} overflows at ${width}px`).toBeLessThanOrEqual(2);
      }
    });
  }
});

test.describe('visual baselines', () => {
  const SHOTS: Array<[string, string]> = [
    ['login', '/login'],
    ['dashboard', ''],
    ['/chat', '/chat'],
    ['/files', '/files'],
    ['/memory', '/memory'],
    ['/resume', '/resume'],
    ['/schedule', '/schedule'],
    ['/approvals', '/approvals'],
    ['/settings', '/settings'],
  ];

  for (const theme of ['dark', 'light'] as const) {
    for (const vp of [375, 1440] as const) {
      for (const [name, seg] of SHOTS) {
        if (name !== 'login') continue; // public route captured without auth below
        test(`${name} ${theme} ${vp}`, async ({ page }) => {
          await page.setViewportSize({ width: vp, height: vp === 375 ? 812 : 900 });
          await page.goto('/login', { waitUntil: 'domcontentloaded' });
          await page.evaluate((t) => localStorage.setItem('theme', t), theme);
          await page.goto(seg || '/', { waitUntil: 'networkidle' });
          await page.waitForTimeout(600);
          await expect(page).toHaveScreenshot(`${name}-${theme}-${vp}.png`);
        });
      }
    }
  }

  for (const theme of ['dark', 'light'] as const) {
    for (const vp of [375, 1440] as const) {
      for (const [name, seg] of SHOTS) {
        if (name === 'login') continue;
        test(`${name.slice(1)} ${theme} ${vp}`, async ({ page }) => {
          const wsId = await login(page);
          await page.setViewportSize({ width: vp, height: vp === 375 ? 812 : 900 });
          await page.evaluate((t) => localStorage.setItem('theme', t), theme);
          await page.goto(`/workspace/${wsId}${seg}`, { waitUntil: 'domcontentloaded' });
          await page.waitForTimeout(1400);
          await expect(page).toHaveScreenshot(`${name.slice(1)}-${theme}-${vp}.png`);
        });
      }
    }
  }
});
