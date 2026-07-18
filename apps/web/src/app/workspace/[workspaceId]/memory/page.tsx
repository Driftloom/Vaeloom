'use client';
import React, { useState } from 'react';
import { EmptyState } from '@/components/shared/EmptyState';

export default function MemoryGraphPage() {
  const [nodes] = useState([
    { id: '1', label: 'John Doe', type: 'Person' },
    { id: '2', label: 'Python', type: 'Skill' },
    { id: '3', label: 'Software Engineer', type: 'Role' },
    { id: '4', label: 'Google', type: 'Company' },
  ]);

  return (
    <div className="flex flex-col h-full">
      <header className="mb-6">
        <h1 className="text-3xl font-display font-medium text-text mb-2">Memory Graph</h1>
        <p className="text-text-muted">Explore the knowledge extracted from your documents.</p>
      </header>

      {nodes.length === 0 ? (
        <EmptyState 
          title="No memories extracted yet" 
          description="Upload documents to allow the Memory Agent to build your knowledge graph."
        />
      ) : (
        <div className="card flex-1 flex items-center justify-center relative overflow-hidden bg-background">
          {/* Mocked Graph Visualization */}
          <div className="absolute inset-0 opacity-10" style={{
            backgroundImage: 'radial-gradient(circle at 2px 2px, var(--color-border) 1px, transparent 0)',
            backgroundSize: '24px 24px'
          }}></div>
          
          <div className="relative z-10 flex flex-wrap gap-8 justify-center items-center p-8 max-w-3xl">
            {nodes.map(node => (
              <div key={node.id} className="card border-primary/50 bg-surface/80 hover:bg-surface cursor-pointer transform hover:scale-105 transition-all text-center min-w-[120px]">
                <div className="text-xs font-mono text-primary uppercase tracking-wider mb-2">{node.type}</div>
                <div className="text-lg text-text font-medium">{node.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
