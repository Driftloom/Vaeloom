import { AxePuppeteer } from '@axe-core/puppeteer';

export interface AxeConfig {
  runOnly: {
    type: string;
    values: string[];
  };
  include: string[];
  exclude: string[];
  tags: string[];
  threshold: {
    critical: number;
    serious: number;
    moderate: number;
    minor: number;
  };
}

export const axeConfig: AxeConfig = {
  runOnly: {
    type: 'tag',
    values: [
      'wcag2a',
      'wcag2aa',
      'wcag22aa',
      'wcag21a',
      'wcag21aa',
    ],
  },
  include: ['#__next', 'main', '[role="main"]'],
  exclude: [
    '.ignore-a11y',
    '[aria-hidden="true"]',
    '.visually-hidden-test',
  ],
  tags: [
    'wcag2a',
    'wcag2aa',
    'wcag21a',
    'wcag21aa',
    'wcag22aa',
    'best-practice',
  ],
  threshold: {
    critical: 0,
    serious: 5,
    moderate: 10,
    minor: 20,
  },
};

export function getAxeOptions(pageName?: string) {
  return {
    runOnly: axeConfig.runOnly,
    exclude: axeConfig.exclude,
    resultTypes: ['violations', 'incomplete'],
  };
}
