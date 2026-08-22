'use client';
import { EnterpriseGated, isEnterpriseEnabled } from '@/components/shared/EnterpriseGated';
import React, { useState, useEffect } from 'react';
import { Button, Modal } from '@vaeloom/ui-kit';
import { EmptyState } from '@/components/shared/EmptyState';
import { Table, type Column } from '@/components/shared/Table';
import { StatusBadge, type StatusVariant } from '@/components/shared/StatusBadge';
import { iamApi, auditApi, ApiClientError } from '@/lib/api-client';

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

const roleColors: Record<UserRole, StatusVariant> = {
  admin: 'info',
  member: 'success',
  viewer: 'neutral',
};
const statusColors: Record<UserStatus, StatusVariant> = {
  active: 'success',
  invited: 'warning',
  suspended: 'error',
};
const serviceColors: Record<string, StatusVariant> = {
  operational: 'success',
  degraded: 'warning',
  down: 'error',
  maintenance: 'neutral',
};

const svcColor = (s: string): StatusVariant => serviceColors[s] ?? 'neutral';

export default function AdminPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [auditLog, setAuditLog] = useState<AuditEvent[]>([]);
  const [auditPage, setAuditPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pageSize = 3;

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch users
        const usersResponse = await iamApi.listUsers({ page: 1, page_size: 100 });
        const mappedUsers: User[] = usersResponse.items.map((u) => ({
          id: u.id,
          name: u.display_name,
          email: u.email,
          role: (u.roles?.[0]?.name?.toLowerCase() || 'member') as UserRole,
          status: (u.active ? 'active' : 'suspended') as UserStatus,
          lastActive: u.updated_at || 'Unknown',
        }));
        setUsers(mappedUsers);

        // Fetch system health
        try {
          const healthResponse = await fetch(
            `${process.env['NEXT_PUBLIC_API_URL'] || 'http://localhost:8000'}/health/startup`,
          );
          if (healthResponse.ok) {
            const healthData = await healthResponse.json();
            const dependencies = healthData.dependencies || {};
            const servicesList: Service[] = [
              {
                id: 'db',
                name: 'Database',
                status: dependencies.database?.status || 'unknown',
                uptime: '—',
              },
              {
                id: 'redis',
                name: 'Redis',
                status: dependencies.redis?.status || 'unknown',
                uptime: '—',
              },
              {
                id: 'api',
                name: 'API Server',
                status: healthData.status === 'ok' ? 'operational' : 'degraded',
                uptime: '—',
              },
            ];
            setServices(servicesList);
          }
        } catch (e) {
          console.error('Failed to fetch health:', e);
        }

        // Fetch audit log
        const auditResponse = await auditApi.queryEvents({ page: 1, page_size: 20 });
        const mappedAudit: AuditEvent[] = auditResponse.items.map((e) => ({
          id: e.id,
          user: e.actor_id || 'System',
          action: e.action,
          resource: e.resource,
          timestamp: e.created_at,
          ip: 'N/A',
        }));
        setAuditLog(mappedAudit);
      } catch (e) {
        if (e instanceof ApiClientError && (e.status === 403 || e.status === 404)) {
          setError('This feature requires an Enterprise license. Contact sales@vaeloom.app.');
        } else {
          setError('Failed to load admin data. Please try again later.');
        }
        console.error('Admin data fetch error:', e);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const paginatedAudit = auditLog.slice((auditPage - 1) * pageSize, auditPage * pageSize);
  const totalPages = Math.ceil(auditLog.length / pageSize);

  const userColumns: Column<User>[] = [
    { key: 'name', header: 'Name' },
    { key: 'email', header: 'Email' },
    {
      key: 'role',
      header: 'Role',
      render: (u) => <StatusBadge variant={roleColors[u.role]} label={u.role} />,
    },
    {
      key: 'status',
      header: 'Status',
      render: (u) => <StatusBadge variant={statusColors[u.status]} label={u.status} />,
    },
    { key: 'lastActive', header: 'Last Active', className: 'text-text-muted text-sm' },
  ];

  const auditColumns: Column<AuditEvent>[] = [
    { key: 'user', header: 'User' },
    {
      key: 'action',
      header: 'Action',
      render: (e) => <span className="font-mono text-sm">{e.action}</span>,
    },
    { key: 'resource', header: 'Resource', className: 'text-text-muted' },
    { key: 'timestamp', header: 'Timestamp', className: 'text-text-muted font-mono text-sm' },
    { key: 'ip', header: 'IP', className: 'text-text-muted font-mono text-sm' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-text-muted">Loading admin data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="rounded-full border border-border bg-surface px-3 py-1 text-xs font-mono uppercase tracking-widest text-text-dim mb-4">
          Enterprise â€” Gated
        </div>
        <h1 className="text-2xl font-display font-medium text-text mb-2">Admin Dashboard</h1>
        <p className="text-text-muted max-w-lg">{error}</p>
        <div className="mt-6 flex gap-3">
          <a href="mailto:sales@vaeloom.app" className="btn-secondary">
            Contact sales
          </a>
        </div>
      </div>
    );
  }

  if (!isEnterpriseEnabled()) return <EnterpriseGated feature="Admin" />;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-display font-medium text-text mb-2">Admin Dashboard</h1>
        <p className="text-text-muted">
          System administration, user management, and audit controls.
        </p>
      </header>

      <section>
        <h2 className="text-xl font-display font-medium text-text mb-4 border-b border-border pb-2">
          User Management
        </h2>
        <div className="card overflow-hidden">
          {users.length === 0 ? (
            <EmptyState title="No users" description="No users found in the system." />
          ) : (
            <Table columns={userColumns} data={users} keyExtractor={(u) => u.id} />
          )}
        </div>
      </section>

      <section>
        <h2 className="text-xl font-display font-medium text-text mb-4 border-b border-border pb-2">
          System Health
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {services.map((svc) => (
            <div key={svc.id} className="card flex items-center justify-between">
              <div>
                <p className="font-medium text-text">{svc.name}</p>
                <p className="text-xs text-text-muted font-mono mt-1">Uptime: {svc.uptime}</p>
              </div>
              <StatusBadge variant={svcColor(svc.status)} label={svc.status} />
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-xl font-display font-medium text-text mb-4 border-b border-border pb-2">
          Audit Log
        </h2>
        <div className="card overflow-hidden">
          {auditLog.length === 0 ? (
            <EmptyState title="No audit events" description="No audit events recorded yet." />
          ) : (
            <>
              <Table columns={auditColumns} data={paginatedAudit} keyExtractor={(e) => e.id} />
              <div className="flex items-center justify-between p-4 border-t border-border">
                <span className="text-sm text-text-muted">
                  Page {auditPage} of {totalPages}
                </span>
                <div className="flex gap-2">
                  <button
                    className="btn-secondary"
                    disabled={auditPage <= 1}
                    onClick={() => setAuditPage(auditPage - 1)}
                  >
                    Previous
                  </button>
                  <button
                    className="btn-secondary"
                    disabled={auditPage >= totalPages}
                    onClick={() => setAuditPage(auditPage + 1)}
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </section>

      <section>
        <h2 className="text-xl font-display font-medium text-text mb-4 border-b border-border pb-2">
          Quick Actions
        </h2>
        {/* F-02: these controls previously faked success toasts without any
            backend call. They are disabled until corresponding admin APIs exist. */}
        <div className="flex flex-wrap gap-4">
          <Button
            variant="secondary"
            disabled
            title="Requires a cache-clear admin endpoint (not yet available)"
          >
            Clear Cache
          </Button>
          <Button
            variant="secondary"
            disabled
            title="Requires a backup-trigger admin endpoint (not yet available)"
          >
            Trigger Backup
          </Button>
          <Button
            variant="secondary"
            disabled
            title="Requires a diagnostics admin endpoint (not yet available)"
          >
            Run Diagnostics
          </Button>
          <Button
            variant="secondary"
            disabled
            title="Requires a service-restart admin endpoint (not yet available)"
          >
            Restart Services
          </Button>
        </div>
      </section>
    </div>
  );
}
