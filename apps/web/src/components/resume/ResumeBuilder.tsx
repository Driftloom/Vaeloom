'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { resumeApi, type ResumeResponse } from '@/lib/api-client';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

function renderContent(content: Record<string, unknown>): string {
  const sections: string[] = [];
  for (const [key, value] of Object.entries(content)) {
    if (key === 'name') {
      sections.unshift(String(value));
    } else if (key === 'email' || key === 'phone') {
      sections.push(String(value));
    } else if (Array.isArray(value)) {
      sections.push(`\n${key.toUpperCase()}`);
      for (const item of value) {
        if (typeof item === 'string') {
          sections.push(`  ${item}`);
        } else if (item && typeof item === 'object') {
          const parts = Object.entries(item)
            .filter(([k]) => k !== 'source_document_id' && k !== 'is_inferred')
            .map(([, v]) => String(v ?? ''));
          if (parts.length) sections.push(`  ${parts.join(' - ')}`);
        }
      }
    } else if (typeof value === 'string' && !['name', 'email', 'phone'].includes(key)) {
      sections.push(`${key}: ${value}`);
    }
  }
  return sections.join('\n');
}

export function ResumeBuilder({ workspaceId }: { workspaceId: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resumes, setResumes] = useState<ResumeResponse[]>([]);
  const [generating, setGenerating] = useState(false);
  const [targetRole, setTargetRole] = useState('');

  const fetchData = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await resumeApi.list(workspaceId);
      setResumes(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load resumes');
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const masterResume = resumes.find(r => r.variant_type === 'master');
  const variants = resumes.filter(r => r.variant_type !== 'master');

  const handleGenerate = async () => {
    const sourceId = masterResume?.id ?? resumes[0]?.id;
    if (!sourceId) return;
    setGenerating(true);
    try {
      await resumeApi.generate(sourceId, {
        variant_type: targetRole ? 'tailored' : 'generic',
        ...(targetRole && { target_role: targetRole }),
      });
      setTargetRole('');
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate variant');
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col h-full">
        <header className="mb-6">
          <h1 className="text-3xl font-display font-medium text-text mb-2">Resume</h1>
          <p className="text-text-muted">Edit your master resume and view tailored variants.</p>
        </header>
        <div className="flex-1 flex items-center justify-center text-text-muted">
          Loading resumes...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col h-full">
        <header className="mb-6">
          <h1 className="text-3xl font-display font-medium text-text mb-2">Resume</h1>
        </header>
        <ErrorState title="Failed to load resumes" message={error} onRetry={fetchData} />
      </div>
    );
  }

  if (resumes.length === 0) {
    return (
      <div className="flex flex-col h-full">
        <header className="mb-6">
          <h1 className="text-3xl font-display font-medium text-text mb-2">Resume</h1>
          <p className="text-text-muted">Build your master resume and generate tailored variants.</p>
        </header>
        <EmptyState
          title="No resumes yet"
          description="Upload documents so the Resume Agent can build your master resume from extracted experience."
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full gap-6">
      <header className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-display font-medium text-text mb-2">Resume</h1>
          <p className="text-text-muted">Edit your master resume and view tailored variants.</p>
        </div>
        <div className="flex items-end gap-3">
          <div>
            <label htmlFor="target-role" className="block text-xs font-mono text-text-muted mb-1 uppercase tracking-wider">Target Role</label>
            <input
              id="target-role"
              type="text"
              value={targetRole}
              onChange={e => setTargetRole(e.target.value)}
              placeholder="e.g. Senior Frontend Engineer"
              className="bg-surface border border-border text-text rounded px-3 py-2 text-sm w-64"
            />
          </div>
          <button className="btn-primary h-[38px]" onClick={handleGenerate} disabled={generating || resumes.length === 0}>
            {generating ? 'Generating…' : 'Generate Variant'}
          </button>
        </div>
      </header>

      <div className="flex gap-6 flex-1 min-h-0">
        <div className="flex-1 flex flex-col gap-4 min-w-0">
          {masterResume && (
            <div className="card border-accent/30 bg-accent/5 flex-1 flex flex-col p-0 overflow-hidden">
              <div className="px-6 py-3 border-b border-accent/20 flex items-center justify-between">
                <div>
                  <h2 className="font-display font-medium text-text">Master Resume</h2>
                  <p className="text-xs text-text-muted font-mono">
                    v{masterResume.version} &middot; {formatDate(masterResume.created_at)}
                  </p>
                </div>
              </div>
              <pre className="flex-1 bg-transparent text-text p-6 overflow-y-auto font-sans text-sm leading-relaxed whitespace-pre-wrap">
                {renderContent(masterResume.content) || 'No content'}
              </pre>
            </div>
          )}

          {!masterResume && (
            <div className="card flex-1 flex flex-col p-6">
              <p className="text-text-muted text-sm">
                No master resume found. Variants are shown below.
              </p>
            </div>
          )}
        </div>

        {variants.length > 0 && (
          <aside className="w-72 shrink-0 flex flex-col gap-3">
            <h3 className="font-mono text-sm text-text-muted uppercase tracking-wider">
              Variants ({variants.length})
            </h3>
            <div className="flex flex-col gap-2 overflow-y-auto">
              {variants.map(v => (
                <div key={v.id} className="card p-3 border-border/50 text-sm">
                  <div className="font-medium text-text capitalize">{v.variant_type}</div>
                  <div className="text-xs text-text-muted font-mono mt-1">
                    v{v.version} &middot; {formatDate(v.created_at)}
                  </div>
                </div>
              ))}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
