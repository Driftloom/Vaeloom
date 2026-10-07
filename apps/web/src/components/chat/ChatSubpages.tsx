'use client';

import React from 'react';
import type { ChatTab, ModelOption } from './types';
import { SPECIALIST_AGENTS } from './ChatAgentSquadSelector';

export interface ChatSubpagesNavProps {
  activeTab: ChatTab;
  onTabChange: (tab: ChatTab) => void;
}

export function ChatSubpagesNav({ activeTab, onTabChange }: ChatSubpagesNavProps): JSX.Element {
  const tabs: Array<{ id: ChatTab; label: string; icon: string }> = [
    { id: 'stream', label: 'Chat Stream', icon: '💬' },
    { id: 'squads', label: 'Agent Squads', icon: '👥' },
    { id: 'models', label: 'Model Matrix', icon: '⚡' },
    { id: 'memory', label: 'Memory Vault', icon: '📌' },
  ];

  return (
    <nav
      className="flex items-center gap-1 border-b border-border/40 bg-surface-50/50 px-4 py-1.5 overflow-x-auto"
      aria-label="Chat Subpage Navigation"
      role="tablist"
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            aria-controls={`panel-${tab.id}`}
            id={`tab-${tab.id}`}
            onClick={() => onTabChange(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all shrink-0 ${
              isActive
                ? 'bg-surface-200 text-text font-semibold shadow-xs border border-border/80'
                : 'text-text-muted hover:text-text hover:bg-surface-hover border border-transparent'
            }`}
            data-testid={`subpage-tab-${tab.id}`}
          >
            <span aria-hidden="true">{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

export interface AgentSquadsViewProps {
  selectedSquad: string[];
  onToggleAgent: (agentId: string) => void;
  onSelectSquad: (squad: string[]) => void;
}

export function AgentSquadsView({
  selectedSquad,
  onToggleAgent,
  onSelectSquad,
}: AgentSquadsViewProps): JSX.Element {
  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 max-w-5xl mx-auto w-full">
      <div className="border-b border-border/50 pb-4">
        <h2 className="text-lg font-semibold text-text">Specialist Agent Squads</h2>
        <p className="text-xs text-text-dim mt-1">
          Configure specialized agents to run in parallel. Each agent focuses on a distinct domain
          of your career campaign, followed by an executive synthesis.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {SPECIALIST_AGENTS.map((agent) => {
          const isSelected = selectedSquad.includes(agent.id);
          return (
            <div
              key={agent.id}
              className={`p-4 rounded-xl border transition-all flex flex-col justify-between ${
                isSelected
                  ? 'border-action bg-action/5 ring-1 ring-action/30'
                  : 'border-border/60 bg-surface-50'
              }`}
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: agent.color }}
                    />
                    <h3 className="text-sm font-semibold text-text">{agent.name}</h3>
                  </div>
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded border ${agent.badgeClass}`}
                  >
                    {agent.role}
                  </span>
                </div>
                <p className="text-xs text-text-muted leading-relaxed">{agent.description}</p>
              </div>

              <div className="pt-4 mt-4 border-t border-border/40 flex items-center justify-between">
                <span className="text-[11px] font-mono text-text-dim">
                  {isSelected ? 'Active in Squad' : 'Inactive'}
                </span>
                <button
                  type="button"
                  onClick={() => onToggleAgent(agent.id)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${
                    isSelected
                      ? 'border-action bg-action text-action-fg'
                      : 'border-border bg-surface-100 text-text hover:bg-surface-hover'
                  }`}
                >
                  {isSelected ? 'Remove' : '+ Add to Squad'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export interface ModelMatrixViewProps {
  availableModels: ModelOption[];
  selectedModel: string;
  onSelectModel: (modelId: string) => void;
  temperature: number;
  onTemperatureChange: (temp: number) => void;
}

export function ModelMatrixView({
  availableModels,
  selectedModel,
  onSelectModel,
  temperature,
  onTemperatureChange,
}: ModelMatrixViewProps): JSX.Element {
  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 max-w-5xl mx-auto w-full">
      <div className="border-b border-border/50 pb-4">
        <h2 className="text-lg font-semibold text-text">Foundation Model Matrix</h2>
        <p className="text-xs text-text-dim mt-1">
          Explore foundation models supporting fast execution, balanced workloads, and deep
          multi-step reasoning.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {availableModels.map((model) => {
          const isSelected = model.id === selectedModel;
          return (
            <div
              key={model.id}
              className={`p-4 rounded-xl border transition-all flex flex-col justify-between ${
                isSelected
                  ? 'border-action bg-action/5 ring-1 ring-action/40'
                  : 'border-border/60 bg-surface-50'
              }`}
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-text">{model.name}</h3>
                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-surface-200 border border-border text-text-dim">
                    {model.provider}
                  </span>
                </div>
                <div className="text-[11px] font-mono text-text-muted flex gap-2">
                  <span>Tier: {model.tier}</span>
                  {model.maxTokens && <span>Ctx: {(model.maxTokens / 1000).toFixed(0)}k</span>}
                </div>
                {model.description && (
                  <p className="text-xs text-text-dim leading-relaxed">{model.description}</p>
                )}
                {(model.inputCostPer1m !== undefined || model.outputCostPer1m !== undefined) && (
                  <div className="text-[10px] font-mono text-text-dim pt-1">
                    Cost: ${model.inputCostPer1m?.toFixed(2) ?? '0.00'} / $
                    {model.outputCostPer1m?.toFixed(2) ?? '0.00'} per 1M tokens
                  </div>
                )}
              </div>

              <div className="pt-4 mt-4 border-t border-border/40 flex items-center justify-between">
                <span className="text-[11px] font-mono text-text-dim">
                  {isSelected ? '✓ Default Model' : 'Available'}
                </span>
                <button
                  type="button"
                  onClick={() => onSelectModel(model.id)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${
                    isSelected
                      ? 'border-action bg-action text-action-fg'
                      : 'border-border bg-surface-100 text-text hover:bg-surface-hover'
                  }`}
                >
                  {isSelected ? 'Selected' : 'Select'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
