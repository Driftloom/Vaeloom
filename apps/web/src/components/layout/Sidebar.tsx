import React from 'react';
import Link from 'next/link';

export function Sidebar({ workspaceId }: { workspaceId: string }) {
  const links = [
    { name: 'Dashboard', path: `/workspace/${workspaceId}`, icon: '📊' },
    { name: 'Workspace', path: `/workspace/${workspaceId}/files`, icon: '📁' },
    { name: 'Memory Graph', path: `/workspace/${workspaceId}/memory`, icon: '🕸️' },
    { name: 'Resume', path: `/workspace/${workspaceId}/resume`, icon: '📄' },
    { name: 'Jobs', path: `/workspace/${workspaceId}/jobs`, icon: '💼' },
    { name: 'Applications', path: `/workspace/${workspaceId}/applications`, icon: '📋' },
    { name: 'Chat', path: `/workspace/${workspaceId}/chat`, icon: '💬' },
    { name: 'Schedule', path: `/workspace/${workspaceId}/schedule`, icon: '📅' },
    { name: 'Connectors', path: `/workspace/${workspaceId}/connectors`, icon: '🔌' },
    { name: 'History', path: `/workspace/${workspaceId}/history`, icon: '⏳' },
    { name: 'Settings', path: `/workspace/${workspaceId}/settings`, icon: '⚙️' },
  ];

  return (
    <aside className="w-64 bg-surface border-r border-border flex flex-col h-screen shrink-0">
      <div className="p-4 border-b border-border">
        <h1 className="text-xl font-display font-semibold text-primary">Vaeloom</h1>
      </div>
      <nav className="flex-1 overflow-y-auto p-2">
        <ul className="space-y-1">
          {links.map((link) => (
            <li key={link.name}>
              <Link 
                href={link.path}
                className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-surface-hover text-text-muted hover:text-text transition-colors font-mono text-sm"
              >
                <span>{link.icon}</span>
                <span>{link.name}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}
