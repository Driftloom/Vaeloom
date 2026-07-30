import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { axeConfig, getAxeOptions } from './axe-config';
import * as fs from 'fs';
import * as path from 'path';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const REPORTS_DIR = path.resolve(__dirname, 'reports');

interface RouteEntry {
  path: string;
  name: string;
  dynamic?: Record<string, string>;
}

const routes: RouteEntry[] = [
  { path: '/', name: 'Home' },
  { path: '/auth/login', name: 'Login' },
  { path: '/auth/signup', name: 'Sign Up' },
  { path: '/workspace/[workspaceId]', name: 'Workspace Dashboard', dynamic: { workspaceId: 'demo' } },
  { path: '/workspace/[workspaceId]/admin', name: 'Admin', dynamic: { workspaceId: 'demo' } },
  { path: '/workspace/[workspaceId]/applications', name: 'Applications', dynamic: { workspaceId: 'demo' } },
  { path: '/workspace/[workspaceId]/billing', name: 'Billing', dynamic: { workspaceId: 'demo' } },
  { path: '/workspace/[workspaceId]/chat', name: 'Chat', dynamic: { workspaceId: 'demo' } },
  { path: '/workspace/[workspaceId]/connectors', name: 'Connectors', dynamic: { workspaceId: 'demo' } },
  { path: '/workspace/[workspaceId]/developer', name: 'Developer', dynamic: { workspaceId: 'demo' } },
  { path: '/workspace/[workspaceId]/feature-flags', name: 'Feature Flags', dynamic: { workspaceId: 'demo' } },
  { path: '/workspace/[workspaceId]/files', name: 'Files', dynamic: { workspaceId: 'demo' } },
  { path: '/workspace/[workspaceId]/history', name: 'History', dynamic: { workspaceId: 'demo' } },
  { path: '/workspace/[workspaceId]/jobs', name: 'Jobs', dynamic: { workspaceId: 'demo' } },
  { path: '/workspace/[workspaceId]/marketplace', name: 'Marketplace', dynamic: { workspaceId: 'demo' } },
  { path: '/workspace/[workspaceId]/memory', name: 'Memory', dynamic: { workspaceId: 'demo' } },
  { path: '/workspace/[workspaceId]/organizations', name: 'Organizations', dynamic: { workspaceId: 'demo' } },
  { path: '/workspace/[workspaceId]/resume', name: 'Resume', dynamic: { workspaceId: 'demo' } },
  { path: '/workspace/[workspaceId]/schedule', name: 'Schedule', dynamic: { workspaceId: 'demo' } },
  { path: '/workspace/[workspaceId]/settings', name: 'Settings', dynamic: { workspaceId: 'demo' } },
];

function resolvePath(route: RouteEntry): string {
  if (!route.dynamic) return route.path;
  let resolved = route.path;
  for (const [key, value] of Object.entries(route.dynamic)) {
    resolved = resolved.replace(`[${key}]`, value);
  }
  return resolved;
}

interface AuditResult {
  page: string;
  url: string;
  violations: {
    id: string;
    impact: string;
    description: string;
    tags: string[];
    nodes: number;
  }[];
  passes: number;
  incomplete: number;
}

async function auditPage(page: any, route: RouteEntry): Promise<AuditResult> {
  const url = `${BASE_URL}${resolvePath(route)}`;
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
  } catch {
    return {
      page: route.name,
      url,
      violations: [],
      passes: 0,
      incomplete: 0,
    };
  }

  const results = await new AxeBuilder({ page })
    .withTags(axeConfig.tags)
    .exclude(axeConfig.exclude)
    .analyze();

  return {
    page: route.name,
    url,
    violations: results.violations.map((v) => ({
      id: v.id,
      impact: v.impact || 'unknown',
      description: v.description,
      tags: v.tags,
      nodes: v.nodes.length,
    })),
    passes: results.passes.length,
    incomplete: results.incomplete.length,
  };
}

async function main() {
  if (!fs.existsSync(REPORTS_DIR)) {
    fs.mkdirSync(REPORTS_DIR, { recursive: true });
  }

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
  });
  const page = await context.newPage();

  const allResults: AuditResult[] = [];
  let criticalViolations = 0;

  for (const route of routes) {
    const result = await auditPage(page, route);
    allResults.push(result);

    for (const v of result.violations) {
      if (v.impact === 'critical') {
        criticalViolations++;
      }
    }
  }

  await browser.close();

  const template = fs.readFileSync(
    path.resolve(__dirname, 'report-template.html'),
    'utf8'
  );

  const totalViolations = allResults.reduce((s, r) => s + r.violations.length, 0);
  const totalPages = allResults.length;
  const passedPages = allResults.filter(
    (r) => r.violations.filter((v) => v.impact === 'critical').length === 0
  ).length;

  const reportHtml = template
    .replace('{{TOTAL_VIOLATIONS}}', String(totalViolations))
    .replace('{{TOTAL_PAGES}}', String(totalPages))
    .replace('{{PASSED_PAGES}}', String(passedPages))
    .replace('{{CRITICAL_COUNT}}', String(criticalViolations))
    .replace('{{TIMESTAMP}}', new Date().toISOString())
    .replace(
      '{{RESULTS_JSON}}',
      JSON.stringify(allResults, null, 2).replace(/</g, '&lt;').replace(/>/g, '&gt;')
    );

  fs.writeFileSync(path.join(REPORTS_DIR, 'a11y-report.html'), reportHtml);

  const criticalList = allResults.flatMap((r) =>
    r.violations
      .filter((v) => v.impact === 'critical')
      .map((v) => `${r.page}: ${v.id} - ${v.description} (${v.nodes} nodes)`)
  );

  if (criticalList.length > 0) {
    fs.writeFileSync(
      path.join(REPORTS_DIR, 'critical-violations.txt'),
      criticalList.join('\n')
    );
  }

  console.log(`\nAccessibility Audit Complete`);
  console.log(`  Pages audited: ${totalPages}`);
  console.log(`  Total violations: ${totalViolations}`);
  console.log(`  Critical violations: ${criticalViolations}`);
  console.log(`  Passed pages: ${passedPages}/${totalPages}`);
  console.log(`  Report: ${REPORTS_DIR}/a11y-report.html`);

  if (criticalViolations > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Audit failed:', err);
  process.exit(1);
});
