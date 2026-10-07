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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dossier-title"
    >
      <div
        ref={modalRef}
        className="w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/80 bg-zinc-950/60">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <ShieldIcon size={16} />
            </div>
            <div>
              <h2
                id="dossier-title"
                className="text-sm font-semibold text-zinc-100 flex items-center gap-2"
              >
                Grounding Provenance Dossier
                {agentName && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 font-normal">
                    @{agentName}
                  </span>
                )}
              </h2>
              <p className="text-xs text-zinc-400">
                Authoritative evidence inspected before inference
              </p>
            </div>
          </div>
          <button
            ref={closeButtonRef}
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
            aria-label="Close dossier dialog"
          >
            <XIcon size={16} />
          </button>
        </div>

        {/* Cognitive Precedence Banner */}
        <div className="px-6 py-2.5 bg-blue-950/20 border-b border-blue-900/30 text-xs text-blue-300 flex items-center justify-between">
          <span className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
            Zero-Trust Precedence: Active Vault Docs &gt; Dynamic Memories
          </span>
          {typeof tokenEstimate === 'number' && (
            <span className="font-mono text-[11px] text-zinc-400">
              ~{tokenEstimate.toLocaleString()} tokens
            </span>
          )}
        </div>

        {/* Content list */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {memories.length === 0 ? (
            <div className="py-12 text-center text-zinc-500 text-sm">
              <DatabaseIcon size={32} className="mx-auto mb-2 text-zinc-600 opacity-60" />
              <p>No external memories or vault documents were injected into this turn.</p>
              <p className="text-xs text-zinc-600 mt-1">
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
                  className="p-4 rounded-lg bg-zinc-950/40 border border-zinc-800/80 hover:border-zinc-700/80 transition-all space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className={`p-1 rounded ${
                          isVaultDoc
                            ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                            : 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                        }`}
                      >
                        <Icon size={14} />
                      </div>
                      <span className="text-xs font-semibold text-zinc-200">{item.title}</span>
                      <span className="text-[11px] px-1.5 py-0.5 rounded bg-zinc-800/80 text-zinc-400 border border-zinc-700/50">
                        {sourceLabel}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/30 px-1.5 py-0.5 rounded border border-emerald-500/20 font-medium">
                        {scorePct}% match
                      </span>
                      {item.updatedAt && (
                        <span className="text-[11px] text-zinc-500">
                          {new Date(item.updatedAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Verbatim quote snippet */}
                  <blockquote className="text-xs text-zinc-300 font-mono bg-zinc-900/60 p-3 rounded border border-zinc-800/60 whitespace-pre-wrap leading-relaxed">
                    {item.snippet}
                  </blockquote>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-zinc-800/80 bg-zinc-950/60 flex items-center justify-between text-xs text-zinc-500">
          <span>All items retrieved with workspace-boundary verification.</span>
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
