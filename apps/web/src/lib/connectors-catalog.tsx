import React from 'react';
import type { ConnectorProvider } from '@vaeloom/shared-types';
import { CheckIcon, PlusIcon } from '@vaeloom/ui-kit';

export type ConnectorProtocol =
  | 'OAuth 2.0'
  | 'MCP (stdio)'
  | 'MCP (Streamable-HTTP)'
  | 'REST API'
  | 'GraphQL'
  | 'Native Sovereign';

export type ConnectorCategory =
  | 'All'
  | 'Career & ATS'
  | 'Startup & Business'
  | 'Productivity & Study'
  | 'Developer Tools & Cloud'
  | 'Communication'
  | 'Engineering'
  // Backward compatibility legacy categories
  | 'Education'
  | 'Sales'
  | 'Productivity'
  | 'Financial'
  | 'Legal'
  | 'HR'
  | 'AI & ML'
  | 'Data & Analytics'
  | 'Marketing'
  | 'Support'
  | 'E-Commerce'
  | 'Google'
  | 'Native'
  | 'MCP';

export interface ConnectorDefinition {
  id: string;
  name: string;
  provider: ConnectorProvider | 'composio' | 'mcp' | 'native';
  category: ConnectorCategory;
  protocol: ConnectorProtocol;
  description: string;
  scopes: string[];
  assignedAgents: string[];
  isTop?: boolean;
  isTrending?: boolean;
  isNew?: boolean;
  isDesktop?: boolean;
  composioApp?: string;
  mcpServerId?: string;
  customIcon?: string;
}

export interface CategoryFilter {
  id: ConnectorCategory;
  label: string;
  /** Matched against the row's category text, lowercased. */
  terms: readonly string[];
  /** Matched against the row's provider / id / protocol instead of its category. */
  providerTerms?: readonly string[];
  idIncludes?: readonly string[];
  protocolIncludes?: readonly string[];
}

export const CATEGORY_FILTERS: readonly CategoryFilter[] = [
  { id: 'All', label: 'All Purposes & Sectors', terms: [] },
  {
    id: 'Career & ATS',
    label: 'Career, Hiring & Tech Identity',
    terms: [
      'career',
      'ats',
      'talent',
      'recruit',
      'hiring',
      'resume',
      'job',
      'hr',
      'candidate',
      'applicant',
      'portfolio',
      'interview',
    ],
  },
  {
    id: 'Startup & Business',
    label: 'Startup, Founder & Business Hub',
    terms: [
      'startup',
      'business',
      'founder',
      'sales',
      'crm',
      'finance',
      'financial',
      'banking',
      'billing',
      'accounting',
      'legal',
      'payment',
      'revenue',
      'lead',
      'spend',
      'payroll',
      'contract',
      'e-commerce',
      'commerce',
    ],
  },
  {
    id: 'Productivity & Study',
    label: 'Productivity, Knowledge & Study',
    terms: [
      'productivity',
      'study',
      'education',
      'learning',
      'knowledge',
      'note',
      'doc',
      'task',
      'project',
      'workspace',
      'course',
      'academy',
      'lms',
      'wiki',
    ],
  },
  {
    id: 'Developer Tools & Cloud',
    label: 'Developer Tools, Cloud & DevOps',
    terms: [
      'developer',
      'cloud',
      'devops',
      'infra',
      'database',
      'hosting',
      'backend',
      'api',
      'docker',
      'kubernetes',
      'aws',
      'gcp',
      'azure',
      'data',
      'analytics',
      'warehouse',
      'bi',
      'ai',
      'ml',
      'monitoring',
      'observability',
    ],
  },
  {
    id: 'Communication',
    label: 'Communication, Social & Community',
    terms: [
      'communication',
      'community',
      'messaging',
      'email',
      'chat',
      'social',
      'meeting',
      'video',
      'voice',
    ],
  },
  {
    id: 'Engineering',
    label: 'Engineering & DevOps',
    terms: [
      'engineering',
      'devops',
      'developer',
      'infrastructure',
      'database',
      'code',
      'git',
      'ci/cd',
      'repository',
    ],
  },
  // Backward compatibility filters
  {
    id: 'Education',
    label: 'Education & Learning',
    terms: ['education', 'learning', 'course', 'academy', 'training'],
  },
  { id: 'Sales', label: 'Sales & CRM', terms: ['sales', 'crm', 'lead', 'revenue'] },
  {
    id: 'Productivity',
    label: 'Productivity & Tasks',
    terms: ['productivity', 'task', 'project', 'workspace'],
  },
  {
    id: 'Financial',
    label: 'Finance & Accounting',
    terms: ['finance', 'financial', 'accounting', 'banking', 'tax', 'payments'],
  },
  { id: 'Legal', label: 'Legal & Contracts', terms: ['legal', 'contract', 'compliance'] },
  {
    id: 'HR',
    label: 'HR, Recruiting & Talent',
    terms: ['hr', 'talent', 'recruit', 'hiring', 'people', 'payroll'],
  },
  { id: 'AI & ML', label: 'AI, Agents & ML', terms: ['ai', 'machine learning', 'intelligence'] },
  {
    id: 'Data & Analytics',
    label: 'Data, Analytics & BI',
    terms: ['analytics', 'data', 'bi', 'warehouse'],
  },
  {
    id: 'Marketing',
    label: 'Marketing & Social',
    terms: ['marketing', 'social', 'campaign', 'seo', 'brand', 'advertis', 'content'],
  },
  { id: 'Support', label: 'Customer Support', terms: ['support', 'helpdesk', 'ticket', 'service'] },
  {
    id: 'E-Commerce',
    label: 'E-Commerce & Retail',
    terms: ['commerce', 'retail', 'store', 'ecommerce', 'marketplace'],
  },
  {
    id: 'Google',
    label: 'Google Workspace',
    terms: ['google', 'gmail', 'drive', 'calendar', 'workspace'],
    idIncludes: ['google', 'gmail'],
  },
  { id: 'Native', label: 'Native Sovereign', terms: [], providerTerms: ['native'] },
  {
    id: 'MCP',
    label: 'Model Context Protocol (MCP)',
    terms: [],
    protocolIncludes: ['MCP'],
    providerTerms: ['mcp'],
  },
];

/* ──────────────────────────────────────────────────────────────────────────
   1. High-Fidelity SVG Brand Icons & Verified Components
   ────────────────────────────────────────────────────────────────────────── */

export function GoogleDriveIcon() {
  return (
    <svg className="w-6 h-6" viewBox="0 0 87.3 78" fill="none">
      <path
        d="M6.6 66.85l3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8H0c0 1.55.4 3.1 1.2 4.5l5.4 9.35z"
        fill="#0066DA"
      />
      <path
        d="M43.65 25L29.9 1.2c-1.35.8-2.5 1.9-3.3 3.3L1.2 45.45c-.8 1.4-1.2 2.95-1.2 4.5h27.5L43.65 25z"
        fill="#00AC47"
      />
      <path
        d="M73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5H59.8l5.85 10.15 7.9 13.65z"
        fill="#EA4335"
      />
      <path
        d="M43.65 25L57.4 1.2C56.05.4 54.5 0 52.95 0H34.35c-1.55 0-3.1.4-4.45 1.2L43.65 25z"
        fill="#00832D"
      />
      <path
        d="M59.8 50H27.5L13.75 73.8c1.35.8 2.9 1.2 4.45 1.2h50.9c1.55 0 3.1-.4 4.45-1.2L59.8 50z"
        fill="#2684FC"
      />
      <path
        d="M73.4 26.5l-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3L43.65 25 59.8 50h27.5c0-1.55-.4-3.1-1.2-4.5l-12.7-19z"
        fill="#FFBA00"
      />
    </svg>
  );
}

export function GmailIcon() {
  return (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none">
      <path
        d="M2 5.5V18.5C2 19.6 2.9 20.5 4 20.5H6.5V11.5L12 15.5L17.5 11.5V20.5H20C21.1 20.5 22 19.6 22 18.5V5.5C22 4.07 20.37 3.25 19.2 4.13L12 9.5L4.8 4.13C3.63 3.25 2 4.07 2 5.5Z"
        fill="#EA4335"
      />
      <path d="M2 5.5C2 4.07 3.63 3.25 4.8 4.13L12 9.5L6.5 13.5L2 10.1V5.5Z" fill="#4285F4" />
      <path d="M22 5.5C22 4.07 20.37 3.25 19.2 4.13L12 9.5L17.5 13.5L22 10.1V5.5Z" fill="#FBBC04" />
      <path d="M2 10.1V18.5C2 19.6 2.9 20.5 4 20.5H6.5V11.5L2 10.1Z" fill="#34A853" />
      <path d="M22 10.1V18.5C22 19.6 21.1 20.5 20 20.5H17.5V11.5L22 10.1Z" fill="#C5221F" />
    </svg>
  );
}

export function GoogleCalendarIcon() {
  return (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="4" width="18" height="17" rx="3" fill="#4285F4" />
      <path d="M3 7.5H21V6C21 4.34 19.66 3 18 3H6C4.34 3 3 4.34 3 6V7.5Z" fill="#1967D2" />
      <rect x="7" y="2" width="2" height="3" rx="1" fill="#FFFFFF" />
      <rect x="15" y="2" width="2" height="3" rx="1" fill="#FFFFFF" />
      <text
        x="12"
        y="16.5"
        fill="#FFFFFF"
        fontSize="9"
        fontWeight="700"
        textAnchor="middle"
        fontFamily="sans-serif"
      >
        31
      </text>
    </svg>
  );
}

export function CanvaIcon() {
  return (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" fill="#00C4CC" />
      <path
        d="M14.8 8.8C14.2 8.3 13.4 8 12.4 8C10.2 8 8.7 9.8 8.7 12.2C8.7 14.6 10.2 16.2 12.5 16.2C13.6 16.2 14.4 15.8 15 15.2C15.2 15 15.1 14.6 14.8 14.4L14.2 14C14 13.8 13.7 13.9 13.5 14.1C13.2 14.4 12.8 14.6 12.3 14.6C11.1 14.6 10.3 13.6 10.3 12.2C10.3 10.8 11.1 9.6 12.4 9.6C12.9 9.6 13.4 9.8 13.7 10.1C13.9 10.3 14.2 10.3 14.4 10.1L14.9 9.5C15.1 9.3 15 8.9 14.8 8.8Z"
        fill="#FFFFFF"
      />
    </svg>
  );
}

export function Microsoft365Icon() {
  return (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="3" width="8.5" height="8.5" rx="1" fill="#F25022" />
      <rect x="12.5" y="3" width="8.5" height="8.5" rx="1" fill="#7FBA00" />
      <rect x="3" y="12.5" width="8.5" height="8.5" rx="1" fill="#00A4EF" />
      <rect x="12.5" y="12.5" width="8.5" height="8.5" rx="1" fill="#FFB900" />
    </svg>
  );
}

export function NotionIcon() {
  return (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none">
      <rect
        x="2"
        y="2"
        width="20"
        height="20"
        rx="4"
        fill="#181716"
        stroke="#333"
        strokeWidth="1"
      />
      <path
        d="M6 6.8L14.4 6L18 8.2V17.8L12.4 18.5L7.2 15.2V6.8M7.2 6.8L12.4 10.5V17M12.4 10.5L18 7.5"
        stroke="#FFFFFF"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <text
        x="11.5"
        y="15"
        fill="#FFFFFF"
        fontSize="10"
        fontWeight="900"
        fontFamily="serif"
        textAnchor="middle"
      >
        N
      </text>
    </svg>
  );
}

export function FigmaIcon() {
  return (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none">
      <path d="M8 3.5H12V9.5H8C6.34 9.5 5 8.16 5 6.5C5 4.84 6.34 3.5 8 3.5Z" fill="#F24E1E" />
      <path
        d="M12 3.5H16C17.66 3.5 19 4.84 19 6.5C19 8.16 17.66 9.5 16 9.5H12V3.5Z"
        fill="#FF7262"
      />
      <path d="M8 9.5H12V15.5H8C6.34 15.5 5 14.16 5 12.5C5 10.84 6.34 9.5 8 9.5Z" fill="#A259FF" />
      <path
        d="M12 9.5H16C17.66 9.5 19 10.84 19 12.5C19 14.16 17.66 15.5 16 15.5C14.34 15.5 13 14.16 13 12.5V9.5H12Z"
        fill="#1ABCFE"
      />
      <path
        d="M8 15.5H12V18.5C12 20.16 10.66 21.5 9 21.5C7.34 21.5 6 20.16 6 18.5C6 16.84 7.34 15.5 8 15.5Z"
        fill="#0ACF83"
      />
    </svg>
  );
}

export function SlackIcon() {
  return (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none">
      <path d="M6 15A2 2 0 0 1 8 13H10V15A2 2 0 0 1 8 17H6A2 2 0 0 1 6 15Z" fill="#E01E5A" />
      <path
        d="M11 15A2 2 0 0 1 13 15V19A2 2 0 0 1 11 21A2 2 0 0 1 9 19V15A2 2 0 0 1 11 15Z"
        fill="#E01E5A"
      />
      <path
        d="M9 8A2 2 0 0 1 11 6V8A2 2 0 0 1 9 10H5A2 2 0 0 1 5 8A2 2 0 0 1 9 8Z"
        fill="#36C5F0"
      />
      <path
        d="M9 11A2 2 0 0 1 9 13H5A2 2 0 0 1 3 11A2 2 0 0 1 5 9H9A2 2 0 0 1 9 11Z"
        fill="#36C5F0"
      />
      <path d="M18 9A2 2 0 0 1 16 11H14V9A2 2 0 0 1 16 7H18A2 2 0 0 1 18 9Z" fill="#2EB67D" />
      <path
        d="M13 9A2 2 0 0 1 11 9V5A2 2 0 0 1 13 3A2 2 0 0 1 15 5V9A2 2 0 0 1 13 9Z"
        fill="#2EB67D"
      />
      <path
        d="M15 16A2 2 0 0 1 13 18V16A2 2 0 0 1 15 14H19A2 2 0 0 1 19 16A2 2 0 0 1 15 16Z"
        fill="#ECB22E"
      />
      <path
        d="M15 13A2 2 0 0 1 15 11H19A2 2 0 0 1 21 13A2 2 0 0 1 19 15H15A2 2 0 0 1 15 13Z"
        fill="#ECB22E"
      />
    </svg>
  );
}

