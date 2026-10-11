'use client';

import React, { useMemo, useState } from 'react';

export interface MemoryVaultExplorerProps {
  workspaceId: string;
  onCiteMemory: (citation: string) => void;
  onOpenVaultDrawer?: () => void;
}

interface VaultMemoryItem {
  id: string;
  category: 'career' | 'skills' | 'projects' | 'education' | 'feedback';
  title: string;
  content: string;
  source: string;
  date: string;
}

const SEED_MEMORIES: VaultMemoryItem[] = [
  {
    id: 'mem-1',
    category: 'career',
    title: 'Staff Distributed Systems Engineer Experience',
    content:
      'Led the architecture of a high-throughput event processing platform processing 1.2M events/sec with 99.99% availability using Kafka and Go.',
    source: 'Workday Resume / CV Grounding',
    date: '2026-09-15',
  },
  {
    id: 'mem-2',
    category: 'skills',
    title: 'Core Technical Competencies',
    content:
      'Proficient in TypeScript, Next.js App Router, Python (FastAPI/PyTorch), PostgreSQL RLS, Rust, Distributed Systems, and LLM Orchestration.',
    source: 'Obsidian Note: skills/technical-index.md',
    date: '2026-10-01',
  },
  {
    id: 'mem-3',
    category: 'projects',
    title: 'AI Multi-Agent Career Copilot Architecture',
    content:
      'Designed autonomous multi-agent squads leveraging ReAct reasoning loops, semantic ATS optimization, and zero-knowledge memory vaults.',
    source: 'Obsidian Note: projects/vaeloom-core.md',
    date: '2026-10-05',
  },
  {
    id: 'mem-4',
    category: 'education',
    title: 'Computer Science & Engineering Degree',
    content:
      'B.Tech in Computer Science and Engineering with specialization in Distributed Computing and Artificial Intelligence.',
    source: 'Verified Transcript',
    date: '2026-08-20',
  },
  {
    id: 'mem-5',
    category: 'career',
    title: 'Performance & Scale Achievements',
    content:
      'Reduced p99 API query latencies by 64% through PostgreSQL index redesign and Redis semantic caching layer implementation.',
    source: 'Performance Review & Brag Document',
    date: '2026-09-28',
  },
];

export function MemoryVaultExplorer({
  workspaceId,
  onCiteMemory,
  onOpenVaultDrawer,
}: MemoryVaultExplorerProps): JSX.Element {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const categories = ['all', '#career', '#skills', '#projects', '#education', '#feedback'];

  const filteredMemories = useMemo(() => {
    return SEED_MEMORIES.filter((mem) => {
      const matchesCategory = activeCategory === 'all' || `#${mem.category}` === activeCategory;
      const matchesQuery =
        searchQuery.trim() === '' ||
        mem.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        mem.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
        mem.source.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesQuery;
    });
  }, [searchQuery, activeCategory]);

  const handleCopy = (id: string, text: string) => {
    void navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 max-w-5xl mx-auto w-full">
      {/* Header & Obsidian Vault Status */}
      <div className="border-b border-border/50 pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-text flex items-center gap-2">
            <span>📌</span>
            <span>Obsidian Vault & Memory Grounding</span>
          </h2>
          <p className="text-xs text-text-dim mt-1">
            Authoritative knowledge grounding for this workspace. All agent turns reference these
            verified notes and memories.
          </p>
        </div>
        {onOpenVaultDrawer && (
          <button
            type="button"
            onClick={onOpenVaultDrawer}
            className="self-start sm:self-auto px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-action text-action-fg hover:bg-action-hover transition-colors shadow-xs"
          >
            Inspect Vault Drawer →
          </button>
        )}
      </div>

      {/* Vault Sync Status Banner */}
      <div className="p-3.5 rounded-xl border border-success/30 bg-success/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-success animate-pulse motion-reduce:animate-none" />
          <span className="font-medium text-text">Obsidian Vault Connected:</span>
          <span className="text-text-muted">CRDT Local Mirror Active</span>
          <span className="text-text-dim">·</span>
          <span className="font-mono text-text-muted">
            {filteredMemories.length} Grounded Notes
          </span>
        </div>
        <span className="text-[11px] font-mono text-text-dim">
          Workspace · {workspaceId.slice(0, 8)}
        </span>
      </div>

      {/* Filter and Search Bar */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-text-dim text-xs">
              🔍
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search memories, skills, notes, or entities…"
              aria-label="Search memories, skills, notes"
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-border/60 bg-surface-50 text-xs text-text placeholder:text-text-dim focus:outline-none focus:border-action transition-colors"
            />
          </div>

          {/* Category Tag Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            {categories.map((cat) => {
              const isActive = activeCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  aria-label={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-colors ${
                    isActive
                      ? 'bg-action text-action-fg font-medium'
                      : 'bg-surface-100 hover:bg-surface-200 text-text-muted border border-border/50'
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Memories Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredMemories.length === 0 ? (
          <div className="col-span-full py-12 text-center text-text-dim text-xs">
            No memories match the filter query &ldquo;{searchQuery}&rdquo;.
          </div>
        ) : (
          filteredMemories.map((mem) => (
            <div
              key={mem.id}
              className="p-4 rounded-xl border border-border/60 bg-surface-50 hover:border-border transition-all flex flex-col justify-between space-y-3"
            >
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-text">{mem.title}</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-surface-200 border border-border/50 text-text-dim">
                    #{mem.category}
                  </span>
                </div>
                <p className="text-xs text-text-muted leading-relaxed">{mem.content}</p>
                <div className="pt-2 text-[10px] font-mono text-text-dim flex items-center justify-between">
                  <span>Source: {mem.source}</span>
                  <span>{mem.date}</span>
                </div>
              </div>

              <div className="pt-3 border-t border-border/40 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => handleCopy(mem.id, mem.content)}
                  className="px-2.5 py-1 rounded-lg text-xs font-medium text-text-dim hover:text-text hover:bg-surface-200 border border-border/50 transition-colors"
                >
                  {copiedId === mem.id ? '✓ Copied' : 'Copy'}
                </button>
                <button
                  type="button"
                  onClick={() => onCiteMemory(`[Memory Citation: ${mem.title}]\n"${mem.content}"`)}
                  className="px-3 py-1 rounded-lg text-xs font-semibold bg-action/15 hover:bg-action text-action hover:text-action-fg border border-action/40 transition-colors"
                >
                  Cite in Chat
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
