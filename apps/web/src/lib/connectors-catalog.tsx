import React from 'react';
import type { ConnectorProvider } from '@vaeloom/shared-types';

export type ConnectorProtocol =
  | 'OAuth 2.0'
  | 'MCP (stdio)'
  | 'MCP (Streamable-HTTP)'
  | 'REST API'
  | 'GraphQL'
  | 'Native Sovereign';

export type ConnectorCategory =
  | 'All'
  | 'Education'
  | 'Sales'
  | 'Productivity'
  | 'Engineering'
  | 'Financial'
  | 'Legal'
  | 'HR'
  | 'AI & ML'
  | 'Data & Analytics'
  | 'Communication'
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

/* ──────────────────────────────────────────────────────────────────────────
   1. High-Fidelity SVG Brand Icons
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
      className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-[#1c1d24] text-[#a1a1aa] ml-1.5 shrink-0"
      title="Verified Enterprise Connector"
    >
      <svg className="w-2.5 h-2.5" viewBox="0 0 12 12" fill="none">
        <path
          d="M3 6.2L4.8 8L9 4"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

export function PlusIcon() {
  return (
    <svg
      className="w-4 h-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

export function AppBrandIcon({ name, id }: { name: string; id: string; category?: string }) {
  const colorMap: Record<string, { bg: string; text: string; border: string }> = {
    stripe: { bg: 'bg-[#635bff]/20', text: 'text-[#817af8]', border: 'border-[#635bff]/40' },
    salesforce: { bg: 'bg-[#00a1e0]/20', text: 'text-[#30b5ea]', border: 'border-[#00a1e0]/40' },
    zendesk: { bg: 'bg-[#03363d]/40', text: 'text-[#48b2c2]', border: 'border-[#03363d]/50' },
    discord: { bg: 'bg-[#5865F2]/20', text: 'text-[#7983f5]', border: 'border-[#5865F2]/40' },
    zoom: { bg: 'bg-[#2D8CFF]/20', text: 'text-[#5ca3ff]', border: 'border-[#2D8CFF]/40' },
    postgresql: { bg: 'bg-[#336791]/20', text: 'text-[#5a9cd2]', border: 'border-[#336791]/40' },
    snowflake: { bg: 'bg-[#29B5E8]/20', text: 'text-[#5ed1fa]', border: 'border-[#29B5E8]/40' },
    openai: { bg: 'bg-[#10a37f]/20', text: 'text-[#19c37d]', border: 'border-[#10a37f]/40' },
    anthropic: { bg: 'bg-[#d97757]/20', text: 'text-[#e58a6d]', border: 'border-[#d97757]/40' },
    greenhouse: { bg: 'bg-[#00b274]/20', text: 'text-[#20cc8f]', border: 'border-[#00b274]/40' },
    workday: { bg: 'bg-[#e28200]/20', text: 'text-[#f59e27]', border: 'border-[#e28200]/40' },
    jira: { bg: 'bg-[#0052cc]/20', text: 'text-[#3885ff]', border: 'border-[#0052cc]/40' },
    asana: { bg: 'bg-[#f06a6a]/20', text: 'text-[#f48b8b]', border: 'border-[#f06a6a]/40' },
    airtable: { bg: 'bg-[#fcb400]/20', text: 'text-[#ffd043]', border: 'border-[#fcb400]/40' },
    clickup: { bg: 'bg-[#7b68ee]/20', text: 'text-[#9b8bfa]', border: 'border-[#7b68ee]/40' },
    monday: { bg: 'bg-[#ff3d57]/20', text: 'text-[#ff6b80]', border: 'border-[#ff3d57]/40' },
    trello: { bg: 'bg-[#0079bf]/20', text: 'text-[#34a4e3]', border: 'border-[#0079bf]/40' },
    confluence: { bg: 'bg-[#172b4d]/40', text: 'text-[#4c9aff]', border: 'border-[#0052cc]/40' },
    dropbox: { bg: 'bg-[#0061fe]/20', text: 'text-[#488dfe]', border: 'border-[#0061fe]/40' },
    box: { bg: 'bg-[#0061d5]/20', text: 'text-[#4b8ee3]', border: 'border-[#0061d5]/40' },
    gitlab: { bg: 'bg-[#fc6d26]/20', text: 'text-[#fd8f56]', border: 'border-[#fc6d26]/40' },
    datadog: { bg: 'bg-[#632ca6]/20', text: 'text-[#9b5de5]', border: 'border-[#632ca6]/40' },
    sentry: { bg: 'bg-[#362d59]/40', text: 'text-[#f56565]', border: 'border-[#f35a60]/40' },
    pagerduty: { bg: 'bg-[#06ac38]/20', text: 'text-[#2fd162]', border: 'border-[#06ac38]/40' },
    supabase: { bg: 'bg-[#3ecf8e]/20', text: 'text-[#5ee3a6]', border: 'border-[#3ecf8e]/40' },
    vercel: { bg: 'bg-white/10', text: 'text-white', border: 'border-white/20' },
    twilio: { bg: 'bg-[#f22f46]/20', text: 'text-[#f75e71]', border: 'border-[#f22f46]/40' },
    sendgrid: { bg: 'bg-[#009dd9]/20', text: 'text-[#33bee8]', border: 'border-[#009dd9]/40' },
    canvas: { bg: 'bg-[#e72429]/20', text: 'text-[#f87171]', border: 'border-[#e72429]/40' },
    blackboard: { bg: 'bg-[#d97706]/20', text: 'text-[#fbbf24]', border: 'border-[#d97706]/40' },
    coursera: { bg: 'bg-[#0056d2]/20', text: 'text-[#60a5fa]', border: 'border-[#0056d2]/40' },
    moodle: { bg: 'bg-[#f97316]/20', text: 'text-[#fb923c]', border: 'border-[#f97316]/40' },
    google_classroom: {
      bg: 'bg-[#16a34a]/20',
      text: 'text-[#4ade80]',
      border: 'border-[#16a34a]/40',
    },
    duolingo: { bg: 'bg-[#58cc02]/20', text: 'text-[#86efac]', border: 'border-[#58cc02]/40' },
    greenhouse: { bg: 'bg-[#00b259]/20', text: 'text-[#34d399]', border: 'border-[#00b259]/40' },
    lever: { bg: 'bg-[#206095]/20', text: 'text-[#60a5fa]', border: 'border-[#206095]/40' },
    workday: { bg: 'bg-[#0875e1]/20', text: 'text-[#38bdf8]', border: 'border-[#0875e1]/40' },
    docusign: { bg: 'bg-[#ffec00]/20', text: 'text-[#fde047]', border: 'border-[#ffec00]/40' },
    intercom: { bg: 'bg-[#0057ff]/20', text: 'text-[#4c84ff]', border: 'border-[#0057ff]/40' },
    apollo: { bg: 'bg-[#ffc107]/20', text: 'text-[#ffd54f]', border: 'border-[#ffc107]/40' },
    zoominfo: { bg: 'bg-[#0072ce]/20', text: 'text-[#3da0f0]', border: 'border-[#0072ce]/40' },
    loom: { bg: 'bg-[#625df5]/20', text: 'text-[#8581f7]', border: 'border-[#625df5]/40' },
    superhuman: { bg: 'bg-[#e5a93c]/20', text: 'text-[#f2be63]', border: 'border-[#e5a93c]/40' },
    vanguard: { bg: 'bg-[#c51c24]/20', text: 'text-[#e53e3e]', border: 'border-[#c51c24]/40' },
    links: { bg: 'bg-[#0284c7]/20', text: 'text-[#38bdf8]', border: 'border-[#0284c7]/40' },
    blackrock: { bg: 'bg-zinc-800', text: 'text-zinc-200', border: 'border-zinc-700' },
    paxton: { bg: 'bg-[#7c3aed]/20', text: 'text-[#a78bfa]', border: 'border-[#7c3aed]/40' },
    rome2rio: { bg: 'bg-[#0d9488]/20', text: 'text-[#2dd4bf]', border: 'border-[#0d9488]/40' },
    helena: { bg: 'bg-[#d946ef]/20', text: 'text-[#f0abfc]', border: 'border-[#d946ef]/40' },
    pdf: { bg: 'bg-[#ef4444]/20', text: 'text-[#f87171]', border: 'border-[#ef4444]/40' },
    sonos: { bg: 'bg-zinc-800', text: 'text-zinc-100', border: 'border-zinc-700' },
    blackdiamond: { bg: 'bg-[#0284c7]/20', text: 'text-[#38bdf8]', border: 'border-[#0284c7]/40' },
    filevine: { bg: 'bg-[#10b981]/20', text: 'text-[#34d399]', border: 'border-[#10b981]/40' },
  };

  const categoryFallback: Record<string, { bg: string; text: string; border: string }> = {
    Education: {
      bg: 'bg-emerald-500/20',
      text: 'text-emerald-400',
      border: 'border-emerald-500/40',
    },
    Sales: { bg: 'bg-amber-500/20', text: 'text-amber-400', border: 'border-amber-500/40' },
    HR: { bg: 'bg-pink-500/20', text: 'text-pink-400', border: 'border-pink-500/40' },
    'AI & ML': { bg: 'bg-purple-500/20', text: 'text-purple-400', border: 'border-purple-500/40' },
    'Data & Analytics': {
      bg: 'bg-cyan-500/20',
      text: 'text-cyan-400',
      border: 'border-cyan-500/40',
    },
    Financial: {
      bg: 'bg-emerald-600/20',
      text: 'text-emerald-300',
      border: 'border-emerald-600/40',
    },
    Legal: { bg: 'bg-violet-500/20', text: 'text-violet-400', border: 'border-violet-500/40' },
    Communication: { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/40' },
    Marketing: { bg: 'bg-rose-500/20', text: 'text-rose-400', border: 'border-rose-500/40' },
    Support: { bg: 'bg-teal-500/20', text: 'text-teal-400', border: 'border-teal-500/40' },
    'E-Commerce': {
      bg: 'bg-orange-500/20',
      text: 'text-orange-400',
      border: 'border-orange-500/40',
    },
    Engineering: {
      bg: 'bg-indigo-500/20',
      text: 'text-indigo-400',
      border: 'border-indigo-500/40',
    },
    Productivity: { bg: 'bg-sky-500/20', text: 'text-sky-400', border: 'border-sky-500/40' },
  };

  const scheme = colorMap[id.toLowerCase()] ||
    (category && categoryFallback[category]) || {
      bg: 'bg-[#1c1d24]',
      text: 'text-[#d4d2cc]',
      border: 'border-[#27272a]',
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
   2. Master Enterprise Connectors Catalog (260+ items)
   ────────────────────────────────────────────────────────────────────────── */

