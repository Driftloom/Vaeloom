'use client';

import React, { useState, useMemo } from 'react';
import { Button, Card, Input, Modal, ConfirmationDialog, Select, Skeleton } from '@vaeloom/ui-kit';
import { StatusBadge, type StatusVariant } from '@/components/shared/StatusBadge';
import { Table, type Column } from '@/components/shared/Table';
import useSWR, { mutate } from 'swr';
import { useParams } from 'next/navigation';
import {
  organizationsApi,
  type OrganizationNode,
  type OrganizationMember,
  type OrganizationInvitation,
} from '@/lib/api-client';
import { useToast } from '@/components/shared/Toast';
import { PageHeader } from '@/components/shared/Page';
import { EnterpriseGated, useEnterpriseEnabled } from '@/components/shared/EnterpriseGated';

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

/**
 * `shared/Table` forwards no `loading` prop, so the placeholder rows live here
 * rather than being dropped. The markup mirrors ui-kit's DataTable skeleton so
 * the loading and loaded states occupy the same box.
 */
function TableSkeleton({
  columns,
  rows = 5,
}: {
  columns: { key: string; header: string }[];
  rows?: number;
}) {
  return (
    <div
      className="w-full overflow-x-auto rounded-lg border border-border bg-surface"
      aria-busy="true"
    >
      <table className="w-full text-left border-collapse text-sm">
        <thead>
          <tr className="border-b border-border bg-surface-50/50">
            {columns.map((col) => (
              <th
                key={col.key}
                scope="col"
                className="py-3 px-4 text-xs font-semibold uppercase tracking-wider text-text-muted"
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border-subtle">
          {Array.from({ length: rows }).map((_, rIdx) => (
            <tr key={`skeleton-${rIdx}`}>
              {columns.map((col) => (
                <td key={col.key} className="py-3 px-4">
                  <Skeleton className="h-4 w-3/4" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function findNodePath(roots: OrganizationNode[], targetId: string): OrganizationNode[] {
  for (const root of roots) {
    if (root.id === targetId) return [root];
    if (root.children && root.children.length > 0) {
      const sub = findNodePath(root.children, targetId);
      if (sub.length > 0) return [root, ...sub];
    }
  }
  return [];
}

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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect(node);
    } else if (e.key === 'ArrowRight' && hasChildren) {
      e.preventDefault();
      setExpanded(true);
    } else if (e.key === 'ArrowLeft' && hasChildren) {
      e.preventDefault();
      setExpanded(false);
    }
  };

  return (
    <div role="none">
      <div
        role="treeitem"
        aria-selected={isSelected}
        aria-expanded={hasChildren ? expanded : undefined}
        tabIndex={isSelected ? 0 : -1}
        onKeyDown={handleKeyDown}
        className={`flex items-center gap-2 py-2 px-2 rounded-md cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-accent ${
          isSelected
            ? 'bg-primary/10 border border-primary/30 font-medium'
            : 'hover:bg-surface-hover border border-transparent'
        }`}
        style={{ paddingLeft: `${depth * 18 + 8}px` }}
        onClick={() => onSelect(node)}
      >
        {hasChildren ? (
          <button
            type="button"
            tabIndex={-1}
            aria-label={expanded ? `Collapse ${node.name}` : `Expand ${node.name}`}
            className="p-1 rounded hover:bg-surface-active text-text-muted hover:text-text transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
          >
            <svg
              className={`w-3.5 h-3.5 transition-transform duration-150 ${expanded ? 'rotate-90' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </button>
        ) : (
          <div className="w-5" />
        )}
        <span
          className={`text-sm truncate ${
            node.type === 'organization'
              ? 'font-display font-semibold text-primary'
              : node.type === 'department'
                ? 'font-medium text-text'
                : 'text-text-muted'
          }`}
        >
          {node.name}
        </span>
        <span className="text-xs text-text-dim font-mono ml-auto pl-2 shrink-0">
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
  const enterpriseEnabled = useEnterpriseEnabled();
  if (!enterpriseEnabled) {
    return <EnterpriseGated feature="Organizations" />;
  }
  return <OrganizationsContent />;
}

function OrganizationsContent() {
  const params = useParams();
  const workspaceId = (params?.['workspaceId'] as string | undefined) ?? null;
  const { toast } = useToast();

  const [selectedNode, setSelectedNode] = useState<OrganizationNode | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createType, setCreateType] = useState<'organization' | 'department' | 'team'>(
    'department',
  );
  const [createAllowedDomains, setCreateAllowedDomains] = useState('');
  const [createDefaultRole, setCreateDefaultRole] = useState('member');
  const [createParentId, setCreateParentId] = useState<string | null>(null);
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

  // Search & Filter state for members
  const [memberSearch, setMemberSearch] = useState('');
  const [memberSortBy, setMemberSortBy] = useState('userId');
  const [memberSortDir, setMemberSortDir] = useState<'asc' | 'desc'>('asc');
  const [invitationSortBy, setInvitationSortBy] = useState('email');
  const [invitationSortDir, setInvitationSortDir] = useState<'asc' | 'desc'>('asc');

  // Unified Confirmation Dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    confirmLabel?: string;
    variant?: 'default' | 'destructive';
    loading?: boolean;
    onConfirm: () => Promise<void> | void;
  }>({
    isOpen: false,
    title: '',
    description: '',
    onConfirm: () => {},
  });

  // Live org tree fetch with SWR
  const {
    data: orgTree,
    error: treeError,
    isLoading: treeLoading,
  } = useSWR<OrganizationNode[]>(
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
    error: membersError,
    isLoading: membersLoading,
    mutate: mutateMembers,
  } = useSWR<OrganizationMember[]>(
    selectedNode ? `orgs-members-${selectedNode.id}` : null,
    () => organizationsApi.getMembers(selectedNode!.id),
    { revalidateOnFocus: false },
  );

  // Live invitations fetch for selected organization unit
  const {
    data: invitations,
    error: invitationsError,
    isLoading: invitationsLoading,
    mutate: mutateInvitations,
  } = useSWR<OrganizationInvitation[]>(
    selectedNode ? `orgs-invitations-${selectedNode.id}` : null,
    () => organizationsApi.getInvitations(selectedNode!.id),
    { revalidateOnFocus: false },
  );

  const roots = orgTree ?? [];
  const isTreeEmpty = roots.length === 0 && !treeLoading;

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
      const allowedDomains = createAllowedDomains
        .split(',')
        .map((d) => d.trim())
        .filter(Boolean);

      const newNode = await organizationsApi.create({
        name: createName.trim(),
        type: createType,
        parent_id: createParentId,
        workspace_id: workspaceId ?? undefined,
        allowed_domains: allowedDomains.length > 0 ? allowedDomains : undefined,
        default_role: createDefaultRole,
      });

      toast({
        tone: 'success',
        title: 'Unit Created',
        detail: `Created ${newNode.type} "${newNode.name}".`,
      });

      setCreateName('');
      setCreateAllowedDomains('');
      setShowCreateModal(false);
      void mutate(workspaceId ? `orgs-tree-${workspaceId}` : 'orgs-tree');
    } catch {
      toast({
        tone: 'error',
        title: 'Creation Failed',
        detail: 'Could not create organizational unit.',
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleAddMember = async () => {
    if (!selectedNode || !inviteUserId.trim()) {
      toast({
        tone: 'error',
        title: 'User ID required',
        detail: 'Please enter a user ID to assign.',
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
        detail: `Added user to ${selectedNode.name}.`,
      });
      setInviteUserId('');
      setShowInviteModal(false);
      void mutateMembers();
      void mutate(workspaceId ? `orgs-tree-${workspaceId}` : 'orgs-tree');
    } catch {
      toast({
        tone: 'error',
        title: 'Assignment Failed',
        detail: 'Could not assign user to organizational unit.',
      });
    } finally {
      setIsInviting(false);
    }
  };

  const handleSendInvite = async () => {
    if (!selectedNode || !inviteEmail.trim()) {
      toast({
        tone: 'error',
        title: 'Email required',
        detail: 'Please enter a colleague email address.',
      });
      return;
    }
    setIsSendingInvite(true);
    try {
      const inv = await organizationsApi.createInvitation(selectedNode.id, {
        email: inviteEmail.trim(),
        role: inviteEmailRole,
      });
      const inviteUrl = `${window.location.origin}/join?token=${inv.token}`;
      setCreatedInviteLink(inviteUrl);
      toast({
        tone: 'success',
        title: 'Invitation Dispatched',
        detail: `Sent 7-day invite link to ${inv.email}.`,
      });
      setInviteEmail('');
      void mutateInvitations();
    } catch {
      toast({
        tone: 'error',
        title: 'Invitation Failed',
        detail: 'Could not generate invitation link. Ensure email matches domain policy.',
      });
    } finally {
      setIsSendingInvite(false);
    }
  };

  const executeRemoveMember = async (userId: string) => {
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

  const executeRevokeInvite = async (inviteId: string) => {
    if (!selectedNode) return;
    try {
      await organizationsApi.revokeInvitation(inviteId);
      toast({
        tone: 'info',
        title: 'Invitation Revoked',
        detail: 'The invitation token has been permanently invalidated.',
      });
      void mutateInvitations();
    } catch {
      toast({
        tone: 'error',
        title: 'Revoke Failed',
        detail: 'Could not revoke invitation token.',
      });
    }
  };

  const executeDeleteNode = async (nodeId: string) => {
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

  // Filtered & sorted members
  const filteredMembers = useMemo(() => {
    const list = [...(members ?? [])];
    const q = memberSearch.trim().toLowerCase();
    const filtered = q
      ? list.filter(
          (m) =>
            m.userId.toLowerCase().includes(q) ||
            m.role.toLowerCase().includes(q) ||
            m.status.toLowerCase().includes(q),
        )
      : list;

    filtered.sort((a, b) => {
      const aVal = (a as any)[memberSortBy] ?? '';
      const bVal = (b as any)[memberSortBy] ?? '';
      const cmp = String(aVal).localeCompare(String(bVal));
      return memberSortDir === 'asc' ? cmp : -cmp;
    });

    return filtered;
  }, [members, memberSearch, memberSortBy, memberSortDir]);

  const sortedInvitations = useMemo(() => {
    const list = [...(invitations ?? [])];
    list.sort((a, b) => {
      const aVal = (a as any)[invitationSortBy] ?? '';
      const bVal = (b as any)[invitationSortBy] ?? '';
      const cmp = String(aVal).localeCompare(String(bVal));
      return invitationSortDir === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [invitations, invitationSortBy, invitationSortDir]);

  // Member table columns definition
  const memberColumns: Column<OrganizationMember>[] = [
    {
      key: 'userId',
      header: 'Member',
      sortable: true,
      render: (m) => (
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-surface-200 text-text font-mono text-xs flex items-center justify-center shrink-0 border border-border/60">
            {m.userId.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="font-mono text-xs text-text truncate max-w-[200px]">{m.userId}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Role',
      sortable: true,
      render: (m) => (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize bg-surface-100 border border-border/60 text-text">
          {m.role}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (m) => <StatusBadge variant={mStatusColor(m.status)} label={m.status} />,
    },
    {
      key: 'actions',
      header: 'Action',
      render: (m) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            setConfirmDialog({
              isOpen: true,
              title: 'Remove Member',
              description: `Are you sure you want to remove user "${m.userId}" from ${selectedNode?.name ?? 'this unit'}?`,
              confirmLabel: 'Remove Member',
              variant: 'destructive',
              onConfirm: async () => {
                setConfirmDialog((p) => ({ ...p, isOpen: false }));
                await executeRemoveMember(m.userId);
              },
            })
          }
          className="text-xs text-error hover:text-error"
        >
          Remove
        </Button>
      ),
    },
  ];

  // Invitations table columns definition
  const invitationColumns: Column<OrganizationInvitation>[] = [
    {
      key: 'email',
      header: 'Email',
      sortable: true,
      render: (inv) => <span className="font-mono text-xs text-text">{inv.email}</span>,
    },
    {
      key: 'role',
      header: 'Role',
      sortable: true,
      render: (inv) => (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize bg-surface-100 border border-border/60 text-text">
          {inv.role}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (inv) => (
        <StatusBadge
          variant={
            inv.status === 'accepted' ? 'success' : inv.status === 'pending' ? 'warning' : 'neutral'
          }
          label={inv.status}
        />
      ),
    },
    {
      key: 'expiresAt',
      header: 'Expires',
      render: (inv) => (
        <span className="text-xs text-text-muted">
          {inv.expiresAt ? new Date(inv.expiresAt).toLocaleDateString() : '7 days'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Action',
      render: (inv) => (
        <div className="flex items-center gap-2">
          {inv.token && (
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                const inviteUrl = `${window.location.origin}/join?token=${inv.token}`;
                try {
                  await navigator.clipboard.writeText(inviteUrl);
                  toast({ tone: 'success', title: 'Link copied to clipboard' });
                } catch {
                  toast({ tone: 'info', title: 'Invite URL', detail: inviteUrl });
                }
              }}
              className="text-xs text-action hover:text-action"
            >
              Copy Link
            </Button>
          )}
          {inv.status === 'pending' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                setConfirmDialog({
                  isOpen: true,
                  title: 'Revoke Invitation',
                  description: `Are you sure you want to revoke the invitation sent to ${inv.email}? The link will stop working immediately.`,
                  confirmLabel: 'Revoke Invite',
                  variant: 'destructive',
                  onConfirm: async () => {
                    setConfirmDialog((p) => ({ ...p, isOpen: false }));
                    await executeRevokeInvite(inv.id);
                  },
                })
              }
              className="text-xs text-error hover:text-error"
            >
              Revoke
            </Button>
          )}
        </div>
      ),
    },
  ];

  const selectedPath = selectedNode ? findNodePath(roots, selectedNode.id) : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Organizations"
        description="Enterprise hierarchical organization structure, departments, and team membership."
        breadcrumb={
          selectedPath.length > 0 ? (
            <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-xs flex-wrap">
              {selectedPath.map((item, idx, arr) => (
                <React.Fragment key={item.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedNode(item)}
                    className={`hover:text-text transition-colors ${
                      idx === arr.length - 1 ? 'font-semibold text-text' : 'text-text-muted'
                    }`}
                  >
                    {item.name}
                  </button>
                  {idx < arr.length - 1 && (
                    <span className="text-text-dim" aria-hidden="true">
                      /
                    </span>
                  )}
                </React.Fragment>
              ))}
            </nav>
          ) : undefined
        }
        actions={
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setCreateParentId(selectedNode ? selectedNode.id : null);
                setShowCreateModal(true);
              }}
            >
              Add Unit
            </Button>
            <Button size="sm" onClick={() => setShowInviteModal(true)} disabled={!selectedNode}>
              Add Member
            </Button>
          </>
        }
      />

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Organization Tree */}
        <div className="lg:col-span-1">
          <Card padding="lg">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-display font-medium text-text">Hierarchy Tree</h2>
              {selectedNode && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setConfirmDialog({
                      isOpen: true,
                      title: `Delete Unit "${selectedNode.name}"`,
                      description: `Are you sure you want to delete "${selectedNode.name}" and all of its sub-departments? All unassigned members will remain in the directory.`,
                      confirmLabel: 'Delete Unit',
                      variant: 'destructive',
                      onConfirm: async () => {
                        setConfirmDialog((p) => ({ ...p, isOpen: false }));
                        await executeDeleteNode(selectedNode.id);
                      },
                    })
                  }
                  className="text-xs text-error hover:text-error"
                >
                  Delete Unit
                </Button>
              )}
            </div>

            {treeLoading ? (
              <div className="space-y-2 py-4">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-5/6 ml-4" />
                <Skeleton className="h-8 w-4/6 ml-8" />
              </div>
            ) : treeError ? (
              <div className="p-4 rounded-lg border border-error/30 bg-error-muted text-xs text-error">
                Failed to load organizational tree. Please try refreshing.
              </div>
            ) : isTreeEmpty ? (
              <div className="py-8 text-center space-y-3">
                <p className="text-sm text-text-muted">No organizational structure defined yet.</p>
                <Button
                  size="sm"
                  onClick={() => {
                    setCreateParentId(null);
                    setShowCreateModal(true);
                  }}
                >
                  Create Root Unit
                </Button>
              </div>
            ) : (
              <div
                role="tree"
                aria-label="Organizational Hierarchy"
                className="space-y-1 max-h-[600px] overflow-y-auto pr-1 focus:outline-none"
              >
                {roots.map((node) => (
                  <OrgTreeNode
                    key={node.id}
                    node={node}
                    depth={0}
                    selectedId={selectedNode ? selectedNode.id : null}
                    onSelect={(n) => setSelectedNode(n)}
                  />
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Right Column: Members & Invitations */}
        <div className="lg:col-span-2 space-y-6">
          {/* Members Card */}
          <Card padding="lg">
            <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
              <div>
                <h2 className="text-base font-display font-medium text-text">
                  {selectedNode ? `${selectedNode.name} Members` : 'Members Directory'}
                </h2>
                <p className="text-xs text-text-muted mt-0.5">
                  {selectedNode
                    ? `Unit Type: ${selectedNode.type.toUpperCase()}`
                    : 'Select an organizational unit on the left to view assigned members.'}
                </p>
              </div>
              {selectedNode && (
                <div className="flex items-center gap-2">
                  <Input
                    aria-label="Filter members by id, role, or status"
                    placeholder="Filter members..."
                    value={memberSearch}
                    onChange={(e) => setMemberSearch(e.target.value)}
                    className="w-44 text-xs py-1"
                  />
                  <Button size="sm" onClick={() => setShowInviteModal(true)}>
                    Assign Member
                  </Button>
                </div>
              )}
            </div>

            {membersError ? (
              <div className="p-4 rounded-lg border border-error/30 bg-error-muted text-xs text-error">
                Failed to load members for this unit.
              </div>
            ) : !selectedNode ? (
              <div className="py-12 text-center text-sm text-text-muted">
                Select an organizational unit from the hierarchy tree to view members.
              </div>
            ) : membersLoading ? (
              <TableSkeleton columns={memberColumns} />
            ) : (
              <Table<OrganizationMember>
                columns={memberColumns}
                data={filteredMembers}
                keyExtractor={(m) => m.id}
                sortBy={memberSortBy}
                sortDir={memberSortDir}
                onSort={(key) => {
                  if (memberSortBy === key) {
                    setMemberSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
                  } else {
                    setMemberSortBy(key);
                    setMemberSortDir('asc');
                  }
                }}
                emptyMessage={
                  memberSearch
                    ? 'No members match your search filter.'
                    : 'No members assigned to this unit yet.'
                }
              />
            )}
          </Card>

          {/* Invitations Card */}
          <Card padding="lg">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="text-base font-display font-medium text-text">
                  {selectedNode ? `${selectedNode.name} Invitations` : 'Pending Invitations'}
                </h2>
                <p className="text-xs text-text-muted mt-0.5">
                  Transactional email invitations with 7-day cryptographically signed tokens.
                </p>
              </div>
              {selectedNode && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setCreatedInviteLink(null);
                    setShowInviteEmailModal(true);
                  }}
                >
                  Invite by Email
                </Button>
              )}
            </div>

            {invitationsError ? (
              <div className="p-4 rounded-lg border border-error/30 bg-error-muted text-xs text-error">
                Failed to load invitations.
              </div>
            ) : !selectedNode ? (
              <div className="py-8 text-center text-sm text-text-muted">
                Select an organizational unit from the tree to view invitations.
              </div>
            ) : invitationsLoading ? (
              <TableSkeleton columns={invitationColumns} />
            ) : (
              <Table<OrganizationInvitation>
                columns={invitationColumns}
                data={sortedInvitations}
                keyExtractor={(inv) => inv.id}
                sortBy={invitationSortBy}
                sortDir={invitationSortDir}
                onSort={(key) => {
                  if (invitationSortBy === key) {
                    setInvitationSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
                  } else {
                    setInvitationSortBy(key);
                    setInvitationSortDir('asc');
                  }
                }}
                emptyMessage="No invitations found for this unit."
              />
            )}
          </Card>

          {/* Enterprise Roles & Permissions Reference */}
          <Card padding="lg">
            <h2 className="text-base font-display font-medium text-text mb-2">
              Role & Permission Matrix
            </h2>
            <p className="text-xs text-text-muted mb-4">
              Inherited role hierarchy applied down organizational sub-trees.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {ROLES.map((role) => (
                <div
                  key={role.id}
                  className="p-3 rounded-lg border border-border bg-surface-50/50 space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm text-text">{role.name}</span>
                    <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-surface-200 text-text-secondary">
                      {role.permissions.length} scopes
                    </span>
                  </div>
                  <p className="text-xs text-text-muted leading-relaxed">{role.description}</p>
                  <div className="flex flex-wrap gap-1 pt-1">
                    {role.permissions.map((perm) => (
                      <span
                        key={perm}
                        className="text-xs font-mono px-1.5 py-0.5 rounded bg-surface border border-border/70 text-text-dim"
                      >
                        {perm}
                      </span>
                    ))}
                  </div>
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
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCreateName(e.target.value)}
            placeholder="e.g. Engineering, Platform, Frontend"
          />
          <Select
            label="Unit Type"
            value={createType}
            onChange={(v: string) => setCreateType(v as 'organization' | 'department' | 'team')}
            options={[
              { value: 'organization', label: 'Root Organization' },
              { value: 'department', label: 'Department' },
              { value: 'team', label: 'Team' },
            ]}
          />
          <Input
            label="Allowed Email Domains (comma-separated, optional)"
            value={createAllowedDomains}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setCreateAllowedDomains(e.target.value)
            }
            placeholder="e.g. acme.com, vaeloom.test"
          />
          <Select
            label="Default Role"
            value={createDefaultRole}
            onChange={(v: string) => setCreateDefaultRole(v)}
            options={[
              { value: 'admin', label: 'Admin' },
              { value: 'lead', label: 'Lead' },
              { value: 'member', label: 'Member' },
              { value: 'viewer', label: 'Viewer' },
            ]}
          />
          <div className="flex justify-end gap-2 pt-3">
            <Button variant="secondary" size="sm" onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleCreateNode} loading={isCreating}>
              Create Unit
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal: Add Member to Unit */}
      <Modal
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        title={`Assign Member to ${selectedNode?.name ?? 'Unit'}`}
      >
        <div className="space-y-4">
          <Input
            label="User ID or Email"
            value={inviteUserId}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInviteUserId(e.target.value)}
            placeholder="user_id or user@organization.com"
          />
          <Select
            label="Assigned Role"
            value={inviteRole}
            onChange={(v: string) => setInviteRole(v as 'admin' | 'lead' | 'member' | 'viewer')}
            options={[
              { value: 'admin', label: 'Admin' },
              { value: 'lead', label: 'Lead' },
              { value: 'member', label: 'Member' },
              { value: 'viewer', label: 'Viewer' },
            ]}
          />
          <div className="flex justify-end gap-2 pt-3">
            <Button variant="secondary" size="sm" onClick={() => setShowInviteModal(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleAddMember} loading={isInviting}>
              Assign Member
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal: Invite by Email */}
      <Modal
        isOpen={showInviteEmailModal}
        onClose={() => {
          setShowInviteEmailModal(false);
          setCreatedInviteLink(null);
        }}
        title={`Invite by Email to ${selectedNode?.name ?? 'Unit'}`}
      >
        <div className="space-y-4">
          {createdInviteLink ? (
            <div className="space-y-3">
              <div className="p-3 rounded-lg border border-success/30 bg-success-muted">
                <p className="text-xs font-medium text-success mb-1">
                  Invitation link generated successfully!
                </p>
                <p className="text-xs font-mono break-all text-text bg-surface p-2 rounded border border-border">
                  {createdInviteLink}
                </p>
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={async () => {
                    await navigator.clipboard.writeText(createdInviteLink);
                    toast({ tone: 'success', title: 'Link copied to clipboard' });
                  }}
                >
                  Copy Link
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    setShowInviteEmailModal(false);
                    setCreatedInviteLink(null);
                  }}
                >
                  Done
                </Button>
              </div>
            </div>
          ) : (
            <>
              <Input
                label="Colleague Email Address"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="colleague@company.com"
              />
              <Select
                label="Role"
                value={inviteEmailRole}
                onChange={(v) => setInviteEmailRole(v as 'admin' | 'lead' | 'member' | 'viewer')}
                options={[
                  { value: 'admin', label: 'Admin' },
                  { value: 'lead', label: 'Lead' },
                  { value: 'member', label: 'Member' },
                  { value: 'viewer', label: 'Viewer' },
                ]}
              />
              <div className="flex justify-end gap-2 pt-3">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setShowInviteEmailModal(false);
                    setCreatedInviteLink(null);
                  }}
                >
                  Cancel
                </Button>
                <Button size="sm" onClick={handleSendInvite} loading={isSendingInvite}>
                  Generate Invite Link
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>

      {/* Global Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog((p) => ({ ...p, isOpen: false }))}
        onConfirm={confirmDialog.onConfirm}
        title={confirmDialog.title}
        description={confirmDialog.description}
        confirmLabel={confirmDialog.confirmLabel}
        variant={confirmDialog.variant}
        loading={confirmDialog.loading}
      />
    </div>
  );
}
