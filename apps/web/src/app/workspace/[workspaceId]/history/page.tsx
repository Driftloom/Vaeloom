'use client';
import React from 'react';
import { EmptyState } from '@/components/shared/EmptyState';

export default function HistoryPage() {
  const actions = [
    { id: '1', agent: 'Organization Agent', action: 'Renamed "Resume_v2.pdf" to "Resume.pdf"', timestamp: '2 hours ago', status: 'approved' },
    { id: '2', agent: 'Job Search Agent', action: 'Found 5 new Frontend roles', timestamp: 'Yesterday', status: 'auto' },
    { id: '3', agent: 'Resume Agent', action: 'Drafted "Google SWE" variant', timestamp: '2 days ago', status: 'approved' },
  ];

  return (
    <div className="flex flex-col h-full">
      <header className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-display font-medium text-text mb-2">History</h1>
          <p className="text-text-muted">Audit log of all agent actions and system events.</p>
        </div>
        <button className="btn-secondary">Export Log</button>
      </header>

      {actions.length === 0 ? (
        <EmptyState title="No history yet" description="Agent actions will appear here once you start using the workspace." />
      ) : (
        <div className="card">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border text-text-muted font-mono text-sm uppercase">
                <th className="pb-3 font-normal">Timestamp</th>
                <th className="pb-3 font-normal">Agent</th>
                <th className="pb-3 font-normal">Action</th>
                <th className="pb-3 font-normal">Status</th>
              </tr>
            </thead>
            <tbody>
              {actions.map(a => (
                <tr key={a.id} className="border-b border-border/50 hover:bg-background/50 transition-colors">
                  <td className="py-3 text-text-muted text-sm">{a.timestamp}</td>
                  <td className="py-3 text-primary text-sm font-medium">{a.agent}</td>
                  <td className="py-3 text-text text-sm">{a.action}</td>
                  <td className="py-3">
                    <span className={`text-xs font-mono px-2 py-1 rounded border ${a.status === 'approved' ? 'border-primary/50 text-primary bg-primary/10' : 'border-border text-text-muted bg-surface'}`}>
                      {a.status.toUpperCase()}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
