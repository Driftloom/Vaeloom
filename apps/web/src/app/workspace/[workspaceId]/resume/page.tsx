'use client';
import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import { EmptyState } from '@/components/shared/EmptyState';
import { api } from '../../../../lib/api';

export default function ResumePage() {
  const params = useParams();
  const workspaceId = params?.['workspaceId'] as string | undefined;

  const [hasResume, setHasResume] = useState(true);
  const [resumeText, setResumeText] = useState("John Doe\nSoftware Engineer\n\nExperience\n- Built scalable web apps\n- Integrated AI tools");
  const [variant, setVariant] = useState('master');
  const [generating, setGenerating] = useState(false);

  const handleGenerate = async () => {
    if (!workspaceId) return;
    setGenerating(true);
    try {
      await api.request(`/workspaces/${workspaceId}/resumes/master`, { method: 'GET' });
      // In a full implementation this POSTs to :resumeId/generate with the target variant.
      await api.request(`/workspaces/${workspaceId}/resumes`, { method: 'GET' });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <header className="mb-6 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-display font-medium text-text mb-2">Resume</h1>
          <p className="text-text-muted">Edit your master resume and view tailored variants.</p>
        </div>
        <div className="flex gap-2">
          <select 
            value={variant} 
            onChange={(e) => setVariant(e.target.value)}
            className="bg-surface border border-border text-text rounded px-3 py-2"
          >
            <option value="master">Master Resume</option>
            <option value="ats">ATS Optimized</option>
            <option value="google">Tailored: Google SWE</option>
          </select>
          <button className="btn-primary" onClick={handleGenerate} disabled={generating}>
            {generating ? 'Generating…' : 'Generate Variant'}
          </button>
        </div>
      </header>

      {!hasResume ? (
        <EmptyState 
          title="No resume found" 
          description="Upload an existing resume or start building one from your extracted experience."
          action={{ label: 'Create Master Resume', onClick: () => setHasResume(true) }}
        />
      ) : (
        <div className="flex gap-6 flex-1">
          <div className="flex-1 card flex flex-col p-0 overflow-hidden">
            <div className="bg-surface-hover border-b border-border p-3 flex gap-2">
              <button className="text-sm font-medium text-text-muted hover:text-text px-2">B</button>
              <button className="text-sm font-medium text-text-muted hover:text-text px-2">I</button>
              <button className="text-sm font-medium text-text-muted hover:text-text px-2">U</button>
            </div>
            <textarea 
              className="flex-1 bg-transparent text-text p-6 resize-none focus:outline-none"
              value={resumeText}
              onChange={(e) => setResumeText(e.target.value)}
            />
          </div>
          
          <aside className="w-80 shrink-0 flex flex-col space-y-4">
            <div className="card border-accent/30 bg-accent/5">
              <h3 className="font-mono text-sm text-accent mb-2 uppercase tracking-wider flex items-center gap-2">
                <span>🤖</span> Resume Agent
              </h3>
              <p className="text-text mb-4 text-sm">
                Your experience section is missing measurable metrics. Could you quantify &quot;Built scalable web apps&quot;? (e.g. users served, load reduced)
              </p>
              <textarea 
                className="w-full bg-background border border-border rounded p-2 text-sm text-text mb-2"
                placeholder="e.g. Scaled to 10k users..."
                rows={3}
              />
              <button className="btn-secondary w-full text-sm">Update Resume</button>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