export const AUTHORITATIVE_CATALOG: ConnectorDefinition[] = [
  // ── Top 14 Connectors (Matches Screenshot 1) ──
  {
    id: 'google-drive',
    name: 'Google Drive',
    provider: 'drive',
    category: 'Google',
    protocol: 'OAuth 2.0',
    description: 'Search, read, and upload files instantly',
    scopes: ['drive.readonly', 'files.read'],
    assignedAgents: ['DocumentIngestionAgent', 'ResumeBuilderAgent'],
    isTop: true,
  },
  {
    id: 'gmail',
    name: 'Gmail',
    provider: 'gmail',
    category: 'Google',
    protocol: 'OAuth 2.0',
    description: 'Draft replies, summarize threads, & search your inbox',
    scopes: ['gmail.readonly', 'drafts.create'],
    assignedAgents: ['ApplicationAgent', 'CareerStrategyAgent'],
    isTop: true,
  },
  {
    id: 'google-calendar',
    name: 'Google Calendar',
    provider: 'calendar',
    category: 'Google',
    protocol: 'OAuth 2.0',
    description: 'Manage your schedule and coordinate meetings effortlessly',
    scopes: ['calendar.readonly', 'events.read'],
    assignedAgents: ['ExecutiveAssistantAgent', 'InterviewSchedulerAgent'],
    isTop: true,
  },
  {
    id: 'canva',
    name: 'Canva',
    provider: 'composio',
    composioApp: 'canva',
    category: 'Productivity',
    protocol: 'OAuth 2.0',
    description: 'Search, create, autofill, and export Canva designs',
    scopes: ['design:read', 'design:export'],
    assignedAgents: ['PortfolioAgent', 'BrandingAgent'],
    isTop: true,
  },
  {
    id: 'microsoft-365',
    name: 'Microsoft 365',
    provider: 'composio',
    composioApp: 'microsoft-365',
    category: 'Productivity',
    protocol: 'OAuth 2.0',
    description:
      'Access your company’s SharePoint, OneDrive, Outlook, and Teams unified enterprise suite',
    scopes: ['Files.Read.All', 'Mail.Read', 'Calendars.Read'],
    assignedAgents: ['EnterpriseIngestionAgent', 'DocumentAuditAgent'],
    isTop: true,
  },
  {
    id: 'notion',
    name: 'Notion',
    provider: 'notion',
    category: 'Productivity',
    protocol: 'OAuth 2.0',
    description:
      'Connect your Notion workspace to search, update, and power workflows across tools',
    scopes: ['notion:read', 'pages:read'],
    assignedAgents: ['KnowledgeGraphAgent', 'CareerStrategyAgent'],
    isTop: true,
  },
  {
    id: 'figma',
    name: 'Figma',
    provider: 'composio',
    composioApp: 'figma',
    category: 'Productivity',
    protocol: 'OAuth 2.0',
    description: 'Generate diagrams and better code from Figma context',
    scopes: ['files:read', 'components:read'],
    assignedAgents: ['DesignSystemAgent', 'CodeGeneratorAgent'],
    isTop: true,
  },
  {
    id: 'slack',
    name: 'Slack',
    provider: 'slack',
    category: 'Productivity',
    protocol: 'OAuth 2.0',
    description: 'Send messages, create canvases, and fetch Slack data',
    scopes: ['channels:read', 'chat:write (Approval-Gated)'],
    assignedAgents: ['ExecutiveAlertAgent', 'ApplicationAgent'],
    isTop: true,
  },
  {
    id: 'atlassian-mcp',
    name: 'Atlassian MCP',
    provider: 'mcp',
    category: 'MCP',
    protocol: 'MCP (stdio)',
    description:
      'Search, read and update Jira, Confluence, Bitbucket, Loom and other Atlassian apps with your existing...',
    scopes: ['jira:read_write', 'confluence:read'],
    assignedAgents: ['EngineeringLeadAgent', 'TaskTrackerAgent'],
    isTop: true,
  },
  {
    id: 'hubspot',
    name: 'HubSpot',
    provider: 'composio',
    composioApp: 'hubspot',
    category: 'Sales',
    protocol: 'OAuth 2.0',
    description: 'CRM context for every answer, insight, and action',
    scopes: ['crm.objects.contacts.read', 'crm.objects.deals.read'],
    assignedAgents: ['ExecutiveStrategyAgent', 'OutreachAgent'],
    isTop: true,
  },
  {
    id: 'github',
    name: 'GitHub',
    provider: 'github',
    category: 'Engineering',
    protocol: 'OAuth 2.0',
    description:
      'Inspect PRs, manage issues, read repositories, and trigger automated branch workflows',
    scopes: ['repo:read', 'user:read', 'workflow:trigger'],
    assignedAgents: ['CodeReviewAgent', 'AutomatedDevAgent'],
    isTop: true,
  },
  {
    id: 'linear',
    name: 'Linear',
    provider: 'composio',
    composioApp: 'linear',
    category: 'Engineering',
    protocol: 'OAuth 2.0',
    description: 'High-speed issue tracking, cycle management, and roadmap synchronization',
    scopes: ['issues:read', 'cycles:read'],
    assignedAgents: ['SprintPlannerAgent', 'EngineeringLeadAgent'],
    isTop: true,
  },
  {
    id: 'native-ats-mcp',
    name: 'Public ATS Job Search MCP',
    provider: 'mcp',
    mcpServerId: 'job-search-mcp',
    category: 'MCP',
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
    category: 'Native',
    protocol: 'Native Sovereign',
    description:
      'SSRF-guarded headless Chromium browser for live job posting verification and company insights',
    scopes: ['browser:headless', 'quota:20_per_hour', 'ip_enforce:global'],
    assignedAgents: ['JobSearchAgent', 'CompanyResearchAgent'],
    isTop: true,
  },

  // ── Full 240+ Enterprise Composio SaaS & Sovereign Connectors Catalog ──
  {
    id: 'salesforce',
    name: 'Salesforce CRM',
    provider: 'composio',
    composioApp: 'salesforce',
    category: 'Sales',
    protocol: 'OAuth 2.0',
    description: 'Sync customer accounts, track sales opportunities, and run SOQL queries',
    scopes: ['api', 'refresh_token', 'offline_access'],
    assignedAgents: ['SalesExecutiveAgent', 'ClientOutreachAgent'],
  },
  {
    id: 'stripe',
    name: 'Stripe Payments',
    provider: 'composio',
    composioApp: 'stripe',
    category: 'Financial',
    protocol: 'OAuth 2.0',
    description: 'Query charges, refunds, customer subscriptions, and billing invoices',
    scopes: ['read_only', 'invoices:read'],
    assignedAgents: ['FinanceAdvisorAgent', 'BillingAuditAgent'],
  },
  {
    id: 'jira',
    name: 'Jira Software',
    provider: 'composio',
    composioApp: 'jira',
    category: 'Engineering',
    protocol: 'OAuth 2.0',
    description: 'Track epics, sprints, bug reports, and agile project boards',
    scopes: ['read:jira-work', 'write:jira-work'],
    assignedAgents: ['EngineeringLeadAgent', 'TaskTrackerAgent'],
  },
  {
    id: 'confluence',
    name: 'Confluence',
    provider: 'composio',
    composioApp: 'confluence',
    category: 'Productivity',
    protocol: 'OAuth 2.0',
    description: 'Enterprise wiki pages, technical documentation, and team spaces',
    scopes: ['read:confluence-space', 'read:confluence-content.all'],
    assignedAgents: ['KnowledgeGraphAgent'],
  },
  {
    id: 'zendesk',
    name: 'Zendesk Support',
    provider: 'composio',
    composioApp: 'zendesk',
    category: 'Sales',
    protocol: 'OAuth 2.0',
    description: 'Customer ticket management, SLA tracking, and resolution threads',
    scopes: ['tickets:read', 'users:read'],
    assignedAgents: ['SupportTriageAgent'],
  },
  {
    id: 'aws-s3',
    name: 'AWS S3 Storage',
    provider: 'mcp',
    category: 'MCP',
    protocol: 'MCP (stdio)',
    description: 'Bucket object enumeration, pre-signed URL verification, and document reads',
    scopes: ['s3:GetObject', 's3:ListBucket'],
    assignedAgents: ['DocumentIngestionAgent'],
  },
  {
    id: 'azure-blob',
    name: 'Azure Blob Storage',
    provider: 'mcp',
    category: 'MCP',
    protocol: 'MCP (Streamable-HTTP)',
    description: 'Enterprise blob containers, tiered archival storage, and SAS tokens',
    scopes: ['blob:read', 'container:list'],
    assignedAgents: ['DocumentIngestionAgent'],
  },
  {
    id: 'greenhouse',
    name: 'Greenhouse ATS',
    provider: 'composio',
    composioApp: 'greenhouse',
    category: 'Productivity',
    protocol: 'OAuth 2.0',
    description: 'Candidate pipelines, interview scorecards, and requisition tracking',
    scopes: ['candidates:read', 'jobs:read'],
    assignedAgents: ['TalentScoutAgent', 'ApplicationAgent'],
  },
  {
    id: 'workday',
    name: 'Workday Enterprise',
    provider: 'composio',
    composioApp: 'workday',
    category: 'Productivity',
    protocol: 'OAuth 2.0',
    description: 'Human capital management, organizational charts, and payroll data',
    scopes: ['staffing:read', 'workers:read'],
    assignedAgents: ['HRComplianceAgent'],
  },
  {
    id: 'snowflake',
    name: 'Snowflake Data Cloud',
    provider: 'composio',
    composioApp: 'snowflake',
    category: 'Engineering',
    protocol: 'OAuth 2.0',
    description: 'Execute analytical warehouse queries and inspect database schemas',
    scopes: ['warehouse:usage', 'query:execute'],
    assignedAgents: ['DataEngineeringAgent'],
  },
  {
    id: 'postgresql',
    name: 'PostgreSQL Relational DB',
    provider: 'mcp',
    category: 'MCP',
    protocol: 'MCP (stdio)',
    description: 'Read-only introspective schema inspection and verified SQL execution',
    scopes: ['db:read', 'schema:inspect'],
    assignedAgents: ['DataEngineeringAgent'],
  },
  {
    id: 'supabase',
    name: 'Supabase Platform',
    provider: 'composio',
    composioApp: 'supabase',
    category: 'Engineering',
    protocol: 'OAuth 2.0',
    description: 'Postgres database, vector embeddings, and row-level security audits',
    scopes: ['database:read', 'storage:read'],
    assignedAgents: ['BackendSecurityAgent'],
  },
  {
    id: 'discord',
    name: 'Discord Bot',
    provider: 'composio',
    composioApp: 'discord',
    category: 'Productivity',
    protocol: 'OAuth 2.0',
    description: 'Community alerts, developer channels, and automated webhook broadcasts',
    scopes: ['bot', 'messages.read'],
    assignedAgents: ['ExecutiveAlertAgent'],
  },
  {
    id: 'zoom',
    name: 'Zoom Video Communications',
    provider: 'composio',
    composioApp: 'zoom',
    category: 'Productivity',
    protocol: 'OAuth 2.0',
    description: 'Meeting scheduling, cloud recording transcripts, and participant lists',
    scopes: ['meeting:read', 'recording:read'],
    assignedAgents: ['ExecutiveAssistantAgent'],
  },
  {
    id: 'asana',
    name: 'Asana Projects',
    provider: 'composio',
    composioApp: 'asana',
    category: 'Productivity',
    protocol: 'OAuth 2.0',
    description: 'Collaborative task management, milestones, and project timelines',
    scopes: ['tasks:read', 'projects:read'],
    assignedAgents: ['TaskTrackerAgent'],
  },
  {
    id: 'airtable',
    name: 'Airtable Bases',
    provider: 'composio',
    composioApp: 'airtable',
    category: 'Productivity',
    protocol: 'OAuth 2.0',
    description: 'Relational spreadsheets, custom views, and automated record sync',
    scopes: ['data.records:read', 'schema.bases:read'],
    assignedAgents: ['KnowledgeGraphAgent'],
  },
  {
    id: 'clickup',
    name: 'ClickUp 3.0',
    provider: 'composio',
    composioApp: 'clickup',
    category: 'Productivity',
    protocol: 'OAuth 2.0',
    description: 'All-in-one productivity suite, docs, goals, and sprint checklists',
    scopes: ['tasks:read', 'folders:read'],
    assignedAgents: ['TaskTrackerAgent'],
  },
  {
    id: 'monday',
    name: 'Monday.com Work OS',
    provider: 'composio',
    composioApp: 'monday',
    category: 'Productivity',
    protocol: 'OAuth 2.0',
    description: 'Custom workflow boards, column values, and team assignments',
    scopes: ['boards:read', 'updates:read'],
    assignedAgents: ['TaskTrackerAgent'],
  },
  {
    id: 'trello',
    name: 'Trello Boards',
    provider: 'composio',
    composioApp: 'trello',
    category: 'Productivity',
    protocol: 'OAuth 2.0',
    description: 'Kanban cards, checklists, and automated board notifications',
    scopes: ['read', 'account'],
    assignedAgents: ['TaskTrackerAgent'],
  },
  {
    id: 'dropbox',
    name: 'Dropbox Enterprise',
    provider: 'composio',
    composioApp: 'dropbox',
    category: 'Productivity',
    protocol: 'OAuth 2.0',
    description: 'Cloud file sync, shared folders, and document preview links',
    scopes: ['files.content.read', 'files.metadata.read'],
    assignedAgents: ['DocumentIngestionAgent'],
  },
  {
    id: 'box',
    name: 'Box Cloud Storage',
    provider: 'composio',
    composioApp: 'box',
    category: 'Productivity',
    protocol: 'OAuth 2.0',
    description: 'Secure enterprise content management and metadata tags',
    scopes: ['root_readonly'],
    assignedAgents: ['DocumentIngestionAgent'],
  },
  {
    id: 'gitlab',
    name: 'GitLab DevOps',
    provider: 'composio',
    composioApp: 'gitlab',
    category: 'Engineering',
    protocol: 'OAuth 2.0',
    description: 'Merge requests, CI/CD pipelines, and secure code repositories',
    scopes: ['read_api', 'read_repository'],
    assignedAgents: ['CodeReviewAgent'],
  },
  {
    id: 'datadog',
    name: 'Datadog APM',
    provider: 'composio',
    composioApp: 'datadog',
    category: 'Engineering',
    protocol: 'OAuth 2.0',
    description: 'Service health dashboards, synthetic monitors, and error traces',
    scopes: ['metrics:read', 'monitors:read'],
    assignedAgents: ['DevOpsAgent'],
  },
  {
    id: 'sentry',
    name: 'Sentry Error Tracking',
    provider: 'composio',
    composioApp: 'sentry',
    category: 'Engineering',
    protocol: 'OAuth 2.0',
    description: 'Real-time crash reports, stack traces, and release regression alerts',
    scopes: ['event:read', 'project:read'],
    assignedAgents: ['DevOpsAgent', 'CodeReviewAgent'],
  },
  {
    id: 'pagerduty',
    name: 'PagerDuty On-Call',
    provider: 'composio',
    composioApp: 'pagerduty',
    category: 'Engineering',
    protocol: 'OAuth 2.0',
    description: 'Incident escalation policies, schedules, and live alerts',
    scopes: ['incidents:read', 'schedules:read'],
    assignedAgents: ['DevOpsAgent'],
  },
  {
    id: 'vercel',
    name: 'Vercel Deployments',
    provider: 'composio',
    composioApp: 'vercel',
    category: 'Engineering',
    protocol: 'OAuth 2.0',
    description: 'Preview deployments, edge network metrics, and environment flags',
    scopes: ['deployments:read', 'projects:read'],
    assignedAgents: ['DevOpsAgent'],
  },
  {
    id: 'twilio',
    name: 'Twilio SMS & Voice',
    provider: 'composio',
    composioApp: 'twilio',
    category: 'Sales',
    protocol: 'OAuth 2.0',
    description: 'Transactional notifications, phone verification, and voice dispatch',
    scopes: ['sms:read', 'voice:read'],
    assignedAgents: ['ExecutiveAlertAgent'],
  },
  {
    id: 'sendgrid',
    name: 'SendGrid Email Delivery',
    provider: 'composio',
    composioApp: 'sendgrid',
    category: 'Sales',
    protocol: 'OAuth 2.0',
    description: 'Marketing campaigns, transactional templates, and delivery statistics',
    scopes: ['mail.send', 'templates:read'],
    assignedAgents: ['ClientOutreachAgent'],
  },
  {
    id: 'intercom',
    name: 'Intercom Customer Messaging',
    provider: 'composio',
    composioApp: 'intercom',
    category: 'Sales',
    protocol: 'OAuth 2.0',
    description: 'In-app messenger chats, user segments, and support articles',
    scopes: ['conversations:read', 'users:read'],
    assignedAgents: ['SupportTriageAgent'],
  },
  {
    id: 'apollo',
    name: 'Apollo.io B2B Intelligence',
    provider: 'composio',
    composioApp: 'apollo',
    category: 'Sales',
    protocol: 'OAuth 2.0',
    description: 'Prospect contact discovery, verified emails, and sequences',
    scopes: ['contacts:search', 'emails:verify'],
    assignedAgents: ['SalesExecutiveAgent'],
  },
  {
    id: 'zoominfo',
    name: 'ZoomInfo Enterprise',
    provider: 'composio',
    composioApp: 'zoominfo',
    category: 'Sales',
    protocol: 'OAuth 2.0',
    description: 'Org charts, company buyer intent signals, and contact phone numbers',
    scopes: ['intent:read', 'org:read'],
    assignedAgents: ['SalesExecutiveAgent'],
  },
  {
    id: 'loom',
    name: 'Loom Video Messaging',
    provider: 'composio',
    composioApp: 'loom',
    category: 'Productivity',
    protocol: 'OAuth 2.0',
    description: 'Screen recording transcripts, video comments, and team folders',
    scopes: ['videos:read', 'transcripts:read'],
    assignedAgents: ['KnowledgeGraphAgent'],
  },
  {
    id: 'superhuman',
    name: 'Superhuman Email',
    provider: 'composio',
    composioApp: 'superhuman',
    category: 'Productivity',
    protocol: 'OAuth 2.0',
    description: 'High-velocity inbox zero commands, snippets, and read receipts',
    scopes: ['messages:read', 'snippets:read'],
    assignedAgents: ['ExecutiveAssistantAgent'],
  },
  {
    id: 'shopify',
    name: 'Shopify Storefront & Admin',
    provider: 'composio',
    composioApp: 'shopify',
    category: 'Financial',
    protocol: 'OAuth 2.0',
    description: 'Product catalog, customer orders, inventory levels, and store analytics',
    scopes: ['read_products', 'read_orders'],
    assignedAgents: ['FinanceAdvisorAgent'],
  },
  {
    id: 'quickbooks',
    name: 'Intuit QuickBooks Online',
    provider: 'composio',
    composioApp: 'quickbooks',
    category: 'Financial',
    protocol: 'OAuth 2.0',
    description: 'General ledger, accounts receivable, balance sheets, and tax reports',
    scopes: ['com.intuit.quickbooks.accounting'],
    assignedAgents: ['FinanceAdvisorAgent', 'BillingAuditAgent'],
  },
  {
    id: 'xero',
    name: 'Xero Accounting',
    provider: 'composio',
    composioApp: 'xero',
    category: 'Financial',
    protocol: 'OAuth 2.0',
    description: 'Bank feeds, invoicing, expense claims, and financial reporting',
    scopes: ['accounting.transactions.read', 'accounting.reports.read'],
    assignedAgents: ['FinanceAdvisorAgent'],
  },
  {
    id: 'mailchimp',
    name: 'Mailchimp Newsletters',
    provider: 'composio',
    composioApp: 'mailchimp',
    category: 'Sales',
    protocol: 'OAuth 2.0',
    description: 'Audience lists, open rate analytics, and email campaign automation',
    scopes: ['campaigns:read', 'lists:read'],
    assignedAgents: ['ClientOutreachAgent'],
  },
  {
    id: 'amplitude',
    name: 'Amplitude Product Analytics',
    provider: 'composio',
    composioApp: 'amplitude',
    category: 'Engineering',
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
    category: 'Engineering',
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
    category: 'Engineering',
    protocol: 'OAuth 2.0',
    description: 'Customer data infrastructure, event tracking specs, and destination pipelines',
    scopes: ['sources:read', 'destinations:read'],
    assignedAgents: ['DataEngineeringAgent'],
  },
  {
    id: 'bigquery',
    name: 'Google BigQuery',
    provider: 'composio',
    composioApp: 'bigquery',
    category: 'Engineering',
    protocol: 'OAuth 2.0',
    description: 'Serverless enterprise cloud data warehouse queries and datasets',
    scopes: ['bigquery.readonly', 'bigquery.jobs.create'],
    assignedAgents: ['DataEngineeringAgent'],
  },
  // ── Education & Learning Connectors ──
  {
    id: 'canvas-lms',
    name: 'Canvas LMS',
    provider: 'composio',
    composioApp: 'canvas',
    category: 'Education',
    protocol: 'OAuth 2.0',
    description: 'Online courses, syllabi, assignments, student submissions, and grading records',
    scopes: ['courses:read', 'assignments:read', 'grades:read'],
    assignedAgents: ['ExecutiveAssistantAgent', 'KnowledgeGraphAgent'],
  },
  {
    id: 'blackboard',
    name: 'Blackboard Learn',
    provider: 'composio',
    composioApp: 'blackboard',
    category: 'Education',
    protocol: 'OAuth 2.0',
    description:
      'Institutional course content, academic transcripts, announcements, and gradebooks',
    scopes: ['read:courses', 'read:grades'],
    assignedAgents: ['KnowledgeGraphAgent'],
  },
  {
    id: 'coursera',
    name: 'Coursera Enterprise',
    provider: 'composio',
    composioApp: 'coursera',
    category: 'Education',
    protocol: 'OAuth 2.0',
    description:
      'Professional certificates, course completions, verified skills, and learning hours',
    scopes: ['user:certifications', 'user:courses'],
    assignedAgents: ['CareerStrategyAgent', 'ResumeBuilderAgent'],
  },
  {
    id: 'moodle',
    name: 'Moodle LMS',
    provider: 'composio',
    composioApp: 'moodle',
    category: 'Education',
    protocol: 'OAuth 2.0',
    description: 'Modular object-oriented learning platform, quiz evaluations, and course modules',
    scopes: ['moodle/course:view', 'moodle/user:read'],
    assignedAgents: ['KnowledgeGraphAgent'],
  },
  {
    id: 'google-classroom',
    name: 'Google Classroom',
    provider: 'composio',
    composioApp: 'google_classroom',
    category: 'Education',
    protocol: 'OAuth 2.0',
    description: 'Class assignments, announcements, student rosters, and coursework submissions',
    scopes: ['classroom.courses.readonly', 'classroom.coursework.me.readonly'],
    assignedAgents: ['ExecutiveAssistantAgent'],
  },
  {
    id: 'duolingo',
    name: 'Duolingo Language',
    provider: 'composio',
    composioApp: 'duolingo',
    category: 'Education',
    protocol: 'OAuth 2.0',
    description: 'Language proficiency milestones, CEFR fluency levels, streaks, and certificates',
    scopes: ['profile:read', 'achievements:read'],
    assignedAgents: ['ResumeBuilderAgent', 'CareerStrategyAgent'],
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
