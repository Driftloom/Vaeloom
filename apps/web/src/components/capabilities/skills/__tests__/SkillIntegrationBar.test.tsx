import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { SkillIntegrationBar, getAgentForSkill } from '../SkillIntegrationBar';
import type { SkillRow } from '../SkillCard';
import type { CapabilityItem } from '@/lib/capabilities-data';

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), prefetch: jest.fn() }),
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({ workspaceId: 'ws-42' }),
}));

function makeRow(name: string, scope = 'workspace.read', triggers = ['review resume']): SkillRow {
  const item: CapabilityItem = {
    id: `item-${name}`,
    name,
    category: 'skills',
    description: `Description for ${name}`,
    status: 'active',
    enabled: true,
    version: '1.0.0',
    author: 'Vaeloom Core Team',
    source: 'built-in',
    runtime: 'python',
    tags: ['career', 'ats'],
    triggers,
    markdownDoc: `# ${name}`,
    requiredScope: scope,
    trustClass: 'core_trusted',
    autonomy: 'supervised',
    usageCount: 15,
    lastUsedAt: '2026-10-01T00:00:00Z',
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-10-01T00:00:00Z',
  };

  return {
    key: `key-${name}`,
    item,
    installed: true,
    bundled: true,
    slug: name,
    serverBacked: true,
  };
}

describe('SkillIntegrationBar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getAgentForSkill mapping logic', () => {
    it('maps ATS skills to ATS Auditor agent', () => {
      const agent = getAgentForSkill('ats-audit');
      expect(agent.id).toBe('ats');
      expect(agent.name).toBe('ATS Auditor');
    });

    it('maps job discovery skills to Job Search Scout agent', () => {
      const agent = getAgentForSkill('job-discovery-radar');
      expect(agent.id).toBe('job_search');
      expect(agent.name).toBe('Job Search Scout');
    });

    it('maps cover letter and form filler skills to Application Agent', () => {
      const agent = getAgentForSkill('cover-letter-architect');
      expect(agent.id).toBe('application');
      expect(agent.name).toBe('Application Agent');
    });

    it('maps interview and coaching skills to Career Strategist agent', () => {
      const agent = getAgentForSkill('star-interview-prep');
      expect(agent.id).toBe('career');
      expect(agent.name).toBe('Career Strategist');
    });
  });

  describe('component rendering and actions', () => {
    it('renders agent squad link and provides 1-click launch in live chat', () => {
      const row = makeRow('ats-audit', 'memory.read, system.document.compile', ['audit my resume']);
      render(<SkillIntegrationBar row={row} workspaceId="ws-prod" />);

      expect(screen.getByText('Cross-Page Agent Wiring:')).toBeInTheDocument();
      expect(screen.getAllByText('ATS Auditor').length).toBeGreaterThanOrEqual(1);

      const launchBtn = screen.getByRole('button', { name: /Launch in Chat/i });
      fireEvent.click(launchBtn);

      expect(mockPush).toHaveBeenCalledTimes(1);
      const pushedUrl = mockPush.mock.calls[0][0];
      expect(pushedUrl).toContain('/workspace/ws-prod/chat?');
      expect(pushedUrl).toContain('agent=ats');
      expect(pushedUrl).toContain('prompt=Use+audit+my+resume');
    });

    it('renders Vault Grounding link when skill requires memory scope', () => {
      const row = makeRow('career-coaching', 'memory.read, memory.write');
      render(<SkillIntegrationBar row={row} workspaceId="ws-alpha" />);

      const vaultLink = screen.getByRole('link', { name: /Vault Grounding/i });
      expect(vaultLink).toHaveAttribute('href', '/workspace/ws-alpha/memory');
      expect(screen.getByText('memory.read, memory.write')).toBeInTheDocument();
    });

    it('renders Documents Hub link when skill handles resume documents', () => {
      const row = makeRow('ats-resume-builder', 'system.document.compile');
      render(<SkillIntegrationBar row={row} workspaceId="ws-beta" />);

      const docsLink = screen.getByRole('link', { name: /Documents Hub/i });
      expect(docsLink).toHaveAttribute('href', '/workspace/ws-beta/files');
      expect(screen.getByText('system.document.compile')).toBeInTheDocument();
    });
  });
});
