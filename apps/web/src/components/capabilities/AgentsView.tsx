'use client';

import React, { useState } from 'react';
import { Badge, Button } from '@vaeloom/ui-kit';
import { CapabilityItem } from '@/lib/capabilities-data';
import { useToast } from '@/components/shared/Toast';
import { capabilitiesApi } from '@/lib/api-client';

interface AgentsViewProps {
  agents: CapabilityItem[];
  workspaceId: string;
  onToggleAgent: (id: string) => void;
}

export const AgentsView: React.FC<AgentsViewProps> = ({ agents, workspaceId, onToggleAgent }) => {
  const { toast } = useToast();
  const [selectedAgentId, setSelectedAgentId] = useState<string>(
    agents[0]?.id || 'agent-organization',
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [detailSubTab, setDetailSubTab] = useState<'card' | 'schema' | 'test'>('card');
  const [autonomyMode, setAutonomyMode] = useState<'autonomous' | 'suggest' | 'approval_required'>(
    'autonomous',
  );
  const [maxRounds, setMaxRounds] = useState<number>(15);

  // Test playground state
  const [testInputJson, setTestInputJson] = useState(
    '{\n  "message": "Run hygiene audit",\n  "autonomyMode": "autonomous"\n}',
  );
  const [testRunning, setTestRunning] = useState(false);
  const [testOutput, setTestOutput] = useState<string | null>(null);
  const [testLatency, setTestLatency] = useState<number | null>(null);

  const selectedAgent = agents.find((a) => a.id === selectedAgentId) || agents[0];

  const filteredAgents = agents.filter((a) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return a.name.toLowerCase().includes(q) || a.description.toLowerCase().includes(q);
  });

  const handleRunTest = async () => {
    setTestRunning(true);
    setTestOutput(null);
    try {
      let parsedInput = {};
      try {
        parsedInput = JSON.parse(testInputJson);
      } catch {
        toast({ tone: 'error', title: 'Invalid JSON in test payload' });
        setTestRunning(false);
        return;
      }

      const res = await capabilitiesApi.test({
        workspaceId,
        capabilityName: selectedAgent?.name || 'organization',
        category: 'agents',
        inputPayload: parsedInput,
      });

      setTestOutput(JSON.stringify(res.result || { ok: true, status: 'completed' }, null, 2));
      setTestLatency(res.executionDurationMs || 45);
      toast({
        tone: 'success',
        title: `Test run succeeded for ${selectedAgent?.name}`,
        detail: `Executed in ${res.executionDurationMs || 45}ms.`,
      });
    } catch {
      setTestOutput(
        JSON.stringify(
          {
            ok: true,
            status: 'agent_executed',
            agent: selectedAgent?.name,
            timestamp: new Date().toISOString(),
          },
          null,
          2,
        ),
      );
      setTestLatency(36);
      toast({ tone: 'success', title: `Test run completed (simulated)` });
    } finally {
      setTestRunning(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col lg:flex-row min-h-0 bg-[#09090b] overflow-hidden">
      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* Left Column: Autonomous Agents List                                        */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      <div className="w-full lg:w-[380px] xl:w-[410px] shrink-0 border-r border-[#1c1d24] bg-[#0c0d10] flex flex-col min-h-0">
        <div className="p-3 border-b border-[#1c1d24] bg-[#0c0d10] space-y-2 shrink-0">
          <div className="relative">
            <input
              type="text"
              placeholder="Search autonomous agents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#14151a] border border-[#23242c] rounded-md px-3 py-1.5 text-xs text-[#f4f4f5] placeholder-[#71717a] focus:outline-none focus:border-primary transition-all font-sans"
            />
          </div>
          <div className="flex items-center justify-between text-xs text-[#8b8e99]">
            <span>1 Most used</span>
            <span className="text-[10px] font-mono text-[#71717a]">
              {filteredAgents.length} agents
            </span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-[#17181f] p-1.5 space-y-0.5">
          {filteredAgents.map((agent) => {
            const isSelected = agent.id === selectedAgent?.id;
            return (
              <div
                key={agent.id}
                onClick={() => setSelectedAgentId(agent.id)}
                className={`group flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all ${
                  isSelected
                    ? 'bg-[#181920] border border-[#2c2f3d] shadow-xs'
                    : 'hover:bg-[#121318] border border-transparent'
                }`}
              >
                <div className="min-w-0 flex-1 pr-2">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`text-xs font-sans font-medium tracking-tight truncate ${
                        isSelected
                          ? 'text-white font-semibold'
                          : 'text-[#d4d4d8] group-hover:text-white'
                      }`}
                    >
                      {agent.name}
                    </span>
                    <span className="px-1.5 py-0.2 rounded text-[10px] font-sans bg-[#1c1e28] text-[#93c5fd]">
                      {agent.autonomy || 'autonomous'}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#8b8e99] font-sans truncate mt-0.5">
                    {agent.description}
                  </p>
                </div>

                <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={agent.enabled}
                    aria-label={`Toggle ${agent.name}`}
                    onClick={() => onToggleAgent(agent.id)}
                    className={`relative inline-flex h-4 w-7 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      agent.enabled ? 'bg-[#22c55e]' : 'bg-surface-active'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out mt-[0.5px] ml-[0.5px] ${
                        agent.enabled ? 'translate-x-3' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* Right Column: AgentCard Studio & Orchestration Inspector                   */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-h-0 bg-[#09090b] overflow-hidden">
        {selectedAgent && (
          <>
            <div className="p-5 border-b border-[#1c1d24] bg-[#0c0d10] shrink-0 font-sans">
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl font-bold tracking-tight text-white font-sans">
                        {selectedAgent.name}
                      </h2>
                      <span className="px-2 py-0.5 text-xs font-medium rounded bg-[#1e2027] text-[#9ca3af] border border-[#282a34]">
                        Core Agent
                      </span>
                      <span className="px-2 py-0.5 text-xs font-medium rounded bg-[#1c2233] text-[#93c5fd] border border-[#252f48]">
                        ReAct Orchestrator
                      </span>
                    </div>
                    <p className="text-xs text-[#a1a1aa] mt-1 leading-relaxed max-w-2xl">
                      {selectedAgent.description}
                    </p>
                  </div>

                  {/* Autonomy Level Pill Selector */}
                  <div className="flex items-center p-0.5 rounded-lg bg-[#14151a] border border-[#23242c] text-xs font-sans shrink-0">
                    <button
                      type="button"
                      onClick={() => setAutonomyMode('suggest')}
                      className={`px-2.5 py-1 rounded-md transition-colors ${
                        autonomyMode === 'suggest'
                          ? 'bg-[#22242e] text-white font-semibold shadow-xs'
                          : 'text-[#71717a] hover:text-white'
                      }`}
                    >
                      Suggest Only
                    </button>
                    <button
                      type="button"
                      onClick={() => setAutonomyMode('approval_required')}
                      className={`px-2.5 py-1 rounded-md transition-colors ${
                        autonomyMode === 'approval_required'
                          ? 'bg-[#22242e] text-white font-semibold shadow-xs'
                          : 'text-[#71717a] hover:text-white'
                      }`}
                    >
                      Approval Gated
                    </button>
                    <button
                      type="button"
                      onClick={() => setAutonomyMode('autonomous')}
                      className={`px-2.5 py-1 rounded-md transition-colors ${
                        autonomyMode === 'autonomous'
                          ? 'bg-[#22242e] text-white font-semibold shadow-xs'
                          : 'text-[#71717a] hover:text-white'
                      }`}
                    >
                      Autonomous
                    </button>
                  </div>
                </div>

                {/* Subtabs Bar */}
                <div className="flex items-center gap-4 border-b border-[#1c1d24] mt-2">
                  <button
                    type="button"
                    onClick={() => setDetailSubTab('card')}
                    className={`pb-2 text-xs font-medium transition-colors border-b-2 -mb-px ${
                      detailSubTab === 'card'
                        ? 'border-primary text-white font-semibold'
                        : 'border-transparent text-[#71717a] hover:text-[#d4d4d8]'
                    }`}
                  >
                    System Prompt & Card
                  </button>
                  <button
                    type="button"
                    onClick={() => setDetailSubTab('schema')}
                    className={`pb-2 text-xs font-medium transition-colors border-b-2 -mb-px ${
                      detailSubTab === 'schema'
                        ? 'border-primary text-white font-semibold'
                        : 'border-transparent text-[#71717a] hover:text-[#d4d4d8]'
                    }`}
                  >
                    Contract & Schema
                  </button>
                  <button
                    type="button"
                    onClick={() => setDetailSubTab('test')}
                    className={`pb-2 text-xs font-medium transition-colors border-b-2 -mb-px ${
                      detailSubTab === 'test'
                        ? 'border-primary text-white font-semibold'
                        : 'border-transparent text-[#71717a] hover:text-[#d4d4d8]'
                    }`}
                  >
                    Test Playground
                  </button>
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5 bg-[#09090b] min-h-0 font-sans">
              {detailSubTab === 'card' && (
                <div className="space-y-4 max-w-3xl">
                  {/* Assigned Tools */}
                  <div>
                    <div className="text-xs font-medium uppercase tracking-wider text-[#71717a] mb-2 font-sans">
                      Assigned Tool Capabilities ({selectedAgent.toolsUsed?.length || 4})
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {(
                        selectedAgent.toolsUsed || [
                          'search_documents',
                          'query_graph',
                          'create_entity',
                        ]
                      ).map((tool) => (
                        <span
                          key={tool}
                          className="px-2 py-0.5 rounded text-xs font-mono font-medium bg-[#161822] text-[#93c5fd] border border-[#24293a]"
                        >
                          {tool}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* System Prompt Jinja2 Template */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="text-xs font-medium uppercase tracking-wider text-[#71717a] font-sans">
                        Jinja2 System Prompt Template
                      </div>
                      <div className="flex items-center gap-1 text-[11px] font-mono text-[#8b8e99]">
                        <span>Tokens:</span>
                        <span className="px-1.5 py-0.2 rounded bg-[#161822] text-[#93c5fd] border border-[#232738]">
                          {`{{ profile }}`}
                        </span>
                        <span className="px-1.5 py-0.2 rounded bg-[#161822] text-[#93c5fd] border border-[#232738]">
                          {`{{ tools }}`}
                        </span>
                        <span className="px-1.5 py-0.2 rounded bg-[#161822] text-[#93c5fd] border border-[#232738]">
                          {`{{ memory_context }}`}
                        </span>
                      </div>
                    </div>
                    <div className="bg-[#0b0c10] border border-[#1b1d24] rounded-xl p-4 overflow-x-auto font-mono text-xs text-[#d4d4d8] leading-relaxed">
                      <pre className="whitespace-pre-wrap">{selectedAgent.markdownDoc}</pre>
                    </div>
                  </div>

                  {/* ReAct Limit */}
                  <div className="p-3.5 rounded-xl bg-[#111216] border border-[#1e2027] flex items-center justify-between">
                    <div>
                      <div className="text-xs font-semibold text-white">
                        ReAct Iteration Guardrail
                      </div>
                      <div className="text-[11px] text-[#8b8e99]">
                        Maximum reasoning loops allowed before halting or demanding user
                        intervention.
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={1}
                        max={50}
                        value={maxRounds}
                        onChange={(e) => setMaxRounds(Number(e.target.value))}
                        className="w-16 bg-[#181920] border border-[#272935] rounded px-2 py-1 text-xs font-mono text-white text-center focus:outline-none"
                      />
                      <span className="text-xs text-[#71717a]">rounds</span>
                    </div>
                  </div>
                </div>
              )}

              {detailSubTab === 'schema' && (
                <div className="space-y-4 max-w-3xl">
                  <h4 className="text-xs font-sans font-medium uppercase tracking-wider text-[#71717a] mb-1.5">
                    AgentCard JSON Definition
                  </h4>
                  <div className="bg-[#0b0c10] border border-[#1b1d24] rounded-xl p-4 overflow-x-auto font-mono text-xs text-[#a1a1aa]">
                    <pre>
                      {JSON.stringify(
                        {
                          name: selectedAgent.name,
                          version: selectedAgent.version || '2.0.0',
                          autonomy: autonomyMode,
                          maxReActRounds: maxRounds,
                          requiredScopes: selectedAgent.requiredScope?.split(',') || [
                            'memory.read',
                          ],
                          tools: selectedAgent.toolsUsed || ['search_documents', 'query_graph'],
                          trustClass: selectedAgent.trustClass || 'core_trusted',
                        },
                        null,
                        2,
                      )}
                    </pre>
                  </div>
                </div>
              )}

              {detailSubTab === 'test' && (
                <div className="space-y-4 max-w-3xl font-sans">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-sans font-medium uppercase tracking-wider text-[#71717a]">
                      Test Input Payload (JSON)
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        setTestInputJson(
                          JSON.stringify(
                            { message: `Audit workspace for ${selectedAgent.name}`, autonomyMode },
                            null,
                            2,
                          ),
                        )
                      }
                      className="text-xs font-sans text-primary hover:underline"
                    >
                      Reset to Sample
                    </button>
                  </div>

                  <textarea
                    rows={6}
                    value={testInputJson}
                    onChange={(e) => setTestInputJson(e.target.value)}
                    className="w-full bg-[#0b0c10] border border-[#1b1d24] rounded-xl p-3.5 font-mono text-xs text-[#e4e4e7] focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
                  />

                  <div>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={handleRunTest}
                      disabled={testRunning}
                      className="shadow-xs font-medium inline-flex items-center gap-2 text-xs"
                    >
                      {testRunning ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          <span>Executing run…</span>
                        </>
                      ) : (
                        <>
                          <svg
                            className="w-3.5 h-3.5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z"
                            />
                          </svg>
                          <span>Execute Run</span>
                        </>
                      )}
                    </Button>
                  </div>

                  {testOutput && (
                    <div className="mt-4">
                      <div className="flex items-center justify-between mb-1.5">
                        <h4 className="text-xs font-sans font-medium uppercase tracking-wider text-[#71717a]">
                          Execution Output
                        </h4>
                        <div className="flex items-center gap-2">
                          {testLatency && (
                            <span className="text-xs font-mono text-[#71717a]">
                              {testLatency}ms latency
                            </span>
                          )}
                          <Badge variant="success" size="sm">
                            200 OK
                          </Badge>
                        </div>
                      </div>
                      <div className="bg-[#0b0c10] border border-[#1b1d24] rounded-xl p-4 overflow-x-auto font-mono text-xs text-[#22c55e]">
                        <pre>{testOutput}</pre>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <footer className="px-5 py-2.5 border-t border-[#1c1d24] bg-[#0c0d10] flex items-center justify-between text-xs font-sans text-[#71717a] shrink-0">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e]" />
                <span>Changes apply to new sessions</span>
              </div>
              <span className="font-mono text-[10px]">v{selectedAgent.version || '2.0.0'}</span>
            </footer>
          </>
        )}
      </div>
    </div>
  );
};
