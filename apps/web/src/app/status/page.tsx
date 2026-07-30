'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { ErrorState } from '@/components/shared/ErrorState';

interface ServiceStatus {
  status: 'ok' | 'degraded' | 'down';
  latency_ms?: number;
  error?: string;
}

interface HealthResponse {
  status: string;
  service: string;
  version: string;
  timestamp: string;
  dependencies?: Record<string, ServiceStatus>;
}

const indicatorColors: Record<string, string> = {
  ok: 'bg-green-500 shadow-[0_0_12px_rgba(34,197,94,0.5)]',
  degraded: 'bg-yellow-500 shadow-[0_0_12px_rgba(234,179,8,0.5)]',
  down: 'bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.5)]',
};

const statusLabels: Record<string, string> = {
  ok: 'Operational',
  degraded: 'Degraded',
  down: 'Down',
};

const FETCH_INTERVAL = 30000;

async function fetchHealth(): Promise<{ overall: HealthResponse; ready: HealthResponse }> {
  const apiBase = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:8000';
  const [overallRes, readyRes] = await Promise.all([
    fetch(`${apiBase}/health`),
    fetch(`${apiBase}/health/ready`),
  ]);
  const [overall, ready] = await Promise.all([
    overallRes.json() as Promise<HealthResponse>,
    readyRes.json() as Promise<HealthResponse>,
  ]);
  return { overall, ready };
}

function formatUptime(startedAt: string): string {
  const diff = Date.now() - new Date(startedAt).getTime();
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${Math.floor((diff % 3600000) / 60000)}m`;
  return `${Math.floor(diff / 60000)}m`;
}

function ServiceRow({
  name,
  status,
  latency,
}: {
  name: string;
  status: ServiceStatus | undefined;
  latency?: number;
}) {
  const s = status?.status ?? 'down';
  return (
    <div className="flex items-center justify-between py-4 border-b border-border/50 last:border-0">
      <div className="flex items-center gap-4">
        <div className={`w-3 h-3 rounded-full ${indicatorColors[s]} ${s === 'ok' ? 'animate-pulse' : ''}`} />
        <div>
          <span className="font-medium text-text">{name}</span>
          {latency !== undefined && (
            <span className="ml-3 text-xs font-mono text-text-muted">{latency}ms</span>
          )}
        </div>
      </div>
      <span className={`text-sm font-mono px-2.5 py-0.5 rounded-full border ${
        s === 'ok' ? 'text-green-400 border-green-500/30 bg-green-900/20' :
        s === 'degraded' ? 'text-yellow-400 border-yellow-500/30 bg-yellow-900/20' :
        'text-red-400 border-red-500/30 bg-red-900/20'
      }`}>
        {statusLabels[s]}
      </span>
    </div>
  );
}

export default function StatusPage() {
  const [health, setHealth] = useState<{ overall: HealthResponse; ready: HealthResponse } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const data = await fetchHealth();
      setHealth(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch status');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, FETCH_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchData]);

  const overall = health?.overall;
  const deps = overall?.dependencies;
  const readyDeps = health?.ready?.dependencies;

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <LoadingSpinner text="Checking service status..." />
      </div>
    );
  }

  if (error && !overall) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <ErrorState title="Cannot reach status endpoint" message={error} onRetry={fetchData} />
      </div>
    );
  }

  const overallStatus = overall?.status ?? 'down';
  const services = [
    { name: 'Backend API', key: 'backend', status: deps ? { status: overallStatus as 'ok' | 'degraded' | 'down', latency_ms: 0 } : undefined },
    { name: 'Database', key: 'database', status: deps?.['database'] ?? readyDeps?.['database'] },
    { name: 'Redis', key: 'redis', status: deps?.['redis'] ?? readyDeps?.['redis'] },
    { name: 'AI Gateway', key: 'ai-gateway', status: deps?.['ai-gateway'] ?? deps?.['infisical'] },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className={`w-4 h-4 rounded-full ${indicatorColors[overallStatus]} ${overallStatus === 'ok' ? 'animate-pulse' : ''}`} />
            <h1 className="text-4xl font-display font-bold text-text">Vaeloom Status</h1>
          </div>
          <p className="text-text-muted text-lg">
            {overallStatus === 'ok' ? 'All systems operational' : 'Some systems experiencing issues'}
          </p>
          {overall?.timestamp && (
            <p className="text-text-muted text-sm mt-2 font-mono">
              Last checked: {new Date(overall.timestamp).toLocaleString()}
            </p>
          )}
        </div>

        <div className="card p-6 mb-8">
          <h2 className="text-lg font-display font-medium text-text mb-2">Services</h2>
          <div className="divide-y divide-border/50">
            {services.map(s => (
              <ServiceRow key={s.key} name={s.name} status={s.status} latency={s.status?.latency_ms} />
            ))}
          </div>
        </div>

        <div className="card p-6 mb-8">
          <h2 className="text-lg font-display font-medium text-text mb-2">Service Information</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-text-muted">Service</span>
              <p className="text-text font-mono">{overall?.service ?? 'vaeloom-backend'}</p>
            </div>
            <div>
              <span className="text-text-muted">Version</span>
              <p className="text-text font-mono">{overall?.version ?? '-'}</p>
            </div>
            <div>
              <span className="text-text-muted">Uptime</span>
              <p className="text-text font-mono">{overall?.timestamp ? formatUptime(overall.timestamp) : '-'}</p>
            </div>
            <div>
              <span className="text-text-muted">Auto-refresh</span>
              <p className="text-text font-mono">Every 30s</p>
            </div>
          </div>
        </div>

        <p className="text-center text-text-muted text-xs">
          This page is public. No authentication required.
        </p>
      </div>
    </div>
  );
}