export function AtlassianIcon() {
  return (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none">
      <path
        d="M11.6 12.3C11.3 11.9 10.9 11.5 10.6 11.2L6.1 6.7C5.8 6.4 5.3 6.6 5.3 7.1V17.3C5.3 17.7 5.6 18 6 18H11.2C11.6 18 11.9 17.6 11.7 17.2L11.6 12.3Z"
        fill="#0052CC"
      />
      <path
        d="M12.4 11.7C12.7 12.1 13.1 12.5 13.4 12.8L17.9 17.3C18.2 17.6 18.7 17.4 18.7 16.9V6.7C18.7 6.3 18.4 6 18 6H12.8C12.4 6 12.1 6.4 12.3 6.8L12.4 11.7Z"
        fill="#2684FF"
      />
    </svg>
  );
}

export function HubSpotIcon() {
  return (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" fill="#FF7A59" />
      <circle cx="12" cy="12" r="3" fill="#FFFFFF" />
      <path d="M12 4V9" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
      <path d="M12 15V20" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
      <path d="M15 12H20" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
      <circle cx="12" cy="4" r="1.5" fill="#FFFFFF" />
      <circle cx="12" cy="20" r="1.5" fill="#FFFFFF" />
      <circle cx="20" cy="12" r="1.5" fill="#FFFFFF" />
    </svg>
  );
}

export function GitHubIcon() {
  return (
    <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
      />
    </svg>
  );
}

