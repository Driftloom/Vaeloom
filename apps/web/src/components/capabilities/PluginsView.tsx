'use client';

import React, { useState } from 'react';
import { CapabilityItem } from '@/lib/capabilities-data';
import { useToast } from '@/components/shared/Toast';

interface PluginsViewProps {
  plugins: CapabilityItem[];
  searchQuery?: string;
  onTogglePlugin: (id: string) => void;
  onOpenGitImport: () => void;
}

interface BuiltinPluginConfig {
  id: string;
  name: string;
  badges: string[];
  description: string;
  icon: 'bots' | 'kanban' | 'radio' | 'default';
  desktopEnabled: boolean;
  agentEnabled: boolean;
}

const DEFAULT_BUILTIN_PLUGINS: BuiltinPluginConfig[] = [
  {
    id: 'builtin-bots',
    name: 'Bots',
    badges: ['Desktop', 'bundled'],
    description:
      'Manage, configure, and monitor automated Discord, Slack, and Telegram bot daemons and multi-agent background listeners.',
    icon: 'bots',
    desktopEnabled: true,
    agentEnabled: true,
  },
  {
    id: 'builtin-kanban',
    name: 'Kanban',
    badges: ['Desktop', 'bundled'],
    description:
      'Project management Kanban board with drag-and-drop task lanes, agent work-ticket dispatch, and status syncing.',
    icon: 'kanban',
    desktopEnabled: true,
    agentEnabled: true,
  },
  {
    id: 'builtin-radio',
    name: 'Radio',
    badges: ['Desktop', 'bundled'],
    description:
      'Background audio player, ambient focus lo-fi streams, and agent speech audio synthesis playback relay.',
    icon: 'radio',
    desktopEnabled: false,
    agentEnabled: true,
  },
];

