/**
 * Canonical Vaeloom Route Manifest
 *
 * Single source of truth for:
 * - Navigation links in Sidebar, TopNav, and CommandCenter
 * - Breadcrumb resolution
 * - DataMode categorization (live vs preview vs stub)
 * - Enterprise capability gating
 * - Automated E2E route coverage and accessibility scanning
 */

export type DataMode = 'live' | 'preview' | 'stub' | 'dead';
export type NavSection =
  'Assist' | 'Memory' | 'Career' | 'Operations' | 'Trust & Rights' | 'Enterprise';

export interface RouteDefinition {
  id: string;
  /** Subroute relative to /workspace/[workspaceId] (empty string represents the workspace root/dashboard) */
  subpath: string;
  label: string;
  section: NavSection;
  dataMode: DataMode;
  enterprise?: boolean;
  breadcrumbTitle: string;
  aliases?: string[];
  redirectTo?: string;
  primaryAction?: string;
  mobilePattern?: 'single-column' | 'list-to-detail' | 'drawer';
  description?: string;
}

export const WORKSPACE_ROUTES: readonly RouteDefinition[] = [
  // ── Assist ─────────────────────────────────────────────────────────────
  {
    id: 'dashboard',
    subpath: '',
    label: 'Dashboard',
    section: 'Assist',
    dataMode: 'live',
    breadcrumbTitle: 'Dashboard',
    primaryAction: 'Start Next Action',
    mobilePattern: 'single-column',
    description: 'System overview, active DAGs, pending approvals, and quick actions.',
  },
  {
    id: 'capabilities',
    subpath: 'capabilities',
    label: 'Capabilities',
    section: 'Assist',
    dataMode: 'live',
    breadcrumbTitle: 'Capabilities',
    primaryAction: 'Configure Capability',
    mobilePattern: 'drawer',
    description: 'Manage AI agents, tool permissions, and system connectors.',
  },
  {
    id: 'chat',
    subpath: 'chat',
    label: 'Chat',
    section: 'Assist',
    dataMode: 'live',
    breadcrumbTitle: 'Chat Assistant',
    primaryAction: 'Send Message',
    mobilePattern: 'single-column',
    description: 'Autonomous reasoning copilot with source citations and step inspection.',
  },
  {
    id: 'agents',
    subpath: 'agents',
    label: 'Agents',
    section: 'Assist',
    dataMode: 'live',
    breadcrumbTitle: 'Agents',
    primaryAction: 'Deploy Agent',
    mobilePattern: 'list-to-detail',
    description: 'Specialist AI agent fleet status, telemetry, and execution logs.',
  },
  {
    id: 'cognition',
    subpath: 'cognition',
    label: 'Cognitive Engine',
    section: 'Assist',
    dataMode: 'live',
    breadcrumbTitle: 'Cognitive Engine',
    description: 'System 1 / System 2 cognitive pipeline inspection and decision models.',
  },
  {
    id: 'council',
    subpath: 'council',
    label: 'Agent Council',
    section: 'Assist',
    dataMode: 'live',
    breadcrumbTitle: 'Agent Council',
    description: 'Multi-agent consensus arbitration, confidence scoring, and quorum adjudications.',
  },

  // ── Memory ────────────────────────────────────────────────────────────
  {
    id: 'memory',
    subpath: 'memory',
    label: 'Memory Graph',
    section: 'Memory',
    dataMode: 'live',
    breadcrumbTitle: 'Memory Graph',
    primaryAction: 'Explore Knowledge Node',
    mobilePattern: 'drawer',
    description: 'Graph visualization of extracted semantic entities and relationship triples.',
  },
  {
    id: 'search',
    subpath: 'search',
    label: 'Search',
    section: 'Memory',
    dataMode: 'live',
    breadcrumbTitle: 'Global Search',
    primaryAction: 'Execute Search',
    mobilePattern: 'single-column',
    description: 'Semantic vector retrieval across documents, memories, jobs, and tasks.',
  },
  {
    id: 'files',
    subpath: 'files',
    label: 'Documents',
    section: 'Memory',
    dataMode: 'live',
    breadcrumbTitle: 'Files & Documents',
    aliases: ['documents'],
    primaryAction: 'Upload Document',
    mobilePattern: 'list-to-detail',
    description: 'Workspace document storage, text extraction, version history, and RAG index.',
  },

  // ── Career ────────────────────────────────────────────────────────────
  {
    id: 'career',
    subpath: 'career',
    label: 'Career Strategy',
    section: 'Career',
    dataMode: 'preview',
    breadcrumbTitle: 'Career Strategy',
    description:
      'Autonomous career trajectory pathing, compensation targets, and market benchmarking.',
  },
  {
    id: 'resume',
    subpath: 'resume',
    label: 'Resumes',
    section: 'Career',
    dataMode: 'live',
    breadcrumbTitle: 'Resume & Documents',
    aliases: ['resumes'],
    primaryAction: 'Create Resume',
    mobilePattern: 'list-to-detail',
    description: 'ATS-optimized resume generator, LaTeX compile, and template tailoring.',
  },
  {
    id: 'jobs',
    subpath: 'jobs',
    label: 'Jobs',
    section: 'Career',
    dataMode: 'live',
    breadcrumbTitle: 'Job Tracker',
    primaryAction: 'Find Opportunities',
    mobilePattern: 'list-to-detail',
    description: 'Target job board listings, match scoring, and recruiter correspondence tracking.',
  },
  {
    id: 'applications',
    subpath: 'applications',
    label: 'Applications',
    section: 'Career',
    dataMode: 'live',
    breadcrumbTitle: 'Job Applications',
    primaryAction: 'Submit Application',
    mobilePattern: 'list-to-detail',
    description: 'End-to-end application lifecycle tracking with ATS status feedback.',
  },

  // ── Operations ────────────────────────────────────────────────────────
  {
    id: 'tasks',
    subpath: 'tasks',
    label: 'Tasks & DAGs',
    section: 'Operations',
    dataMode: 'preview',
    breadcrumbTitle: 'Tasks & DAGs',
    primaryAction: 'Trigger Task',
    mobilePattern: 'single-column',
    description: 'Autonomous execution pipelines, step-by-step DAG traces, and task status.',
  },
  {
    id: 'history',
    subpath: 'history',
    label: 'Activity Log',
    section: 'Operations',
    dataMode: 'live',
    breadcrumbTitle: 'Activity Log',
    description: 'Audit trail of user interactions, agent decisions, and tool executions.',
  },
  {
    id: 'schedule',
    subpath: 'schedule',
    label: 'Schedule',
    section: 'Operations',
    dataMode: 'live',
    breadcrumbTitle: 'Schedule & Crons',
    description: 'Background cron jobs, recurring agent sweeps, and calendar reminders.',
  },
  {
    id: 'approvals',
    subpath: 'approvals',
    label: 'Approvals',
    section: 'Operations',
    dataMode: 'live',
    breadcrumbTitle: 'Pending Approvals',
    primaryAction: 'Review Approval',
    mobilePattern: 'single-column',
    description: 'Human-in-the-loop (HITL) consent gates for destructive or external actions.',
  },
  {
    id: 'connectors',
    subpath: 'connectors',
    label: 'Connectors',
    section: 'Operations',
    dataMode: 'live',
    breadcrumbTitle: 'Integrations & Connectors',
    primaryAction: 'Add Connector',
    mobilePattern: 'list-to-detail',
    description:
      'Model Context Protocol (MCP) servers, Composio tools, and external service links.',
  },
  {
    id: 'email',
    subpath: 'email',
    label: 'Email Intel',
    section: 'Operations',
    dataMode: 'preview',
    breadcrumbTitle: 'Email Intelligence',
    description: 'Autonomous recruiter email scanning, thread triage, and timeline extraction.',
  },

  // ── Trust & Rights ────────────────────────────────────────────────────
  {
    id: 'profile',
    subpath: 'profile',
    label: 'Profile & Account',
    section: 'Trust & Rights',
    dataMode: 'live',
    breadcrumbTitle: 'Profile & Account',
    primaryAction: 'Edit Profile',
    description: 'Personal profile, active sessions, TOTP MFA, and account preferences.',
  },
  {
    id: 'settings',
    subpath: 'settings',
    label: 'Workspace Settings',
    section: 'Trust & Rights',
    dataMode: 'live',
    breadcrumbTitle: 'Workspace Settings',
    description: 'Workspace metadata, member management, and general configurations.',
  },
  {
    id: 'security',
    subpath: 'settings/security',
    label: 'Security & Keys',
    section: 'Trust & Rights',
    dataMode: 'live',
    breadcrumbTitle: 'Account Security',
    primaryAction: 'Manage 2FA',
    description: 'Two-factor authentication, active device sessions, and credential management.',
  },
  {
    id: 'vault',
    subpath: 'vault',
    label: 'Secrets Vault',
    section: 'Trust & Rights',
    dataMode: 'live',
    breadcrumbTitle: 'Secrets Vault',
    primaryAction: 'Store Secret',
    description: 'Zero-trust encrypted storage for third-party API keys and OAuth tokens.',
  },
  {
    id: 'help',
    subpath: 'help',
    label: 'Help & Guides',
    section: 'Trust & Rights',
    dataMode: 'preview',
    breadcrumbTitle: 'Help & Guides',
    description: 'Product documentation, keyboard shortcuts, and troubleshooting guides.',
  },

  // ── Enterprise ────────────────────────────────────────────────────────
  {
    id: 'billing',
    subpath: 'billing',
    label: 'Billing & Plans',
    section: 'Enterprise',
    enterprise: true,
    dataMode: 'live',
    breadcrumbTitle: 'Billing & Plans',
    description: 'Subscription management, seat allocations, usage quotas, and payment receipts.',
  },
  {
    id: 'admin',
    subpath: 'admin',
    label: 'Admin',
    section: 'Enterprise',
    enterprise: true,
    dataMode: 'live',
    breadcrumbTitle: 'Admin Console',
    description:
      'Tenant governance, system health metrics, compliance logs, and security policies.',
  },
  {
    id: 'organizations',
    subpath: 'organizations',
    label: 'Organizations',
    section: 'Enterprise',
    enterprise: true,
    dataMode: 'live',
    breadcrumbTitle: 'Organization Hierarchy',
    primaryAction: 'Add Organization Unit',
    mobilePattern: 'list-to-detail',
    description: 'Multi-tenant organization units, department trees, and role-based permissions.',
  },
  {
    id: 'marketplace',
    subpath: 'marketplace',
    label: 'Marketplace',
    section: 'Enterprise',
    enterprise: true,
    dataMode: 'live',
    breadcrumbTitle: 'Extension Marketplace',
    primaryAction: 'Install Extension',
    mobilePattern: 'list-to-detail',
    description: 'Discover and install verified plugins, connectors, and AI agents.',
  },
  {
    id: 'developer',
    subpath: 'developer',
    label: 'Developer',
    section: 'Enterprise',
    enterprise: true,
    dataMode: 'live',
    breadcrumbTitle: 'Developer Console',
    primaryAction: 'Create API Key',
    description: 'API key issuance, webhook endpoints, SDK docs, and event delivery logs.',
  },
  {
    id: 'feature-flags',
    subpath: 'feature-flags',
    label: 'Feature Flags',
    section: 'Enterprise',
    enterprise: true,
    dataMode: 'live',
    breadcrumbTitle: 'Feature Flags',
    description:
      'Targeted capability rollout, beta feature enrollment, and operational kill-switches.',
  },
] as const;

