'use client';
import React, { useState, useEffect } from 'react';
import { EnterpriseGated, isEnterpriseEnabled } from '@/components/shared/EnterpriseGated';
import { Button, Card, Input, Modal } from '@vaeloom/ui-kit';
import { StatusBadge, type StatusVariant } from '@/components/shared/StatusBadge';
import useSWR from 'swr';
import { useParams } from 'next/navigation';
import { iamApi } from '@/lib/api-client';

interface OrgNode {
  id: string;
  name: string;
  type: 'organization' | 'department' | 'team';
  members: number;
  children?: OrgNode[];
}

interface Member {
  id: string;
  name: string;
  email: string;
  role: string;
  status: 'active' | 'invited' | 'inactive';
  department: string;
}

interface Role {
  id: string;
  name: string;
  description: string;
  permissions: string[];
}

const orgTree: OrgNode = {
  id: 'root',
  name: 'Acme Corp',
  type: 'organization',
  members: 0,
  children: [
    {
      id: 'eng',
      name: 'Engineering',
      type: 'department',
      members: 12,
      children: [
        { id: 'frontend', name: 'Frontend Team', type: 'team', members: 5 },
        { id: 'backend', name: 'Backend Team', type: 'team', members: 4 },
        { id: 'ml', name: 'ML Team', type: 'team', members: 3 },
      ],
    },
    {
      id: 'product',
      name: 'Product',
      type: 'department',
      members: 4,
      children: [
        { id: 'design', name: 'Design Team', type: 'team', members: 2 },
        { id: 'pm', name: 'PM Team', type: 'team', members: 2 },
      ],
    },
    { id: 'hr', name: 'Human Resources', type: 'department', members: 3 },
  ],
};

const mockMembers: Member[] = [
  {
    id: 'm1',
    name: 'Alice Chen',
    email: 'alice@acme.com',
    role: 'Admin',
    status: 'active',
    department: 'Engineering',
  },
  {
    id: 'm2',
    name: 'Bob Martinez',
    email: 'bob@acme.com',
    role: 'Editor',
    status: 'active',
    department: 'Engineering',
  },
  {
    id: 'm3',
    name: 'Carol Smith',
    email: 'carol@acme.com',
    role: 'Viewer',
    status: 'invited',
    department: 'Product',
  },
  {
    id: 'm4',
    name: 'Dave Johnson',
    email: 'dave@acme.com',
    role: 'Editor',
    status: 'active',
    department: 'Design',
  },
  {
    id: 'm5',
    name: 'Eve Williams',
    email: 'eve@acme.com',
    role: 'Admin',
    status: 'active',
    department: 'HR',
  },
];

const mockRoles: Role[] = [
  {
    id: 'r1',
    name: 'Admin',
    description: 'Full access to all resources and settings.',
    permissions: ['read', 'write', 'delete', 'manage_members', 'manage_billing'],
  },
  {
    id: 'r2',
    name: 'Editor',
    description: 'Can create and edit resources.',
    permissions: ['read', 'write'],
  },
  {
    id: 'r3',
    name: 'Viewer',
    description: 'Read-only access to resources.',
    permissions: ['read'],
  },
];

