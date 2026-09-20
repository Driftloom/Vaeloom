'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { ErrorState } from '@/components/shared/ErrorState';
import { useWorkspaceConnectors } from '../../../../hooks/useWorkspace';
import { api } from '../../../../lib/api';
import {
  temporalApi,
  connectorsApi,
  type TemporalWorkflowStatus,
  type ConnectorItem,
  type BuiltinMcpServer,
  type ComposioAppInfo,
  type ComposioStatusResponse,
  type ComposioAppsResponse,
  type McpToolInfo,
  type ConnectorHealthResponse,
} from '../../../../lib/api-client';
import { useToast } from '@/components/shared/Toast';
import { Modal } from '@vaeloom/ui-kit';
import type { Connector, ConnectorProvider } from '@vaeloom/shared-types';

/* ──────────────────────────────────────────────────────────────────────────
   1. Brand SVG Icons (Pixel-matched to Claude Customize UI)
   ────────────────────────────────────────────────────────────────────────── */

function GoogleDriveIcon() {
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

function GmailIcon() {
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

function GoogleCalendarIcon() {
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

function CanvaIcon() {
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

function Microsoft365Icon() {
  return (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="3" width="8.5" height="8.5" rx="1" fill="#F25022" />
      <rect x="12.5" y="3" width="8.5" height="8.5" rx="1" fill="#7FBA00" />
      <rect x="3" y="12.5" width="8.5" height="8.5" rx="1" fill="#00A4EF" />
      <rect x="12.5" y="12.5" width="8.5" height="8.5" rx="1" fill="#FFB900" />
    </svg>
  );
}

function NotionIcon() {
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

function FigmaIcon() {
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

function SlackIcon() {
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

function AtlassianIcon() {
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

function HubSpotIcon() {
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

function GitHubIcon() {
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

function LinearIcon() {
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

function AtsCrawlerIcon() {
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

function BrowserIcon() {
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

function VerifiedCheck() {
  return (
    <span
      className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-[#272623] text-[#a3a19b] ml-1.5 shrink-0"
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

function PlusIcon() {
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

function SearchIcon() {
  return (
    <svg
      className="w-4 h-4 text-[#716f6a]"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function ShieldCheckIcon() {
  return (
    <svg
      className="w-4 h-4 text-success"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

function AppBrandIcon({ name, id }: { name: string; id: string; category?: string }) {
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
    intercom: { bg: 'bg-[#0057ff]/20', text: 'text-[#4c84ff]', border: 'border-[#0057ff]/40' },
    apollo: { bg: 'bg-[#ffc107]/20', text: 'text-[#ffd54f]', border: 'border-[#ffc107]/40' },
    zoominfo: { bg: 'bg-[#0072ce]/20', text: 'text-[#3da0f0]', border: 'border-[#0072ce]/40' },
    loom: { bg: 'bg-[#625df5]/20', text: 'text-[#8581f7]', border: 'border-[#625df5]/40' },
    superhuman: { bg: 'bg-[#e5a93c]/20', text: 'text-[#f2be63]', border: 'border-[#e5a93c]/40' },
  };

  const scheme = colorMap[id.toLowerCase()] || {
    bg: 'bg-[#1f1e1c]',
    text: 'text-[#d4d2cc]',
    border: 'border-[#33322f]',
  };

  const initials = name
    .split(/[\s-_]+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div
      className={`w-7 h-7 rounded-lg ${scheme.bg} ${scheme.border} border flex items-center justify-center font-semibold text-xs ${scheme.text} shadow-inner select-none`}
    >
      {initials || name[0]?.toUpperCase() || 'S'}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   2. Connector Catalog Items & Enterprise Metadata
   ────────────────────────────────────────────────────────────────────────── */

interface ConnectorDefinition {
  id: string;
  name: string;
  provider: ConnectorProvider | 'composio' | 'mcp' | 'native';
  category: string;
  protocol: 'OAuth 2.0' | 'MCP (stdio)' | 'MCP (Streamable-HTTP)' | 'REST API' | 'Native Sovereign';
  description: string;
  scopes: string[];
  renderIcon: () => React.ReactNode;
  composioApp?: string;
  mcpServerId?: string;
  assignedAgents: string[];
  actionCount?: number;
}

const CATALOG_CONNECTORS: ConnectorDefinition[] = [
  {
    id: 'google-drive',
    name: 'Google Drive',
    provider: 'drive',
    category: 'Google',
    protocol: 'OAuth 2.0',
    description: 'Search, read, and upload files instantly',
    scopes: ['drive.readonly', 'files.read'],
    assignedAgents: ['DocumentIngestionAgent', 'ResumeBuilderAgent'],
    renderIcon: () => <GoogleDriveIcon />,
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
    renderIcon: () => <GmailIcon />,
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
    renderIcon: () => <GoogleCalendarIcon />,
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
    renderIcon: () => <CanvaIcon />,
  },
  {
    id: 'microsoft-365',
    name: 'Microsoft 365',
    provider: 'composio',
    composioApp: 'microsoft-365',
    category: 'Productivity',
    protocol: 'OAuth 2.0',
    description:
      'Access your company’s SharePoint, OneDrive, Outlook, and Teams directly in Claude',
    scopes: ['Files.Read.All', 'Mail.Read', 'Calendars.Read'],
    assignedAgents: ['EnterpriseIngestionAgent', 'DocumentAuditAgent'],
    renderIcon: () => <Microsoft365Icon />,
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
    renderIcon: () => <NotionIcon />,
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
    renderIcon: () => <FigmaIcon />,
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
    renderIcon: () => <SlackIcon />,
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
    renderIcon: () => <AtlassianIcon />,
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
    renderIcon: () => <HubSpotIcon />,
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
    renderIcon: () => <GitHubIcon />,
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
    renderIcon: () => <LinearIcon />,
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
    renderIcon: () => <AtsCrawlerIcon />,
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
    renderIcon: () => <BrowserIcon />,
  },
];

const PROVIDER_META: Record<string, { name: string; scopes: string[]; description: string }> = {
  drive: {
    name: 'Google Drive',
    scopes: ['drive.readonly'],
    description: 'Read-only access to files you open with Vaeloom. No write/delete.',
  },
  github: {
    name: 'GitHub',
    scopes: ['repo:read', 'user:read'],
    description: 'Read your repos and profile. No write access.',
  },
  gmail: {
    name: 'Gmail',
    scopes: ['gmail.readonly'],
    description: 'Read-only mailbox access for ingestion. Drafts require approval.',
  },
  notion: {
    name: 'Notion',
    scopes: ['notion:read'],
    description: 'Read pages you share. No edit access.',
  },
  calendar: {
    name: 'Google Calendar',
    scopes: ['calendar.readonly'],
    description: 'Read events to extract deadlines. No write.',
  },
  slack: {
    name: 'Slack',
    scopes: ['channels:read', 'chat:write'],
    description: 'Read channels you authorize. Messages via approval.',
  },
};

function formatDate(iso?: string): string {
  if (!iso) return 'Never';
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function ConnectorsPage() {
  const params = useParams();
  const workspaceId = (params?.['workspaceId'] as string | undefined) ?? '';
  const { connectors, isLoading, isError, mutate } = useWorkspaceConnectors(workspaceId);
  const { toast } = useToast();

  // Navigation State
  const [topTab, setTopTab] = useState<'skills' | 'connectors' | 'plugins'>('connectors');
  const [activeView, setActiveView] = useState<'yours' | 'discover'>('discover');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<string>('All');

  // Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedItemDetails, setSelectedItemDetails] = useState<ConnectorDefinition | null>(null);
  const [pendingProvider, setPendingProvider] = useState<ConnectorProvider | null>(null);
  const [healthTarget, setHealthTarget] = useState<ConnectorHealthResponse | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [toolsModalTarget, setToolsModalTarget] = useState<{ id: string; name: string } | null>(
    null,
  );
  const [toolsList, setToolsList] = useState<McpToolInfo[]>([]);
  const [toolsLoading, setToolsLoading] = useState(false);

  // Busy trackers
  const [busy, setBusy] = useState<string | null>(null);
  const [syncBusy, setSyncBusy] = useState<string | null>(null);

  // Dynamic Backend State
  const [dynamicConnectors, setDynamicConnectors] = useState<ConnectorItem[]>([]);
  const [composioApps, setComposioApps] = useState<ComposioAppInfo[]>([]);
  const [composioCatalogApps, setComposioCatalogApps] = useState<ComposioAppInfo[]>([]);
  const [composioTotalCount, setComposioTotalCount] = useState<number>(269);
  const [showAllConnectors, setShowAllConnectors] = useState<boolean>(false);
  const [builtinServers, setBuiltinServers] = useState<BuiltinMcpServer[]>([]);
  const [composioSyncing, setComposioSyncing] = useState<boolean>(false);

  // Form State for Add Custom Connector
  const [customType, setCustomType] = useState<'mcp' | 'rest' | 'graphql'>('mcp');
  const [customName, setCustomName] = useState('');
  const [customUrl, setCustomUrl] = useState('');
  const [customApiKey, setCustomApiKey] = useState('');
  const [customAuthToken, setCustomAuthToken] = useState('');
  const [customMcpTransport, setCustomMcpTransport] = useState<'stdio' | 'http'>('stdio');
  const [customCommand, setCustomCommand] = useState('');
  const [customArgs, setCustomArgs] = useState('');
  const [submittingCustom, setSubmittingCustom] = useState(false);

  // Load Dynamic Data from Real Backend
  const loadDynamicData = useCallback(async () => {
    if (!workspaceId) return;
    try {
      const [conns, compStatus, compApps, mcp] = await Promise.allSettled([
        connectorsApi?.list
          ? connectorsApi.list(workspaceId)
          : Promise.resolve<ConnectorItem[]>([]),
        connectorsApi?.composio?.status
          ? connectorsApi.composio.status()
          : Promise.resolve<ComposioStatusResponse>({
              enabled: false,
              popular_apps: [],
              total_apps: 269,
            }),
        connectorsApi?.composio?.apps
          ? connectorsApi.composio.apps({ limit: 300 })
          : Promise.resolve<ComposioAppsResponse>({
              total: 0,
              limit: 300,
              offset: 0,
              apps: [],
              categories: [],
            }),
        connectorsApi?.mcp?.builtin
          ? connectorsApi.mcp.builtin()
          : Promise.resolve<{ builtin_servers: BuiltinMcpServer[] }>({ builtin_servers: [] }),
      ]);

      if (conns.status === 'fulfilled' && Array.isArray(conns.value)) {
        setDynamicConnectors(conns.value);
      }
      if (compStatus.status === 'fulfilled' && compStatus.value?.popular_apps) {
        setComposioApps(compStatus.value.popular_apps);
        if (compStatus.value.total_apps) {
          setComposioTotalCount(compStatus.value.total_apps);
        }
      }
      if (
        compApps.status === 'fulfilled' &&
        compApps.value?.apps &&
        compApps.value.apps.length > 0
      ) {
        setComposioCatalogApps(compApps.value.apps);
        if (compApps.value.total) {
          setComposioTotalCount(compApps.value.total);
        }
      }
      if (mcp.status === 'fulfilled' && mcp.value?.builtin_servers) {
        setBuiltinServers(mcp.value.builtin_servers);
      }
    } catch {
      // safe fallback
    }
  }, [workspaceId]);

  useEffect(() => {
    loadDynamicData();
  }, [loadDynamicData]);

  // Connectors Map for Connected Checking
  const byProvider = useMemo(() => new Map(connectors.map((c) => [c.provider, c])), [connectors]);

  // Check if a catalog item is connected
  const isItemConnected = useCallback(
    (item: ConnectorDefinition): boolean => {
      if (item.provider !== 'composio' && item.provider !== 'mcp' && item.provider !== 'native') {
        return byProvider.has(item.provider);
      }
      if (item.id === 'native-ats-mcp') {
        return dynamicConnectors.some(
          (c) =>
            c.type === 'mcp' &&
            (c.name.toLowerCase().includes('job-search') || c.name.toLowerCase().includes('ats')),
        );
      }
      if (item.provider === 'composio') {
        const appName = (item.composioApp || item.id.replace('composio-', '')).toLowerCase();
        return dynamicConnectors.some(
          (c) => c.name.toLowerCase() === appName || c.config?.['app'] === appName,
        );
      }
      return false;
    },
    [byProvider, dynamicConnectors],
  );

  // Connect Handler (triggers OAuth modal or API)
  const handleInitiateConnect = (item: ConnectorDefinition) => {
    if (item.provider !== 'composio' && item.provider !== 'mcp' && item.provider !== 'native') {
      setPendingProvider(item.provider as ConnectorProvider);
      return;
    }

    if (item.id === 'native-ats-mcp') {
      void handleAttachAtsMcp();
      return;
    }

    if (item.provider === 'composio') {
      const appName = item.composioApp || item.id.replace('composio-', '');
      void handleComposioOAuth(appName, item.name);
      return;
    }

    if (item.provider === 'mcp') {
      setIsAddModalOpen(true);
      setCustomType('mcp');
      setCustomName(item.name);
      return;
    }

    toast({
      tone: 'info',
      title: 'Native Service Active',
      detail: `${item.name} is sovereignly enabled in this workspace.`,
    });
  };

  // Perform OAuth Connect
  const handleExecuteConnect = async (provider: ConnectorProvider) => {
    const meta = PROVIDER_META[provider];
    setBusy(`connect-${provider}`);
    try {
      await api.integrations.create({ name: meta?.name ?? provider, provider });
      await mutate();
      toast({
        tone: 'success',
        title: 'Connector connected',
        detail: `${meta?.name ?? provider} successfully linked to workspace.`,
      });
      setPendingProvider(null);
      loadDynamicData();
    } catch (err) {
      toast({
        tone: 'error',
        title: 'Connect failed',
        detail: err instanceof Error ? err.message : 'Please try again.',
      });
    } finally {
      setBusy(null);
    }
  };

  // Attach Builtin ATS MCP
  const handleAttachAtsMcp = async () => {
    if (!workspaceId) return;
    setBusy('attach-ats-mcp');
    try {
      const builtinRes = await connectorsApi.mcp.builtin();
      const server =
        builtinRes.builtin_servers?.find((s) => s.id === 'job-search-mcp') ||
        builtinRes.builtin_servers?.[0];

      if (!server) {
        throw new Error('Public ATS Job Search MCP definition not found.');
      }

      const created = await connectorsApi.create({
        name: server.name,
        type: 'mcp',
        workspace_id: workspaceId,
        config: server.config,
      });

      await connectorsApi.mcp.sync(created.id, workspaceId);

      toast({
        tone: 'success',
        title: 'MCP Server Attached',
        detail: `Attached ${server.name} and synchronized agent tools.`,
      });
      loadDynamicData();
      await mutate();
    } catch (err) {
      toast({
        tone: 'error',
        title: 'Attachment Failed',
        detail: err instanceof Error ? err.message : 'Could not attach MCP server.',
      });
    } finally {
      setBusy(null);
    }
  };

  // Composio OAuth
  const handleComposioOAuth = async (appId: string, appName: string) => {
    if (!workspaceId) return;
    setBusy(`composio-${appId}`);
    try {
      const res = await connectorsApi.composio.authUrl(appId, workspaceId);
      const url = res.auth_url || res.url;
      if (url) {
        window.open(url, '_blank', 'noopener,noreferrer');
        toast({
          tone: 'info',
          title: 'Composio OAuth Opened',
          detail: `Complete authorization for ${appName} in the opened window.`,
        });
      } else {
        toast({
          tone: 'error',
          title: 'Key Required',
          detail: res.message || 'Set COMPOSIO_API_KEY in environment to enable OAuth.',
        });
      }
    } catch (err) {
      toast({
        tone: 'error',
        title: 'Auth Failed',
        detail: err instanceof Error ? err.message : 'Could not generate OAuth URL.',
      });
    } finally {
      setBusy(null);
    }
  };

  // Sync All Composio SaaS Tools
  const handleSyncAllComposio = async () => {
    if (!workspaceId) return;
    setComposioSyncing(true);
    try {
      const res = await connectorsApi.composio.sync(workspaceId);
      toast({
        tone: 'success',
        title: 'Composio SaaS Synced',
        detail: `Successfully bridged ${res.count || 0} tools into dynamic agent router.`,
      });
      loadDynamicData();
    } catch (err) {
      toast({
        tone: 'error',
        title: 'Sync Failed',
        detail: err instanceof Error ? err.message : 'Composio synchronization failed.',
      });
    } finally {
      setComposioSyncing(false);
    }
  };

  // Sync Handler
  const handleSync = async (connector: Connector) => {
    if (!workspaceId) return;
    setSyncBusy(connector.id);
    setBusy(`sync-${connector.id}`);
    try {
      try {
        await temporalApi.startConnectorSync({
          workspace_id: workspaceId,
          connector_id: connector.id,
          sync_token: connector.id.slice(0, 8),
        });
        toast({ tone: 'success', title: 'Durable sync started', detail: connector.id });
      } catch (e: unknown) {
        const errMsg = e instanceof Error ? e.message : String(e);
        if ((e as { status?: number })?.status === 503 || errMsg.includes('503')) {
          const res = await api.integrations.sync(connector.id);
          toast({
            tone: 'success',
            title: 'Sync started',
            detail: (res as { message?: string })?.message ?? 'Sync requested',
          });
        } else {
          throw e;
        }
      }
      await mutate();
    } catch (err) {
      toast({
        tone: 'error',
        title: 'Sync failed',
        detail: err instanceof Error ? err.message : 'Please try again.',
      });
    } finally {
      setBusy(null);
      setSyncBusy(null);
    }
  };

  // Dynamic Connector Sync
  const handleDynamicSync = async (connId: string) => {
    setBusy(`dyn-sync-${connId}`);
    try {
      const res = await connectorsApi.sync(connId);
      if (res.status === 'syncing' && res.error?.includes('in progress')) {
        toast({
          tone: 'info',
          title: 'Sync in Progress',
          detail: 'A sync task is already running.',
        });
      } else {
        toast({
          tone: 'success',
          title: 'Sync Completed',
          detail: `Records: ${res.records_synced ?? 0}`,
        });
      }
      loadDynamicData();
    } catch (err) {
      toast({
        tone: 'error',
        title: 'Sync Failed',
        detail: err instanceof Error ? err.message : 'Error',
      });
    } finally {
      setBusy(null);
    }
  };

  // Dynamic Connector Connection Test
  const handleTestConnection = async (connId: string) => {
    setBusy(`dyn-test-${connId}`);
    try {
      const res = await connectorsApi.test(connId);
      if (res.status === 'ok') {
        toast({
          tone: 'success',
          title: 'Connection Healthy',
          detail: `Target endpoint reachable (HTTP ${res.code ?? 200}).`,
        });
      } else {
        toast({
          tone: 'error',
          title: 'Connection Warning',
          detail: res.error || res.message || 'Endpoint returned unhealthy status.',
        });
      }
    } catch (err) {
      toast({
        tone: 'error',
        title: 'Test Failed',
        detail: err instanceof Error ? err.message : 'Error',
      });
    } finally {
      setBusy(null);
    }
  };

  // Health Inspector
  const handleInspectHealth = async (connId: string) => {
    setHealthLoading(true);
    try {
      const res = await connectorsApi.health(connId);
      setHealthTarget(res);
    } catch (err) {
      toast({
        tone: 'error',
        title: 'Health Check Failed',
        detail: err instanceof Error ? err.message : 'Error',
      });
    } finally {
      setHealthLoading(false);
    }
  };

  // Tools Inspector
  const handleInspectTools = async (connId: string, name: string) => {
    setToolsLoading(true);
    setToolsModalTarget({ id: connId, name });
    try {
      const res = await connectorsApi.mcp.listTools(connId);
      setToolsList(Array.isArray(res) ? res : []);
    } catch (err) {
      toast({
        tone: 'error',
        title: 'Tool Discovery Failed',
        detail: err instanceof Error ? err.message : 'Error',
      });
    } finally {
      setToolsLoading(false);
    }
  };

  // Disconnect / Revoke
  const handleRevoke = async (connector: Connector) => {
    const proceed = window.confirm(
      `Revoke ${PROVIDER_META[connector.provider]?.name ?? connector.provider}? This will disconnect future syncs.`,
    );
    if (!proceed) return;
    setBusy(`revoke-${connector.id}`);
    try {
      await api.request(`/integrations/${connector.id}`, { method: 'DELETE' });
      await mutate();
      toast({ tone: 'success', title: 'Revoked', detail: `${connector.provider} disconnected` });
    } catch (err) {
      toast({
        tone: 'error',
        title: 'Revoke failed',
        detail: err instanceof Error ? err.message : 'Please try again.',
      });
    } finally {
      setBusy(null);
    }
  };

  // Delete Dynamic Connector
  const handleDeleteDynamic = async (connId: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete connector "${name}"?`)) return;
    setBusy(`del-${connId}`);
    try {
      await connectorsApi.delete(connId);
      toast({ tone: 'info', title: 'Connector Removed', detail: `${name} deleted.` });
      loadDynamicData();
      await mutate();
    } catch (err) {
      toast({
        tone: 'error',
        title: 'Delete Failed',
        detail: err instanceof Error ? err.message : 'Error',
      });
    } finally {
      setBusy(null);
    }
  };

  // Create Custom Connector
  const handleCreateCustom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspaceId || !customName.trim()) return;
    setSubmittingCustom(true);
    try {
      const config: Record<string, any> = {};
      if (customType === 'rest' || customType === 'graphql') {
        config['url'] = customUrl.trim();
        if (customApiKey.trim()) config['apiKey'] = customApiKey.trim();
        if (customAuthToken.trim()) config['authToken'] = customAuthToken.trim();
      } else if (customType === 'mcp') {
        config['transport'] = customMcpTransport;
        if (customMcpTransport === 'stdio') {
          config['command'] = customCommand.trim();
          config['args'] = customArgs.trim() ? customArgs.trim().split(' ') : [];
        } else {
          config['url'] = customUrl.trim();
          config['allow_insecure'] = customUrl.trim().startsWith('http://');
        }
      }

      const created = await connectorsApi.create({
        name: customName.trim(),
        type: customType,
        workspace_id: workspaceId,
        config,
      });

      if (customType === 'mcp') {
        await connectorsApi.mcp.sync(created.id, workspaceId);
      }

      toast({
        tone: 'success',
        title: 'Connector Created',
        detail: `${customName} successfully registered.`,
      });
      setIsAddModalOpen(false);
      setCustomName('');
      setCustomUrl('');
      setCustomApiKey('');
      setCustomAuthToken('');
      setCustomCommand('');
      setCustomArgs('');
      loadDynamicData();
      await mutate();
    } catch (err) {
      toast({
        tone: 'error',
        title: 'Creation Failed',
        detail: err instanceof Error ? err.message : 'Error',
      });
    } finally {
      setSubmittingCustom(false);
    }
  };

  // Merge base catalog with all 260+ Composio apps
  const allAvailableConnectors = useMemo(() => {
    const existingIds = new Set(
      CATALOG_CONNECTORS.map((c) => (c.composioApp || c.id).toLowerCase()),
    );
    const composioDefs: ConnectorDefinition[] = composioCatalogApps
      .filter((app) => !existingIds.has(app.id.toLowerCase()))
      .map((app) => ({
        id: `composio-${app.id}`,
        name: app.name,
        provider: 'composio' as const,
        composioApp: app.id,
        category: app.category || 'Productivity',
        protocol: 'OAuth 2.0' as const,
        description:
          app.description || `Integrate ${app.name} with autonomous workspace agent workflows`,
        scopes: [`${app.id}:read`, `${app.id}:actions (Approval-Gated)`],
        assignedAgents: ['WorkflowAgent', 'AutonomousAgent'],
        actionCount: app.action_count,
        renderIcon: () => <AppBrandIcon name={app.name} id={app.id} category={app.category} />,
      }));

    return [...CATALOG_CONNECTORS, ...composioDefs];
  }, [composioCatalogApps]);

  // Filtered Catalog for Discover View
  const filteredCatalog = useMemo(() => {
    let list = allAvailableConnectors;

    if (selectedFilter !== 'All') {
      list = list.filter((item) => {
        if (selectedFilter === 'Google') return item.category === 'Google';
        return item.category.toLowerCase().includes(selectedFilter.toLowerCase());
      });
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter((item) => {
        const matchName = item.name.toLowerCase().includes(q);
        const matchDesc = item.description.toLowerCase().includes(q);
        const matchProtocol = item.protocol.toLowerCase().includes(q);
        const matchCat = item.category.toLowerCase().includes(q);
        return matchName || matchDesc || matchProtocol || matchCat;
      });
    } else if (!showAllConnectors && selectedFilter === 'All') {
      // Default view shows Top Connectors (14)
      return CATALOG_CONNECTORS;
    }

    return list;
  }, [allAvailableConnectors, selectedFilter, searchQuery, showAllConnectors]);

  // Loading View
  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <LoadingSpinner text="Loading connectors..." />
      </div>
    );
  }

  // Error View
  if (isError) {
    return (
      <ErrorState
        title="Failed to load connectors"
        message="Could not load your workspace connectors. Please check your network and try again."
        onRetry={() => {
          void mutate();
        }}
      />
    );
  }

  const totalConnectedCount = connectors.length + dynamicConnectors.length;
  const totalCatalogCount = composioTotalCount || allAvailableConnectors.length;

  return (
    <div className="min-h-screen text-[#e3e1db] font-sans pb-16">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* ──────────────────────────────────────────────────────────────────
            3. Top Header Area (Exact Claude Customize Header)
            ────────────────────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-white">Customize</h1>
            <p className="text-xs text-[#8e8c85] mt-1">
              Connect SaaS integrations, MCP tools, and sovereign scrapers directly to your
              workspace agent loop.
            </p>
          </div>

          {/* Enterprise Security Badge */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#181716] border border-[#2a2926] text-xs font-mono text-[#a3a19b]">
            <ShieldCheckIcon />
            <span>Zero-Trust SSRF Guarded</span>
            <span className="text-[#454440]">•</span>
            <span className="text-success">AES-256 Encrypted</span>
          </div>
        </div>

        {/* Top Navigation Row: Left Group (Skills/Connectors/Plugins) + Middle Group (Yours/Discover) + Add Button */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b border-[#22211e]">
          {/* Left Cluster: Skills | Connectors | Plugins */}
          <div className="inline-flex items-center p-1 rounded-full bg-[#181716] border border-[#2a2926]">
            <Link
              href={`/workspace/${workspaceId}/capabilities`}
              className="px-4 py-1.5 rounded-full text-xs font-medium text-[#8e8c85] hover:text-white transition-colors"
            >
              Skills
            </Link>
            <button
              type="button"
              onClick={() => setTopTab('connectors')}
              className="px-4 py-1.5 rounded-full text-xs font-medium bg-[#2b2a27] text-white shadow-sm transition-colors"
            >
              Connectors
            </button>
            <Link
              href={`/workspace/${workspaceId}/marketplace`}
              className="px-4 py-1.5 rounded-full text-xs font-medium text-[#8e8c85] hover:text-white transition-colors"
            >
              Plugins
            </Link>
          </div>

          {/* Center Cluster: Yours | Discover */}
          <div className="inline-flex items-center p-1 rounded-full bg-[#181716] border border-[#2a2926]">
            <button
              type="button"
              onClick={() => setActiveView('yours')}
              className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors flex items-center gap-1.5 ${
                activeView === 'yours'
                  ? 'bg-[#2b2a27] text-white shadow-sm'
                  : 'text-[#8e8c85] hover:text-white'
              }`}
            >
              <span>Yours</span>
              {totalConnectedCount > 0 && (
                <span className="text-2xs font-mono px-1.5 py-0.2 rounded-full bg-[#3a3935] text-[#d4d2cc]">
                  {totalConnectedCount}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setActiveView('discover')}
              className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors ${
                activeView === 'discover'
                  ? 'bg-[#2b2a27] text-white shadow-sm'
                  : 'text-[#8e8c85] hover:text-white'
              }`}
            >
              Discover
            </button>
          </div>

          {/* Right Action: Add Button */}
          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold bg-white text-[#141413] hover:bg-[#eae8e4] transition-all shadow-sm active:scale-95"
          >
            <PlusIcon />
            <span>Add</span>
          </button>
        </div>

        {/* ──────────────────────────────────────────────────────────────────
            4. Search and Filter Controls (Claude Design)
            ────────────────────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
          {/* Search Box */}
          <div className="relative flex-1 max-w-xl">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
              <SearchIcon />
            </span>
            <input
              type="text"
              placeholder="Search connectors"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-surface-100 border border-border text-sm text-text placeholder:text-text-muted focus:outline-none focus:border-border-strong transition-colors"
            />
          </div>

          {/* Filter Dropdown */}
          <div className="flex items-center gap-2">
            <select
              value={selectedFilter}
              onChange={(e) => {
                setSelectedFilter(e.target.value);
                if (e.target.value !== 'All') {
                  setShowAllConnectors(true);
                }
              }}
              className="px-3.5 py-2 rounded-xl bg-[#181716] border border-[#2a2926] text-xs font-medium text-[#a3a19b] hover:text-white hover:border-[#383733] focus:outline-none focus:border-[#454440] cursor-pointer transition-colors"
            >
              <option value="All">Filter: All ({totalCatalogCount})</option>
              <option value="Google">Filter: Google Workspace</option>
              <option value="Productivity">Filter: Productivity & Docs</option>
              <option value="Engineering">Filter: Engineering & DevOps</option>
              <option value="Communication">Filter: Communication & Messaging</option>
              <option value="Sales">Filter: Sales & CRM</option>
              <option value="Finance">Filter: Finance & Commerce</option>
              <option value="AI & Data">Filter: AI & Data Platforms</option>
              <option value="HR">Filter: HR & Recruiting</option>
              <option value="MCP">Filter: Model Context Protocol (MCP)</option>
              <option value="Native">Filter: Native Sovereign Tools</option>
            </select>
          </div>
        </div>

        {/* ──────────────────────────────────────────────────────────────────
            5. DISCOVER VIEW — Top Connectors Grid
            ────────────────────────────────────────────────────────────────── */}
        {activeView === 'discover' && (
          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-medium text-white/90">
                  {searchQuery.trim()
                    ? `Search results (${filteredCatalog.length})`
                    : selectedFilter !== 'All'
                      ? `${selectedFilter} Connectors (${filteredCatalog.length})`
                      : showAllConnectors
                        ? `All connectors (${filteredCatalog.length})`
                        : 'Top connectors'}
                </h2>
                <span className="text-xs text-[#716f6a] font-mono">({filteredCatalog.length})</span>
                {!showAllConnectors && !searchQuery.trim() && selectedFilter === 'All' && (
                  <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-[#1e293b] border border-[#38bdf8]/30 text-[#38bdf8] font-mono ml-2 hidden sm:inline-flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#38bdf8] animate-pulse" />
                    260+ available
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  if (showAllConnectors) {
                    setShowAllConnectors(false);
                    setSelectedFilter('All');
                    setSearchQuery('');
                  } else {
                    setShowAllConnectors(true);
                  }
                }}
                className="text-xs text-[#8e8c85] hover:text-white transition-colors"
              >
                {showAllConnectors ? 'Show top connectors' : `Show all (${totalCatalogCount})`}
              </button>
            </div>

            {filteredCatalog.length === 0 ? (
              <div className="py-16 text-center rounded-2xl border border-dashed border-[#2a2926] bg-[#141413]">
                <p className="text-sm text-[#8e8c85]">No connectors match your search or filter.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {filteredCatalog.map((item) => {
                  const connected = isItemConnected(item);
                  const legacyConn =
                    item.provider !== 'composio' &&
                    item.provider !== 'mcp' &&
                    item.provider !== 'native'
                      ? byProvider.get(item.provider as ConnectorProvider)
                      : null;
                  const isBusy =
                    busy === `connect-${item.provider}` || busy === `sync-${legacyConn?.id}`;

                  return (
                    <div
                      key={item.id}
                      data-testid="connector-card"
                      className="group relative flex items-center justify-between p-4 rounded-2xl bg-[#181716] border border-[#272623] hover:border-[#383733] transition-all duration-150 cursor-pointer"
                      onClick={() => setSelectedItemDetails(item)}
                    >
                      <div className="flex items-center gap-3.5 min-w-0 pr-3">
                        {/* Tile Icon */}
                        <div className="w-11 h-11 rounded-xl bg-[#121110] border border-[#272623] flex items-center justify-center shrink-0 shadow-inner">
                          {item.renderIcon()}
                        </div>

                        {/* Text Block */}
                        <div className="min-w-0">
                          <div className="flex items-center">
                            <h3
                              data-testid="connector-name"
                              className="font-medium text-white text-[15px] truncate group-hover:text-primary transition-colors"
                            >
                              {item.name}
                            </h3>
                            <VerifiedCheck />
                            {item.actionCount ? (
                              <span className="text-2xs font-mono text-[#8e8c85] bg-[#22211e] px-1.5 py-0.5 rounded border border-[#2a2926] ml-2 hidden sm:inline-block">
                                {item.actionCount} actions
                              </span>
                            ) : null}
                          </div>
                          <p className="text-xs text-[#8e8c85] line-clamp-2 mt-0.5 leading-relaxed">
                            {item.description}
                          </p>
                        </div>
                      </div>

                      {/* Right Action Button (Prevent bubble to card click) */}
                      <div
                        className="flex items-center gap-2 shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {connected ? (
                          <div className="flex items-center gap-2">
                            <span
                              data-testid="sync-status"
                              className="text-2xs font-mono px-2 py-0.5 rounded border border-success/30 text-success bg-success/15 hidden sm:inline-flex items-center gap-1"
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                              Added
                            </span>
                            {legacyConn ? (
                              <button
                                type="button"
                                data-testid="sync-button"
                                onClick={() => handleSync(legacyConn)}
                                disabled={isBusy || syncBusy === legacyConn.id}
                                className="px-3 py-1 rounded-lg border border-[#33322f] hover:border-[#52504b] bg-transparent hover:bg-white/5 text-xs text-[#d4d2cc] hover:text-white transition-colors"
                              >
                                Sync Now
                              </button>
                            ) : null}
                          </div>
                        ) : (
                          <button
                            type="button"
                            data-testid="connect-button"
                            onClick={() => handleInitiateConnect(item)}
                            disabled={isBusy}
                            title="Connect"
                            className="w-8 h-8 rounded-lg border border-[#33322f] hover:border-[#52504b] bg-transparent hover:bg-white/5 text-[#a3a19b] hover:text-white flex items-center justify-center transition-colors active:scale-95"
                          >
                            <PlusIcon />
                            <span className="sr-only">Connect</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ──────────────────────────────────────────────────────────────────
            6. YOURS VIEW — Active Workspace Connectors Hub
            ────────────────────────────────────────────────────────────────── */}
        {activeView === 'yours' && (
          <div className="space-y-4 pt-2">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-2">
              <div>
                <h2 className="text-base font-medium text-white/90">
                  Configured Connectors & Bridges
                </h2>
                <p className="text-xs text-[#8e8c85]">
                  {totalConnectedCount} live sovereign bridges registered to workspace {workspaceId}
                  .
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSyncAllComposio}
                  disabled={composioSyncing}
                  className="px-3.5 py-1.5 rounded-xl border border-[#33322f] hover:border-[#52504b] text-xs font-medium text-[#d4d2cc] hover:text-white transition-colors flex items-center gap-1.5"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-warning animate-pulse" />
                  <span>{composioSyncing ? 'Syncing SaaS...' : 'Sync Composio SaaS'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(true)}
                  className="px-3.5 py-1.5 rounded-xl bg-white text-black text-xs font-semibold hover:bg-[#eae8e4] transition-colors"
                >
                  + Add Custom Connector
                </button>
              </div>
            </div>

            {totalConnectedCount === 0 ? (
              <div className="py-16 text-center rounded-2xl border border-dashed border-[#2a2926] bg-[#141413] space-y-3">
                <p className="text-sm text-[#8e8c85]">
                  No connectors connected in this workspace yet.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveView('discover')}
                  className="px-4 py-1.5 rounded-full text-xs font-semibold bg-white text-black hover:bg-[#eae8e4] transition-colors"
                >
                  Discover Top Connectors
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {/* Standard Legacy / OAuth Connectors */}
                {connectors.map((c) => {
                  const meta = PROVIDER_META[c.provider];
                  const isSyncing = syncBusy === c.id || busy === `sync-${c.id}`;

                  return (
                    <div
                      key={c.id}
                      data-testid="connector-card"
                      className="group flex flex-col justify-between p-4 rounded-2xl bg-[#181716] border border-[#272623] hover:border-[#383733] transition-all"
                    >
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-[#121110] border border-[#272623] flex items-center justify-center">
                            {c.provider === 'drive' && <GoogleDriveIcon />}
                            {c.provider === 'gmail' && <GmailIcon />}
                            {c.provider === 'calendar' && <GoogleCalendarIcon />}
                            {c.provider === 'notion' && <NotionIcon />}
                            {c.provider === 'slack' && <SlackIcon />}
                            {c.provider === 'github' && <GitHubIcon />}
                          </div>
                          <div>
                            <h3
                              data-testid="connector-name"
                              className="font-medium text-white text-[15px]"
                            >
                              {meta?.name ?? c.provider}
                            </h3>
                            <p className="text-xs text-[#8e8c85]">{meta?.scopes.join(', ')}</p>
                          </div>
                        </div>

                        <span
                          data-testid="sync-status"
                          className="text-2xs font-mono px-2 py-0.5 rounded border border-success/30 text-success bg-success/15 uppercase"
                        >
                          {c.status}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-2xs font-mono text-[#716f6a] pt-2 border-t border-[#272623]">
                        <span>Last sync: {formatDate(c.lastSyncAt)}</span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            data-testid="sync-button"
                            onClick={() => handleSync(c)}
                            disabled={isSyncing}
                            className="px-2.5 py-1 rounded-lg border border-[#33322f] hover:border-[#52504b] text-xs text-[#d4d2cc] hover:text-white transition-colors"
                          >
                            {isSyncing ? 'Syncing...' : 'Sync Now'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRevoke(c)}
                            className="text-xs text-error/80 hover:text-error transition-colors"
                          >
                            Disconnect
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Dynamic REST, GraphQL & MCP Connectors */}
                {dynamicConnectors.map((conn) => {
                  const isSyncing = busy === `dyn-sync-${conn.id}`;
                  const isTesting = busy === `dyn-test-${conn.id}`;

                  return (
                    <div
                      key={conn.id}
                      data-testid="connector-card"
                      className="group flex flex-col justify-between p-4 rounded-2xl bg-[#181716] border border-[#272623] hover:border-[#383733] transition-all"
                    >
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-[#121110] border border-[#272623] flex items-center justify-center">
                            {conn.type === 'mcp' ? <AtlassianIcon /> : <GitHubIcon />}
                          </div>
                          <div>
                            <h3
                              data-testid="connector-name"
                              className="font-medium text-white text-[15px]"
                            >
                              {conn.name}
                            </h3>
                            <p className="text-xs text-[#8e8c85]">
                              {conn.type === 'mcp'
                                ? `MCP • ${conn.config?.['transport'] ?? 'stdio'}`
                                : `${conn.type.toUpperCase()} • ${conn.config?.['url'] ?? 'Custom'}`}
                            </p>
                          </div>
                        </div>

                        <span className="text-2xs font-mono px-2 py-0.5 rounded border border-success/30 text-success bg-success/15 uppercase">
                          {conn.status}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-2xs font-mono text-[#716f6a] pt-2 border-t border-[#272623]">
                        <span>Last sync: {formatDate(conn.lastSync)}</span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleDynamicSync(conn.id)}
                            disabled={isSyncing}
                            className="px-2 py-1 rounded border border-[#33322f] hover:border-[#52504b] text-xs text-[#d4d2cc] hover:text-white transition-colors"
                          >
                            {isSyncing ? '...' : 'Sync'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleTestConnection(conn.id)}
                            disabled={isTesting}
                            className="px-2 py-1 rounded border border-[#33322f] hover:border-[#52504b] text-xs text-[#a3a19b] hover:text-white transition-colors"
                          >
                            {isTesting ? '...' : 'Test'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleInspectHealth(conn.id)}
                            className="px-2 py-1 rounded border border-[#33322f] hover:border-[#52504b] text-xs text-[#a3a19b] hover:text-white transition-colors"
                          >
                            Health
                          </button>
                          {conn.type === 'mcp' && (
                            <button
                              type="button"
                              onClick={() => handleInspectTools(conn.id, conn.name)}
                              className="px-2 py-1 rounded border border-[#33322f] hover:border-[#52504b] text-xs text-[#a3a19b] hover:text-white transition-colors"
                            >
                              Tools
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDeleteDynamic(conn.id, conn.name)}
                            className="px-1.5 py-1 text-xs text-error/70 hover:text-error transition-colors"
                            title="Delete Connector"
                          >
                            ×
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ──────────────────────────────────────────────────────────────────
          7. ENTERPRISE CONNECTOR SPEC & DETAILS MODAL
          ────────────────────────────────────────────────────────────────── */}
      {selectedItemDetails && (
        <Modal
          isOpen={!!selectedItemDetails}
          onClose={() => setSelectedItemDetails(null)}
          title={selectedItemDetails.name}
        >
          <div className="space-y-4 text-sm text-[#e3e1db]">
            <div className="flex items-center gap-3 pb-3 border-b border-[#272623]">
              <div className="w-12 h-12 rounded-xl bg-[#121110] border border-[#272623] flex items-center justify-center">
                {selectedItemDetails.renderIcon()}
              </div>
              <div>
                <div className="flex items-center">
                  <h3 className="font-semibold text-white text-base">{selectedItemDetails.name}</h3>
                  <VerifiedCheck />
                </div>
                <p className="text-xs text-[#8e8c85] font-mono">
                  {selectedItemDetails.protocol} • {selectedItemDetails.category}
                </p>
              </div>
            </div>

            <p className="text-xs text-[#a3a19b] leading-relaxed">
              {selectedItemDetails.description}
            </p>

            {selectedItemDetails.actionCount ? (
              <div className="p-2.5 rounded-xl border border-primary/25 bg-primary/10 flex items-center justify-between">
                <span className="text-xs text-[#e3e1db] font-medium">Composio Agent Execution</span>
                <span className="text-2xs font-mono font-semibold text-primary bg-primary/20 px-2 py-0.5 rounded border border-primary/30">
                  {selectedItemDetails.actionCount} automated actions
                </span>
              </div>
            ) : null}

            {/* Zero-Trust Security Guarantees */}
            <div className="p-3 rounded-xl border border-[#2a2926] bg-[#141413] space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-success">
                <ShieldCheckIcon />
                <span>Zero-Trust Enterprise Guard</span>
              </div>
              <ul className="text-2xs font-mono text-[#8e8c85] space-y-1 list-disc list-inside">
                <li>SSRF Boundary: Loopback & Cloud metadata (169.254.169.254) blocked</li>
                <li>Encryption: Credentials encrypted at rest with workspace isolation</li>
                <li>Auditing: Full immutable event trail logged on connector dispatch</li>
                <li>Approval Gates: Destructive/write actions require human-in-the-loop review</li>
              </ul>
            </div>

            {/* Scopes */}
            <div>
              <span className="text-2xs uppercase tracking-wider text-[#716f6a] font-mono block mb-1.5">
                Declared Scopes & Capabilities
              </span>
              <div className="flex flex-wrap gap-1.5">
                {selectedItemDetails.scopes.map((s) => (
                  <span
                    key={s}
                    className="text-2xs font-mono px-2 py-0.5 rounded bg-[#1f1e1c] border border-[#2e2d2a] text-[#a3a19b]"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>

            {/* Assigned Autonomous Agents */}
            <div>
              <span className="text-2xs uppercase tracking-wider text-[#716f6a] font-mono block mb-1.5">
                Wired AI Agents
              </span>
              <div className="flex flex-wrap gap-1.5">
                {selectedItemDetails.assignedAgents.map((a) => (
                  <span
                    key={a}
                    className="text-2xs font-mono px-2 py-0.5 rounded bg-primary/10 border border-primary/30 text-primary"
                  >
                    {a}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-[#272623]">
              <button
                type="button"
                onClick={() => setSelectedItemDetails(null)}
                className="px-4 py-1.5 rounded-lg border border-[#33322f] text-xs text-[#8e8c85] hover:text-white"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedItemDetails(null);
                  handleInitiateConnect(selectedItemDetails);
                }}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-white text-black hover:bg-[#eae8e4] transition-colors"
              >
                {isItemConnected(selectedItemDetails) ? 'Manage Connection' : 'Connect / Attach'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ──────────────────────────────────────────────────────────────────
          8. OAUTH PERMISSION CONFIRMATION MODAL (Test Compatible)
          ────────────────────────────────────────────────────────────────── */}
      {pendingProvider && (
        <Modal
          isOpen={!!pendingProvider}
          onClose={() => setPendingProvider(null)}
          title={`Connect to ${PROVIDER_META[pendingProvider]?.name ?? pendingProvider}`}
        >
          <div className="space-y-4 text-sm text-[#e3e1db]">
            <p className="text-xs text-[#8e8c85] leading-relaxed">
              Authorize Vaeloom to securely connect with your {PROVIDER_META[pendingProvider]?.name}{' '}
              account. Credentials are encrypted at rest with workspace-scoped isolation.
            </p>

            <div className="rounded-xl border border-[#2a2926] bg-[#141413] p-3 space-y-2">
              <span className="text-2xs uppercase tracking-wider text-[#716f6a] font-mono">
                Requested Read Scopes
              </span>
              <div className="flex flex-wrap gap-1.5">
                {PROVIDER_META[pendingProvider]?.scopes.map((s) => (
                  <span
                    key={s}
                    className="text-xs font-mono px-2 py-0.5 rounded bg-[#1f1e1c] border border-[#2e2d2a] text-[#a3a19b]"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#272623]">
              <button
                type="button"
                onClick={() => setPendingProvider(null)}
                className="px-3.5 py-1.5 rounded-lg border border-[#33322f] text-xs text-[#8e8c85] hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy === `connect-${pendingProvider}`}
                onClick={() => handleExecuteConnect(pendingProvider)}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-white text-black hover:bg-[#eae8e4] transition-colors"
              >
                Continue to OAuth
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ──────────────────────────────────────────────────────────────────
          9. ADD CUSTOM CONNECTOR MODAL (Add Button Target)
          ────────────────────────────────────────────────────────────────── */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add Custom Connector"
      >
        <form onSubmit={handleCreateCustom} className="space-y-4 text-sm text-[#e3e1db]">
          <p className="text-xs text-[#8e8c85]">
            Register an external API, database, or Model Context Protocol (MCP) server. Sensitive
            credentials remain encrypted at rest.
          </p>

          {/* Type Selector */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'mcp', label: 'MCP Server' },
              { id: 'rest', label: 'REST API' },
              { id: 'graphql', label: 'GraphQL' },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setCustomType(t.id as 'mcp' | 'rest' | 'graphql')}
                className={`py-2 rounded-xl text-xs font-medium border transition-colors ${
                  customType === t.id
                    ? 'bg-[#2b2a27] border-white/20 text-white'
                    : 'bg-[#181716] border-[#272623] text-[#8e8c85] hover:text-white'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Connector Name */}
          <div>
            <label className="block text-2xs uppercase tracking-wider text-[#716f6a] font-mono mb-1">
              Connector Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Jira Issue Tracker"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl bg-[#141413] border border-[#2a2926] text-sm text-white focus:outline-none focus:border-[#454440]"
            />
          </div>

          {/* Type-Specific Fields */}
          {customType === 'mcp' ? (
            <div className="space-y-3">
              <div>
                <label className="block text-2xs uppercase tracking-wider text-[#716f6a] font-mono mb-1">
                  Transport
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setCustomMcpTransport('stdio')}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-medium border ${
                      customMcpTransport === 'stdio'
                        ? 'bg-[#2b2a27] border-white/20 text-white'
                        : 'bg-[#141413] border-[#272623] text-[#8e8c85]'
                    }`}
                  >
                    Stdio (CLI Executable)
                  </button>
                  <button
                    type="button"
                    onClick={() => setCustomMcpTransport('http')}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-medium border ${
                      customMcpTransport === 'http'
                        ? 'bg-[#2b2a27] border-white/20 text-white'
                        : 'bg-[#141413] border-[#272623] text-[#8e8c85]'
                    }`}
                  >
                    Streamable-HTTP
                  </button>
                </div>
              </div>

              {customMcpTransport === 'stdio' ? (
                <>
                  <div>
                    <label className="block text-2xs uppercase tracking-wider text-[#716f6a] font-mono mb-1">
                      Command *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. npx or python"
                      value={customCommand}
                      onChange={(e) => setCustomCommand(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl bg-[#141413] border border-[#2a2926] text-sm text-white focus:outline-none focus:border-[#454440]"
                    />
                  </div>
                  <div>
                    <label className="block text-2xs uppercase tracking-wider text-[#716f6a] font-mono mb-1">
                      Arguments (Space-separated)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. -y @modelcontextprotocol/server-jira"
                      value={customArgs}
                      onChange={(e) => setCustomArgs(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl bg-[#141413] border border-[#2a2926] text-sm text-white focus:outline-none focus:border-[#454440]"
                    />
                  </div>
                </>
              ) : (
                <div>
                  <label className="block text-2xs uppercase tracking-wider text-[#716f6a] font-mono mb-1">
                    HTTP Endpoint URL *
                  </label>
                  <input
                    type="url"
                    required
                    placeholder="https://mcp.your-domain.com/v1"
                    value={customUrl}
                    onChange={(e) => setCustomUrl(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-[#141413] border border-[#2a2926] text-sm text-white focus:outline-none focus:border-[#454440]"
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="block text-2xs uppercase tracking-wider text-[#716f6a] font-mono mb-1">
                  Endpoint URL *
                </label>
                <input
                  type="url"
                  required
                  placeholder={
                    customType === 'graphql'
                      ? 'https://api.example.com/graphql'
                      : 'https://api.example.com/v1'
                  }
                  value={customUrl}
                  onChange={(e) => setCustomUrl(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-[#141413] border border-[#2a2926] text-sm text-white focus:outline-none focus:border-[#454440]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-2xs uppercase tracking-wider text-[#716f6a] font-mono mb-1">
                    API Key (Optional)
                  </label>
                  <input
                    type="password"
                    placeholder="Encrypted at rest"
                    value={customApiKey}
                    onChange={(e) => setCustomApiKey(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg bg-[#141413] border border-[#2a2926] text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-2xs uppercase tracking-wider text-[#716f6a] font-mono mb-1">
                    Bearer Token (Optional)
                  </label>
                  <input
                    type="password"
                    placeholder="Encrypted at rest"
                    value={customAuthToken}
                    onChange={(e) => setCustomAuthToken(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg bg-[#141413] border border-[#2a2926] text-xs text-white"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-3 border-t border-[#272623]">
            <button
              type="button"
              onClick={() => setIsAddModalOpen(false)}
              className="px-3.5 py-1.5 rounded-lg border border-[#33322f] text-xs text-[#8e8c85] hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submittingCustom}
              className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-white text-black hover:bg-[#eae8e4] transition-colors"
            >
              {submittingCustom ? 'Creating...' : 'Register Connector'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ──────────────────────────────────────────────────────────────────
          10. HEALTH CHECK DIAGNOSTICS MODAL
          ────────────────────────────────────────────────────────────────── */}
      {healthTarget && (
        <Modal
          isOpen={!!healthTarget}
          onClose={() => setHealthTarget(null)}
          title="Connector Health Diagnostics"
        >
          <div className="space-y-3 text-sm text-[#e3e1db]">
            <div className="flex items-center justify-between pb-2 border-b border-[#272623]">
              <span className="text-xs text-[#8e8c85]">Status</span>
              <span className="text-xs font-mono px-2 py-0.5 rounded border border-success/30 text-success bg-success/15 uppercase">
                {healthTarget.status}
              </span>
            </div>
            <div className="flex items-center justify-between pb-2 border-b border-[#272623]">
              <span className="text-xs text-[#8e8c85]">Protocol / Type</span>
              <span className="text-xs font-mono text-white">
                {healthTarget.type.toUpperCase()}
              </span>
            </div>
            <div className="flex items-center justify-between pb-2 border-b border-[#272623]">
              <span className="text-xs text-[#8e8c85]">Last Sync</span>
              <span className="text-xs font-mono text-white">
                {formatDate(healthTarget.last_sync)}
              </span>
            </div>
            <div className="space-y-1 pt-1">
              <span className="text-2xs uppercase tracking-wider text-[#716f6a] font-mono">
                Masked Config Parameter Keys
              </span>
              <div className="p-2.5 rounded-xl bg-[#141413] border border-[#2a2926] text-xs font-mono text-[#a3a19b] whitespace-pre-wrap">
                {JSON.stringify(healthTarget.config_keys, null, 2)}
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setHealthTarget(null)}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-white text-black hover:bg-[#eae8e4]"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ──────────────────────────────────────────────────────────────────
          11. MCP TOOLS INSPECTOR MODAL
          ────────────────────────────────────────────────────────────────── */}
      {toolsModalTarget && (
        <Modal
          isOpen={!!toolsModalTarget}
          onClose={() => setToolsModalTarget(null)}
          title={`Dynamic Tools: ${toolsModalTarget.name}`}
        >
          <div className="space-y-3 text-sm text-[#e3e1db]">
            {toolsLoading ? (
              <div className="py-8 text-center">
                <LoadingSpinner text="Discovering tools..." />
              </div>
            ) : toolsList.length === 0 ? (
              <p className="text-xs text-[#8e8c85] py-4 text-center">
                No dynamic tools registered on this bridge.
              </p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                {toolsList.map((t) => (
                  <div
                    key={t.name}
                    className="p-3 rounded-xl bg-[#141413] border border-[#2a2926] space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-semibold text-white">{t.name}</span>
                      <span className="text-2xs font-mono px-1.5 py-0.5 rounded bg-[#1f1e1c] text-[#a3a19b] border border-[#2e2d2a]">
                        agent-bridge
                      </span>
                    </div>
                    <p className="text-xs text-[#8e8c85] leading-relaxed">
                      {t.description || 'No description provided.'}
                    </p>
                  </div>
                ))}
              </div>
            )}
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setToolsModalTarget(null)}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-white text-black hover:bg-[#eae8e4]"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