/**
 * Resolve breadcrumbs from the current browser pathname.
 */
export function resolveBreadcrumb(pathname: string): { section: string; title: string } {
  const parts = pathname.split('/').filter(Boolean);
  if (parts[0] !== 'workspace' || !parts[1]) {
    return { section: 'Vaeloom', title: 'Home' };
  }

  const subroute = parts.slice(2).join('/');

  // Exact match
  const exact = WORKSPACE_ROUTES.find(
    (r) => r.subpath === subroute || r.aliases?.includes(subroute),
  );
  if (exact) {
    return { section: exact.section, title: exact.breadcrumbTitle };
  }

  // Prefix match (for detail routes like files/[id] or memory/[id])
  const baseSub = parts[2] || '';
  const baseMatch = WORKSPACE_ROUTES.find(
    (r) => r.subpath === baseSub || r.aliases?.includes(baseSub),
  );
  if (baseMatch) {
    return { section: baseMatch.section, title: baseMatch.breadcrumbTitle };
  }

  return {
    section: 'Workspace',
    title: subroute ? subroute.charAt(0).toUpperCase() + subroute.slice(1) : 'Overview',
  };
}

/**
 * Resolve the route definition for a given pathname.
 */
export function resolveRoute(pathname: string): RouteDefinition | undefined {
  const parts = pathname.split('/').filter(Boolean);
  if (parts[0] !== 'workspace' || !parts[1]) {
    return undefined;
  }
  const subroute = parts.slice(2).join('/');
  const exact = WORKSPACE_ROUTES.find(
    (r) => r.subpath === subroute || r.aliases?.includes(subroute),
  );
  if (exact) return exact;

  const baseSub = parts[2] || '';
  return WORKSPACE_ROUTES.find((r) => r.subpath === baseSub || r.aliases?.includes(baseSub));
}

/**
 * Returns all accessible workspace navigation routes grouped by section.
 */
export function getNavigationGroups(
  workspaceId: string,
  options?: { enableEnterprise?: boolean },
): Array<{
  label: NavSection;
  enterprise?: boolean;
  links: Array<{ id: string; name: string; path: string; dataMode: DataMode }>;
}> {
  const enableEnterprise = options?.enableEnterprise ?? false;
  const sections: NavSection[] = ['Assist', 'Memory', 'Career', 'Operations', 'Trust & Rights'];

  if (enableEnterprise) {
    sections.push('Enterprise');
  }

  return sections.map((sec) => {
    const routes = WORKSPACE_ROUTES.filter((r) => {
      if (r.section !== sec) return false;
      if (r.enterprise && !enableEnterprise) return false;
      return true;
    });

    return {
      label: sec,
      enterprise: sec === 'Enterprise',
      links: routes.map((r) => ({
        id: r.id,
        name: r.label,
        path: r.subpath ? `/workspace/${workspaceId}/${r.subpath}` : `/workspace/${workspaceId}`,
        dataMode: r.dataMode,
      })),
    };
  });
}
