'use client';
import React, { useState } from 'react';
import { Button, Card, Input, Modal } from '@vaeloom/ui-kit';
import { StatusBadge, type StatusVariant } from '@/components/shared/StatusBadge';
import useSWR, { mutate } from 'swr';
import { useParams } from 'next/navigation';
import {
  organizationsApi,
  type OrganizationNode,
  type OrganizationMember,
  type OrganizationInvitation,
} from '@/lib/api-client';
import { useToast } from '@/components/shared/Toast';

interface Role {
  id: string;
  name: string;
  description: string;
  permissions: string[];
}

const ROLES: Role[] = [
  {
    id: 'r1',
    name: 'Admin',
    description: 'Full administrative access to manage tree, members, and organizational settings.',
    permissions: ['org:manage', 'org:write', 'org:delete', 'members:invite', 'members:remove'],
  },
  {
    id: 'r2',
    name: 'Lead',
    description: 'Can manage department or team members and configure child units.',
    permissions: ['org:write', 'members:invite'],
  },
  {
    id: 'r3',
    name: 'Member',
    description: 'Standard access to team resources, projects, and collaborative workspaces.',
    permissions: ['org:read', 'workspace:collaborate'],
  },
  {
    id: 'r4',
    name: 'Viewer',
    description: 'Read-only access to organizational hierarchy and member directories.',
    permissions: ['org:read'],
  },
];

const memberStatusColors: Record<string, StatusVariant> = {
  active: 'success',
  invited: 'warning',
  suspended: 'neutral',
};
const mStatusColor = (s: string): StatusVariant => memberStatusColors[s] ?? 'neutral';