export function LinearIcon() {
  return (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" fill="#5E6AD2" />
      <path
        d="M7 17L17 7M7 17L12 17M7 17L7 12M17 7L12 7M17 7L17 12"
        stroke="#FFFFFF"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function AtsCrawlerIcon() {
  return (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none">
      <rect x="2" y="2" width="20" height="20" rx="6" fill="#10B981" />
      <path
        d="M7 8H17M7 12H17M7 16H13M17 16L19 18M19 16L17 18"
        stroke="#FFFFFF"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function BrowserIcon() {
  return (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none">
      <rect x="2" y="3" width="20" height="18" rx="4" fill="#8B5CF6" />
      <line x1="2" y1="8" x2="22" y2="8" stroke="#FFFFFF" strokeWidth="1.5" />
      <circle cx="5" cy="5.5" r="1" fill="#FFFFFF" />
      <circle cx="8" cy="5.5" r="1" fill="#FFFFFF" />
      <circle cx="11" cy="5.5" r="1" fill="#FFFFFF" />
      <circle cx="12" cy="14" r="3" stroke="#FFFFFF" strokeWidth="1.5" />
      <path d="M12 11V17M9 14H15" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function VerifiedCheck() {
  return (
    <span
      className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-muted text-muted-foreground border border-border/50 ml-1.5 shrink-0"
      title="Verified Enterprise Connector"
    >
      <CheckIcon size={10} className="text-muted-foreground" />
    </span>
  );
}

export { PlusIcon } from '@vaeloom/ui-kit';

export function AppBrandIcon({
  name,
  id,
  category,
}: {
  name: string;
  id: string;
  category?: string;
}) {
  const colorMap: Record<string, { bg: string; text: string; border: string }> = {
    stripe: { bg: 'bg-indigo-500/15', text: 'text-indigo-400', border: 'border-indigo-500/30' },
    salesforce: { bg: 'bg-sky-500/15', text: 'text-sky-400', border: 'border-sky-500/30' },
    zendesk: { bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/30' },
    discord: { bg: 'bg-indigo-500/15', text: 'text-indigo-400', border: 'border-indigo-500/30' },
    zoom: { bg: 'bg-blue-500/15', text: 'text-blue-400', border: 'border-blue-500/30' },
    postgresql: { bg: 'bg-blue-600/15', text: 'text-blue-300', border: 'border-blue-600/30' },
    snowflake: { bg: 'bg-cyan-500/15', text: 'text-cyan-400', border: 'border-cyan-500/30' },
    openai: { bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/30' },
    anthropic: { bg: 'bg-amber-600/15', text: 'text-amber-400', border: 'border-amber-600/30' },
    greenhouse: {
      bg: 'bg-emerald-500/15',
      text: 'text-emerald-400',
      border: 'border-emerald-500/30',
    },
    workday: { bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/30' },
    jira: { bg: 'bg-blue-500/15', text: 'text-blue-400', border: 'border-blue-500/30' },
    asana: { bg: 'bg-rose-500/15', text: 'text-rose-400', border: 'border-rose-500/30' },
    airtable: { bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/30' },
    clickup: { bg: 'bg-purple-500/15', text: 'text-purple-400', border: 'border-purple-500/30' },
    monday: { bg: 'bg-rose-500/15', text: 'text-rose-400', border: 'border-rose-500/30' },
    trello: { bg: 'bg-blue-500/15', text: 'text-blue-400', border: 'border-blue-500/30' },
    confluence: { bg: 'bg-blue-600/15', text: 'text-blue-400', border: 'border-blue-600/30' },
    dropbox: { bg: 'bg-blue-500/15', text: 'text-blue-400', border: 'border-blue-500/30' },
    box: { bg: 'bg-blue-500/15', text: 'text-blue-400', border: 'border-blue-500/30' },
    gitlab: { bg: 'bg-orange-500/15', text: 'text-orange-400', border: 'border-orange-500/30' },
    datadog: { bg: 'bg-purple-600/15', text: 'text-purple-400', border: 'border-purple-600/30' },
    sentry: { bg: 'bg-rose-600/15', text: 'text-rose-400', border: 'border-rose-600/30' },
    pagerduty: {
      bg: 'bg-emerald-500/15',
      text: 'text-emerald-400',
      border: 'border-emerald-500/30',
    },
    supabase: {
      bg: 'bg-emerald-500/15',
      text: 'text-emerald-400',
      border: 'border-emerald-500/30',
    },
    vercel: { bg: 'bg-foreground/10', text: 'text-foreground', border: 'border-foreground/20' },
    twilio: { bg: 'bg-red-500/15', text: 'text-red-400', border: 'border-red-500/30' },
    sendgrid: { bg: 'bg-sky-500/15', text: 'text-sky-400', border: 'border-sky-500/30' },
    canvas: { bg: 'bg-red-500/15', text: 'text-red-400', border: 'border-red-500/30' },
    blackboard: { bg: 'bg-amber-600/15', text: 'text-amber-400', border: 'border-amber-600/30' },
    coursera: { bg: 'bg-blue-600/15', text: 'text-blue-400', border: 'border-blue-600/30' },
    moodle: { bg: 'bg-orange-500/15', text: 'text-orange-400', border: 'border-orange-500/30' },
    duolingo: { bg: 'bg-lime-500/15', text: 'text-lime-400', border: 'border-lime-500/30' },
    lever: { bg: 'bg-blue-600/15', text: 'text-blue-400', border: 'border-blue-600/30' },
    docusign: { bg: 'bg-yellow-500/15', text: 'text-yellow-400', border: 'border-yellow-500/30' },
    intercom: { bg: 'bg-blue-500/15', text: 'text-blue-400', border: 'border-blue-500/30' },
    apollo: { bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/30' },
    zoominfo: { bg: 'bg-sky-600/15', text: 'text-sky-400', border: 'border-sky-600/30' },
    loom: { bg: 'bg-indigo-500/15', text: 'text-indigo-400', border: 'border-indigo-500/30' },
    superhuman: { bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/30' },
    aws: { bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/30' },
    gcp: { bg: 'bg-blue-500/15', text: 'text-blue-400', border: 'border-blue-500/30' },
    azure: { bg: 'bg-sky-500/15', text: 'text-sky-400', border: 'border-sky-500/30' },
    docker: { bg: 'bg-sky-500/15', text: 'text-sky-400', border: 'border-sky-500/30' },
    kubernetes: { bg: 'bg-blue-500/15', text: 'text-blue-400', border: 'border-blue-500/30' },
    postman: { bg: 'bg-orange-500/15', text: 'text-orange-400', border: 'border-orange-500/30' },
    cloudflare: { bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/30' },
    resend: { bg: 'bg-foreground/10', text: 'text-foreground', border: 'border-foreground/20' },
    teams: { bg: 'bg-indigo-600/15', text: 'text-indigo-400', border: 'border-indigo-600/30' },
    ashby: { bg: 'bg-emerald-600/15', text: 'text-emerald-400', border: 'border-emerald-600/30' },
    bamboohr: { bg: 'bg-lime-600/15', text: 'text-lime-400', border: 'border-lime-600/30' },
    linkedin: { bg: 'bg-blue-600/15', text: 'text-blue-400', border: 'border-blue-600/30' },
    mercury: { bg: 'bg-indigo-500/15', text: 'text-indigo-400', border: 'border-indigo-500/30' },
    brex: { bg: 'bg-orange-500/15', text: 'text-orange-400', border: 'border-orange-500/30' },
    ramp: { bg: 'bg-lime-500/15', text: 'text-lime-400', border: 'border-lime-500/30' },
    gusto: { bg: 'bg-rose-500/15', text: 'text-rose-400', border: 'border-rose-500/30' },
    deel: { bg: 'bg-blue-500/15', text: 'text-blue-400', border: 'border-blue-500/30' },
    obsidian: { bg: 'bg-purple-500/15', text: 'text-purple-400', border: 'border-purple-500/30' },
  };

  const categoryFallback: Record<string, { bg: string; text: string; border: string }> = {
    // 5 Enterprise Tiers
    'Career & ATS': {
      bg: 'bg-primary/15',
      text: 'text-primary',
      border: 'border-primary/30',
    },
    'Startup & Business': {
      bg: 'bg-amber-500/15',
      text: 'text-amber-400',
      border: 'border-amber-500/30',
    },
    'Productivity & Study': {
      bg: 'bg-emerald-500/15',
      text: 'text-emerald-400',
      border: 'border-emerald-500/30',
    },
    'Developer Tools & Cloud': {
      bg: 'bg-cyan-500/15',
      text: 'text-cyan-400',
      border: 'border-cyan-500/30',
    },
    Communication: {
      bg: 'bg-indigo-500/15',
      text: 'text-indigo-400',
      border: 'border-indigo-500/30',
    },
    Engineering: {
      bg: 'bg-blue-500/15',
      text: 'text-blue-400',
      border: 'border-blue-500/30',
    },
    // Legacy categories
    Education: {
      bg: 'bg-emerald-500/15',
      text: 'text-emerald-400',
      border: 'border-emerald-500/30',
    },
    Sales: {
      bg: 'bg-amber-500/15',
      text: 'text-amber-400',
      border: 'border-amber-500/30',
    },
    HR: {
      bg: 'bg-pink-500/15',
      text: 'text-pink-400',
      border: 'border-pink-500/30',
    },
    'AI & ML': {
      bg: 'bg-purple-500/15',
      text: 'text-purple-400',
      border: 'border-purple-500/30',
    },
    'Data & Analytics': {
      bg: 'bg-cyan-500/15',
      text: 'text-cyan-400',
      border: 'border-cyan-500/30',
    },
    Financial: {
      bg: 'bg-emerald-600/15',
      text: 'text-emerald-300',
      border: 'border-emerald-600/30',
    },
    Legal: {
      bg: 'bg-violet-500/15',
      text: 'text-violet-400',
      border: 'border-violet-500/30',
    },
    Marketing: {
      bg: 'bg-rose-500/15',
      text: 'text-rose-400',
      border: 'border-rose-500/30',
    },
    Support: {
      bg: 'bg-teal-500/15',
      text: 'text-teal-400',
      border: 'border-teal-500/30',
    },
    'E-Commerce': {
      bg: 'bg-orange-500/15',
      text: 'text-orange-400',
      border: 'border-orange-500/30',
    },
    Productivity: {
      bg: 'bg-sky-500/15',
      text: 'text-sky-400',
      border: 'border-sky-500/30',
    },
    Google: {
      bg: 'bg-blue-500/15',
      text: 'text-blue-400',
      border: 'border-blue-500/30',
    },
    Native: {
      bg: 'bg-primary/15',
      text: 'text-primary',
      border: 'border-primary/30',
    },
    MCP: {
      bg: 'bg-accent/15',
      text: 'text-accent-foreground',
      border: 'border-accent/30',
    },
  };

  const scheme = colorMap[id.toLowerCase()] ||
    (category && categoryFallback[category]) || {
      bg: 'bg-muted',
      text: 'text-foreground',
      border: 'border-border',
    };

  const initials = name
    .split(/[\s-_]+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div
      className={`w-7 h-7 rounded-lg ${scheme.bg} ${scheme.border} border flex items-center justify-center font-semibold text-xs ${scheme.text} shadow-inner select-none shrink-0`}
    >
      {initials || name[0]?.toUpperCase() || 'S'}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   2. Master Enterprise Connectors Catalog (200 Curated Integrations)
   ────────────────────────────────────────────────────────────────────────── */

export const AUTHORITATIVE_CATALOG: ConnectorDefinition[] = [
  {
    id: 'github',
    name: 'GitHub',
    provider: 'github',
    category: 'Career & ATS',
    protocol: 'OAuth 2.0',
    description:
      'Inspect PRs, manage issues, read repositories, and showcase technical code contributions',
    scopes: ['repo:read', 'user:read', 'workflow:trigger'],
    assignedAgents: ['CodeReviewAgent', 'AutomatedDevAgent', 'CareerStrategyAgent'],
    isTop: true,
  },
  {
    id: 'gitlab',
    name: 'GitLab DevOps',
    provider: 'composio',
    composioApp: 'gitlab',
    category: 'Career & ATS',
    protocol: 'OAuth 2.0',
    description: 'Merge requests, CI/CD pipelines, and verified engineering portfolio commits',
    scopes: ['read_api', 'read_repository'],
    assignedAgents: ['CodeReviewAgent', 'CareerStrategyAgent'],
  },
  {
    id: 'bitbucket',
    name: 'Bitbucket Cloud',
    provider: 'composio',
    composioApp: 'bitbucket',
    category: 'Career & ATS',
    protocol: 'OAuth 2.0',
    description: 'Atlassian Git repositories, branch permissions, and code review history',
    scopes: ['repository:read', 'pullrequest:read'],
    assignedAgents: ['EngineeringLeadAgent', 'CodeReviewAgent'],
  },
  {
    id: 'greenhouse',
    name: 'Greenhouse ATS',
    provider: 'composio',
    composioApp: 'greenhouse',
    category: 'Career & ATS',
    protocol: 'OAuth 2.0',
    description: 'Candidate job requisitions, application pipelines, scorecards, and offer stages',
    scopes: ['candidates:read', 'jobs:read', 'applications:read'],
    assignedAgents: ['TalentScoutAgent', 'ApplicationAgent'],
    isTrending: true,
  },
  {
    id: 'lever',
    name: 'Lever Talent ATS',
    provider: 'composio',
    composioApp: 'lever',
    category: 'Career & ATS',
    protocol: 'OAuth 2.0',
    description: 'Candidate pipeline analytics, interview feedback, and posting requisition sync',
    scopes: ['candidates:read', 'postings:read', 'opportunities:read'],
    assignedAgents: ['TalentScoutAgent', 'ApplicationAgent'],
  },
  {
    id: 'ashby',
    name: 'Ashby Recruiting ATS',
    provider: 'composio',
    composioApp: 'ashby',
    category: 'Career & ATS',
    protocol: 'OAuth 2.0',
    description:
      'Next-gen talent operations, structured interview loops, and candidate pipeline metrics',
    scopes: ['candidate:read', 'job:read', 'interview:read'],
    assignedAgents: ['TalentScoutAgent', 'ApplicationAgent'],
    isTrending: true,
  },
  {
    id: 'workday',
    name: 'Workday Enterprise HCM',
    provider: 'composio',
    composioApp: 'workday',
    category: 'Career & ATS',
    protocol: 'OAuth 2.0',
    description:
      'Global enterprise human capital management, organizational hierarchies, and career job profiles',
    scopes: ['staffing:read', 'workers:read', 'jobs:read'],
    assignedAgents: ['HRComplianceAgent', 'CareerStrategyAgent'],
  },
  {
    id: 'bamboohr',
    name: 'BambooHR People Systems',
    provider: 'composio',
    composioApp: 'bamboohr',
    category: 'Career & ATS',
    protocol: 'OAuth 2.0',
    description:
      'Employee records, performance reviews, company directory, and applicant tracking sync',
    scopes: ['employees:read', 'reports:read'],
    assignedAgents: ['CareerStrategyAgent', 'ExecutiveAssistantAgent'],
  },
  {
    id: 'linkedin',
    name: 'LinkedIn Professional Network',
    provider: 'composio',
    composioApp: 'linkedin',
    category: 'Career & ATS',
    protocol: 'OAuth 2.0',
    description:
      'Professional profile identity, recommendations, post distribution, and career milestone tracking',
    scopes: ['r_liteprofile', 'r_emailaddress', 'w_member_social'],
    assignedAgents: ['CareerStrategyAgent', 'BrandingAgent', 'ApplicationAgent'],
    isTop: true,
  },
  {
    id: 'substack',
    name: 'Substack Publications',
    provider: 'composio',
    composioApp: 'substack',
    category: 'Career & ATS',
    protocol: 'OAuth 2.0',
    description:
      'Long-form essays, newsletter subscriber milestones, and thought leadership archive',
    scopes: ['posts:read', 'subscribers:read'],
    assignedAgents: ['BrandingAgent', 'PortfolioAgent'],
  },
  {
    id: 'medium',
    name: 'Medium Publications',
    provider: 'composio',
    composioApp: 'medium',
    category: 'Career & ATS',
    protocol: 'OAuth 2.0',
    description:
      'Technical articles, engineering publications, claps, and verified author portfolio',
    scopes: ['basicProfile', 'listPublications', 'publishPost'],
    assignedAgents: ['BrandingAgent', 'PortfolioAgent'],
  },
  {
    id: 'hackerrank',
    name: 'HackerRank Assessments',
    provider: 'composio',
    composioApp: 'hackerrank',
    category: 'Career & ATS',
    protocol: 'OAuth 2.0',
    description:
      'Coding skill certifications, benchmark scores, algorithm challenges, and assessment results',
    scopes: ['certificates:read', 'profile:read'],
    assignedAgents: ['CareerStrategyAgent', 'ResumeBuilderAgent'],
  },
  {
    id: 'devpost',
    name: 'Devpost Hackathons',
    provider: 'composio',
    composioApp: 'devpost',
    category: 'Career & ATS',
    protocol: 'OAuth 2.0',
    description:
      'Hackathon project submissions, prize wins, team collaborations, and prototype showcases',
    scopes: ['projects:read', 'hackathons:read'],
    assignedAgents: ['PortfolioAgent', 'ResumeBuilderAgent'],
  },
  {
    id: 'leetcode',
    name: 'LeetCode Profile',
    provider: 'composio',
    composioApp: 'leetcode',
    category: 'Career & ATS',
    protocol: 'OAuth 2.0',
    description:
      'Verified algorithmic problem solutions, contest ratings, badge milestones, and submission graphs',
    scopes: ['profile:read', 'submissions:read'],
    assignedAgents: ['ResumeBuilderAgent', 'CareerStrategyAgent'],
  },
  {
    id: 'codeforces',
    name: 'Codeforces Profile',
    provider: 'composio',
    composioApp: 'codeforces',
    category: 'Career & ATS',
    protocol: 'REST API',
    description:
      'Competitive programming ratings, division ranks, contest history, and problem solve counts',
    scopes: ['user.rating', 'user.status'],
    assignedAgents: ['ResumeBuilderAgent'],
  },
  {
    id: 'kaggle',
    name: 'Kaggle Data Science',
    provider: 'composio',
    composioApp: 'kaggle',
    category: 'Career & ATS',
    protocol: 'REST API',
    description:
      'Machine learning competitions, grandmaster tier rank, public datasets, and notebook kernels',
    scopes: ['competitions:read', 'datasets:read'],
    assignedAgents: ['PortfolioAgent', 'ResumeBuilderAgent'],
  },
  {
    id: 'wellfound',
    name: 'Wellfound (AngelList)',
    provider: 'composio',
    composioApp: 'wellfound',
    category: 'Career & ATS',
    protocol: 'OAuth 2.0',
    description:
      'Venture-backed startup recruiting, candidate pitches, equity compensation, and founder job leads',
    scopes: ['profile:read', 'applications:read'],
    assignedAgents: ['JobSearchAgent', 'ApplicationAgent'],
  },
  {
    id: 'indeed',
    name: 'Indeed Career Hub',
    provider: 'composio',
    composioApp: 'indeed',
    category: 'Career & ATS',
    protocol: 'OAuth 2.0',
    description:
      'Global employment aggregator, application statuses, job alerts, and employer messaging',
    scopes: ['applicant.read', 'jobs.search'],
    assignedAgents: ['JobSearchAgent'],
  },
  {
    id: 'ziprecruiter',
    name: 'ZipRecruiter Jobs',
    provider: 'composio',
    composioApp: 'ziprecruiter',
    category: 'Career & ATS',
    protocol: 'REST API',
    description:
      'Curated job match feeds, one-click applicant updates, and recruiter view notifications',
    scopes: ['jobs:read', 'alerts:read'],
    assignedAgents: ['JobSearchAgent'],
  },
  {
    id: 'handshake',
    name: 'Handshake Early Career',
    provider: 'composio',
    composioApp: 'handshake',
    category: 'Career & ATS',
    protocol: 'OAuth 2.0',
    description:
      'University recruiting, student career fairs, internships, and campus employer networks',
    scopes: ['student:read', 'applications:read'],
    assignedAgents: ['CareerStrategyAgent', 'JobSearchAgent'],
  },
  {
    id: 'glassdoor',
    name: 'Glassdoor Reviews & Salaries',
    provider: 'composio',
    composioApp: 'glassdoor',
    category: 'Career & ATS',
    protocol: 'REST API',
    description:
      'Verified compensation benchmarks, interview review questions, and company cultural sentiment',
    scopes: ['salaries:read', 'interviews:read'],
    assignedAgents: ['CompanyResearchAgent', 'CareerStrategyAgent'],
  },
  {
    id: 'credly',
    name: 'Credly Digital Badges',
    provider: 'composio',
    composioApp: 'credly',
    category: 'Career & ATS',
    protocol: 'OAuth 2.0',
    description:
      'Verified industry certifications, digital badges (AWS, Cisco, CompTIA), and skill credentials',
    scopes: ['badges:read', 'skills:read'],
    assignedAgents: ['ResumeBuilderAgent', 'CareerStrategyAgent'],
  },
  {
    id: 'dribbble',
    name: 'Dribbble Portfolio',
    provider: 'composio',
    composioApp: 'dribbble',
    category: 'Career & ATS',
    protocol: 'OAuth 2.0',
    description:
      'Design shots, animated interaction prototypes, creative portfolios, and follower appreciation',
    scopes: ['public', 'shots:read'],
    assignedAgents: ['PortfolioAgent', 'BrandingAgent'],
  },
  {
    id: 'behance',
    name: 'Adobe Behance',
    provider: 'composio',
    composioApp: 'behance',
    category: 'Career & ATS',
    protocol: 'OAuth 2.0',
    description:
      'Full design case studies, branding campaigns, creative direction, and peer project appreciations',
    scopes: ['project_read', 'user_read'],
    assignedAgents: ['PortfolioAgent', 'BrandingAgent'],
  },
  {
    id: 'polywork',
    name: 'Polywork Multihyphenate',
    provider: 'composio',
    composioApp: 'polywork',
    category: 'Career & ATS',
    protocol: 'REST API',
    description:
      'Multi-disciplinary project timeline, podcast appearances, advisory roles, and speaking engagements',
    scopes: ['timeline:read', 'profile:read'],
    assignedAgents: ['PortfolioAgent', 'BrandingAgent'],
  },
  {
    id: 'stackoverflow',
    name: 'Stack Overflow Developer',
    provider: 'composio',
    composioApp: 'stackoverflow',
    category: 'Career & ATS',
    protocol: 'OAuth 2.0',
    description:
      'Verified reputation score, top tag badges, accepted answers, and community architecture insight',
    scopes: ['read_inbox', 'no_expiry'],
    assignedAgents: ['ResumeBuilderAgent', 'CareerStrategyAgent'],
  },
  {
    id: 'replit',
    name: 'Replit Cloud Workspace',
    provider: 'composio',
    composioApp: 'replit',
    category: 'Career & ATS',
    protocol: 'REST API',
    description:
      'Interactive cloud sandboxes, published repl apps, live bounties, and prototype demos',
    scopes: ['repls:read', 'profile:read'],
    assignedAgents: ['PortfolioAgent', 'CodeReviewAgent'],
  },
  {
    id: 'codepen',
    name: 'CodePen Creative Web',
    provider: 'composio',
    composioApp: 'codepen',
    category: 'Career & ATS',
    protocol: 'REST API',
    description:
      'HTML/CSS/WebGL frontend demonstrations, popular pens, and UI component experiments',
    scopes: ['pens:read', 'profile:read'],
    assignedAgents: ['PortfolioAgent', 'DesignSystemAgent'],
  },
  {
    id: 'npm',
    name: 'NPM Registry Author',
    provider: 'composio',
    composioApp: 'npm',
    category: 'Career & ATS',
    protocol: 'REST API',
    description:
      'Published open-source packages, weekly download metrics, semver releases, and maintainer profile',
    scopes: ['packages:read'],
    assignedAgents: ['ResumeBuilderAgent', 'PortfolioAgent'],
  },
  {
    id: 'pypi',
    name: 'PyPI Python Index',
    provider: 'composio',
    composioApp: 'pypi',
    category: 'Career & ATS',
    protocol: 'REST API',
    description:
      'Published Python packages, release histories, documentation links, and maintainer reputation',
    scopes: ['packages:read'],
    assignedAgents: ['ResumeBuilderAgent', 'PortfolioAgent'],
  },
  {
    id: 'dockerhub',
    name: 'Docker Hub Registry',
    provider: 'composio',
    composioApp: 'dockerhub',
    category: 'Career & ATS',
    protocol: 'REST API',
    description:
      'Public container repositories, star ratings, pull counts, and automated container build badges',
    scopes: ['repositories:read'],
    assignedAgents: ['PortfolioAgent'],
  },
  {
    id: 'huggingface',
    name: 'Hugging Face Hub',
    provider: 'composio',
    composioApp: 'huggingface',
    category: 'Career & ATS',
    protocol: 'OAuth 2.0',
    description:
      'Published open-weights ML models, curated datasets, and interactive Gradio Spaces',
    scopes: ['models:read', 'datasets:read', 'spaces:read'],
    assignedAgents: ['PortfolioAgent', 'CareerStrategyAgent'],
  },
  {
    id: 'native-ats-mcp',
    name: 'Public ATS Job Search MCP',
    provider: 'mcp',
    mcpServerId: 'job-search-mcp',
    category: 'Career & ATS',
    protocol: 'MCP (stdio)',
    description:
      'Zero-key live job crawler across Greenhouse, Lever, and Ashby boards without API keys',
    scopes: ['ats:crawler', 'jobs:public_read', 'ssrf:guarded'],
    assignedAgents: ['JobSearchAgent', 'ApplicationAgent'],
    isTop: true,
  },
  {
    id: 'native-browser',
    name: 'Browser Scraper (Playwright)',
    provider: 'native',
    category: 'Career & ATS',
    protocol: 'Native Sovereign',
    description:
      'SSRF-guarded headless Chromium browser for live job posting verification and company insights',
    scopes: ['browser:headless', 'quota:20_per_hour', 'ip_enforce:global'],
    assignedAgents: ['JobSearchAgent', 'CompanyResearchAgent'],
    isTop: true,
  },
  {
    id: 'smartrecruiters',
    name: 'SmartRecruiters Talent',
    provider: 'composio',
    composioApp: 'smartrecruiters',
    category: 'Career & ATS',
    protocol: 'OAuth 2.0',
    description:
      'Enterprise hiring platform, requisition management, candidate scoring, and offer letter sync',
    scopes: ['candidates:read', 'jobs:read'],
    assignedAgents: ['ApplicationAgent'],
  },
  {
    id: 'workable',
    name: 'Workable Hiring Platform',
    provider: 'composio',
    composioApp: 'workable',
    category: 'Career & ATS',
    protocol: 'OAuth 2.0',
    description:
      'Applicant pipeline tracking, interview scorecards, and multi-board job syndication feeds',
    scopes: ['jobs:read', 'candidates:read'],
    assignedAgents: ['ApplicationAgent', 'JobSearchAgent'],
  },
  {
    id: 'recruitee',
    name: 'Recruitee Collaborative Hiring',
    provider: 'composio',
    composioApp: 'recruitee',
    category: 'Career & ATS',
    protocol: 'OAuth 2.0',
    description:
      'Team interview loops, candidate pipelines, job requisitions, and recruitment analytics',
    scopes: ['candidates:read', 'offers:read'],
    assignedAgents: ['ApplicationAgent'],
  },
  {
    id: 'taleo',
    name: 'Oracle Taleo Cloud ATS',
    provider: 'composio',
    composioApp: 'taleo',
    category: 'Career & ATS',
    protocol: 'REST API',
    description:
      'Large enterprise recruitment architecture, regulatory compliance, and candidate profiles',
    scopes: ['requisitions:read', 'submissions:read'],
    assignedAgents: ['ApplicationAgent'],
  },
  {
    id: 'stripe',
    name: 'Stripe Payments & Billing',
    provider: 'composio',
    composioApp: 'stripe',
    category: 'Startup & Business',
    protocol: 'OAuth 2.0',
    description:
      'Query charges, refunds, customer subscriptions, recurring billing invoices, and MRR metrics',
    scopes: ['read_only', 'invoices:read', 'charges:read'],
    assignedAgents: ['FinanceAdvisorAgent', 'BillingAuditAgent'],
    isTop: true,
  },
  {
    id: 'mercury',
    name: 'Mercury Startup Banking',
    provider: 'composio',
    composioApp: 'mercury',
    category: 'Startup & Business',
    protocol: 'OAuth 2.0',
    description:
      'FDIC-insured checking accounts, treasury yields, runway calculations, and wire transactions',
    scopes: ['accounts:read', 'transactions:read'],
    assignedAgents: ['FinanceAdvisorAgent', 'ExecutiveStrategyAgent'],
    isTrending: true,
  },
  {
    id: 'brex',
    name: 'Brex Corporate Spend',
    provider: 'composio',
    composioApp: 'brex',
    category: 'Startup & Business',
    protocol: 'OAuth 2.0',
    description:
      'Corporate card balances, employee spend limits, expense receipts, and runway tracking',
    scopes: ['accounts:read', 'expenses:read'],
    assignedAgents: ['FinanceAdvisorAgent'],
  },
  {
    id: 'ramp',
    name: 'Ramp Finance & Cards',
    provider: 'composio',
    composioApp: 'ramp',
    category: 'Startup & Business',
    protocol: 'OAuth 2.0',
    description:
      'Automated receipt capture, vendor contract renegotiation savings, and expense approvals',
    scopes: ['cards:read', 'transactions:read', 'reimbursements:read'],
    assignedAgents: ['FinanceAdvisorAgent'],
    isTrending: true,
  },
  {
    id: 'hubspot',
    name: 'HubSpot Inbound CRM',
    provider: 'composio',
    composioApp: 'hubspot',
    category: 'Startup & Business',
    protocol: 'OAuth 2.0',
    description:
      'CRM context, deal pipeline tracking, contact activity timelines, and email sequences',
    scopes: ['crm.objects.contacts.read', 'crm.objects.deals.read'],
    assignedAgents: ['ExecutiveStrategyAgent', 'OutreachAgent'],
    isTop: true,
  },
  {
    id: 'salesforce',
    name: 'Salesforce CRM & Customer 360',
    provider: 'composio',
    composioApp: 'salesforce',
    category: 'Startup & Business',
    protocol: 'OAuth 2.0',
    description:
      'Sync enterprise customer accounts, track sales opportunities, and run SOQL reports',
    scopes: ['api', 'refresh_token', 'offline_access'],
    assignedAgents: ['SalesExecutiveAgent', 'ClientOutreachAgent'],
  },
  {
    id: 'apollo',
    name: 'Apollo.io B2B Intelligence',
    provider: 'composio',
    composioApp: 'apollo',
    category: 'Startup & Business',
    protocol: 'OAuth 2.0',
    description:
      'Prospect contact discovery, verified work emails, buyer intent signals, and outbound sequences',
    scopes: ['contacts:search', 'emails:verify'],
    assignedAgents: ['SalesExecutiveAgent'],
  },
  {
    id: 'linear',
    name: 'Linear Product Tracking',
    provider: 'composio',
    composioApp: 'linear',
    category: 'Startup & Business',
    protocol: 'OAuth 2.0',
    description:
      'High-velocity issue tracking, engineering cycle management, and roadmap synchronization',
    scopes: ['issues:read', 'cycles:read', 'projects:read'],
    assignedAgents: ['SprintPlannerAgent', 'EngineeringLeadAgent'],
    isTop: true,
  },
  {
    id: 'attio',
    name: 'Attio Data-Driven CRM',
    provider: 'composio',
    composioApp: 'attio',
    category: 'Startup & Business',
    protocol: 'OAuth 2.0',
    description:
      'Real-time relationship intelligence, flexible data schemas, and modern founder CRM pipelines',
    scopes: ['records:read', 'lists:read'],
    assignedAgents: ['ExecutiveStrategyAgent', 'SalesExecutiveAgent'],
    isNew: true,
  },
  {
    id: 'close-crm',
    name: 'Close Inside Sales CRM',
    provider: 'composio',
    composioApp: 'close',
    category: 'Startup & Business',
    protocol: 'OAuth 2.0',
    description:
      'High-volume sales calling, automated email sequences, and deal pipeline forecasting',
    scopes: ['leads:read', 'opportunities:read'],
    assignedAgents: ['SalesExecutiveAgent'],
  },
  {
    id: 'gusto',
    name: 'Gusto Payroll & Benefits',
    provider: 'composio',
    composioApp: 'gusto',
    category: 'Startup & Business',
    protocol: 'OAuth 2.0',
    description:
      'Automated payroll runs, W-2 tax filings, employee health benefits, and contractor payments',
    scopes: ['payroll:read', 'company:read'],
    assignedAgents: ['FinanceAdvisorAgent', 'HRComplianceAgent'],
  },
  {
    id: 'deel',
    name: 'Deel Global Payroll',
    provider: 'composio',
    composioApp: 'deel',
    category: 'Startup & Business',
    protocol: 'OAuth 2.0',
    description:
      'International contractor agreements, EOR compliance, multi-currency invoices, and visa support',
    scopes: ['contracts:read', 'invoices:read', 'organizations:read'],
    assignedAgents: ['HRComplianceAgent', 'FinanceAdvisorAgent'],
    isTrending: true,
  },
  {
    id: 'remote',
    name: 'Remote Global HR & EOR',
    provider: 'composio',
    composioApp: 'remote',
    category: 'Startup & Business',
    protocol: 'OAuth 2.0',
    description:
      'Global employment contracts, statutory benefits compliance, and contractor management',
    scopes: ['employment:read', 'billing:read'],
    assignedAgents: ['HRComplianceAgent'],
  },
  {
    id: 'rippling',
    name: 'Rippling Workforce Platform',
    provider: 'composio',
    composioApp: 'rippling',
    category: 'Startup & Business',
    protocol: 'OAuth 2.0',
    description: 'Unified employee onboarding, IT device management, benefits, and payroll sync',
    scopes: ['employees:read', 'payroll:read'],
    assignedAgents: ['HRComplianceAgent'],
  },
  {
    id: 'plaid',
    name: 'Plaid Open Banking',
    provider: 'composio',
    composioApp: 'plaid',
    category: 'Startup & Business',
    protocol: 'REST API',
    description:
      'Secure financial institution authentication, real-time balance checks, and transaction sync',
    scopes: ['transactions', 'auth', 'balance'],
    assignedAgents: ['FinanceAdvisorAgent'],
  },
  {
    id: 'wise',
    name: 'Wise Multi-Currency',
    provider: 'composio',
    composioApp: 'wise',
    category: 'Startup & Business',
    protocol: 'OAuth 2.0',
    description:
      'Low-fee mid-market international exchange rates, cross-border vendor payments, and balances',
    scopes: ['transfers:read', 'balances:read'],
    assignedAgents: ['FinanceAdvisorAgent'],
  },
  {
    id: 'paypal',
    name: 'PayPal Commerce',
    provider: 'composio',
    composioApp: 'paypal',
    category: 'Startup & Business',
    protocol: 'OAuth 2.0',
    description:
      'Merchant checkout transactions, dispute resolutions, subscription billing, and payouts',
    scopes: ['payment:read', 'invoicing:read'],
    assignedAgents: ['FinanceAdvisorAgent'],
  },
  {
    id: 'square',
    name: 'Square Point of Sale',
    provider: 'composio',
    composioApp: 'square',
    category: 'Startup & Business',
    protocol: 'OAuth 2.0',
    description:
      'In-person payments, inventory catalogs, daily settlement reports, and customer orders',
    scopes: ['PAYMENTS_READ', 'ITEMS_READ'],
    assignedAgents: ['FinanceAdvisorAgent'],
  },
  {
    id: 'carta',
    name: 'Carta Cap Table & Equity',
    provider: 'composio',
    composioApp: 'carta',
    category: 'Startup & Business',
    protocol: 'OAuth 2.0',
    description:
      'Cap table ownership percentages, 409A valuations, stock option grants, and SAFE records',
    scopes: ['captable:read', 'equity:read'],
    assignedAgents: ['ExecutiveStrategyAgent', 'FinanceAdvisorAgent'],
  },
  {
    id: 'pulley',
    name: 'Pulley Cap Table',
    provider: 'composio',
    composioApp: 'pulley',
    category: 'Startup & Business',
    protocol: 'OAuth 2.0',
    description: 'Founder cap table modeling, SAFEs, option pools, and investor updates',
    scopes: ['equity:read', 'transactions:read'],
    assignedAgents: ['ExecutiveStrategyAgent', 'FinanceAdvisorAgent'],
  },
  {
    id: 'quickbooks',
    name: 'Intuit QuickBooks Online',
    provider: 'composio',
    composioApp: 'quickbooks',
    category: 'Startup & Business',
    protocol: 'OAuth 2.0',
    description: 'General ledger, accounts receivable, balance sheets, and tax reports',
    scopes: ['com.intuit.quickbooks.accounting'],
    assignedAgents: ['FinanceAdvisorAgent', 'BillingAuditAgent'],
  },
  {
    id: 'xero',
    name: 'Xero Cloud Accounting',
    provider: 'composio',
    composioApp: 'xero',
    category: 'Startup & Business',
    protocol: 'OAuth 2.0',
    description: 'Bank feeds, invoicing, expense claims, and financial reporting',
    scopes: ['accounting.transactions.read', 'accounting.reports.read'],
    assignedAgents: ['FinanceAdvisorAgent'],
  },
  {
    id: 'pipedrive',
    name: 'Pipedrive Sales CRM',
    provider: 'composio',
    composioApp: 'pipedrive',
    category: 'Startup & Business',
    protocol: 'OAuth 2.0',
    description: 'Visual sales pipeline stages, deal probabilities, and customer contact histories',
    scopes: ['deals:read', 'contacts:read'],
    assignedAgents: ['SalesExecutiveAgent'],
  },
  {
    id: 'copper-crm',
    name: 'Copper Workspace CRM',
    provider: 'composio',
    composioApp: 'copper',
    category: 'Startup & Business',
    protocol: 'OAuth 2.0',
    description:
      'Google Workspace-native customer management, Gmail conversation linking, and deal forecasting',
    scopes: ['leads:read', 'opportunities:read'],
    assignedAgents: ['SalesExecutiveAgent'],
  },
  {
    id: 'zoho-crm',
    name: 'Zoho CRM Enterprise',
    provider: 'composio',
    composioApp: 'zoho',
    category: 'Startup & Business',
    protocol: 'OAuth 2.0',
    description:
      'Omnichannel customer relationship tracking, sales blueprint automation, and pipeline analytics',
    scopes: ['ZohoCRM.modules.ALL'],
    assignedAgents: ['SalesExecutiveAgent'],
  },
  {
    id: 'freshsales',
    name: 'Freshworks Freshsales',
    provider: 'composio',
    composioApp: 'freshsales',
    category: 'Startup & Business',
    protocol: 'OAuth 2.0',
    description: 'AI-powered contact scoring, deal insights, and multi-channel sales communication',
    scopes: ['contacts:read', 'deals:read'],
    assignedAgents: ['SalesExecutiveAgent'],
  },
  {
    id: 'outreach',
    name: 'Outreach Sales Execution',
    provider: 'composio',
    composioApp: 'outreach',
    category: 'Startup & Business',
    protocol: 'OAuth 2.0',
    description:
      'Enterprise sales cadence automation, call recordings, and buyer engagement signals',
    scopes: ['prospects.read', 'sequences.read'],
    assignedAgents: ['SalesExecutiveAgent'],
  },
  {
    id: 'salesloft',
    name: 'Salesloft Revenue Platform',
    provider: 'composio',
    composioApp: 'salesloft',
    category: 'Startup & Business',
    protocol: 'OAuth 2.0',
    description: 'Deal intelligence, conversation transcription, and customer rhythm sequencing',
    scopes: ['cadences:read', 'people:read'],
    assignedAgents: ['SalesExecutiveAgent'],
  },
  {
    id: 'zoominfo',
    name: 'ZoomInfo Enterprise',
    provider: 'composio',
    composioApp: 'zoominfo',
    category: 'Startup & Business',
    protocol: 'OAuth 2.0',
    description:
      'Org charts, company buyer intent signals, verified phone numbers, and technographic data',
    scopes: ['intent:read', 'org:read'],
    assignedAgents: ['SalesExecutiveAgent'],
  },
  {
    id: 'clearbit',
    name: 'Clearbit Data Enrichment',
    provider: 'composio',
    composioApp: 'clearbit',
    category: 'Startup & Business',
    protocol: 'REST API',
    description:
      'Real-time company domain intelligence, employee counts, tech stack detection, and job titles',
    scopes: ['enrichment:read'],
    assignedAgents: ['CompanyResearchAgent', 'SalesExecutiveAgent'],
  },
  {
    id: 'clay',
    name: 'Clay Data & Outbound',
    provider: 'composio',
    composioApp: 'clay',
    category: 'Startup & Business',
    protocol: 'REST API',
    description:
      '100+ enrichment providers in one spreadsheet, personalized outreach formulas, and prospect scraping',
    scopes: ['tables:read', 'enrichment:execute'],
    assignedAgents: ['SalesExecutiveAgent'],
    isNew: true,
  },
  {
    id: 'docusign',
    name: 'DocuSign Agreement Cloud',
    provider: 'composio',
    composioApp: 'docusign',
    category: 'Startup & Business',
    protocol: 'OAuth 2.0',
    description:
      'eSignature envelope status, legal signer completion timestamps, and audit certificates',
    scopes: ['signature', 'extended'],
    assignedAgents: ['ExecutiveStrategyAgent'],
  },
  {
    id: 'pandadoc',
    name: 'PandaDoc eSign & Proposals',
    provider: 'composio',
    composioApp: 'pandadoc',
    category: 'Startup & Business',
    protocol: 'OAuth 2.0',
    description:
      'Sales proposals, customer quotes, NDA contracts, and legally binding digital signatures',
    scopes: ['documents:read'],
    assignedAgents: ['SalesExecutiveAgent'],
  },
  {
    id: 'ironclad',
    name: 'Ironclad Contract Lifecycle',
    provider: 'composio',
    composioApp: 'ironclad',
    category: 'Startup & Business',
    protocol: 'OAuth 2.0',
    description:
      'Enterprise contract repository, clause metadata, approval workflows, and master service agreements',
    scopes: ['records:read', 'workflows:read'],
    assignedAgents: ['ExecutiveStrategyAgent'],
  },
  {
    id: 'contractbook',
    name: 'Contractbook Automation',
    provider: 'composio',
    composioApp: 'contractbook',
    category: 'Startup & Business',
    protocol: 'OAuth 2.0',
    description:
      'Data-driven contracts, automated negotiation reminders, and digital document execution',
    scopes: ['contracts:read'],
    assignedAgents: ['ExecutiveStrategyAgent'],
  },
  {
    id: 'clerky',
    name: 'Clerky Startup Legal',
    provider: 'composio',
    composioApp: 'clerky',
    category: 'Startup & Business',
    protocol: 'REST API',
    description: 'Delaware C-Corp formation documents, 83(b) election forms, and board consents',
    scopes: ['documents:read'],
    assignedAgents: ['ExecutiveStrategyAgent'],
  },
  {
    id: 'shopify',
    name: 'Shopify Storefront & Admin',
    provider: 'composio',
    composioApp: 'shopify',
    category: 'Startup & Business',
    protocol: 'OAuth 2.0',
    description:
      'E-Commerce catalog, customer orders, inventory levels, refund rates, and store analytics',
    scopes: ['read_products', 'read_orders'],
    assignedAgents: ['FinanceAdvisorAgent'],
  },
  {
    id: 'google-drive',
    name: 'Google Drive',
    provider: 'drive',
    category: 'Productivity & Study',
    protocol: 'OAuth 2.0',
    description: 'Search, read, and upload files instantly with zero-trust tenant boundaries',
    scopes: ['drive.readonly', 'files.read'],
    assignedAgents: ['DocumentIngestionAgent', 'ResumeBuilderAgent'],
    isTop: true,
  },
  {
    id: 'google-docs',
    name: 'Google Docs Collaboration',
    provider: 'drive',
    category: 'Productivity & Study',
    protocol: 'OAuth 2.0',
    description:
      'Live document editing, collaborative comments, revision history, and text formatting',
    scopes: ['documents.readonly'],
    assignedAgents: ['DocumentIngestionAgent', 'ResumeBuilderAgent'],
  },
  {
    id: 'google-sheets',
    name: 'Google Sheets Analytics',
    provider: 'drive',
    category: 'Productivity & Study',
    protocol: 'OAuth 2.0',
    description:
      'Spreadsheet formula parsing, tabular record queries, cell values, and financial sheets',
    scopes: ['spreadsheets.readonly'],
    assignedAgents: ['KnowledgeGraphAgent', 'FinanceAdvisorAgent'],
  },
  {
    id: 'google-slides',
    name: 'Google Slides Presentations',
    provider: 'drive',
    category: 'Productivity & Study',
    protocol: 'OAuth 2.0',
    description:
      'Slide deck layouts, speaker notes, presentation export, and visual slide outlines',
    scopes: ['presentations.readonly'],
    assignedAgents: ['BrandingAgent', 'PortfolioAgent'],
  },
  {
    id: 'notion',
    name: 'Notion Workspace',
    provider: 'notion',
    category: 'Productivity & Study',
    protocol: 'OAuth 2.0',
    description:
      'Connect your Notion workspace to search, update, and power workflows across databases and docs',
    scopes: ['notion:read', 'pages:read'],
    assignedAgents: ['KnowledgeGraphAgent', 'CareerStrategyAgent'],
    isTop: true,
  },
  {
    id: 'obsidian',
    name: 'Obsidian Vault Sovereign',
    provider: 'native',
    category: 'Productivity & Study',
    protocol: 'Native Sovereign',
    description:
      'Local bi-directional markdown link graph, frontmatter metadata, and private canvas boards',
    scopes: ['vault:read', 'files:local'],
    assignedAgents: ['KnowledgeGraphAgent'],
    isTrending: true,
  },
  {
    id: 'airtable',
    name: 'Airtable Bases & Apps',
    provider: 'composio',
    composioApp: 'airtable',
    category: 'Productivity & Study',
    protocol: 'OAuth 2.0',
    description:
      'Relational spreadsheets, custom views, linked records, and automated workspace sync',
    scopes: ['data.records:read', 'schema.bases:read'],
    assignedAgents: ['KnowledgeGraphAgent'],
  },
  {
    id: 'coda',
    name: 'Coda Interactive Docs',
    provider: 'composio',
    composioApp: 'coda',
    category: 'Productivity & Study',
    protocol: 'OAuth 2.0',
    description:
      'Interactive document tables, embedded buttons, custom formulas, and canvas workflows',
    scopes: ['docs:read'],
    assignedAgents: ['KnowledgeGraphAgent'],
  },
  {
    id: 'miro',
    name: 'Miro Visual Workspace',
    provider: 'composio',
    composioApp: 'miro',
    category: 'Productivity & Study',
    protocol: 'OAuth 2.0',
    description:
      'Digital whiteboards, architecture flowcharts, sticky notes, and sprint retro boards',
    scopes: ['boards:read'],
    assignedAgents: ['DesignSystemAgent', 'SprintPlannerAgent'],
  },
  {
    id: 'canva',
    name: 'Canva Brand Design',
    provider: 'composio',
    composioApp: 'canva',
    category: 'Productivity & Study',
    protocol: 'OAuth 2.0',
    description:
      'Search, create, autofill, and export Canva designs, pitch decks, and brand templates',
    scopes: ['design:read', 'design:export'],
    assignedAgents: ['PortfolioAgent', 'BrandingAgent'],
    isTop: true,
  },
  {
    id: 'figma',
    name: 'Figma Design Systems',
    provider: 'composio',
    composioApp: 'figma',
    category: 'Productivity & Study',
    protocol: 'OAuth 2.0',
    description:
      'Generate design tokens, component hierarchies, and clean code from Figma canvas context',
    scopes: ['files:read', 'components:read'],
    assignedAgents: ['DesignSystemAgent', 'CodeGeneratorAgent'],
    isTop: true,
  },
  {
    id: 'microsoft-365',
    name: 'Microsoft 365 Enterprise',
    provider: 'composio',
    composioApp: 'microsoft-365',
    category: 'Productivity & Study',
    protocol: 'OAuth 2.0',
    description:
      'SharePoint document libraries, OneDrive sync, Outlook mail, and Teams enterprise suite',
    scopes: ['Files.Read.All', 'Mail.Read', 'Calendars.Read'],
    assignedAgents: ['EnterpriseIngestionAgent', 'DocumentAuditAgent'],
    isTop: true,
  },
  {
    id: 'confluence',
    name: 'Confluence Enterprise Wiki',
    provider: 'composio',
    composioApp: 'confluence',
    category: 'Productivity & Study',
    protocol: 'OAuth 2.0',
    description:
      'Enterprise engineering wiki pages, technical architecture documents, and team spaces',
    scopes: ['read:confluence-space', 'read:confluence-content.all'],
    assignedAgents: ['KnowledgeGraphAgent'],
  },
  {
    id: 'asana',
    name: 'Asana Collaborative Projects',
    provider: 'composio',
    composioApp: 'asana',
    category: 'Productivity & Study',
    protocol: 'OAuth 2.0',
    description:
      'Cross-functional task management, milestone timelines, custom fields, and team workloads',
    scopes: ['tasks:read', 'projects:read'],
    assignedAgents: ['TaskTrackerAgent'],
  },
  {
    id: 'clickup',
    name: 'ClickUp 3.0 Platform',
    provider: 'composio',
    composioApp: 'clickup',
    category: 'Productivity & Study',
    protocol: 'OAuth 2.0',
    description: 'All-in-one productivity suite, docs, sprint checklists, and time tracking logs',
    scopes: ['tasks:read', 'folders:read'],
    assignedAgents: ['TaskTrackerAgent'],
  },
  {
    id: 'monday',
    name: 'Monday.com Work OS',
    provider: 'composio',
    composioApp: 'monday',
    category: 'Productivity & Study',
    protocol: 'OAuth 2.0',
    description: 'Custom workflow boards, column formula values, and multi-team task assignments',
    scopes: ['boards:read', 'updates:read'],
    assignedAgents: ['TaskTrackerAgent'],
  },
  {
    id: 'trello',
    name: 'Trello Kanban',
    provider: 'composio',
    composioApp: 'trello',
    category: 'Productivity & Study',
    protocol: 'OAuth 2.0',
    description: 'Kanban cards, checklists, power-ups, and automated board movement triggers',
    scopes: ['read', 'account'],
    assignedAgents: ['TaskTrackerAgent'],
  },
  {
    id: 'basecamp',
    name: 'Basecamp Project Management',
    provider: 'composio',
    composioApp: 'basecamp',
    category: 'Productivity & Study',
    protocol: 'OAuth 2.0',
    description: 'Campfires, message boards, to-do lists, schedule events, and check-in prompts',
    scopes: ['read'],
    assignedAgents: ['TaskTrackerAgent'],
  },
  {
    id: 'todoist',
    name: 'Todoist Daily Tasks',
    provider: 'composio',
    composioApp: 'todoist',
    category: 'Productivity & Study',
    protocol: 'OAuth 2.0',
    description:
      'Natural language task scheduling, karma goals, priority flags, and recurring reminders',
    scopes: ['data:read'],
    assignedAgents: ['ExecutiveAssistantAgent'],
  },
  {
    id: 'ticktick',
    name: 'TickTick ToDo & Pomodoro',
    provider: 'composio',
    composioApp: 'ticktick',
    category: 'Productivity & Study',
    protocol: 'OAuth 2.0',
    description:
      'Calendar view time blocking, Pomodoro focus records, habit logs, and folder hierarchies',
    scopes: ['tasks:read'],
    assignedAgents: ['ExecutiveAssistantAgent'],
  },
  {
    id: 'roam-research',
    name: 'Roam Research Bi-Directional Graph',
    provider: 'composio',
    composioApp: 'roam',
    category: 'Productivity & Study',
    protocol: 'REST API',
    description: 'Networked thought graphs, daily notes log, and unlinked reference discovery',
    scopes: ['graph:read'],
    assignedAgents: ['KnowledgeGraphAgent'],
  },
  {
    id: 'logseq',
    name: 'Logseq Local Privacy Base',
    provider: 'native',
    category: 'Productivity & Study',
    protocol: 'Native Sovereign',
    description:
      'Privacy-first local outliner, PDF highlighting annotations, and Flashcard SRS reviews',
    scopes: ['local:fs'],
    assignedAgents: ['KnowledgeGraphAgent'],
  },
  {
    id: 'bear',
    name: 'Bear Markdown Notes',
    provider: 'native',
    category: 'Productivity & Study',
    protocol: 'Native Sovereign',
    description: 'Markdown text editor, nested tag hierarchies, and encrypted export backups',
    scopes: ['notes:read'],
    assignedAgents: ['KnowledgeGraphAgent'],
  },
  {
    id: 'craft',
    name: 'Craft Visual Docs',
    provider: 'composio',
    composioApp: 'craft',
    category: 'Productivity & Study',
    protocol: 'OAuth 2.0',
    description: 'Structured block documents, visual cards, deep links, and shared web spaces',
    scopes: ['spaces:read'],
    assignedAgents: ['KnowledgeGraphAgent'],
  },
  {
    id: 'evernote',
    name: 'Evernote Personal Organizer',
    provider: 'composio',
    composioApp: 'evernote',
    category: 'Productivity & Study',
    protocol: 'OAuth 2.0',
    description: 'Web clippings, handwritten OCR search, audio notes, and notebook hierarchies',
    scopes: ['notes:read'],
    assignedAgents: ['KnowledgeGraphAgent'],
  },
  {
    id: 'slite',
    name: 'Slite AI Team Docs',
    provider: 'composio',
    composioApp: 'slite',
    category: 'Productivity & Study',
    protocol: 'OAuth 2.0',
    description: 'Clean team knowledge base, AI search verification, and decision registers',
    scopes: ['channels:read', 'notes:read'],
    assignedAgents: ['KnowledgeGraphAgent'],
  },
  {
    id: 'guru',
    name: 'Guru Enterprise Knowledge',
    provider: 'composio',
    composioApp: 'guru',
    category: 'Productivity & Study',
    protocol: 'OAuth 2.0',
    description:
      'Verified knowledge cards, team SME verification intervals, and contextual answers',
    scopes: ['cards:read'],
    assignedAgents: ['KnowledgeGraphAgent'],
  },
  {
    id: 'canvas-lms',
    name: 'Canvas LMS Higher Ed',
    provider: 'composio',
    composioApp: 'canvas',
    category: 'Productivity & Study',
    protocol: 'OAuth 2.0',
    description:
      'University courses, syllabi, assignments, student submissions, and grading records',
    scopes: ['courses:read', 'assignments:read', 'grades:read'],
    assignedAgents: ['ExecutiveAssistantAgent', 'KnowledgeGraphAgent'],
  },
  {
    id: 'blackboard',
    name: 'Blackboard Learn Academic',
    provider: 'composio',
    composioApp: 'blackboard',
    category: 'Productivity & Study',
    protocol: 'OAuth 2.0',
    description:
      'Institutional course content, academic transcripts, announcements, and gradebooks',
    scopes: ['read:courses', 'read:grades'],
    assignedAgents: ['KnowledgeGraphAgent'],
  },
  {
    id: 'coursera',
    name: 'Coursera Enterprise Learning',
    provider: 'composio',
    composioApp: 'coursera',
    category: 'Productivity & Study',
    protocol: 'OAuth 2.0',
    description:
      'Professional certificates, course completions, verified university skills, and learning hours',
    scopes: ['user:certifications', 'user:courses'],
    assignedAgents: ['CareerStrategyAgent', 'ResumeBuilderAgent'],
  },
  {
    id: 'moodle',
    name: 'Moodle Modular Learning',
    provider: 'composio',
    composioApp: 'moodle',
    category: 'Productivity & Study',
    protocol: 'OAuth 2.0',
    description:
      'Modular learning platform, quiz evaluations, assignment feedback, and course modules',
    scopes: ['moodle/course:view', 'moodle/user:read'],
    assignedAgents: ['KnowledgeGraphAgent'],
  },
  {
    id: 'google-classroom',
    name: 'Google Classroom',
    provider: 'composio',
    composioApp: 'google_classroom',
    category: 'Productivity & Study',
    protocol: 'OAuth 2.0',
    description: 'Class assignments, teacher announcements, student rosters, and coursework grades',
    scopes: ['classroom.courses.readonly', 'classroom.coursework.me.readonly'],
    assignedAgents: ['ExecutiveAssistantAgent'],
  },
  {
    id: 'duolingo',
    name: 'Duolingo Language Fluency',
    provider: 'composio',
    composioApp: 'duolingo',
    category: 'Productivity & Study',
    protocol: 'OAuth 2.0',
    description:
      'Language proficiency milestones, CEFR fluency levels, daily practice streaks, and certificates',
    scopes: ['profile:read', 'achievements:read'],
    assignedAgents: ['ResumeBuilderAgent', 'CareerStrategyAgent'],
  },
  {
    id: 'edx',
    name: 'edX Academic Certificates',
    provider: 'composio',
    composioApp: 'edx',
    category: 'Productivity & Study',
    protocol: 'OAuth 2.0',
    description:
      'MicroBachelors, MicroMasters, and verified course completion certificates from MIT & Harvard',
    scopes: ['certificates:read', 'courses:read'],
    assignedAgents: ['ResumeBuilderAgent'],
  },
  {
    id: 'udemy',
    name: 'Udemy Business Courses',
    provider: 'composio',
    composioApp: 'udemy',
    category: 'Productivity & Study',
    protocol: 'OAuth 2.0',
    description:
      'Developer bootcamps, technical lectures, certification prep tests, and completed video hours',
    scopes: ['user:courses', 'user:progress'],
    assignedAgents: ['CareerStrategyAgent'],
  },
  {
    id: 'khan-academy',
    name: 'Khan Academy Mastery',
    provider: 'composio',
    composioApp: 'khan_academy',
    category: 'Productivity & Study',
    protocol: 'OAuth 2.0',
    description:
      'STEM mastery tracks, math and computer science problem sets, and badge achievements',
    scopes: ['profile:read', 'badges:read'],
    assignedAgents: ['KnowledgeGraphAgent'],
  },
  {
    id: 'zotero',
    name: 'Zotero Research Library',
    provider: 'composio',
    composioApp: 'zotero',
    category: 'Productivity & Study',
    protocol: 'OAuth 2.0',
    description:
      'Academic paper bibliographic metadata, BibTeX citations, research notes, and PDF attachments',
    scopes: ['library:read'],
    assignedAgents: ['KnowledgeGraphAgent'],
  },
  {
    id: 'overleaf',
    name: 'Overleaf LaTeX Projects',
    provider: 'composio',
    composioApp: 'overleaf',
    category: 'Productivity & Study',
    protocol: 'OAuth 2.0',
    description:
      'Collaborative scientific manuscripts, LaTeX resume source code, and IEEE/ACM paper templates',
    scopes: ['projects:read'],
    assignedAgents: ['ResumeBuilderAgent', 'PortfolioAgent'],
  },
  {
    id: 'dropbox',
    name: 'Dropbox Enterprise Storage',
    provider: 'composio',
    composioApp: 'dropbox',
    category: 'Productivity & Study',
    protocol: 'OAuth 2.0',
    description: 'Cloud file sync, shared folders, paper documents, and preview links',
    scopes: ['files.content.read', 'files.metadata.read'],
    assignedAgents: ['DocumentIngestionAgent'],
  },
  {
    id: 'box',
    name: 'Box Cloud Content',
    provider: 'composio',
    composioApp: 'box',
    category: 'Productivity & Study',
    protocol: 'OAuth 2.0',
    description:
      'Secure enterprise content management, governance retention rules, and metadata tags',
    scopes: ['root_readonly'],
    assignedAgents: ['DocumentIngestionAgent'],
  },
  {
    id: 'aws-s3',
    name: 'AWS S3 Storage',
    provider: 'mcp',
    category: 'Developer Tools & Cloud',
    protocol: 'MCP (stdio)',
    description:
      'Bucket object enumeration, pre-signed URL verification, and enterprise document reads',
    scopes: ['s3:GetObject', 's3:ListBucket'],
    assignedAgents: ['DocumentIngestionAgent'],
  },
  {
    id: 'aws-lambda',
    name: 'AWS Lambda Serverless',
    provider: 'mcp',
    category: 'Developer Tools & Cloud',
    protocol: 'MCP (stdio)',
    description:
      'Serverless function invocations, CloudWatch logs inspection, and event trigger analysis',
    scopes: ['lambda:GetFunction', 'lambda:ListFunctions'],
    assignedAgents: ['DevOpsAgent'],
  },
  {
    id: 'aws-ec2',
    name: 'AWS EC2 Compute',
    provider: 'composio',
    composioApp: 'aws',
    category: 'Developer Tools & Cloud',
    protocol: 'REST API',
    description:
      'Virtual machine instance telemetry, security group audit, and autoscaling metrics',
    scopes: ['ec2:DescribeInstances'],
    assignedAgents: ['DevOpsAgent'],
  },
  {
    id: 'bigquery',
    name: 'Google BigQuery Data Warehouse',
    provider: 'composio',
    composioApp: 'bigquery',
    category: 'Developer Tools & Cloud',
    protocol: 'OAuth 2.0',
    description:
      'Serverless enterprise cloud data warehouse queries, dataset schemas, and analytics jobs',
    scopes: ['bigquery.readonly', 'bigquery.jobs.create'],
    assignedAgents: ['DataEngineeringAgent'],
  },
  {
    id: 'gcp-cloud-storage',
    name: 'Google Cloud Storage',
    provider: 'composio',
    composioApp: 'gcp',
    category: 'Developer Tools & Cloud',
    protocol: 'OAuth 2.0',
    description:
      'GCS bucket object downloads, lifecycle policies, and uniform bucket-level access verification',
    scopes: ['devstorage.read_only'],
    assignedAgents: ['DocumentIngestionAgent'],
  },
  {
    id: 'azure-blob',
    name: 'Azure Blob Storage',
    provider: 'mcp',
    category: 'Developer Tools & Cloud',
    protocol: 'MCP (Streamable-HTTP)',
    description:
      'Enterprise blob containers, tiered archival storage, SAS tokens, and document pipelines',
    scopes: ['blob:read', 'container:list'],
    assignedAgents: ['DocumentIngestionAgent'],
  },
  {
    id: 'azure-devops',
    name: 'Azure DevOps Pipelines',
    provider: 'composio',
    composioApp: 'azure-devops',
    category: 'Developer Tools & Cloud',
    protocol: 'OAuth 2.0',
    description: 'CI/CD pipeline runs, work item boards, Git repos, and enterprise release gates',
    scopes: ['vso.build', 'vso.work'],
    assignedAgents: ['DevOpsAgent', 'TaskTrackerAgent'],
  },
  {
    id: 'cloudflare',
    name: 'Cloudflare Workers & Edge',
    provider: 'composio',
    composioApp: 'cloudflare',
    category: 'Developer Tools & Cloud',
    protocol: 'REST API',
    description:
      'Edge Workers, KV namespaces, D1 SQL databases, DNS records, and DDoS protection metrics',
    scopes: ['workers:read', 'dns:read'],
    assignedAgents: ['DevOpsAgent'],
    isTrending: true,
  },
  {
    id: 'digitalocean',
    name: 'DigitalOcean Droplets & Apps',
    provider: 'composio',
    composioApp: 'digitalocean',
    category: 'Developer Tools & Cloud',
    protocol: 'OAuth 2.0',
    description:
      'Droplet status, managed database clusters, App Platform deployments, and Spaces storage',
    scopes: ['read'],
    assignedAgents: ['DevOpsAgent'],
  },
  {
    id: 'fly-io',
    name: 'Fly.io Global Edge',
    provider: 'composio',
    composioApp: 'fly',
    category: 'Developer Tools & Cloud',
    protocol: 'REST API',
    description:
      'Global microVM orchestrations, edge proxy latency logs, and multi-region Postgres health',
    scopes: ['apps:read', 'machines:read'],
    assignedAgents: ['DevOpsAgent'],
  },
  {
    id: 'railway',
    name: 'Railway Infrastructure',
    provider: 'composio',
    composioApp: 'railway',
    category: 'Developer Tools & Cloud',
    protocol: 'REST API',
    description:
      'Project environments, instant database provisioning, ephemeral PR environments, and deployments',
    scopes: ['project:read', 'deployments:read'],
    assignedAgents: ['DevOpsAgent'],
  },
  {
    id: 'render',
    name: 'Render Unified Cloud',
    provider: 'composio',
    composioApp: 'render',
    category: 'Developer Tools & Cloud',
    protocol: 'REST API',
    description:
      'Web service deployments, static site builds, cron jobs, and private service networking',
    scopes: ['services:read', 'deploys:read'],
    assignedAgents: ['DevOpsAgent'],
  },
  {
    id: 'vercel',
    name: 'Vercel Deployments & Edge',
    provider: 'composio',
    composioApp: 'vercel',
    category: 'Developer Tools & Cloud',
    protocol: 'OAuth 2.0',
    description:
      'Preview deployments, edge network metrics, environment variables, and build performance',
    scopes: ['deployments:read', 'projects:read'],
    assignedAgents: ['DevOpsAgent'],
    isTop: true,
  },
  {
    id: 'netlify',
    name: 'Netlify Edge & Web',
    provider: 'composio',
    composioApp: 'netlify',
    category: 'Developer Tools & Cloud',
    protocol: 'OAuth 2.0',
    description:
      'Continuous deployment hooks, serverless edge functions, form handling, and split testing',
    scopes: ['sites:read', 'deploys:read'],
    assignedAgents: ['DevOpsAgent'],
  },
  {
    id: 'supabase',
    name: 'Supabase Postgres Platform',
    provider: 'composio',
    composioApp: 'supabase',
    category: 'Developer Tools & Cloud',
    protocol: 'OAuth 2.0',
    description:
      'Postgres database, pgvector embeddings, storage buckets, and row-level security audits',
    scopes: ['database:read', 'storage:read'],
    assignedAgents: ['BackendSecurityAgent'],
    isTop: true,
  },
  {
    id: 'neon',
    name: 'Neon Serverless Postgres',
    provider: 'composio',
    composioApp: 'neon',
    category: 'Developer Tools & Cloud',
    protocol: 'OAuth 2.0',
    description:
      'Serverless branching database, instant point-in-time recovery, autoscaling compute, and SQL',
    scopes: ['projects:read', 'branches:read'],
    assignedAgents: ['DataEngineeringAgent'],
    isTrending: true,
  },
  {
    id: 'planetscale',
    name: 'PlanetScale MySQL',
    provider: 'composio',
    composioApp: 'planetscale',
    category: 'Developer Tools & Cloud',
    protocol: 'OAuth 2.0',
    description:
      'Non-blocking schema migrations, branch databases, read replica routing, and Vitess scaling',
    scopes: ['databases:read', 'branches:read'],
    assignedAgents: ['DataEngineeringAgent'],
  },
  {
    id: 'cockroachdb',
    name: 'CockroachDB Distributed SQL',
    provider: 'composio',
    composioApp: 'cockroach',
    category: 'Developer Tools & Cloud',
    protocol: 'REST API',
    description:
      'Global survivability, distributed ACID transactions, and cluster health monitoring',
    scopes: ['clusters:read'],
    assignedAgents: ['DataEngineeringAgent'],
  },
  {
    id: 'upstash',
    name: 'Upstash Serverless Data',
    provider: 'composio',
    composioApp: 'upstash',
    category: 'Developer Tools & Cloud',
    protocol: 'REST API',
    description: 'Serverless Redis caching, QStash message queuing, and serverless vector indexing',
    scopes: ['databases:read'],
    assignedAgents: ['DataEngineeringAgent'],
  },
  {
    id: 'turso',
    name: 'Turso Distributed SQLite',
    provider: 'composio',
    composioApp: 'turso',
    category: 'Developer Tools & Cloud',
    protocol: 'REST API',
    description:
      'libSQL edge database, microsecond query latency, and embedded replica synchronization',
    scopes: ['databases:read'],
    assignedAgents: ['DataEngineeringAgent'],
  },
  {
    id: 'postgresql',
    name: 'PostgreSQL Relational DB MCP',
    provider: 'mcp',
    category: 'Developer Tools & Cloud',
    protocol: 'MCP (stdio)',
    description:
      'Read-only introspective schema inspection, EXPLAIN plans, and verified SQL execution',
    scopes: ['db:read', 'schema:inspect'],
    assignedAgents: ['DataEngineeringAgent'],
    isTop: true,
  },
  {
    id: 'mysql',
    name: 'MySQL Enterprise Database',
    provider: 'mcp',
    category: 'Developer Tools & Cloud',
    protocol: 'MCP (stdio)',
    description:
      'Relational schema discovery, slow query log analysis, and index performance inspection',
    scopes: ['db:read', 'tables:inspect'],
    assignedAgents: ['DataEngineeringAgent'],
  },
  {
    id: 'redis',
    name: 'Redis In-Memory Cache',
    provider: 'mcp',
    category: 'Developer Tools & Cloud',
    protocol: 'MCP (stdio)',
    description:
      'In-memory key discovery, TTL inspect, memory footprint analysis, and cache invalidation',
    scopes: ['cache:read', 'keys:inspect'],
    assignedAgents: ['DevOpsAgent'],
  },
  {
    id: 'mongodb',
    name: 'MongoDB Atlas Cloud',
    provider: 'composio',
    composioApp: 'mongodb',
    category: 'Developer Tools & Cloud',
    protocol: 'OAuth 2.0',
    description: 'Document collection schemas, aggregation pipelines, and Atlas search indexes',
    scopes: ['clusters:read', 'collections:read'],
    assignedAgents: ['DataEngineeringAgent'],
  },
  {
    id: 'snowflake',
    name: 'Snowflake Data Cloud',
    provider: 'composio',
    composioApp: 'snowflake',
    category: 'Developer Tools & Cloud',
    protocol: 'OAuth 2.0',
    description:
      'Execute analytical warehouse queries, inspect database schemas, and compute credit usage',
    scopes: ['warehouse:usage', 'query:execute'],
    assignedAgents: ['DataEngineeringAgent'],
  },
  {
    id: 'databricks',
    name: 'Databricks Lakehouse',
    provider: 'composio',
    composioApp: 'databricks',
    category: 'Developer Tools & Cloud',
    protocol: 'OAuth 2.0',
    description:
      'Apache Spark clusters, Delta Lake tables, MLflow model registry, and notebook jobs',
    scopes: ['clusters:read', 'tables:read'],
    assignedAgents: ['DataEngineeringAgent'],
  },
  {
    id: 'clickhouse',
    name: 'ClickHouse Columnar DB',
    provider: 'composio',
    composioApp: 'clickhouse',
    category: 'Developer Tools & Cloud',
    protocol: 'REST API',
    description:
      'High-speed real-time event analytics, billions of rows/sec query execution, and partitions',
    scopes: ['queries:read'],
    assignedAgents: ['DataEngineeringAgent'],
  },
  {
    id: 'elasticsearch',
    name: 'Elasticsearch & Kibana',
    provider: 'composio',
    composioApp: 'elasticsearch',
    category: 'Developer Tools & Cloud',
    protocol: 'REST API',
    description:
      'Full-text fuzzy search, log indexing, BM25 scoring, and cluster health monitoring',
    scopes: ['indices:read'],
    assignedAgents: ['DataEngineeringAgent'],
  },
  {
    id: 'pinecone',
    name: 'Pinecone Vector DB',
    provider: 'composio',
    composioApp: 'pinecone',
    category: 'Developer Tools & Cloud',
    protocol: 'REST API',
    description:
      'Serverless vector index queries, cosine similarity search, and namespace filtering',
    scopes: ['vectors:read'],
    assignedAgents: ['KnowledgeGraphAgent'],
  },
  {
    id: 'weaviate',
    name: 'Weaviate Vector Search',
    provider: 'composio',
    composioApp: 'weaviate',
    category: 'Developer Tools & Cloud',
    protocol: 'REST API',
    description:
      'Hybrid dense-sparse vector search, generative search modules, and multi-modal embeddings',
    scopes: ['schema:read', 'objects:read'],
    assignedAgents: ['KnowledgeGraphAgent'],
  },
  {
    id: 'qdrant',
    name: 'Qdrant Vector Engine',
    provider: 'composio',
    composioApp: 'qdrant',
    category: 'Developer Tools & Cloud',
    protocol: 'REST API',
    description: 'Payload-based vector filtering, collection telemetry, and HNSW graph parameters',
    scopes: ['collections:read'],
    assignedAgents: ['KnowledgeGraphAgent'],
  },
  {
    id: 'chromadb',
    name: 'Chroma Vector Store',
    provider: 'native',
    category: 'Developer Tools & Cloud',
    protocol: 'Native Sovereign',
    description:
      'Open-source embedding database, local collection inspection, and nearest neighbor queries',
    scopes: ['collections:read'],
    assignedAgents: ['KnowledgeGraphAgent'],
  },
  {
    id: 'docker',
    name: 'Docker Engine & Containers',
    provider: 'composio',
    composioApp: 'docker',
    category: 'Developer Tools & Cloud',
    protocol: 'REST API',
    description:
      'Local and remote container lifecycle, image vulnerability scanning, and Docker Compose files',
    scopes: ['containers:read', 'images:read'],
    assignedAgents: ['DevOpsAgent'],
    isTop: true,
  },
  {
    id: 'kubernetes',
    name: 'Kubernetes Orchestration',
    provider: 'mcp',
    category: 'Developer Tools & Cloud',
    protocol: 'MCP (stdio)',
    description:
      'Pod status, deployment rollouts, ingress rules, service logs, and namespace resource quotas',
    scopes: ['pods:read', 'deployments:read', 'nodes:read'],
    assignedAgents: ['DevOpsAgent'],
    isTop: true,
  },
  {
    id: 'postman',
    name: 'Postman API Platform',
    provider: 'composio',
    composioApp: 'postman',
    category: 'Developer Tools & Cloud',
    protocol: 'OAuth 2.0',
    description:
      'API collections, OpenAPI specification sync, mock servers, and automated monitor runs',
    scopes: ['collections:read', 'environments:read'],
    assignedAgents: ['CodeReviewAgent'],
    isTop: true,
  },
  {
    id: 'sentry',
    name: 'Sentry Error Tracking',
    provider: 'composio',
    composioApp: 'sentry',
    category: 'Developer Tools & Cloud',
    protocol: 'OAuth 2.0',
    description:
      'Real-time crash reports, stack traces, release regression alerts, and performance transactions',
    scopes: ['event:read', 'project:read'],
    assignedAgents: ['DevOpsAgent', 'CodeReviewAgent'],
  },
  {
    id: 'datadog',
    name: 'Datadog APM & Metrics',
    provider: 'composio',
    composioApp: 'datadog',
    category: 'Developer Tools & Cloud',
    protocol: 'OAuth 2.0',
    description:
      'Service health dashboards, synthetic monitors, distributed traces, and log streaming',
    scopes: ['metrics:read', 'monitors:read'],
    assignedAgents: ['DevOpsAgent'],
  },
  {
    id: 'pagerduty',
    name: 'PagerDuty Incident Response',
    provider: 'composio',
    composioApp: 'pagerduty',
    category: 'Developer Tools & Cloud',
    protocol: 'OAuth 2.0',
    description:
      'On-call schedules, incident escalation policies, live alert triage, and service health',
    scopes: ['incidents:read', 'schedules:read'],
    assignedAgents: ['DevOpsAgent'],
  },
  {
    id: 'grafana',
    name: 'Grafana Observability',
    provider: 'composio',
    composioApp: 'grafana',
    category: 'Developer Tools & Cloud',
    protocol: 'OAuth 2.0',
    description:
      'Interactive telemetry dashboards, alert rule status, and Prometheus/Loki data sources',
    scopes: ['dashboards:read', 'alerts:read'],
    assignedAgents: ['DevOpsAgent'],
  },
  {
    id: 'prometheus',
    name: 'Prometheus Monitoring',
    provider: 'mcp',
    category: 'Developer Tools & Cloud',
    protocol: 'MCP (stdio)',
    description:
      'Time-series PromQL queries, metric target scrape health, and active alert firing evaluations',
    scopes: ['metrics:query'],
    assignedAgents: ['DevOpsAgent'],
  },
  {
    id: 'new-relic',
    name: 'New Relic Telemetry',
    provider: 'composio',
    composioApp: 'newrelic',
    category: 'Developer Tools & Cloud',
    protocol: 'OAuth 2.0',
    description:
      'Application performance monitoring, browser vitals, and infrastructure NRQL queries',
    scopes: ['nerdgraph:read'],
    assignedAgents: ['DevOpsAgent'],
  },
  {
    id: 'better-stack',
    name: 'Better Stack Uptime & Logs',
    provider: 'composio',
    composioApp: 'betterstack',
    category: 'Developer Tools & Cloud',
    protocol: 'REST API',
    description: 'Uptime heartbeats, incident status pages, and Logtail structured log streaming',
    scopes: ['monitors:read', 'logs:read'],
    assignedAgents: ['DevOpsAgent'],
  },
  {
    id: 'circleci',
    name: 'CircleCI Pipelines',
    provider: 'composio',
    composioApp: 'circleci',
    category: 'Developer Tools & Cloud',
    protocol: 'OAuth 2.0',
    description:
      'Automated workflow steps, test report artifacts, and build pipeline status badges',
    scopes: ['pipelines:read'],
    assignedAgents: ['DevOpsAgent'],
  },
  {
    id: 'terraform',
    name: 'Terraform Infrastructure as Code',
    provider: 'composio',
    composioApp: 'terraform',
    category: 'Developer Tools & Cloud',
    protocol: 'OAuth 2.0',
    description:
      'Terraform Cloud workspaces, plan outputs, state drift inspection, and run triggers',
    scopes: ['workspaces:read', 'runs:read'],
    assignedAgents: ['DevOpsAgent'],
  },
  {
    id: 'pulumi',
    name: 'Pulumi Cloud IaC',
    provider: 'composio',
    composioApp: 'pulumi',
    category: 'Developer Tools & Cloud',
    protocol: 'REST API',
    description:
      'TypeScript/Python infrastructure stack updates, policy packs, and deployment history',
    scopes: ['stacks:read'],
    assignedAgents: ['DevOpsAgent'],
  },
  {
    id: 'vault',
    name: 'HashiCorp Vault Secrets',
    provider: 'mcp',
    category: 'Developer Tools & Cloud',
    protocol: 'MCP (stdio)',
    description:
      'Zero-trust encrypted secret path verification, token renewal, and policy access checks',
    scopes: ['secrets:metadata_read'],
    assignedAgents: ['BackendSecurityAgent'],
  },
  {
    id: 'openai',
    name: 'OpenAI Models & Assistants',
    provider: 'composio',
    composioApp: 'openai',
    category: 'Developer Tools & Cloud',
    protocol: 'REST API',
    description:
      'GPT-4o model endpoints, Assistants file search, token usage logs, and fine-tuning jobs',
    scopes: ['models:read', 'usage:read'],
    assignedAgents: ['ExecutiveStrategyAgent'],
  },
  {
    id: 'anthropic',
    name: 'Anthropic Claude API',
    provider: 'composio',
    composioApp: 'anthropic',
    category: 'Developer Tools & Cloud',
    protocol: 'REST API',
    description:
      'Claude 3.5 Sonnet endpoints, prompt caching metrics, tool invocation schemas, and tokens',
    scopes: ['models:read'],
    assignedAgents: ['ExecutiveStrategyAgent'],
  },
  {
    id: 'ollama',
    name: 'Ollama Local & Cloud Inference',
    provider: 'native',
    category: 'Developer Tools & Cloud',
    protocol: 'Native Sovereign',
    description:
      'Local open weights LLMs (Gemma, Llama 3), cloud fallbacks, and private model embeddings',
    scopes: ['models:local'],
    assignedAgents: ['ExecutiveStrategyAgent'],
    isTrending: true,
  },
  {
    id: 'cohere',
    name: 'Cohere Enterprise NLP',
    provider: 'composio',
    composioApp: 'cohere',
    category: 'Developer Tools & Cloud',
    protocol: 'REST API',
    description: 'Command R+ generation, Cohere reranking models, and multilingual text embeddings',
    scopes: ['models:read'],
    assignedAgents: ['KnowledgeGraphAgent'],
  },
  {
    id: 'huggingface-inference',
    name: 'Hugging Face Inference Endpoints',
    provider: 'composio',
    composioApp: 'huggingface',
    category: 'Developer Tools & Cloud',
    protocol: 'REST API',
    description:
      'Dedicated GPU inference deployments, latency tracking, and autoscaling model containers',
    scopes: ['inference:read'],
    assignedAgents: ['DevOpsAgent'],
  },
  {
    id: 'atlassian-mcp',
    name: 'Atlassian MCP',
    provider: 'mcp',
    category: 'Developer Tools & Cloud',
    protocol: 'MCP (stdio)',
    description:
      'Search, read and update Jira, Confluence, Bitbucket, Loom and other Atlassian apps with your existing keys',
    scopes: ['jira:read_write', 'confluence:read'],
    assignedAgents: ['EngineeringLeadAgent', 'TaskTrackerAgent'],
    isTop: true,
  },
  {
    id: 'jira',
    name: 'Jira Software',
    provider: 'composio',
    composioApp: 'jira',
    category: 'Developer Tools & Cloud',
    protocol: 'OAuth 2.0',
    description: 'Track epics, sprints, bug reports, and agile project boards',
    scopes: ['read:jira-work', 'write:jira-work'],
    assignedAgents: ['EngineeringLeadAgent', 'TaskTrackerAgent'],
  },
  {
    id: 'amplitude',
    name: 'Amplitude Product Analytics',
    provider: 'composio',
    composioApp: 'amplitude',
    category: 'Developer Tools & Cloud',
    protocol: 'OAuth 2.0',
    description: 'User funnels, behavioral cohorts, and event conversion insights',
    scopes: ['dashboards:read', 'cohorts:read'],
    assignedAgents: ['ProductManagerAgent'],
  },
  {
    id: 'mixpanel',
    name: 'Mixpanel Analytics',
    provider: 'composio',
    composioApp: 'mixpanel',
    category: 'Developer Tools & Cloud',
    protocol: 'OAuth 2.0',
    description: 'Retention curves, event telemetry, and user breakdown reports',
    scopes: ['insights:read', 'reports:read'],
    assignedAgents: ['ProductManagerAgent'],
  },
  {
    id: 'segment',
    name: 'Twilio Segment CDP',
    provider: 'composio',
    composioApp: 'segment',
    category: 'Developer Tools & Cloud',
    protocol: 'OAuth 2.0',
    description: 'Customer data infrastructure, event tracking specs, and destination pipelines',
    scopes: ['sources:read', 'destinations:read'],
    assignedAgents: ['DataEngineeringAgent'],
  },
  {
    id: 'slack',
    name: 'Slack',
    provider: 'slack',
    category: 'Communication',
    protocol: 'OAuth 2.0',
    description:
      'Send messages, create canvases, and fetch Slack data with approval-gated write channels',
    scopes: ['channels:read', 'chat:write (Approval-Gated)'],
    assignedAgents: ['ExecutiveAlertAgent', 'ApplicationAgent'],
    isTop: true,
  },
  {
    id: 'discord',
    name: 'Discord Bot',
    provider: 'composio',
    composioApp: 'discord',
    category: 'Communication',
    protocol: 'OAuth 2.0',
    description:
      'Community alerts, developer channels, role mentions, and automated webhook broadcasts',
    scopes: ['bot', 'messages.read'],
    assignedAgents: ['ExecutiveAlertAgent'],
  },
  {
    id: 'microsoft-teams',
    name: 'Microsoft Teams',
    provider: 'composio',
    composioApp: 'teams',
    category: 'Communication',
    protocol: 'OAuth 2.0',
    description:
      'Enterprise chat channels, scheduled video meetings, meeting attendance logs, and alerts',
    scopes: ['Chat.Read', 'ChannelMessage.Read.All'],
    assignedAgents: ['ExecutiveAlertAgent', 'InterviewSchedulerAgent'],
    isTop: true,
  },
  {
    id: 'zoom',
    name: 'Zoom Video Communications',
    provider: 'composio',
    composioApp: 'zoom',
    category: 'Communication',
    protocol: 'OAuth 2.0',
    description:
      'Meeting scheduling, cloud recording transcripts, AI meeting summaries, and participants',
    scopes: ['meeting:read', 'recording:read'],
    assignedAgents: ['ExecutiveAssistantAgent'],
    isTop: true,
  },
  {
    id: 'google-meet',
    name: 'Google Meet',
    provider: 'calendar',
    category: 'Communication',
    protocol: 'OAuth 2.0',
    description:
      'Instant video conference links, meeting transcription feeds, and calendar integration',
    scopes: ['calendar.events.readonly'],
    assignedAgents: ['InterviewSchedulerAgent'],
  },
  {
    id: 'google-calendar',
    name: 'Google Calendar',
    provider: 'calendar',
    category: 'Communication',
    protocol: 'OAuth 2.0',
    description:
      'Manage your schedule and coordinate meetings effortlessly with smart availability slots',
    scopes: ['calendar.readonly', 'events.read'],
    assignedAgents: ['ExecutiveAssistantAgent', 'InterviewSchedulerAgent'],
    isTop: true,
  },
  {
    id: 'gmail',
    name: 'Gmail',
    provider: 'gmail',
    category: 'Communication',
    protocol: 'OAuth 2.0',
    description:
      'Draft replies, summarize threads, & search your inbox with approval gates on outbound drafts',
    scopes: ['gmail.readonly', 'drafts.create'],
    assignedAgents: ['ApplicationAgent', 'CareerStrategyAgent'],
    isTop: true,
  },
  {
    id: 'resend',
    name: 'Resend Modern Email',
    provider: 'composio',
    composioApp: 'resend',
    category: 'Communication',
    protocol: 'REST API',
    description:
      'Developer-first transactional email API, domain DNS verification, and deliverability stats',
    scopes: ['emails:send', 'domains:read'],
    assignedAgents: ['ClientOutreachAgent'],
    isTrending: true,
  },
  {
    id: 'sendgrid',
    name: 'SendGrid Email Delivery',
    provider: 'composio',
    composioApp: 'sendgrid',
    category: 'Communication',
    protocol: 'OAuth 2.0',
    description:
      'Marketing campaigns, transactional templates, IP warmup telemetry, and delivery statistics',
    scopes: ['mail.send', 'templates:read'],
    assignedAgents: ['ClientOutreachAgent'],
  },
  {
    id: 'mailchimp',
    name: 'Mailchimp Newsletters',
    provider: 'composio',
    composioApp: 'mailchimp',
    category: 'Communication',
    protocol: 'OAuth 2.0',
    description:
      'Audience lists, open rate analytics, campaign drafts, and subscriber growth telemetry',
    scopes: ['campaigns:read', 'lists:read'],
    assignedAgents: ['ClientOutreachAgent'],
  },
  {
    id: 'postmark',
    name: 'Postmark Fast Transactional Email',
    provider: 'composio',
    composioApp: 'postmark',
    category: 'Communication',
    protocol: 'REST API',
    description:
      'Ultra-reliable inbox delivery, bounce management, open tracking, and email templates',
    scopes: ['messages:read', 'servers:read'],
    assignedAgents: ['ClientOutreachAgent'],
  },
  {
    id: 'mailgun',
    name: 'Mailgun Email API',
    provider: 'composio',
    composioApp: 'mailgun',
    category: 'Communication',
    protocol: 'REST API',
    description: 'Inbound email routing, validation algorithms, and delivery event telemetry',
    scopes: ['events:read', 'domains:read'],
    assignedAgents: ['ClientOutreachAgent'],
  },
  {
    id: 'amazon-ses',
    name: 'Amazon SES Email',
    provider: 'composio',
    composioApp: 'ses',
    category: 'Communication',
    protocol: 'REST API',
    description:
      'High-scale cloud email service, bounce and complaint notification feeds, and reputation metrics',
    scopes: ['ses:GetSendStatistics'],
    assignedAgents: ['ClientOutreachAgent'],
  },
  {
    id: 'brevo',
    name: 'Brevo Email & SMS',
    provider: 'composio',
    composioApp: 'brevo',
    category: 'Communication',
    protocol: 'OAuth 2.0',
    description:
      'Multi-channel marketing automation, transactional SMS, and customer relationship newsletters',
    scopes: ['campaigns:read'],
    assignedAgents: ['ClientOutreachAgent'],
  },
  {
    id: 'convertkit',
    name: 'Kit (ConvertKit) Newsletters',
    provider: 'composio',
    composioApp: 'convertkit',
    category: 'Communication',
    protocol: 'OAuth 2.0',
    description:
      'Creator audience broadcast metrics, automated subscriber funnels, and landing page conversions',
    scopes: ['subscribers:read', 'broadcasts:read'],
    assignedAgents: ['BrandingAgent', 'ClientOutreachAgent'],
  },
  {
    id: 'superhuman',
    name: 'Superhuman Email',
    provider: 'composio',
    composioApp: 'superhuman',
    category: 'Communication',
    protocol: 'OAuth 2.0',
    description:
      'High-velocity inbox zero commands, snippets, read status receipts, and priority splits',
    scopes: ['messages:read', 'snippets:read'],
    assignedAgents: ['ExecutiveAssistantAgent'],
  },
  {
    id: 'outlook',
    name: 'Microsoft Outlook Mail',
    provider: 'composio',
    composioApp: 'outlook',
    category: 'Communication',
    protocol: 'OAuth 2.0',
    description:
      'Exchange mailbox folders, calendar event schedules, focused inbox filters, and categories',
    scopes: ['Mail.Read', 'Calendars.Read'],
    assignedAgents: ['ExecutiveAssistantAgent', 'ApplicationAgent'],
  },
  {
    id: 'loom',
    name: 'Loom Video Messaging',
    provider: 'composio',
    composioApp: 'loom',
    category: 'Communication',
    protocol: 'OAuth 2.0',
    description:
      'Screen recording transcripts, video comments, viewer analytics, and workspace folders',
    scopes: ['videos:read', 'transcripts:read'],
    assignedAgents: ['KnowledgeGraphAgent'],
  },
  {
    id: 'telegram',
    name: 'Telegram Bot Alerts',
    provider: 'composio',
    composioApp: 'telegram',
    category: 'Communication',
    protocol: 'REST API',
    description: 'Direct message notifications, channel broadcasts, and automated bot dispatch',
    scopes: ['bot:messages'],
    assignedAgents: ['ExecutiveAlertAgent'],
  },
  {
    id: 'whatsapp-business',
    name: 'WhatsApp Business Cloud',
    provider: 'composio',
    composioApp: 'whatsapp',
    category: 'Communication',
    protocol: 'REST API',
    description:
      'Verified template messages, two-factor authentication notifications, and customer chats',
    scopes: ['messages:read'],
    assignedAgents: ['ExecutiveAlertAgent'],
  },
  {
    id: 'signal',
    name: 'Signal Private Messenger',
    provider: 'native',
    category: 'Communication',
    protocol: 'Native Sovereign',
    description: 'End-to-end encrypted sovereign alerts and urgent confidential notifications',
    scopes: ['messages:secure'],
    assignedAgents: ['ExecutiveAlertAgent'],
  },
  {
    id: 'mattermost',
    name: 'Mattermost Team Chat',
    provider: 'composio',
    composioApp: 'mattermost',
    category: 'Communication',
    protocol: 'OAuth 2.0',
    description:
      'Self-hosted secure collaboration, playbooks, incident channels, and slash commands',
    scopes: ['channels:read', 'posts:read'],
    assignedAgents: ['DevOpsAgent'],
  },
  {
    id: 'intercom',
    name: 'Intercom Customer Messaging',
    provider: 'composio',
    composioApp: 'intercom',
    category: 'Communication',
    protocol: 'OAuth 2.0',
    description: 'In-app messenger chats, user segments, and support resolution articles',
    scopes: ['conversations:read', 'users:read'],
    assignedAgents: ['SupportTriageAgent'],
  },
  {
    id: 'zendesk',
    name: 'Zendesk Support',
    provider: 'composio',
    composioApp: 'zendesk',
    category: 'Communication',
    protocol: 'OAuth 2.0',
    description: 'Customer ticket management, SLA tracking, and resolution threads',
    scopes: ['tickets:read', 'users:read'],
    assignedAgents: ['SupportTriageAgent'],
  },
  {
    id: 'twilio',
    name: 'Twilio SMS & Voice',
    provider: 'composio',
    composioApp: 'twilio',
    category: 'Communication',
    protocol: 'OAuth 2.0',
    description: 'Transactional SMS notifications, phone verification, and voice call dispatch',
    scopes: ['sms:read', 'voice:read'],
    assignedAgents: ['ExecutiveAlertAgent'],
  },
  {
    id: 'reddit',
    name: 'Reddit Communities',
    provider: 'composio',
    composioApp: 'reddit',
    category: 'Communication',
    protocol: 'OAuth 2.0',
    description:
      'Developer subreddit discussions, trend analysis, upvote monitoring, and community outreach',
    scopes: ['read', 'identity'],
    assignedAgents: ['BrandingAgent', 'OutreachAgent'],
  },
  {
    id: 'twitter-x',
    name: 'X / Twitter Social',
    provider: 'composio',
    composioApp: 'twitter',
    category: 'Communication',
    protocol: 'OAuth 2.0',
    description:
      'Public post feeds, engineering announcements, mentions, and tech founder engagement',
    scopes: ['tweet.read', 'users.read'],
    assignedAgents: ['BrandingAgent'],
  },
  {
    id: 'threads',
    name: 'Meta Threads Network',
    provider: 'composio',
    composioApp: 'threads',
    category: 'Communication',
    protocol: 'OAuth 2.0',
    description: 'Short-form tech thoughts, reply threads, and community developer discourse',
    scopes: ['threads_basic'],
    assignedAgents: ['BrandingAgent'],
  },
  {
    id: 'discourse',
    name: 'Discourse Developer Forums',
    provider: 'composio',
    composioApp: 'discourse',
    category: 'Communication',
    protocol: 'REST API',
    description:
      'Technical topic threads, solution marks, community trust levels, and badge awards',
    scopes: ['topics:read', 'posts:read'],
    assignedAgents: ['KnowledgeGraphAgent', 'BrandingAgent'],
  },
];

/* ──────────────────────────────────────────────────────────────────────────
   3. Icon Resolver for Catalog Items
   ────────────────────────────────────────────────────────────────────────── */

export function renderCatalogIcon(item: ConnectorDefinition): React.ReactNode {
  switch (item.id) {
    case 'google-drive':
      return <GoogleDriveIcon />;
    case 'gmail':
      return <GmailIcon />;
    case 'google-calendar':
      return <GoogleCalendarIcon />;
    case 'canva':
      return <CanvaIcon />;
    case 'microsoft-365':
      return <Microsoft365Icon />;
    case 'notion':
      return <NotionIcon />;
    case 'figma':
      return <FigmaIcon />;
    case 'slack':
      return <SlackIcon />;
    case 'atlassian-mcp':
      return <AtlassianIcon />;
    case 'hubspot':
      return <HubSpotIcon />;
    case 'github':
      return <GitHubIcon />;
    case 'linear':
      return <LinearIcon />;
    case 'native-ats-mcp':
      return <AtsCrawlerIcon />;
    case 'native-browser':
      return <BrowserIcon />;
    default:
      return (
        <AppBrandIcon name={item.name} id={item.composioApp || item.id} category={item.category} />
      );
  }
}