export const PluginsView: React.FC<PluginsViewProps> = ({
  plugins,
  searchQuery = '',
  onTogglePlugin,
  onOpenGitImport,
}) => {
  const { toast } = useToast();
  const [builtinStates, setBuiltinStates] = useState<
    Record<string, { desktop: boolean; agent: boolean }>
  >({
    'builtin-bots': { desktop: true, agent: true },
    'builtin-kanban': { desktop: true, agent: true },
    'builtin-radio': { desktop: false, agent: true },
  });

  const effectiveQuery = searchQuery.trim().toLowerCase();

  const filteredBuiltins = React.useMemo(() => {
    if (!effectiveQuery) return DEFAULT_BUILTIN_PLUGINS;
    return DEFAULT_BUILTIN_PLUGINS.filter(
      (p) =>
        p.name.toLowerCase().includes(effectiveQuery) ||
        p.description.toLowerCase().includes(effectiveQuery) ||
        p.badges.some((b) => b.toLowerCase().includes(effectiveQuery)),
    );
  }, [effectiveQuery]);

  const filteredCustom = React.useMemo(() => {
    if (!effectiveQuery) return plugins;
    return plugins.filter(
      (p) =>
        p.name.toLowerCase().includes(effectiveQuery) ||
        p.description.toLowerCase().includes(effectiveQuery) ||
        p.tags.some((t) => t.toLowerCase().includes(effectiveQuery)),
    );
  }, [plugins, effectiveQuery]);

  const toggleBuiltin = (pluginId: string, target: 'desktop' | 'agent') => {
    setBuiltinStates((prev) => {
      const current = prev[pluginId] || { desktop: true, agent: true };
      const next = { ...current, [target]: !current[target] };
      toast({
        tone: next[target] ? 'info' : 'warning',
        title: `${next[target] ? 'Enabled' : 'Disabled'} ${pluginId.replace('builtin-', '')} for ${target}`,
      });
      return { ...prev, [pluginId]: next };
    });
  };

  const renderIcon = (type: 'bots' | 'kanban' | 'radio' | 'default') => {
    if (type === 'bots') {
      return (
        <svg
          className="w-5 h-5 text-[#93c5fd]"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.75}
            d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23-.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L4.2 15.3"
          />
        </svg>
      );
    }
    if (type === 'kanban') {
      return (
        <svg
          className="w-5 h-5 text-[#a78bfa]"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.75}
            d="M9 4.5v15m6-15v15m-10.875 0h15.75c.621 0 1.125-.504 1.125-1.125V5.625c0-.621-.504-1.125-1.125-1.125H4.125C3.504 4.5 3 5.004 3 5.625v12.75c0 .621.504 1.125 1.125 1.125z"
          />
        </svg>
      );
    }
    if (type === 'radio') {
      return (
        <svg
          className="w-5 h-5 text-[#f472b6]"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.75}
            d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.757 3.63 8.25 4.51 8.25H6.75z"
          />
        </svg>
      );
    }
    return (
      <svg className="w-5 h-5 text-[#38bdf8]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.75}
          d="M14.25 9.75L16.5 12l-2.25 2.25m-4.5 0L7.5 12l2.25-2.25M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    );
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#090b10] text-[#f4f4f5] overflow-y-auto antialiased">
      {/* Top Banner Toolbar: Subtitle + Action buttons */}
      <div className="px-5 py-3 border-b border-[#1c2030] bg-[#0c0e15] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0 shadow-xs">
        <div>
          <p className="text-xs text-zinc-400 font-sans leading-relaxed">
            One row per plugin. A plugin can extend this app, the autonomous agent, or both — each
            lifecycle half has its own switch.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onOpenGitImport}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#141724] border border-[#242b3d] text-xs font-sans font-medium text-zinc-200 hover:text-white hover:bg-[#1a1f30] transition-colors shadow-xs cursor-pointer"
          >
            <svg
              className="w-3.5 h-3.5 text-blue-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.75}
                d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244"
              />
            </svg>
            <span>Install from Git</span>
          </button>

          <button
            type="button"
            onClick={() => toast({ tone: 'info', title: 'Local plugins directory: ./plugins/' })}
            title="Browse local plugins directory"
            className="w-7 h-7 rounded-lg bg-[#141724] border border-[#242b3d] hover:bg-[#1c2236] hover:text-white text-zinc-400 flex items-center justify-center transition-colors cursor-pointer"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.75}
                d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z"
              />
            </svg>
          </button>

          <button
            type="button"
            onClick={() => toast({ tone: 'info', title: 'Plugins scanned & reloaded' })}
            title="Reload plugins"
            className="w-7 h-7 rounded-lg bg-[#141724] border border-[#242b3d] hover:bg-[#1c2236] hover:text-white text-zinc-400 flex items-center justify-center transition-colors cursor-pointer"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.75}
                d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Dual Switch Table Container */}
      <div className="flex-1 p-4 sm:p-6">
        <div className="rounded-xl border border-[#1e2335] bg-[#0e111a] overflow-hidden shadow-xs">
          {/* Table Header */}
          <div className="grid grid-cols-[1fr_120px_160px] sm:grid-cols-[1fr_140px_200px] items-center px-5 py-3 border-b border-[#1c2030] bg-[#11141e] text-xs font-sans font-medium text-zinc-400">
            <div>Plugin</div>
            <div className="text-center font-medium">Desktop UI</div>
            <div className="text-center font-medium">Agent Runtime</div>
          </div>

          {/* Table Body */}
          <div className="divide-y divide-[#181c28]">
            {filteredBuiltins.length === 0 && filteredCustom.length === 0 && effectiveQuery ? (
              <div className="p-8 text-center text-xs text-zinc-500 font-sans">
                No plugins match your filter.
              </div>
            ) : null}

            {/* 1. Bundled Plugins (Bots, Kanban, Radio) */}
            {filteredBuiltins.map((p) => {
              const state = builtinStates[p.id] || {
                desktop: p.desktopEnabled,
                agent: p.agentEnabled,
              };
              return (
                <div
                  key={p.id}
                  className="grid grid-cols-[1fr_120px_160px] sm:grid-cols-[1fr_140px_200px] items-center px-5 py-4 hover:bg-[#121624] transition-colors"
                >
                  {/* Plugin Info */}
                  <div className="flex items-start gap-3.5 pr-4">
                    <div className="w-10 h-10 rounded-xl bg-[#161a27] border border-[#242b3d] flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                      {renderIcon(p.icon)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-zinc-100 font-sans tracking-tight">
                          {p.name}
                        </span>
                        {p.badges.map((badge) => (
                          <span
                            key={badge}
                            className="px-2 py-0.5 text-[10px] font-mono font-medium rounded bg-[#181e2e] text-zinc-400 border border-[#252f48]"
                          >
                            {badge}
                          </span>
                        ))}
                      </div>
                      <p className="text-xs text-zinc-400 font-sans leading-relaxed mt-1 max-w-2xl">
                        {p.description}
                      </p>
                    </div>
                  </div>

                  {/* Desktop Switch */}
                  <div className="flex justify-center">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={state.desktop}
                      aria-label={`Toggle desktop for ${p.name}`}
                      onClick={() => toggleBuiltin(p.id, 'desktop')}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        state.desktop ? 'bg-emerald-500' : 'bg-[#1c2234] border-[#2a344e]'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out mt-[1px] ml-[1px] ${
                          state.desktop ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Agent Switch */}
                  <div className="flex justify-center">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={state.agent}
                      aria-label={`Toggle agent for ${p.name}`}
                      onClick={() => toggleBuiltin(p.id, 'agent')}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        state.agent ? 'bg-emerald-500' : 'bg-[#1c2234] border-[#2a344e]'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out mt-[1px] ml-[1px] ${
                          state.agent ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              );
            })}

            {/* 2. Workspace Plugins from Data */}
            {filteredCustom.map((item) => (
              <div
                key={item.id}
                className="grid grid-cols-[1fr_120px_160px] sm:grid-cols-[1fr_140px_200px] items-center px-5 py-4 hover:bg-[#121624] transition-colors"
              >
                {/* Plugin Info */}
                <div className="flex items-start gap-3.5 pr-4">
                  <div className="w-10 h-10 rounded-xl bg-[#161a27] border border-[#242b3d] flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                    {renderIcon('default')}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-zinc-100 font-sans tracking-tight">
                        {item.name}
                      </span>
                      <span className="px-2 py-0.5 text-[10px] font-mono font-medium rounded bg-[#181e2e] text-zinc-400 border border-[#252f48]">
                        {item.source === 'built-in' ? 'bundled' : 'custom'}
                      </span>
                      {item.version && (
                        <span className="px-1.5 py-0.5 text-[10px] font-mono text-zinc-500">
                          v{item.version}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-400 font-sans leading-relaxed mt-1 max-w-2xl">
                      {item.description}
                    </p>
                  </div>
                </div>

                {/* Desktop Switch */}
                <div className="flex justify-center">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={item.enabled}
                    aria-label={`Toggle desktop for ${item.name}`}
                    onClick={() => onTogglePlugin(item.id)}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      item.enabled ? 'bg-emerald-500' : 'bg-[#1c2234] border-[#2a344e]'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out mt-[1px] ml-[1px] ${
                        item.enabled ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* Agent Switch */}
                <div className="flex justify-center">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={item.enabled}
                    aria-label={`Toggle agent for ${item.name}`}
                    onClick={() => onTogglePlugin(item.id)}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      item.enabled ? 'bg-emerald-500' : 'bg-[#1c2234] border-[#2a344e]'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out mt-[1px] ml-[1px] ${
                        item.enabled ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
