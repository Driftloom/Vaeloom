'use client';
import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import { EmptyState } from '@/components/shared/EmptyState';
import { ProposalCard } from '@/components/shared/ProposalCard';
import { Modal, Input } from '@vaeloom/ui-kit';
import { api } from '../../../../lib/api';

export default function WorkspaceFilesPage() {
  const params = useParams();
  const workspaceId = params?.['workspaceId'] as string | undefined;

  const [files, setFiles] = useState([
    { id: '1', name: 'Resume_v2_final.pdf', type: 'application/pdf', category: 'Resumes' },
    { id: '2', name: 'Transcript.pdf', type: 'application/pdf', category: 'Transcripts' }
  ]);
  
  const [proposals, setProposals] = useState([
    {
      id: 'p1',
      agentName: 'Organization Agent',
      description: 'Rename "Resume_v2_final.pdf" to "Resume.pdf" and move to Resumes folder.'
    }
  ]);

  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadName, setUploadName] = useState('');
  const [uploading, setUploading] = useState(false);

  const handleApprove = (id: string) => {
    setProposals(proposals.filter(p => p.id !== id));
    // Simulate updating the file
    if (id === 'p1') {
      setFiles(files.map(f => f.id === '1' ? { ...f, name: 'Resume.pdf' } : f));
    }
  };

  const handleReject = (id: string) => {
    setProposals(proposals.filter(p => p.id !== id));
  };

  const handleUpload = async () => {
    if (!workspaceId || !uploadName.trim()) return;
    setUploading(true);
    try {
      await api.request(`/workspaces/${workspaceId}/documents`, {
        method: 'POST',
        body: JSON.stringify({ name: uploadName, category: 'Documents' }),
      });
      setFiles((prev) => [...prev, { id: Date.now().toString(), name: uploadName, type: 'application/octet-stream', category: 'Documents' }]);
      setUploadOpen(false);
      setUploadName('');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex h-full gap-6">
      <div className="flex-1 flex flex-col">
        <header className="mb-6 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-display font-medium text-text mb-2">Files</h1>
            <p className="text-text-muted">Manage your documents and view agent suggestions.</p>
          </div>
          <button className="btn-primary" onClick={() => setUploadOpen(true)}>Upload File</button>
        </header>

        {files.length === 0 ? (
          <EmptyState 
            title="No files yet" 
            description="Upload your resume, transcripts, or cover letters to get started."
            action={{ label: 'Upload File', onClick: () => {} }}
          />
        ) : (
          <div className="card flex-1">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border text-text-muted font-mono text-sm uppercase">
                  <th className="pb-3 font-normal">Name</th>
                  <th className="pb-3 font-normal">Category</th>
                  <th className="pb-3 font-normal">Type</th>
                </tr>
              </thead>
              <tbody>
                {files.map(f => (
                  <tr key={f.id} className="border-b border-border/50 hover:bg-background/50 cursor-pointer transition-colors">
                    <td className="py-3 text-text">{f.name}</td>
                    <td className="py-3 text-text-muted">{f.category}</td>
                    <td className="py-3 text-text-muted font-mono text-sm">{f.type}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <aside className="w-80 shrink-0 flex flex-col">
        <h2 className="text-lg font-display font-medium text-text mb-4">Agent Proposals</h2>
        {proposals.length === 0 ? (
          <div className="card bg-background/50 text-center py-8">
            <p className="text-text-muted text-sm">No active proposals.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {proposals.map(p => (
              <ProposalCard
                key={p.id}
                id={p.id}
                agentName={p.agentName}
                description={p.description}
                onApprove={handleApprove}
                onReject={handleReject}
              />
            ))}
          </div>
        )}
      </aside>

      <Modal isOpen={uploadOpen} onClose={() => setUploadOpen(false)} title="Upload File">
        <div className="space-y-4">
          <Input
            label="File name"
            value={uploadName}
            onChange={(e) => setUploadName(e.target.value)}
            placeholder="e.g. Resume.pdf"
          />
          <div className="flex justify-end gap-2">
            <button className="btn-secondary" onClick={() => setUploadOpen(false)}>Cancel</button>
            <button className="btn-primary" onClick={handleUpload} disabled={uploading}>
              {uploading ? 'Uploading…' : 'Upload'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
