'use client';
import { EnterpriseGated, isEnterpriseEnabled } from '@/components/shared/EnterpriseGated';
import React, { useState, useEffect } from 'react';
import { Button, Card, Input, Modal } from '@vaeloom/ui-kit';
import { StatusBadge, type StatusVariant } from '@/components/shared/StatusBadge';
import { ApiClientError } from '@/lib/api-client';

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

function OrgTreeNode({ node, depth = 0 }: { node: OrgNode; depth?: number }) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children && node.children.length > 0;

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        className="flex items-center gap-2 py-2 px-2 rounded hover:bg-surface-hover cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1"
        style={{ paddingLeft: `${depth * 20 + 8}px` }}
        onClick={() => setExpanded(!expanded)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setExpanded(!expanded);
          }
        }}
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
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('Editor');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [orgTree, setOrgTree] = useState<OrgNode | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);

  useEffect(() => {
    const fetchOrgData = async () => {
      try {
        setLoading(true);
        setError(null);

        const { api } = await import('@/lib/api');
        const data = await api.request<{ members: Member[]; roles: Role[]; org_tree?: OrgNode }>(
          '/iam/organizations',
          { method: 'GET' },
        );
        if (data.org_tree) setOrgTree(data.org_tree);
        if (data.members) setMembers(data.members);
        if (data.roles) setRoles(data.roles);
      } catch (e) {
        if (e instanceof ApiClientError && (e.status === 403 || e.status === 404)) {
          setError('This feature requires an Enterprise license. Contact sales@vaeloom.app.');
        } else {
          setError('Failed to load organization data. Please try again later.');
        }
        console.error('Organization data fetch error:', e);
      } finally {
        setLoading(false);
      }
    };

    fetchOrgData();
  }, []);

  if (!isEnterpriseEnabled()) return <EnterpriseGated feature="Organizations" />;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-text-muted">Loading organization data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="rounded-full border border-border bg-surface px-3 py-1 text-xs font-mono uppercase tracking-widest text-text-dim mb-4">
          Enterprise — Gated
        </div>
        <h1 className="text-2xl font-display font-medium text-text mb-2">Organizations</h1>
        <p className="text-text-muted max-w-lg">{error}</p>
        <div className="mt-6 flex gap-3">
          <a href="mailto:sales@vaeloom.app" className="btn-secondary">
            Contact sales
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-display font-medium text-text mb-2">Organizations</h1>
          <p className="text-text-muted">Manage your organization structure, members, and roles.</p>
        </div>
        <Button onClick={() => setShowInviteModal(true)}>Invite Member</Button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <Card padding="lg">
            <h2 className="text-lg font-display font-medium text-text mb-4">Organization Tree</h2>
            {orgTree ? (
              <OrgTreeNode node={orgTree} />
            ) : (
              <div className="text-text-muted text-sm">No organization structure available.</div>
            )}
          </Card>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <Card padding="lg">
            <h2 className="text-lg font-display font-medium text-text mb-4">Members</h2>
            <div className="space-y-2">
              <div className="grid grid-cols-4 gap-4 text-xs font-mono text-text-muted uppercase tracking-wider pb-2 border-b border-border">
                <span>Name</span>
                <span>Email</span>
                <span>Role</span>
                <span>Status</span>
              </div>
              {members.length === 0 ? (
                <div className="text-text-muted text-sm py-4">No members found.</div>
              ) : (
                members.map((m) => (
                  <div
                    key={m.id}
                    className="grid grid-cols-4 gap-4 py-2 text-sm text-text hover:bg-background/50 rounded px-2 -mx-2 transition-colors"
                  >
                    <span className="font-medium">{m.name}</span>
                    <span className="text-text-muted">{m.email}</span>
                    <span className="font-mono text-xs">{m.role}</span>
                    <StatusBadge variant={mStatusColor(m.status)} label={m.status} />
                  </div>
                ))
              )}
            </div>
          </Card>

          <Card padding="lg">
            <h2 className="text-lg font-display font-medium text-text mb-4">Role Management</h2>
            <div className="space-y-4">
              {roles.length === 0 ? (
                <div className="text-text-muted text-sm">No roles defined.</div>
              ) : (
                roles.map((role) => (
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
                ))
              )}
            </div>
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
        </div>
      </Modal>
    </div>
  );
}
