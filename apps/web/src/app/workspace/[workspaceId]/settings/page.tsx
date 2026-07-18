'use client';
import React, { useState } from 'react';

export default function SettingsPage() {
  const [agents, setAgents] = useState([
    { id: 'org', name: 'Organization Agent', autonomy: 'approval_gated' },
    { id: 'resume', name: 'Resume Agent', autonomy: 'approval_gated' },
    { id: 'job', name: 'Job Search Agent', autonomy: 'full' },
    { id: 'app', name: 'Application Agent', autonomy: 'approval_gated' },
    { id: 'gmail', name: 'Gmail Agent', autonomy: 'read_only' },
  ]);

  return (
    <div className="flex flex-col h-full max-w-4xl">
      <header className="mb-6">
        <h1 className="text-3xl font-display font-medium text-text mb-2">Settings</h1>
        <p className="text-text-muted">Manage workspace preferences and agent autonomy.</p>
      </header>

      <div className="space-y-8">
        <section>
          <h2 className="text-xl font-display font-medium text-text mb-4 border-b border-border pb-2">Agent Autonomy Levels</h2>
          <p className="text-sm text-text-muted mb-4">Control how independently each agent is allowed to act on your behalf.</p>
          
          <div className="space-y-4">
            {agents.map(agent => (
              <div key={agent.id} className="card flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-text">{agent.name}</h3>
                </div>
                <select 
                  className="bg-background border border-border text-text rounded px-3 py-1.5 text-sm font-mono"
                  value={agent.autonomy}
                  onChange={(e) => {
                    setAgents(agents.map(a => a.id === agent.id ? { ...a, autonomy: e.target.value } : a));
                  }}
                >
                  <option value="read_only">Read Only</option>
                  <option value="approval_gated">Approval Gated</option>
                  <option value="full">Full Autonomy</option>
                </select>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-xl font-display font-medium text-text mb-4 border-b border-border pb-2">Data & Privacy</h2>
          <div className="flex gap-4">
            <button className="btn-secondary">Export Workspace Data</button>
            <button className="btn-accent bg-transparent border border-accent hover:bg-accent hover:text-white">Delete Workspace</button>
          </div>
        </section>
      </div>
    </div>
  );
}