function OrgTreeNode({
  node,
  depth = 0,
  selectedId,
  onSelect,
}: {
  node: OrganizationNode;
  depth?: number;
  selectedId: string | null;
  onSelect: (node: OrganizationNode) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = !!node.children && node.children.length > 0;
  const isSelected = selectedId === node.id;

  return (
    <div>
      <div
        className={`flex items-center gap-2 py-2 px-2 rounded cursor-pointer transition-colors ${
          isSelected ? 'bg-primary/10 border border-primary/30' : 'hover:bg-surface-hover'
        }`}
        style={{ paddingLeft: `${depth * 20 + 8}px` }}
        onClick={() => onSelect(node)}
      >
        {hasChildren ? (
          <button
            type="button"
            className="p-0.5 rounded hover:bg-surface-active text-text-muted"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
          >
            <svg
              className={`w-4 h-4 transition-transform ${expanded ? 'rotate-90' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        ) : (
          <div className="w-5" />
        )}
        <span
          className={`text-sm ${
            node.type === 'organization'
              ? 'font-display font-semibold text-primary'
              : node.type === 'department'
                ? 'font-medium text-text'
                : 'text-text-muted'
          }`}
        >
          {node.name}
        </span>
        <span className="text-xs text-text-muted font-mono ml-auto">
          {node.membersCount} {node.membersCount === 1 ? 'member' : 'members'}
        </span>
      </div>
      {expanded &&
        hasChildren &&
        node.children.map((child) => (
          <OrgTreeNode
            key={child.id}
            node={child}
            depth={depth + 1}
            selectedId={selectedId}
            onSelect={onSelect}
          />
        ))}
    </div>
  );
}

export default function OrganizationsPage() {
  const params = useParams();
  const workspaceId = (params?.['workspaceId'] as string | undefined) ?? null;
  const { toast } = useToast();

  const [selectedNode, setSelectedNode] = useState<OrganizationNode | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createType, setCreateType] = useState<'organization' | 'department' | 'team'>(
    'department',
  );
  const [createParentId, setCreateParentId] = useState<string | null>(null);
  const [createAllowedDomains, setCreateAllowedDomains] = useState('');
  const [createDefaultRole, setCreateDefaultRole] = useState('member');
  const [isCreating, setIsCreating] = useState(false);

  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteUserId, setInviteUserId] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'lead' | 'member' | 'viewer'>('member');
  const [isInviting, setIsInviting] = useState(false);

  const [showInviteEmailModal, setShowInviteEmailModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteEmailRole, setInviteEmailRole] = useState<'admin' | 'lead' | 'member' | 'viewer'>(
    'member',
  );
  const [isSendingInvite, setIsSendingInvite] = useState(false);
  const [createdInviteLink, setCreatedInviteLink] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  const [showRoleModal, setShowRoleModal] = useState<string | null>(null);

  // Live organization tree fetch via SWR
  const {
    data: orgTree,
    error: treeError,
    isLoading: treeLoading,
  } = useSWR(
    workspaceId ? `orgs-tree-${workspaceId}` : 'orgs-tree',
    () => organizationsApi.getTree(workspaceId),
    {
      revalidateOnFocus: false,
      onSuccess: (data) => {
        if (!selectedNode && data && data.length > 0) {
          setSelectedNode(data[0] ?? null);
        }
      },
    },
  );

  // Live members fetch for selected organization unit
  const {
    data: members,
    isLoading: membersLoading,
    mutate: mutateMembers,
  } = useSWR(
    selectedNode ? `orgs-members-${selectedNode.id}` : null,
    () => organizationsApi.getMembers(selectedNode!.id),
    { revalidateOnFocus: false },
  );

  // Live invitations fetch for selected organization unit
  const {
    data: invitations,
    isLoading: invitationsLoading,
    mutate: mutateInvitations,
  } = useSWR<OrganizationInvitation[]>(
    selectedNode ? `orgs-invitations-${selectedNode.id}` : null,
    () => organizationsApi.getInvitations(selectedNode!.id),
    { revalidateOnFocus: false },
  );

  const handleCreateNode = async () => {
    if (!createName.trim()) {
      toast({
        tone: 'error',
        title: 'Name required',
        detail: 'Please enter a name for the organizational unit.',
      });
      return;
    }
    setIsCreating(true);
    try {
      await organizationsApi.create({
        name: createName.trim(),
        type: createType,
        workspace_id: workspaceId,
        parent_id: createParentId || (selectedNode ? selectedNode.id : null),
        allowed_domains: createAllowedDomains.trim()
          ? createAllowedDomains
              .split(',')
              .map((d) => d.trim())
              .filter(Boolean)
          : undefined,
        default_role: createDefaultRole,
      });
      toast({
        tone: 'success',
        title: 'Unit Created',
        detail: `Successfully created ${createName.trim()}`,
      });
      setShowCreateModal(false);
      setCreateName('');
      setCreateAllowedDomains('');
      void mutate(workspaceId ? `orgs-tree-${workspaceId}` : 'orgs-tree');
    } catch {
      toast({
        tone: 'error',
        title: 'Creation Failed',
        detail: 'Could not create organizational unit. Ensure backend is running.',
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleSendInvite = async () => {
    if (!selectedNode) return;
    if (!inviteEmail.trim() || !inviteEmail.includes('@')) {
      toast({
        tone: 'error',
        title: 'Invalid Email',
        detail: 'Please provide a valid email address.',
      });
      return;
    }
    setIsSendingInvite(true);
    try {
      const res = await organizationsApi.createInvitation(selectedNode.id, {
        email: inviteEmail.trim(),
        role: inviteEmailRole,
      });
      const link = res.token
        ? `${typeof window !== 'undefined' ? window.location.origin : ''}/invite/${res.token}`
        : null;
      setCreatedInviteLink(link);
      toast({
        tone: 'success',
        title: 'Invitation Created',
        detail: `Created secure invitation for ${inviteEmail.trim()}`,
      });
      void mutateInvitations();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not create invitation';
      toast({
        tone: 'error',
        title: 'Invitation Failed',
        detail: msg,
      });
    } finally {
      setIsSendingInvite(false);
    }
  };

  const handleRevokeInvite = async (invitationId: string) => {
    try {
      await organizationsApi.revokeInvitation(invitationId);
      toast({
        tone: 'info',
        title: 'Invitation Revoked',
        detail: 'The invitation has been invalidated.',
      });
      void mutateInvitations();
    } catch {
      toast({
        tone: 'error',
        title: 'Action Failed',
        detail: 'Could not revoke invitation.',
      });
    }
  };

  const handleAddMember = async () => {
    if (!selectedNode) {
      toast({
        tone: 'error',
        title: 'No Unit Selected',
        detail: 'Select an organization unit first.',
      });
      return;
    }
    if (!inviteUserId.trim()) {
      toast({
        tone: 'error',
        title: 'User ID required',
        detail: 'Please enter a user ID or email.',
      });
      return;
    }
    setIsInviting(true);
    try {
      await organizationsApi.addMember(selectedNode.id, {
        user_id: inviteUserId.trim(),
        role: inviteRole,
      });
      toast({
        tone: 'success',
        title: 'Member Added',
        detail: `Assigned user to ${selectedNode.name} as ${inviteRole}`,
      });
      setShowInviteModal(false);
      setInviteUserId('');
      void mutateMembers();
      void mutate(workspaceId ? `orgs-tree-${workspaceId}` : 'orgs-tree');
    } catch {
      toast({
        tone: 'error',
        title: 'Assignment Failed',
        detail: 'Could not add member. User may already be assigned or not exist.',
      });
    } finally {
      setIsInviting(false);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!selectedNode) return;
    try {
      await organizationsApi.removeMember(selectedNode.id, userId);
      toast({
        tone: 'info',
        title: 'Member Removed',
        detail: 'Removed member from organizational unit.',
      });
      void mutateMembers();
      void mutate(workspaceId ? `orgs-tree-${workspaceId}` : 'orgs-tree');
    } catch {
      toast({
        tone: 'error',
        title: 'Action Failed',
        detail: 'Could not remove member.',
      });
    }
  };

  const handleDeleteNode = async (nodeId: string) => {
    if (!confirm('Are you sure you want to delete this organizational unit and its sub-units?'))
      return;
    try {
      await organizationsApi.delete(nodeId);
      toast({
        tone: 'info',
        title: 'Unit Deleted',
        detail: 'Deleted organizational unit and cleaned up child nodes.',
      });
      setSelectedNode(null);
      void mutate(workspaceId ? `orgs-tree-${workspaceId}` : 'orgs-tree');
    } catch {
      toast({
        tone: 'error',
        title: 'Delete Failed',
        detail: 'Could not delete organizational unit.',
      });
    }
  };

  const roots = orgTree ?? [];
  const isTreeEmpty = roots.length === 0 && !treeLoading;

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap justify-between items-start gap-4">
        <div>
          <h1 className="text-3xl font-display font-medium text-text mb-2">Organizations</h1>
          <p className="text-text-muted">
            Enterprise hierarchical organization structure, departments, and team membership.
          </p>
          <p className="mt-2 text-xs font-mono text-text-dim">
            Data source:{' '}
            {treeLoading ? (
              <span>Loading hierarchy from GET /api/v1/organizations/tree…</span>
            ) : treeError ? (
              <span className="text-error">Error loading organization tree</span>
            ) : (
              <span className="text-success">
                Live from GET /api/v1/organizations/tree ({roots.length} root node(s))
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              setCreateParentId(selectedNode ? selectedNode.id : null);
              setShowCreateModal(true);
            }}
          >
            Add Unit
          </Button>
          <Button onClick={() => setShowInviteModal(true)} disabled={!selectedNode}>
            Add Member
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Organization Tree */}
        <div className="lg:col-span-1">
          <Card padding="lg">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-display font-medium text-text">Organization Tree</h2>
              {selectedNode && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDeleteNode(selectedNode.id)}
                  className="text-error hover:text-error"
                >
                  Delete
                </Button>
              )}
            </div>

            {treeLoading ? (
              <div className="py-8 text-center text-sm text-text-muted font-mono">
                Loading organizational hierarchy…
              </div>
            ) : isTreeEmpty ? (
              <div className="py-8 text-center space-y-3">
                <p className="text-sm text-text-muted">No organizations configured yet.</p>
                <Button
                  size="sm"
                  onClick={() => {
                    setCreateParentId(null);
                    setCreateType('organization');
                    setShowCreateModal(true);
                  }}
                >
                  Create Root Organization
                </Button>
              </div>
            ) : (
              <div className="space-y-1">
                {roots.map((root) => (
                  <OrgTreeNode
                    key={root.id}
                    node={root}
                    selectedId={selectedNode?.id ?? null}
                    onSelect={(node) => setSelectedNode(node)}
                  />
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Right Column: Members & Role Management */}
        <div className="lg:col-span-2 space-y-6">
          <Card padding="lg">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="text-lg font-display font-medium text-text">
                  {selectedNode ? `${selectedNode.name} Members` : 'Members'}
                </h2>
                <p className="text-xs text-text-muted">
                  {selectedNode
                    ? `Unit Type: ${selectedNode.type.toUpperCase()}`
                    : 'Select a unit from the tree to inspect its members.'}
                </p>
              </div>
              {selectedNode && (
                <Button size="sm" onClick={() => setShowInviteModal(true)}>
                  Assign Member
                </Button>
              )}
            </div>

            {membersLoading ? (
              <div className="py-8 text-center text-sm text-text-muted font-mono">
                Loading members…
              </div>
            ) : !selectedNode ? (
              <div className="py-8 text-center text-sm text-text-muted">
                Select an organizational unit from the tree to view members.
              </div>
            ) : (members?.length ?? 0) === 0 ? (
              <div className="py-8 text-center text-sm text-text-muted">
                No members assigned to this unit yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <div className="min-w-[500px]">
                  <div className="grid grid-cols-4 gap-4 text-xs font-mono text-text-muted uppercase tracking-wider pb-2 border-b border-border">
                    <span>User ID</span>
                    <span>Role</span>
                    <span>Status</span>
                    <span className="text-right">Action</span>
                  </div>
                  {members?.map((m) => (
                    <div
                      key={m.id}
                      className="grid grid-cols-4 gap-4 py-2.5 text-sm text-text hover:bg-background/50 rounded px-2 -mx-2 transition-colors items-center"
                    >
                      <span className="font-mono text-xs truncate">{m.userId}</span>
                      <span className="font-medium capitalize">{m.role}</span>
                      <StatusBadge variant={mStatusColor(m.status)} label={m.status} />
                      <div className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveMember(m.userId)}
                          className="text-xs text-error hover:text-error"
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>

          {/* Invitations Card */}
          <Card padding="lg">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="text-lg font-display font-medium text-text">
                  {selectedNode ? `${selectedNode.name} Invitations` : 'Invitations'}
                </h2>
                <p className="text-xs text-text-muted">
                  Pending and historical invitations with 7-day token expiry.
                </p>
              </div>
              {selectedNode && (
                <Button
                  size="sm"
                  onClick={() => {
                    setCreatedInviteLink(null);
                    setShowInviteEmailModal(true);
                  }}
                >
                  Invite by Email
                </Button>
              )}
            </div>

            {invitationsLoading ? (
              <div className="py-6 text-center text-sm text-text-muted font-mono">
                Loading invitations…
              </div>
            ) : !selectedNode ? (
              <div className="py-6 text-center text-sm text-text-muted">
                Select an organizational unit from the tree to view invitations.
              </div>
            ) : (invitations?.length ?? 0) === 0 ? (
              <div className="py-6 text-center text-sm text-text-muted">
                No invitations found for this unit.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <div className="min-w-[550px]">
                  <div className="grid grid-cols-5 gap-4 text-xs font-mono text-text-muted uppercase tracking-wider pb-2 border-b border-border">
                    <span>Email</span>
                    <span>Role</span>
                    <span>Status</span>
                    <span>Expires</span>
                    <span className="text-right">Action</span>
                  </div>
                  {invitations?.map((inv) => (
                    <div
                      key={inv.id}
                      className="grid grid-cols-5 gap-4 py-2.5 text-sm text-text hover:bg-background/50 rounded px-2 -mx-2 transition-colors items-center"
                    >
                      <span className="font-mono text-xs truncate">{inv.email}</span>
                      <span className="font-medium capitalize">{inv.role}</span>
                      <StatusBadge
                        variant={
                          inv.status === 'accepted'
                            ? 'success'
                            : inv.status === 'pending'
                              ? 'warning'
                              : 'neutral'
                        }
                        label={inv.status}
                      />
                      <span className="text-xs text-text-muted">
                        {inv.expiresAt ? new Date(inv.expiresAt).toLocaleDateString() : 'N/A'}
                      </span>
                      <div className="text-right">
                        {inv.status === 'pending' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRevokeInvite(inv.id)}
                            className="text-xs text-error hover:text-error"
                          >
                            Revoke
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>

          <Card padding="lg">
            <h2 className="text-lg font-display font-medium text-text mb-4">
              Enterprise Roles & Permissions
            </h2>
            <div className="space-y-3">
              {ROLES.map((role) => (
                <div key={role.id} className="p-3.5 bg-background rounded-lg border border-border">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-medium text-text">{role.name}</h3>
                      <p className="text-xs text-text-muted mt-1">{role.description}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowRoleModal(role.id === showRoleModal ? null : role.id)}
                    >
                      {showRoleModal === role.id ? 'Hide' : 'Permissions'}
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
          </Card>
        </div>
      </div>

      {/* Modal: Create Organizational Unit */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create Organizational Unit"
      >
        <div className="space-y-4">
          <Input
            label="Unit Name"
            value={createName}
            onChange={(e) => setCreateName(e.target.value)}
            placeholder="e.g. Engineering, Design, Core Team"
          />
          <div className="space-y-1">
            <label className="block text-sm font-medium text-text">Type</label>
            <select
              className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm text-text focus:outline-none focus:border-primary"
              value={createType}
              onChange={(e) =>
                setCreateType(e.target.value as 'organization' | 'department' | 'team')
              }
            >
              <option value="organization">Root Organization</option>
              <option value="department">Department</option>
              <option value="team">Team</option>
            </select>
          </div>
          <Input
            label="Allowed Email Domains (comma-separated, optional)"
            value={createAllowedDomains}
            onChange={(e) => setCreateAllowedDomains(e.target.value)}
            placeholder="e.g. acme.com, vaeloom.test"
          />
          <div className="space-y-1">
            <label className="block text-sm font-medium text-text">Default Role</label>
            <select
              className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm text-text focus:outline-none focus:border-primary"
              value={createDefaultRole}
              onChange={(e) => setCreateDefaultRole(e.target.value)}
            >
              <option value="admin">Admin</option>
              <option value="lead">Lead</option>
              <option value="member">Member</option>
              <option value="viewer">Viewer</option>
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateNode} disabled={isCreating}>
              {isCreating ? 'Creating…' : 'Create Unit'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal: Add Member to Unit */}
      <Modal
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        title={`Add Member to ${selectedNode?.name ?? 'Unit'}`}
      >
        <div className="space-y-4">
          <Input
            label="User ID or Email"
            value={inviteUserId}
            onChange={(e) => setInviteUserId(e.target.value)}
            placeholder="user_id or user@organization.com"
          />
          <div className="space-y-1">
            <label className="block text-sm font-medium text-text">Role</label>
            <select
              className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm text-text focus:outline-none focus:border-primary"
              value={inviteRole}
              onChange={(e) =>
                setInviteRole(e.target.value as 'admin' | 'lead' | 'member' | 'viewer')
              }
            >
              <option value="admin">Admin</option>
              <option value="lead">Lead</option>
              <option value="member">Member</option>
              <option value="viewer">Viewer</option>
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setShowInviteModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddMember} disabled={isInviting}>
              {isInviting ? 'Adding…' : 'Add Member'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal: Invite Member by Email */}
      <Modal
        isOpen={showInviteEmailModal}
        onClose={() => {
          setShowInviteEmailModal(false);
          setCreatedInviteLink(null);
        }}
        title={`Invite Member to ${selectedNode?.name ?? 'Unit'}`}
      >
        <div className="space-y-4">
          {createdInviteLink ? (
            <div className="space-y-3 bg-surface p-4 rounded-lg border border-border">
              <p className="text-sm font-medium text-success">
                Invitation token generated successfully!
              </p>
              <p className="text-xs text-text-muted">Share this link with the invitee:</p>
              <div className="flex gap-2">
                <input
                  readOnly
                  value={createdInviteLink}
                  className="w-full bg-background border border-border rounded-md px-3 py-1.5 text-xs font-mono text-text select-all"
                />
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    if (typeof navigator !== 'undefined') {
                      navigator.clipboard.writeText(createdInviteLink);
                      setCopiedLink(true);
                      setTimeout(() => setCopiedLink(false), 2000);
                    }
                  }}
                >
                  {copiedLink ? 'Copied!' : 'Copy'}
                </Button>
              </div>
              <div className="flex justify-end pt-2">
                <Button
                  size="sm"
                  onClick={() => {
                    setShowInviteEmailModal(false);
                    setCreatedInviteLink(null);
                    setInviteEmail('');
                  }}
                >
                  Done
                </Button>
              </div>
            </div>
          ) : (
            <>
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
                  value={inviteEmailRole}
                  onChange={(e) =>
                    setInviteEmailRole(e.target.value as 'admin' | 'lead' | 'member' | 'viewer')
                  }
                >
                  <option value="admin">Admin</option>
                  <option value="lead">Lead</option>
                  <option value="member">Member</option>
                  <option value="viewer">Viewer</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setShowInviteEmailModal(false);
                    setCreatedInviteLink(null);
                  }}
                >
                  Cancel
                </Button>
                <Button onClick={handleSendInvite} disabled={isSendingInvite}>
                  {isSendingInvite ? 'Creating…' : 'Generate Invite Link'}
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}
