'use client';

import React, { useEffect, useRef } from 'react';
import { XIcon, ShieldIcon, FileTextIcon, BrainIcon, DatabaseIcon } from '@vaeloom/ui-kit';
import type { GroundingDossier } from './types';

export interface GroundingDossierModalProps {
  isOpen: boolean;
  onClose: () => void;
  dossier: GroundingDossier | undefined;
  agentName?: string;
}

export function GroundingDossierModal({
  isOpen,
  onClose,
  dossier,
  agentName,
}: GroundingDossierModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    closeButtonRef.current?.focus();
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const memories = dossier?.memories || [];
  const tokenEstimate = dossier?.contextTokenEstimate;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dossier-title"
    >
      <div
        ref={modalRef}
        className="w-full max-w-2xl bg-surface border border-border rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface-50">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-success/10 text-success border border-success/20">
              <ShieldIcon size={16} />
            </div>
            <div>
              <h2
                id="dossier-title"
                className="text-sm font-semibold text-text flex items-center gap-2"
              >
                Grounding Provenance Dossier
                {agentName && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-surface-200 text-text-muted font-normal">
                    @{agentName}
                  </span>
                )}
              </h2>
              <p className="text-xs text-text-muted">
                Authoritative evidence inspected before inference
              </p>
            </div>
          </div>
          <button
            ref={closeButtonRef}
            onClick={onClose}
            className="p-1.5 rounded-lg text-text-muted hover:text-text hover:bg-surface-hover transition-colors"
            aria-label="Close dossier dialog"
          >
            <XIcon size={16} />
          </button>
        </div>

        {/* Cognitive Precedence Banner */}
        <div className="px-6 py-2.5 bg-info/10 border-b border-info/20 text-xs text-info flex items-center justify-between">
          <span className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-info animate-pulse" />
            Zero-Trust Precedence: Active Vault Docs &gt; Dynamic Memories
          </span>
          {typeof tokenEstimate === 'number' && (
            <span className="font-mono text-[11px] text-text-muted">
              ~{tokenEstimate.toLocaleString()} tokens
            </span>
          )}
        </div>

        {/* Content list */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {memories.length === 0 ? (
            <div className="py-12 text-center text-text-dim text-sm">
              <DatabaseIcon size={32} className="mx-auto mb-2 text-text-dim opacity-60" />
              <p>No external memories or vault documents were injected into this turn.</p>
              <p className="text-xs text-text-dim mt-1">
                The model answered using its base reasoning capabilities.
              </p>
            </div>
          ) : (
            memories.map((item: any, idx: number) => {
              const isVaultDoc = item.source === 'vault' || item.type === 'document';
              const Icon = isVaultDoc ? FileTextIcon : BrainIcon;
              const sourceLabel = isVaultDoc ? 'Vault Document' : 'Memory Vault';
              const scorePct = Math.round((Number(item.score) || 0) * 100);

              return (
                <div
                  key={item.id || idx}
                  className="p-4 rounded-lg bg-surface-50 border border-border hover:border-border-strong transition-all space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className={`p-1 rounded ${
                          isVaultDoc
                            ? 'bg-info/10 text-info border border-info/20'
                            : 'bg-accent/10 text-accent border border-accent/20'
                        }`}
                      >
                        <Icon size={14} />
                      </div>
                      <span className="text-xs font-semibold text-text">{item.title}</span>
                      <span className="text-[11px] px-1.5 py-0.5 rounded bg-surface-200 text-text-muted border border-border">
                        {sourceLabel}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono text-success bg-success/10 px-1.5 py-0.5 rounded border border-success/20 font-medium">
                        {scorePct}% match
                      </span>
                      {item.updatedAt && (
                        <span className="text-[11px] text-text-dim">
                          {new Date(item.updatedAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Verbatim quote snippet */}
                  <blockquote className="text-xs text-text font-mono bg-surface p-3 rounded border border-border whitespace-pre-wrap leading-relaxed">
                    {item.snippet}
                  </blockquote>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-border bg-surface-50 flex items-center justify-between text-xs text-text-muted">
          <span>All items retrieved with workspace-boundary verification.</span>
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg bg-surface-200 hover:bg-surface-hover text-text text-xs font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
