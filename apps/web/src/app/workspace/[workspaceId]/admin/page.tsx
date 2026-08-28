'use client';
import { EnterpriseGated, isEnterpriseEnabled } from '@/components/shared/EnterpriseGated';
import React, { useState, useEffect } from 'react';
import { Button, Modal } from '@vaeloom/ui-kit';
import { EmptyState } from '@/components/shared/EmptyState';
import { Table, type Column } from '@/components/shared/Table';
import { StatusBadge, type StatusVariant } from '@/components/shared/StatusBadge';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { ErrorState } from '@/components/shared/ErrorState';
import useSWR from 'swr';
import { iamApi, auditApi, analyticsApi, adminApi } from '@/lib/api-client';
import { api } from '@/lib/api';

type UserRole = 'admin' | 'member' | 'viewer';
type UserStatus = 'active' | 'invited' | 'suspended';

interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  lastActive: string;
}

interface Service {
  id: string;
  name: string;
  status: 'operational' | 'degraded' | 'down' | 'maintenance';
  uptime: string;
}

interface AuditEvent {
  id: string;
  user: string;
  action: string;
  resource: string;
  timestamp: string;
  ip: string;
}

const mockUsers: User[] = [
  { id: '1', name: 'Alice Chen', email: 'alice@example.com', role: 'admin', status: 'active', lastActive: '2 min ago' },
  { id: '2', name: 'Bob Martinez', email: 'bob@example.com', role: 'member', status: 'active', lastActive: '1 hour ago' },
  { id: '3', name: 'Carol Smith', email: 'carol@example.com', role: 'member', status: 'invited', lastActive: 'Never' },
  { id: '4', name: 'Dave Johnson', email: 'dave@example.com', role: 'viewer', status: 'suspended', lastActive: '3 days ago' },
  { id: '5', name: 'Eve Williams', email: 'eve@example.com', role: 'admin', status: 'active', lastActive: '5 min ago' },
];

const mockServices: Service[] = [
  { id: 's1', name: 'API Server', status: 'operational', uptime: '99.97%' },
  { id: 's2', name: 'Database Cluster', status: 'operational', uptime: '99.99%' },
  { id: 's3', name: 'Message Queue', status: 'degraded', uptime: '98.45%' },
  { id: 's4', name: 'File Storage', status: 'operational', uptime: '100%' },
  { id: 's5', name: 'AI Inference', status: 'operational', uptime: '99.89%' },
  { id: 's6', name: 'Notification Service', status: 'maintenance', uptime: '95.12%' },
];

const mockAuditLog: AuditEvent[] = [
  { id: 'a1', user: 'Alice Chen', action: 'workspace.delete', resource: 'Workspace "Dev"', timestamp: '2026-07-18 19:23:04', ip: '192.168.1.10' },
  { id: 'a2', user: 'Bob Martinez', action: 'user.invite', resource: 'carol@example.com', timestamp: '2026-07-18 18:15:22', ip: '192.168.1.11' },
  { id: 'a3', user: 'Eve Williams', action: 'settings.update', resource: 'Agent Autonomy', timestamp: '2026-07-18 17:00:01', ip: '10.0.0.5' },
  { id: 'a4', user: 'System', action: 'backup.complete', resource: 'Daily Backup', timestamp: '2026-07-18 03:00:00', ip: '127.0.0.1' },
  { id: 'a5', user: 'Alice Chen', action: 'role.update', resource: 'Dave Johnson -> viewer', timestamp: '2026-07-17 14:30:00', ip: '192.168.1.10' },
  { id: 'a6', user: 'System', action: 'cache.cleared', resource: 'Redis Cache', timestamp: '2026-07-17 03:00:00', ip: '127.0.0.1' },
];

const roleColors: Record<UserRole, StatusVariant> = { admin: 'info', member: 'success', viewer: 'neutral' };
const statusColors: Record<UserStatus, StatusVariant> = { active: 'success', invited: 'warning', suspended: 'error' };
const serviceColors: Record<string, StatusVariant> = { operational: 'success', degraded: 'warning', down: 'error', maintenance: 'neutral' };
const svcColor = (s: string): StatusVariant => serviceColors[s] ?? 'neutral';

