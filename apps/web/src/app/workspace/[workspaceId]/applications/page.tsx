'use client';
import React from 'react';
import { EmptyState } from '@/components/shared/EmptyState';

export default function ApplicationsPage() {
  const columns = [
    { id: 'shortlisted', title: 'Shortlisted' },
    { id: 'tailoring', title: 'Tailoring' },
    { id: 'submitted', title: 'Submitted' },
    { id: 'interviewing', title: 'Interviewing' },
    { id: 'resolved', title: 'Offer / Rejected' },
  ];

  const applications = [
    { id: '1', title: 'Senior Frontend Engineer', company: 'TechCorp', status: 'shortlisted' },
    { id: '2', title: 'React Developer', company: 'WebSolutions', status: 'submitted' },
  ];

  if (applications.length === 0) {
    return (
      <div className="flex flex-col h-full">
        <header className="mb-6">
          <h1 className="text-3xl font-display font-medium text-text mb-2">Applications</h1>
        </header>
        <EmptyState 
          title="No active applications" 
          description="Shortlist jobs to start tracking your application pipeline."
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <header className="mb-6">
        <h1 className="text-3xl font-display font-medium text-text mb-2">Applications</h1>
        <p className="text-text-muted">Track your progress and let the Application Agent handle submissions.</p>
      </header>

      <div className="flex gap-4 overflow-x-auto pb-4 flex-1">
        {columns.map(col => (
          <div key={col.id} className="flex-shrink-0 w-80 flex flex-col bg-surface-hover/50 rounded-lg p-4 border border-border">
            <h3 className="font-display font-medium text-text mb-4 flex justify-between">
              {col.title}
              <span className="text-text-muted font-mono text-sm bg-surface px-2 py-0.5 rounded">
                {applications.filter(a => a.status === col.id).length}
              </span>
            </h3>
            
            <div className="flex-1 space-y-3 overflow-y-auto">
              {applications.filter(a => a.status === col.id).map(app => (
                <div key={app.id} className="card hover:border-primary/50 transition-colors cursor-pointer">
                  <h4 className="font-medium text-text">{app.title}</h4>
                  <p className="text-sm text-text-muted mt-1">{app.company}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