function OrgTreeNode({ node, depth = 0 }: { node: OrgNode; depth?: number }) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = !!node.children && node.children.length > 0;

  return (
    <div>
      <div
        className="flex items-center gap-2 py-2 px-2 rounded hover:bg-surface-hover cursor-pointer transition-colors"
        style={{ paddingLeft: `${depth * 20 + 8}px` }}
        onClick={() => setExpanded(!expanded)}
      >
        {hasChildren && (
          <svg
            className={`w-4 h-4 text-text-muted transition-transform ${expanded ? 'rotate-90' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        )}
        {!hasChildren && <div className="w-4" />}
        <span
          className={`text-sm ${node.type === 'organization' ? 'font-display text-primary' : node.type === 'department' ? 'font-medium text-text' : 'text-text-muted'}`}
        >
          {node.name}
        </span>
        <span className="text-xs text-text-muted font-mono ml-auto">{node.members} members</span>
      </div>
      {expanded &&
        hasChildren &&
        node.children?.map((child) => (
          <OrgTreeNode key={child.id} node={child} depth={depth + 1} />
        ))}
    </div>
  );
}

const memberStatusColors: Record<string, StatusVariant> = {
  active: 'success',
  invited: 'warning',
  inactive: 'neutral',
};
const mStatusColor = (s: string): StatusVariant => memberStatusColors[s] ?? 'neutral';

export default function OrganizationsPage() {
  // ── Hooks must be BEFORE early return guard (no conditional hooks) ─────────
  const params = useParams();
  const workspaceId = (params?.['workspaceId'] as string | undefined) ?? null;
  void workspaceId;

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('Editor');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>(mockMembers);

  const { data: iamRes, isLoading: iamLoading } = useSWR(
    'orgs-iam-users',
    () => iamApi.listUsers({ page: 1, page_size: 20 }).catch(() => null),
    { revalidateOnFocus: false },
  );

  useEffect(() => {
    if (iamRes?.items?.length) {
      const mapped: Member[] = iamRes.items.map((u) => ({
        id: u.id,
        name: u.display_name,
        email: u.email,
        role: (u.roles[0]?.name as string) ?? 'Viewer',
        status: u.active ? 'active' : 'inactive',
        department: '—',
      }));
      setMembers(mapped);
    }
  }, [iamRes]);

  const isLive = !!iamRes?.items?.length;

  // Enterprise gate — MUST stay after all hooks (no conditional hooks before)
  if (!isEnterpriseEnabled()) return <EnterpriseGated feature="Organizations" />;

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap justify-between items-start gap-4">
        <div>
          <h1 className="text-3xl font-display font-medium text-text mb-2">Organizations</h1>
          <p className="text-text-muted">
            Manage your organization structure, members, and roles.{' '}
            <span className={isLive ? 'text-success' : 'text-text-dim'}>
              {isLive ? 'Live from GET /iam/users (live)' : '(mock — enable enterprise)'}
            </span>
          </p>
          <p className="mt-2 text-xs font-mono text-text-dim">
            Data source:{' '}
            {isLive ? (
              <span className="text-success">
                GET /iam/users (live) — {iamRes?.items?.length ?? 0} user(s)
              </span>
            ) : iamLoading ? (
              <span>Loading GET /iam/users…</span>
            ) : (
              <span>
                mockMembers fallback — backend IAM not reachable. Set ENTERPRISE_ROUTES_ENABLED=true
              </span>
            )}
          </p>
        </div>
        <Button onClick={() => setShowInviteModal(true)}>Invite Member</Button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <Card padding="lg">
            <h2 className="text-lg font-display font-medium text-text mb-4">Organization Tree</h2>
            <OrgTreeNode node={orgTree} />
            <p className="mt-4 text-xs text-text-dim font-mono">
              Mock tree — visual only (no backend org service)
            </p>
          </Card>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <Card padding="lg">
            <h2 className="text-lg font-display font-medium text-text mb-4">Members</h2>
            <div className="hidden sm:block space-y-2 overflow-x-auto">
              <div className="min-w-[520px]">
                <div className="grid grid-cols-4 gap-4 text-xs font-mono text-text-muted uppercase tracking-wider pb-2 border-b border-border">
                  <span>Name</span>
                  <span>Email</span>
                  <span>Role</span>
                  <span>Status</span>
                </div>
                {members.map((m) => (
                  <div
                    key={m.id}
                    className="grid grid-cols-4 gap-4 py-2 text-sm text-text hover:bg-background/50 rounded px-2 -mx-2 transition-colors"
                  >
                    <span className="font-medium truncate">{m.name}</span>
                    <span className="text-text-muted truncate">{m.email}</span>
                    <span className="font-mono text-xs truncate">{m.role}</span>
                    <StatusBadge variant={mStatusColor(m.status)} label={m.status} />
                  </div>
                ))}
              </div>
            </div>
            {/* Mobile cards fallback — visible only < sm */}
            <div className="sm:hidden space-y-2">
              {members.map((m) => (
                <div key={`mob-${m.id}`} className="card p-3 flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{m.name}</span>
                    <StatusBadge variant={mStatusColor(m.status)} label={m.status} />
                  </div>
                  <span className="text-xs text-text-muted truncate">{m.email}</span>
                  <span className="font-mono text-xs text-text-muted">{m.role}</span>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-text-dim font-mono">
              {isLive
                ? 'Members derived from live IAM users (display_name, email, role, status)'
                : 'Showing mockMembers (5) — live IAM will override when available'}
            </p>
          </Card>

          <Card padding="lg">
            <h2 className="text-lg font-display font-medium text-text mb-4">Role Management</h2>
            <div className="space-y-4">
              {mockRoles.map((role) => (
                <div key={role.id} className="p-4 bg-background rounded-lg border border-border">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-medium text-text">{role.name}</h3>
                      <p className="text-sm text-text-muted mt-1">{role.description}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowRoleModal(role.id === showRoleModal ? null : role.id)}
                    >
                      {showRoleModal === role.id ? 'Hide' : 'View Permissions'}
                    </Button>
                  </div>
                  {showRoleModal === role.id && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {role.permissions.map((p) => (
                        <span
                          key={p}
                          className="text-xs bg-surface-active text-text-muted px-2 py-1 rounded font-mono"
                        >
                          {p}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-text-dim font-mono">
              Roles are mock — derived from static definitions (no /iam/roles live mapping yet)
            </p>
          </Card>
        </div>
      </div>

      <Modal
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        title="Invite Member"
      >
        <div className="space-y-4">
          <Input
            label="Email Address"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="colleague@company.com"
          />
          <div className="space-y-1">
            <label className="block text-sm font-medium text-text">Role</label>
            <select
              className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm text-text focus:outline-none focus:border-primary"
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value)}
            >
              <option value="Admin">Admin</option>
              <option value="Editor">Editor</option>
              <option value="Viewer">Viewer</option>
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setShowInviteModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                setShowInviteModal(false);
                setInviteEmail('');
              }}
            >
              Send Invite
            </Button>
          </div>
          <p className="text-xs text-text-dim font-mono">
            Invite is local only — no POST /iam/organizations/invites backend yet
          </p>
        </div>
      </Modal>
    </div>
  );
}
