'use client';
import React, { useState } from 'react';
import { EmptyState } from '@/components/shared/EmptyState';

export default function JobsPage() {
  const [jobs, setJobs] = useState([
    { id: '1', title: 'Senior Frontend Engineer', company: 'TechCorp', fitScore: 92, reason: 'Matches your Next.js and Tailwind experience perfectly. Missing AWS.' },
    { id: '2', title: 'Full Stack Developer', company: 'StartupInc', fitScore: 85, reason: 'Good match for React, but they want more Node.js experience than you currently show.' },
  ]);

  const handleApprove = (id: string) => {
    setJobs(jobs.filter(j => j.id !== id));
    // In real app, moves to Applications (shortlisted)
  };

  const handleReject = (id: string) => {
    setJobs(jobs.filter(j => j.id !== id));
  };

  return (
    <div className="flex flex-col h-full">
      <header className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-display font-medium text-text mb-2">Jobs</h1>
          <p className="text-text-muted">Review roles shortlisted by your Job Search Agent.</p>
        </div>
        <button className="btn-primary" disabled title="Job search agent runs on its configured schedule">Trigger Job Search</button>
      </header>

      {jobs.length === 0 ? (
        <EmptyState 
          title="No jobs found yet" 
          description="Update your preferences or trigger a new search to find tailored opportunities."
          action={{ label: 'Configure Search Agent', onClick: () => {} }}
        />
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {jobs.map(job => (
            <div key={job.id} className="card flex flex-col gap-4">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-xl font-display text-text">{job.title}</h2>
                  <p className="text-text-muted">{job.company}</p>
                </div>
                <div className="bg-surface-active px-3 py-1 rounded-full border border-primary/30">
                  <span className="text-primary font-mono text-sm">{job.fitScore}% Fit</span>
                </div>
              </div>
              
              <div className="bg-primary/5 border border-primary/20 rounded p-3 text-sm text-text">
                <span className="font-mono text-primary text-xs uppercase tracking-wider block mb-1">Agent Reasoning</span>
                {job.reason}
              </div>

              <div className="flex gap-3 mt-auto pt-2 border-t border-border">
                <button className="btn-primary flex-1" onClick={() => handleApprove(job.id)}>Shortlist for Application</button>
                <button className="btn-secondary flex-1" onClick={() => handleReject(job.id)}>Not Interested</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
