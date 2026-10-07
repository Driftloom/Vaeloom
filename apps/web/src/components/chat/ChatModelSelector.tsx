'use client';

import React, { useEffect, useRef, useState } from 'react';
import type { ModelOption, ModelTier } from './types';

export interface ChatModelSelectorProps {
  selectedModel: string;
  onSelectModel: (modelId: string) => void;
  availableModels?: ModelOption[];
  models?: ModelOption[];
  isLoading?: boolean;
  temperature: number;
  onTemperatureChange: (temp: number) => void;
}

const TIER_ICONS: Record<ModelTier, string> = {
  fast: '⚡',
  balanced: '⚖️',
  powerful: '🧠',
};

const TIER_LABELS: Record<ModelTier, string> = {
  fast: 'Fast (Low Latency)',
  balanced: 'Balanced (General Purpose)',
  powerful: 'Powerful (Deep Reasoning)',
};

const PROVIDER_COLORS: Record<string, string> = {
  openai: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  anthropic: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  google: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  groq: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
  ollama: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
};

export function ChatModelSelector({
  selectedModel,
  onSelectModel,
  availableModels = [],
  models,
  isLoading = false,
  temperature,
  onTemperatureChange,
}: ChatModelSelectorProps): JSX.Element {
  const [isOpen, setIsOpen] = useState(false);
  const [filterTier, setFilterTier] = useState<ModelTier | 'all'>('all');
  const containerRef = useRef<HTMLDivElement>(null);

  const safeModels = models ?? availableModels ?? [];
  const activeModel = safeModels.find((m) => m.id === selectedModel) ??
    safeModels[0] ?? {
      id: selectedModel,
      name: selectedModel,
      provider: 'openai' as const,
      tier: 'fast' as const,
      maxTokens: 128000,
    };

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const filteredModels =
    filterTier === 'all' ? safeModels : safeModels.filter((m) => m.tier === filterTier);

  return (
    <div className="relative inline-block text-left" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-surface-50 px-2.5 py-1 text-xs font-medium text-text hover:bg-surface-hover hover:border-border transition-colors motion-reduce:transition-none focus:outline-none focus:ring-1 focus:ring-action"
        aria-haspopup="true"
        aria-expanded={isOpen}
        aria-label={`Select model: ${activeModel.name}`}
        data-testid="chat-model-selector-trigger"
      >
        <span aria-hidden="true" className="text-xs">
          {TIER_ICONS[activeModel.tier] ?? '⚡'}
        </span>
        <span className="font-semibold text-text truncate max-w-[110px] sm:max-w-[150px]">
          {activeModel.name}
        </span>
        <span className="hidden font-mono text-[10px] text-text-dim sm:inline">
          T:{temperature.toFixed(1)}
        </span>
        <svg
          className={`h-3 w-3 text-text-muted transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div
          role="dialog"
          aria-label="Model Selection Menu"
          data-testid="chat-model-selector-popover"
          className="absolute left-0 sm:right-0 sm:left-auto mt-2 w-80 sm:w-96 rounded-xl border border-border bg-surface-100 p-3 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-150"
        >
          <div className="flex items-center justify-between border-b border-border/50 pb-2 mb-2">
            <div>
              <h2 className="text-xs font-semibold text-text uppercase tracking-wider">
                Foundation Model Matrix
              </h2>
              <p className="text-[11px] text-text-dim">
                Select LLM engine & parameters for workspace agents
              </p>
            </div>
            {isLoading && (
              <span className="inline-flex items-center gap-1 text-[10px] text-text-dim animate-pulse">
                Syncing catalog...
              </span>
            )}
          </div>

          {/* Tier Filter Tabs */}
          <div className="flex gap-1 p-0.5 rounded-lg bg-surface-50 border border-border/40 mb-2.5">
            {(['all', 'fast', 'balanced', 'powerful'] as const).map((tier) => (
              <button
                key={tier}
                type="button"
                onClick={() => setFilterTier(tier)}
                className={`flex-1 py-1 text-[11px] font-medium rounded-md capitalize transition-colors ${
                  filterTier === tier
                    ? 'bg-surface-200 text-text shadow-sm'
                    : 'text-text-muted hover:text-text'
                }`}
              >
                {tier === 'all' ? 'All Tiers' : `${TIER_ICONS[tier]} ${tier}`}
              </button>
            ))}
          </div>

          {/* Models List */}
          <div className="max-h-64 overflow-y-auto space-y-3 pr-0.5" role="listbox">
            {/* Section 1: Platform Active Models */}
            {filteredModels.filter((m) => m.status !== 'byok_required').length > 0 && (
              <div>
                <div className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider px-1 mb-1.5 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  Platform Active (Ready to Use)
                </div>
                <div className="space-y-1.5">
                  {filteredModels
                    .filter((m) => m.status !== 'byok_required')
                    .map((model) => {
                      const isSelected = model.id === selectedModel;
                      const providerClass =
                        PROVIDER_COLORS[model.provider] ??
                        'bg-surface-200 text-text-dim border-border';

                      return (
                        <button
                          key={model.id}
                          type="button"
                          role="option"
                          aria-selected={isSelected}
                          onClick={() => {
                            onSelectModel(model.id);
                            setIsOpen(false);
                          }}
                          className={`w-full text-left p-2 rounded-lg border transition-all flex items-start justify-between gap-2 ${
                            isSelected
                              ? 'border-action bg-action/10 ring-1 ring-action/50'
                              : 'border-border/40 hover:border-border hover:bg-surface-hover'
                          }`}
                          data-testid={`model-option-${model.id}`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-xs font-medium text-text">{model.name}</span>
                              <span
                                className={`inline-block text-[9px] uppercase font-mono px-1.5 py-0.2 rounded border ${providerClass}`}
                              >
                                {model.provider}
                              </span>
                              {model.cognitiveRole && (
                                <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-zinc-800 text-zinc-300">
                                  {model.cognitiveRole === 'system1'
                                    ? 'System 1 (<50ms)'
                                    : 'System 2'}
                                </span>
                              )}
                              <span className="text-[10px] text-text-dim">
                                {TIER_ICONS[model.tier]} {model.tier}
                              </span>
                            </div>
                            {model.description && (
                              <p className="text-[11px] text-text-dim line-clamp-1 mt-0.5">
                                {model.description}
                              </p>
                            )}
                            <div className="flex items-center gap-2 mt-1 text-[10px] text-text-muted">
                              {model.maxTokens && (
                                <span>Ctx: {(model.maxTokens / 1000).toFixed(0)}k</span>
                              )}
                              {model.inputCostPer1m !== undefined && (
                                <span>In: ${model.inputCostPer1m.toFixed(2)}/1M</span>
                              )}
                            </div>
                          </div>
                          {isSelected && (
                            <span className="text-action shrink-0 mt-0.5" aria-hidden="true">
                              ✓
                            </span>
                          )}
                        </button>
                      );
                    })}
                </div>
              </div>
            )}

            {/* Section 2: BYOK Models */}
            {filteredModels.filter((m) => m.status === 'byok_required').length > 0 && (
              <div>
                <div className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider px-1 mb-1.5 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                  Bring Your Own Key (BYOK)
                </div>
                <div className="space-y-1.5">
                  {filteredModels
                    .filter((m) => m.status === 'byok_required')
                    .map((model) => {
                      const isSelected = model.id === selectedModel;
                      const providerClass =
                        PROVIDER_COLORS[model.provider] ??
                        'bg-surface-200 text-text-dim border-border';

                      return (
                        <button
                          key={model.id}
                          type="button"
                          role="option"
                          aria-selected={isSelected}
                          onClick={() => {
                            onSelectModel(model.id);
                            setIsOpen(false);
                          }}
                          className={`w-full text-left p-2 rounded-lg border transition-all flex items-start justify-between gap-2 opacity-90 ${
                            isSelected
                              ? 'border-action bg-action/10 ring-1 ring-action/50'
                              : 'border-border/40 hover:border-border hover:bg-surface-hover'
                          }`}
                          data-testid={`model-option-${model.id}`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-xs font-medium text-text">{model.name}</span>
                              <span
                                className={`inline-block text-[9px] uppercase font-mono px-1.5 py-0.2 rounded border ${providerClass}`}
                              >
                                {model.provider}
                              </span>
                              <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-amber-950/40 text-amber-400 border border-amber-500/30">
                                🔑 BYOK
                              </span>
                              <span className="text-[10px] text-text-dim">
                                {TIER_ICONS[model.tier]} {model.tier}
                              </span>
                            </div>
                            {model.description && (
                              <p className="text-[11px] text-text-dim line-clamp-1 mt-0.5">
                                {model.description}
                              </p>
                            )}
                            <div className="flex items-center gap-2 mt-1 text-[10px] text-text-muted">
                              {model.maxTokens && (
                                <span>Ctx: {(model.maxTokens / 1000).toFixed(0)}k</span>
                              )}
                              <span className="text-amber-400/80">Requires personal key</span>
                            </div>
                          </div>
                          {isSelected && (
                            <span className="text-action shrink-0 mt-0.5" aria-hidden="true">
                              ✓
                            </span>
                          )}
                        </button>
                      );
                    })}
                </div>
              </div>
            )}
          </div>

          {/* Temperature Slider */}
          <div className="mt-3 pt-2.5 border-t border-border/50">
            <div className="flex items-center justify-between text-[11px] mb-1">
              <span className="font-medium text-text">Inference Temperature</span>
              <span className="font-mono text-text-muted font-semibold">
                {temperature.toFixed(2)}
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={temperature}
              onChange={(e) => onTemperatureChange(parseFloat(e.target.value))}
              className="w-full accent-action cursor-pointer h-1.5 bg-surface-200 rounded-lg"
              aria-label="Temperature slider"
            />
            <div className="flex justify-between items-center mt-1 text-[10px] text-text-dim">
              <button
                type="button"
                onClick={() => onTemperatureChange(0.2)}
                className="hover:text-text transition-colors"
              >
                Precise (0.2)
              </button>
              <button
                type="button"
                onClick={() => onTemperatureChange(0.7)}
                className="hover:text-text transition-colors"
              >
                Balanced (0.7)
              </button>
              <button
                type="button"
                onClick={() => onTemperatureChange(0.9)}
                className="hover:text-text transition-colors"
              >
                Creative (0.9)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