export default function AdminPage() {
  const [users, setUsers] = useState<User[]>(mockUsers);
  const [services, setServices] = useState<Service[]>(mockServices);
  const [auditLog, setAuditLog] = useState<AuditEvent[]>(mockAuditLog);
  const [auditPage, setAuditPage] = useState(1);
  const [toast, setToast] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const pageSize = 3;
  const paginatedAudit = auditLog.slice((auditPage - 1) * pageSize, auditPage * pageSize);
  const totalPages = Math.ceil(auditLog.length / pageSize);

  const { data: iamRes, isLoading: iamLoading, error: iamError } = useSWR('admin-iam-users', () => iamApi.listUsers({ page: 1, page_size: 20 }).catch(() => null), { revalidateOnFocus: false });
  const { data: auditRes, isLoading: auditLoading } = useSWR('admin-audit-events', () => auditApi.queryEvents({ page: 1, page_size: 20 }).catch(() => null), { revalidateOnFocus: false });
  const { data: healthRes, isLoading: healthLoading } = useSWR('admin-health', () => adminApi.servicesHealth().catch(() => null), { revalidateOnFocus: false });

  useEffect(() => {
    if (iamRes?.items?.length) {
      const mapped: User[] = iamRes.items.map((u) => ({
        id: u.id,
        name: u.display_name,
        email: u.email,
        role: (u.roles[0]?.name as UserRole) ?? 'viewer',
        status: u.active ? 'active' : 'suspended',
        lastActive: new Date(u.updated_at).toLocaleDateString(),
      }));
      setUsers(mapped);
    }
  }, [iamRes]);

  useEffect(() => {
    if (auditRes?.items?.length) {
      const mapped: AuditEvent[] = auditRes.items.map((e) => ({
        id: e.id,
        user: e.actor_id.slice(0, 8),
        action: e.action,
        resource: e.resource + (e.resource_id ? `:${e.resource_id.slice(0, 6)}` : ''),
        timestamp: new Date(e.created_at).toLocaleString(),
        ip: (e.metadata as Record<string, unknown>)?.['ip'] as string ?? '—',
      }));
      setAuditLog(mapped);
    }
  }, [auditRes]);

  useEffect(() => {
    if (healthRes?.services?.length) {
      const mapStatus = (s: string): Service['status'] => {
        if (s === 'healthy' || s === 'operational') return 'operational';
        if (s === 'degraded') return 'degraded';
        if (s === 'down' || s === 'unhealthy') return 'down';
        return 'operational';
      };
      const mapped: Service[] = healthRes.services.map((svc: { name: string; status: string; uptime: string }) => ({
        id: svc.name,
        name: svc.name,
        status: mapStatus(svc.status),
        uptime: svc.uptime,
      }));
      setServices(mapped);
    }
  }, [healthRes]);

  if (!isEnterpriseEnabled()) return <EnterpriseGated feature="Admin" />;

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2000); };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const health = await fetch(`${process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:8000'}/health`).then((r) => r.json()).catch(() => null);
      if (health) showToast(`Health: ${health.status ?? 'ok'}`);
      else showToast('Health check failed — backend unreachable');
    } finally { setRefreshing(false); }
  };

  const userColumns: Column<User>[] = [
    { key: 'name', header: 'Name' },
    { key: 'email', header: 'Email' },
    { key: 'role', header: 'Role', render: (u) => <StatusBadge variant={roleColors[u.role]} label={u.role} /> },
    { key: 'status', header: 'Status', render: (u) => <StatusBadge variant={statusColors[u.status]} label={u.status} /> },
    { key: 'lastActive', header: 'Last Active', className: 'text-text-muted text-sm' },
  ];

  const auditColumns: Column<AuditEvent>[] = [
    { key: 'user', header: 'User' },
    { key: 'action', header: 'Action', render: (e) => <span className="font-mono text-sm">{e.action}</span> },
    { key: 'resource', header: 'Resource', className: 'text-text-muted' },
    { key: 'timestamp', header: 'Timestamp', className: 'text-text-muted font-mono text-sm' },
    { key: 'ip', header: 'IP', className: 'text-text-muted font-mono text-sm' },
  ];

  return (
    <div className="space-y-8">
      {toast && <div role="alert" className="fixed top-4 right-4 z-50 bg-surface border border-border rounded-lg px-4 py-3 shadow-xl text-text text-sm animate-in">{toast}</div>}
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-display font-medium text-text mb-2">Admin Dashboard</h1>
          <p className="text-text-muted">System administration, user management, and audit controls. {iamLoading || auditLoading ? 'Syncing...' : iamError ? 'Using fallback mock data (backend IAM not reachable)' : 'Live data from backend IAM & Audit.'}</p>
        </div>
        <Button variant="secondary" onClick={handleRefresh} disabled={refreshing}>{refreshing ? 'Checking…' : 'Refresh health'}</Button>
      </header>

      <section>
        <h2 className="text-xl font-display font-medium text-text mb-4 border-b border-border pb-2">User Management</h2>
        <div className="card overflow-hidden">
          <Table columns={userColumns} data={users} keyExtractor={(u) => u.id} />
        </div>
        <p className="text-xs text-text-dim mt-2">Source: <span className="font-mono">{iamRes?.items ? 'GET /iam/users (live)' : 'mockUsers fallback — enable ENTERPRISE_ROUTES_ENABLED=true on backend'}</span></p>
      </section>

      <section>
        <h2 className="text-xl font-display font-medium text-text mb-4 border-b border-border pb-2">System Health</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {services.map((svc) => (
            <div key={svc.id} className="card flex items-center justify-between">
              <div><p className="font-medium text-text">{svc.name}</p><p className="text-xs text-text-muted font-mono mt-1">Uptime: {svc.uptime}</p></div>
              <StatusBadge variant={svcColor(svc.status)} label={svc.status} />
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-xl font-display font-medium text-text mb-4 border-b border-border pb-2">Audit Log</h2>
        <div className="card overflow-hidden">
          <Table columns={auditColumns} data={paginatedAudit} keyExtractor={(e) => e.id} />
          <div className="flex items-center justify-between p-4 border-t border-border">
            <span className="text-sm text-text-muted">Page {auditPage} of {totalPages} · {auditLog.length} entries {auditRes?.items ? '(live)' : '(mock)'}</span>
            <div className="flex gap-2">
              <button className="btn-secondary" disabled={auditPage <= 1} onClick={() => setAuditPage(auditPage - 1)}>Previous</button>
              <button className="btn-secondary" disabled={auditPage >= totalPages} onClick={() => setAuditPage(auditPage + 1)}>Next</button>
            </div>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-xl font-display font-medium text-text mb-4 border-b border-border pb-2">Quick Actions</h2>
        <div className="flex flex-wrap gap-4">
          <Button
            variant="secondary"
            onClick={async () => {
              try {
                const r = await adminApi.runAction('clear_cache');
                showToast(r.message || 'Cache cleared successfully.');
              } catch (e) {
                showToast('Cache clear failed — ' + (e as Error).message);
              }
            }}
          >
            Clear Cache
          </Button>
          <Button
            variant="secondary"
            onClick={async () => {
              try {
                const r = await adminApi.runAction('trigger_backup');
                showToast(r.message || 'Backup triggered.');
              } catch (e) {
                showToast('Backup failed — ' + (e as Error).message);
              }
            }}
          >
            Trigger Backup
          </Button>
          <Button
            variant="secondary"
            onClick={async () => {
              try {
                const r = await adminApi.runAction('run_diagnostics');
                showToast('Diagnostics: ' + JSON.stringify(r.diagnostics || r).slice(0, 80));
              } catch (e) {
                showToast('Diagnostics failed — ' + (e as Error).message);
              }
            }}
          >
            Run Diagnostics
          </Button>
          <Button
            variant="secondary"
            onClick={async () => {
              try {
                const r = await adminApi.runAction('restart_services');
                showToast(r.message || 'Restart scheduled.');
              } catch (e) {
                showToast('Restart failed — ' + (e as Error).message);
              }
            }}
          >
            Restart Services
          </Button>
        </div>
        <p className="text-xs text-text-dim mt-2 font-mono">
          Source: {healthRes?.services ? 'GET /admin/services/health (live)' : 'mockServices fallback — enable ENTERPRISE_ROUTES_ENABLED'} · Quick Actions call POST /admin/actions/&#123;action&#125; (live)
        </p>
      </section>
    </div>
  );
}
