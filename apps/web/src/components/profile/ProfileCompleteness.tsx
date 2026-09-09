import React from 'react';
import { ProfileCompletenessData } from '@/lib/api-client';

interface ProfileCompletenessProps {
  data: ProfileCompletenessData;
}

export default function ProfileCompleteness({ data }: ProfileCompletenessProps) {
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (data.score / 100) * circumference;

  return (
    <div className="card mb-6">
      <h3 className="font-medium text-text mb-6">Profile Completeness</h3>

      <div className="flex justify-center mb-6">
        <div className="relative w-32 h-32 flex items-center justify-center">
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
            <circle
              className="text-surface-200 stroke-current"
              strokeWidth="8"
              cx="50"
              cy="50"
              r={radius}
              fill="transparent"
            />
            <circle
              className="text-primary stroke-current transition-all duration-1000 ease-out"
              strokeWidth="8"
              strokeLinecap="round"
              cx="50"
              cy="50"
              r={radius}
              fill="transparent"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-display font-bold text-text">{data.score}%</span>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {data.suggestions.map((suggestion, idx) => (
          <div key={idx} className="p-3 bg-surface-200 rounded-lg flex items-start gap-3">
            <div className="mt-0.5 text-primary">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-text">{suggestion.action}</p>
              <p className="text-xs text-text-muted mt-1">Boosts score by {suggestion.boost}</p>
            </div>
          </div>
        ))}
        {data.suggestions.length === 0 && (
          <div className="text-center text-sm text-green-500 font-medium">
            Your profile is looking great!
          </div>
        )}
      </div>
    </div>
  );
}
