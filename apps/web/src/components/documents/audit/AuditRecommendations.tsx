'use client';

import React, { useState, useCallback } from 'react';
import { Button, CheckIcon, CopyIcon, SparklesIcon } from '@vaeloom/ui-kit';

export interface AuditRecommendationsProps {
  recommendations: string[];
}

export const AuditRecommendations: React.FC<AuditRecommendationsProps> = ({ recommendations }) => {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const handleCopyRecommendation = useCallback((text: string, index: number) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      void navigator.clipboard.writeText(text);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    }
  }, []);

  if (recommendations.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <SparklesIcon size={16} className="text-accent" />
        <h4 className="text-xs font-semibold text-text uppercase tracking-wider">
          AI Actionable Recommendations ({recommendations.length})
        </h4>
      </div>

      <div className="space-y-2">
        {recommendations.map((rec, idx) => (
          <div
            key={idx}
            className="p-3 rounded-lg bg-accent/5 border border-accent/20 flex items-start justify-between gap-3 text-xs"
          >
            <div className="flex items-start gap-2.5">
              <span
                aria-hidden="true"
                className="w-5 h-5 rounded-full bg-accent/10 text-accent font-semibold flex items-center justify-center shrink-0 text-[10px]"
              >
                {idx + 1}
              </span>
              <p className="text-text leading-relaxed mt-0.5">{rec}</p>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleCopyRecommendation(rec, idx)}
              className="shrink-0 h-7 px-2 text-xs"
              aria-label={`Copy recommendation ${idx + 1} of ${recommendations.length}`}
            >
              {copiedIndex === idx ? (
                <>
                  <CheckIcon size={12} className="text-success mr-1" />
                  <span className="text-success">Copied</span>
                </>
              ) : (
                <>
                  <CopyIcon size={12} className="text-text-muted mr-1" />
                  <span>Copy</span>
                </>
              )}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
};
