import React from 'react';
import { CareerEntry } from '@/lib/api-client';

interface CareerTimelineProps {
  careerHistory: CareerEntry[];
}

export default function CareerTimeline({ careerHistory }: CareerTimelineProps) {
  if (!careerHistory || careerHistory.length === 0) return null;

  return (
    <div className="card mb-6">
      <h3 className="font-medium text-text mb-6">Experience Timeline</h3>

      <div className="relative">
        <div className="absolute left-[7px] top-2 bottom-2 w-0.5 bg-border" />

        <div className="space-y-6">
          {careerHistory.map((role, idx) => (
            <div key={idx} className="relative pl-6">
              <div
                className={`absolute w-4 h-4 rounded-full -left-0 top-1 border-2 border-surface ${
                  role.confidence >= 0.8 ? 'bg-primary' : 'bg-surface-200'
                }`}
              />

              <div>
                <div className="font-medium text-sm text-text">{role.role}</div>
                <div className="text-xs text-primary mb-1">{role.company}</div>
                <div className="text-xs text-text-dim">
                  {role.startDate ? new Date(role.startDate).getFullYear() : ''} -{' '}
                  {role.endDate ? new Date(role.endDate).getFullYear() : 'Present'}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
