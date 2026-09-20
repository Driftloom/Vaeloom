'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { Button, Badge } from '@vaeloom/ui-kit';
import type { CapabilityCategory, CapabilityItem } from '@/lib/capabilities-data';

export interface AddCapabilityModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultCategory?: CapabilityCategory;
  initialMode?: 'builder' | 'templates' | 'import';
  onCreate: (capability: CapabilityItem) => void;
  onImport: (url: string, category: CapabilityCategory) => Promise<void>;
  installedNames?: Set<string>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Production-Ready Enterprise Presets / Scaffolds
// ─────────────────────────────────────────────────────────────────────────────
interface PresetTemplate {
  id: string;
  name: string;
  category: CapabilityCategory;
  categoryIcon: string;
  title: string;
  description: string;
  tags: string[];
  autonomy: 'autonomous' | 'approval_required' | 'suggest';
  triggers: string[];
  parameters?: Array<{ name: string; type: string; description: string; required: boolean }>;
  mcpConfig?: { transport: 'stdio' | 'sse'; command: string; env: Record<string, string> };
  doc: string;
}

const PRESET_TEMPLATES: PresetTemplate[] = [
  {
    id: 'pr-code-reviewer',
    name: 'pr-code-reviewer',
    category: 'skills',
    categoryIcon: '🎯',
    title: 'PR & Forensic Code Reviewer',
    description:
      'Autonomous pull request review skill with AST safety analysis and regression checks.',
    tags: ['Review', 'Engineering', 'Security', 'QA'],
    autonomy: 'autonomous',
    triggers: ['/review', 'review this pull request', 'audit code changes'],
    doc: `# PR & Forensic Code Reviewer

## Mission
Performs deep structural and security code reviews on pull request diffs, checks test coverage, and flags anti-patterns.

## When to Use
- User types \`/review\` or requests PR validation.
- Agent analyzes modified files before committing or landing changes.

## Operating Rules
1. Inspect all touched files for security regressions (SQL injection, XSS, insecure deserialization).
2. Validate that automated tests accompany new logic.
3. Suggest concrete diff replacements for any identified issues.
`,
  },
  {
    id: 'agentic-workflow-orchestrator',
    name: 'agentic-workflow-orchestrator',
    category: 'skills',
    categoryIcon: '🎯',
    title: 'Agentic Workflow Orchestrator',
    description:
      'Multi-step ReAct loop with sub-goal decomposition, deterministic fallback, and error self-healing.',
    tags: ['Workflow', 'Agentic', 'Reasoning', 'Orchestration'],
    autonomy: 'autonomous',
    triggers: ['/orchestrate', 'break down task', 'plan and execute'],
    doc: `# Agentic Workflow Orchestrator

## Overview
Coordinates complex multi-turn problem-solving workflows with step-level critiques and backtracking.

## Execution Policy
- Maximum ReAct iterations: 12
- Evaluation criteria: Sub-goal progress verification after every tool call.
- Fallback: Gracefully fallback to deterministic heuristics if an external tool is unreachable.
`,
  },
  {
    id: 'rest-api-webhook',
    name: 'rest-api-webhook',
    category: 'tools',
    categoryIcon: '🛠️',
    title: 'REST API Webhook Tool',
    description:
      'Configurable HTTP tool that dispatches authenticated JSON payloads to external webhooks.',
    tags: ['Webhook', 'API', 'Integration', 'HTTP'],
    autonomy: 'approval_required',
    triggers: ['send webhook', 'post to api'],
    parameters: [
      {
        name: 'endpoint_url',
        type: 'string',
        description: 'HTTPS destination URL',
        required: true,
      },
      {
        name: 'payload',
        type: 'object',
        description: 'JSON data object to dispatch',
        required: true,
      },
      {
        name: 'idempotency_key',
        type: 'string',
        description: 'Unique idempotency token',
        required: false,
      },
    ],
    doc: `# REST API Webhook Tool

## Parameters
- \`endpoint_url\` (string, required): Destination HTTPS URL
- \`payload\` (object, required): JSON request body
- \`idempotency_key\` (string, optional): Idempotent request UUID

## Security Notice
Requires human-in-the-loop approval before executing live outbound network requests.
`,
  },
  {
    id: 'vector-semantic-search',
    name: 'vector-semantic-search',
    category: 'tools',
    categoryIcon: '🛠️',
    title: 'Vector Semantic Search Tool',
    description:
      'Retrieves top-k relevant knowledge nodes and documents via cosine embedding similarity.',
    tags: ['Search', 'Embeddings', 'Memory', 'RAG'],
    autonomy: 'autonomous',
    triggers: ['search knowledge', 'find relevant documents', 'query vector index'],
    parameters: [
      {
        name: 'query',
        type: 'string',
        description: 'Natural language search query',
        required: true,
      },
      {
        name: 'top_k',
        type: 'number',
        description: 'Maximum number of matches (default: 5)',
        required: false,
      },
      {
        name: 'threshold',
        type: 'number',
        description: 'Minimum cosine similarity score (0.0 - 1.0)',
        required: false,
      },
    ],
    doc: `# Vector Semantic Search Tool

Queries the workspace sovereign vector index for high-dimensional document and memory recall.
`,
  },
  {
    id: 'filesystem-mcp-connector',
    name: 'filesystem-mcp-connector',
    category: 'mcp',
    categoryIcon: '🔌',
    title: 'Local Filesystem MCP Server',
    description:
      'Official Model Context Protocol server for scoped local filesystem access and file tools.',
    tags: ['MCP', 'Filesystem', 'Local', 'Connector'],
    autonomy: 'approval_required',
    triggers: ['read local file', 'inspect directory', 'filesystem mcp'],
    mcpConfig: {
      transport: 'stdio',
      command: 'npx -y @modelcontextprotocol/server-filesystem /workspace',
      env: {},
    },
    doc: `# Filesystem MCP Connector

## Transport
- Transport: \`stdio\`
- Launch Command: \`npx -y @modelcontextprotocol/server-filesystem /workspace\`

## Capabilities Exposed
- \`read_file\`, \`write_file\`, \`list_directory\`, \`move_file\`, \`search_files\`
`,
  },
  {
    id: 'github-cloud-mcp',
    name: 'github-cloud-mcp',
    category: 'mcp',
    categoryIcon: '🔌',
    title: 'GitHub Cloud MCP Server',
    description:
      'Model Context Protocol integration for managing pull requests, issues, and repositories.',
    tags: ['MCP', 'GitHub', 'Cloud', 'DevOps'],
    autonomy: 'approval_required',
    triggers: ['github issue', 'create pr', 'fetch repository'],
    mcpConfig: {
      transport: 'stdio',
      command: 'npx -y @modelcontextprotocol/server-github',
      env: { GITHUB_PERSONAL_ACCESS_TOKEN: '${VAULT_GITHUB_PAT}' },
    },
    doc: `# GitHub Cloud MCP Server

## Configuration
- Transport: \`stdio\`
- Command: \`npx -y @modelcontextprotocol/server-github\`
- Required Env: \`GITHUB_PERSONAL_ACCESS_TOKEN\`
`,
  },
  {
    id: 'research-analyst-agent',
    name: 'research-analyst-agent',
    category: 'agents',
    categoryIcon: '🤖',
    title: 'Autonomous Research Analyst',
    description:
      'Dedicated investigation agent that plans, gathers citations, and writes comprehensive briefs.',
    tags: ['Agent', 'Research', 'Synthesis', 'Autonomous'],
    autonomy: 'autonomous',
    triggers: ['conduct deep research', 'investigate topic', 'prepare brief'],
    doc: `# Autonomous Research Analyst Agent

## Purpose
Executes comprehensive background investigations across academic repositories, workspace docs, and web sources.

## Assigned Tools
- \`search_documents\`, \`browse_job_page\`, \`query_graph\`, \`summarize_findings\`
`,
  },
];

const QUICK_TAG_SUGGESTIONS = [
  'Review',
  'Engineering',
  'QA',
  'Design',
  'DevOps',
  'Career',
  'Core',
  'MCP',
  'Memory',
  'AI',
];

export function AddCapabilityModal({
  isOpen,
  onClose,
  defaultCategory = 'skills',
  initialMode = 'builder',
  onCreate,
  onImport,
}: AddCapabilityModalProps) {
  // Navigation Mode: 'templates' | 'builder' | 'import'
  const [activeTab, setActiveTab] = useState<'templates' | 'builder' | 'import'>(initialMode);

  React.useEffect(() => {
    if (isOpen) {
      setActiveTab(initialMode);
    }
  }, [isOpen, initialMode]);

  // Form State
  const [capName, setCapName] = useState('');
  const [capCategory, setCapCategory] = useState<CapabilityCategory>(defaultCategory);
  const [capTags, setCapTags] = useState<string[]>(['Custom']);
  const [tagInput, setTagInput] = useState('');
  const [capDescription, setCapDescription] = useState('');
  const [capDoc, setCapDoc] = useState('');
  const [capAutonomy, setCapAutonomy] = useState<'autonomous' | 'approval_required' | 'suggest'>(
    'autonomous',
  );
  const [capTriggers, setCapTriggers] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);

  // Tool-specific parameter builder
  const [toolParams, setToolParams] = useState<
    Array<{ name: string; type: string; description: string; required: boolean }>
  >([{ name: 'query', type: 'string', description: 'Primary input query', required: true }]);

  // MCP-specific configuration
  const [mcpTransport, setMcpTransport] = useState<'stdio' | 'sse'>('stdio');
  const [mcpCommand, setMcpCommand] = useState('npx -y @modelcontextprotocol/server-example');
  const [mcpEnvKey, setMcpEnvKey] = useState('');
  const [mcpEnvVal, setMcpEnvVal] = useState('');
  const [mcpEnvList, setMcpEnvList] = useState<Array<{ key: string; val: string }>>([]);

  // Import Mode State
  const [importUrl, setImportUrl] = useState('');
  const [importCategory, setImportCategory] = useState<CapabilityCategory>('skills');
  const [importLoading, setImportLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [fileParseSuccess, setFileParseSuccess] = useState<string | null>(null);

  // Load a Preset Template
  const handleSelectTemplate = useCallback((template: PresetTemplate) => {
    setCapName(template.name);
    setCapCategory(template.category);
    setCapTags(template.tags);
    setCapDescription(template.description);
    setCapDoc(template.doc);
    setCapAutonomy(template.autonomy);
    setCapTriggers(template.triggers.join(', '));
    if (template.parameters) {
      setToolParams(template.parameters);
    }
    if (template.mcpConfig) {
      setMcpTransport(template.mcpConfig.transport);
      setMcpCommand(template.mcpConfig.command);
      setMcpEnvList(Object.entries(template.mcpConfig.env).map(([key, val]) => ({ key, val })));
    }
    setActiveTab('builder');
  }, []);

  // Tag Management
  const handleAddTag = useCallback((tag: string) => {
    const trimmed = tag.trim().replace(/^#/, '');
    if (!trimmed) return;
    setCapTags((prev) => (prev.includes(trimmed) ? prev : [...prev, trimmed]));
    setTagInput('');
  }, []);

  const handleRemoveTag = useCallback((tagToRemove: string) => {
    setCapTags((prev) => prev.filter((t) => t !== tagToRemove));
  }, []);

  // Add Tool Parameter
  const handleAddParam = useCallback(() => {
    setToolParams((prev) => [
      ...prev,
      { name: `param_${prev.length + 1}`, type: 'string', description: '', required: false },
    ]);
  }, []);

  const handleRemoveParam = useCallback((index: number) => {
    setToolParams((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // Add MCP Env Var
  const handleAddEnvVar = useCallback(() => {
    if (!mcpEnvKey.trim()) return;
    setMcpEnvList((prev) => [...prev, { key: mcpEnvKey.trim(), val: mcpEnvVal.trim() }]);
    setMcpEnvKey('');
    setMcpEnvVal('');
  }, [mcpEnvKey, mcpEnvVal]);

  // Generated JSON Schema for Tools
  const generatedInputSchema = useMemo(() => {
    if (capCategory !== 'tools') return undefined;
    const properties: Record<string, { type: string; description: string }> = {};
    const required: string[] = [];
    toolParams.forEach((p) => {
      if (p.name.trim()) {
        properties[p.name.trim()] = {
          type: p.type,
          description: p.description || `${p.name} input parameter`,
        };
        if (p.required) required.push(p.name.trim());
      }
    });
    return {
      type: 'object',
      properties,
      required,
    };
  }, [capCategory, toolParams]);

  // File Drag & Drop Parser (SKILL.md, JSON, OpenAPI)
  const parseDroppedContent = useCallback((filename: string, content: string) => {
    try {
      if (filename.endsWith('.md') || filename.endsWith('.markdown')) {
        // Parse frontmatter
        const frontmatterMatch = content.match(
          /^---\s*[\r\n]+([\s\S]*?)[\r\n]+---\s*[\r\n]+([\s\S]*)$/,
        );
        if (frontmatterMatch && frontmatterMatch[1] && frontmatterMatch[2]) {
          const fmText = frontmatterMatch[1];
          const bodyDoc = frontmatterMatch[2];

          // Extract basic YAML key-values
          const nameMatch = fmText.match(/^name:\s*(.+)$/m);
          const descMatch = fmText.match(/^description:\s*(.+)$/m);
          const tagsMatch = fmText.match(/^tags:\s*\[(.*?)\]/m);

          const parsedName = nameMatch?.[1]
            ? nameMatch[1].trim().replace(/^['"]|['"]$/g, '')
            : filename.replace(/\.md$/, '');
          const parsedDesc = descMatch?.[1]
            ? descMatch[1].trim().replace(/^['"]|['"]$/g, '')
            : 'Imported skill definition';
          const parsedTags = tagsMatch?.[1]
            ? tagsMatch[1]
                .split(',')
                .map((t) => t.trim().replace(/^['"]|['"]$/g, ''))
                .filter(Boolean)
            : ['Imported', 'Skill'];

          setCapName(parsedName);
          setCapCategory('skills');
          setCapDescription(parsedDesc);
          setCapTags(parsedTags);
          setCapDoc(bodyDoc.trim());
          setFileParseSuccess(`Parsed ${filename} as Skill "${parsedName}"`);
          setActiveTab('builder');
          return;
        } else {
          // Plain markdown without frontmatter
          const titleMatch = content.match(/^#\s+(.+)$/m);
          const parsedName = titleMatch?.[1]
            ? titleMatch[1]
                .trim()
                .toLowerCase()
                .replace(/[^a-z0-9-_]/g, '-')
            : filename.replace(/\.md$/, '');
          setCapName(parsedName);
          setCapCategory('skills');
          setCapDoc(content);
          setCapDescription(`Imported documentation from ${filename}`);
          setFileParseSuccess(`Imported ${filename} (${content.split('\n').length} lines)`);
          setActiveTab('builder');
          return;
        }
      }

      if (filename.endsWith('.json')) {
        const json = JSON.parse(content);
        if (json.mcpServers || json.command) {
          // MCP Server configuration
          const serverName: string = json.mcpServers
            ? Object.keys(json.mcpServers)[0] || 'mcp-server'
            : filename.replace(/\.json$/, '');
          const serverDef =
            json.mcpServers && json.mcpServers[serverName] ? json.mcpServers[serverName] : json;
          setCapName(serverName);
          setCapCategory('mcp');
          setCapDescription(`Model Context Protocol server configuration for ${serverName}`);
          setMcpCommand(serverDef.command || 'npx -y');
          if (serverDef.env) {
            setMcpEnvList(
              Object.entries(serverDef.env).map(([k, v]) => ({ key: k, val: String(v) })),
            );
          }
          setCapDoc(
            `# ${serverName} MCP Server\n\n\`\`\`json\n${JSON.stringify(json, null, 2)}\n\`\`\``,
          );
          setFileParseSuccess(`Parsed ${filename} as MCP Server "${serverName}"`);
          setActiveTab('builder');
          return;
        }

        // Generic tool or capability schema
        const toolName: string = json.name || filename.replace(/\.json$/, '');
        setCapName(toolName);
        setCapCategory('tools');
        setCapDescription(json.description || 'Imported tool definition');
        setCapDoc(
          `# ${toolName}\n\n${json.description || ''}\n\n\`\`\`json\n${JSON.stringify(json, null, 2)}\n\`\`\``,
        );
        setFileParseSuccess(`Parsed ${filename} as Tool "${toolName}"`);
        setActiveTab('builder');
        return;
      }
    } catch {
      // Fallback
      setCapDoc(content);
      setFileParseSuccess(`Loaded raw content from ${filename}`);
      setActiveTab('builder');
    }
  }, []);

  const handleFileDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const files = e.dataTransfer.files;
      if (!files || files.length === 0) return;
      const file = files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (evt) => {
        const content = evt.target?.result as string;
        if (content) parseDroppedContent(file.name, content);
      };
      reader.readAsText(file);
    },
    [parseDroppedContent],
  );

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;
      const file = files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (evt) => {
        const content = evt.target?.result as string;
        if (content) parseDroppedContent(file.name, content);
      };
      reader.readAsText(file);
    },
    [parseDroppedContent],
  );

  // Submit Capability Creation
  const handleFinalSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!capName.trim()) return;

      const slug = capName.toLowerCase().replace(/[^a-z0-9-_]/g, '-');
      const triggerList = capTriggers
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      const newCap: CapabilityItem = {
        id: `custom-${slug}-${Date.now()}`,
        name: slug,
        category: capCategory,
        tags: capTags.length > 0 ? capTags : ['Custom', 'User-Defined'],
        description: capDescription || `Custom capability added to ${capCategory}.`,
        enabled: true,
        source: 'custom',
        usageCount: 0,
        lastUsed: 'Just now',
        requiredScope: capCategory === 'mcp' ? 'mcp.workspace.write' : 'system.execute',
        trustClass: 'first_party',
        version: '1.0.0',
        author: 'Workspace Member',
        autonomy: capAutonomy,
        triggers: triggerList.length > 0 ? triggerList : undefined,
        inputSchema: generatedInputSchema,
        metadata:
          capCategory === 'mcp'
            ? {
                transport: mcpTransport,
                command: mcpCommand,
                env: Object.fromEntries(mcpEnvList.map((e) => [e.key, e.val])),
              }
            : undefined,
        markdownDoc:
          capDoc ||
          `# ${capName}\n\n## Overview\n${capDescription || 'No description provided.'}\n\n## Operating Rules\n1. Custom defined capability.\n`,
      };

      onCreate(newCap);
      onClose();
    },
    [
      capName,
      capCategory,
      capTags,
      capDescription,
      capDoc,
      capAutonomy,
      capTriggers,
      generatedInputSchema,
      mcpTransport,
      mcpCommand,
      mcpEnvList,
      onCreate,
      onClose,
    ],
  );

  // Submit Git / URL Import
  const handleImportSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!importUrl.trim()) return;
      setImportLoading(true);
      try {
        await onImport(importUrl.trim(), importCategory);
        setImportLoading(false);
        onClose();
      } catch (err) {
        setImportLoading(false);
        throw err;
      }
    },
    [importUrl, importCategory, onImport, onClose],
  );

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-capability-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div className="w-full max-w-2xl lg:max-w-3xl bg-[#0c0d12] border border-[#232632] rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        {/* ── Modal Header with Mode Tabs ──────────────────────────────────── */}
        <div className="px-5 py-3.5 border-b border-[#1f212b] bg-[#101117] flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary text-sm font-bold">
              ✦
            </div>
            <div>
              <h3
                id="add-capability-modal-title"
                className="text-sm font-semibold text-white font-sans"
              >
                Add Custom Capability
              </h3>
              <p className="text-[11px] text-[#8b8e99] font-sans">
                Author custom skills, import via Git / file, or instantiate enterprise scaffolds
              </p>
            </div>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="flex items-center gap-1 p-0.5 rounded-lg bg-[#161720] border border-[#252836] text-xs font-sans">
            <button
              type="button"
              onClick={() => setActiveTab('templates')}
              className={`px-2.5 py-1 rounded-md transition-all font-medium ${
                activeTab === 'templates'
                  ? 'bg-[#252837] text-white shadow-xs'
                  : 'text-[#8b8e99] hover:text-white'
              }`}
            >
              ⚡ Presets
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('builder')}
              className={`px-2.5 py-1 rounded-md transition-all font-medium ${
                activeTab === 'builder'
                  ? 'bg-[#252837] text-white shadow-xs'
                  : 'text-[#8b8e99] hover:text-white'
              }`}
            >
              🛠️ Studio Builder
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('import')}
              className={`px-2.5 py-1 rounded-md transition-all font-medium ${
                activeTab === 'import'
                  ? 'bg-[#252837] text-white shadow-xs'
                  : 'text-[#8b8e99] hover:text-white'
              }`}
            >
              📁 Import Git / File
            </button>
          </div>

          {/* Close Button */}
          <button
            onClick={onClose}
            className="text-[#71717a] hover:text-white p-1 rounded-lg hover:bg-[#1a1b24] transition-colors"
            aria-label="Close modal"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* ── Banner: File Parse Notification ─────────────────────────────── */}
        {fileParseSuccess && (
          <div className="px-5 py-2 bg-emerald-950/40 border-b border-emerald-900/40 flex items-center justify-between text-xs text-emerald-300 font-sans">
            <div className="flex items-center gap-2">
              <span>✓</span>
              <span>{fileParseSuccess}</span>
            </div>
            <button
              onClick={() => setFileParseSuccess(null)}
              className="text-emerald-400 hover:text-emerald-200"
            >
              ×
            </button>
          </div>
        )}

        {/* ── Content Area: Tab 1: Presets & Templates ─────────────────────── */}
        {activeTab === 'templates' && (
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-[#a1a1aa] font-sans">
                  Enterprise Production Scaffolds
                </h4>
                <p className="text-xs text-[#71717a] font-sans mt-0.5">
                  Select a pre-configured template to bootstrap your capability with production
                  rules and typed schemas.
                </p>
              </div>
              <Badge variant="info" size="sm">
                {PRESET_TEMPLATES.length} Scaffolds Available
              </Badge>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
              {PRESET_TEMPLATES.map((tmpl) => (
                <div
                  key={tmpl.id}
                  onClick={() => handleSelectTemplate(tmpl)}
                  className="group flex flex-col justify-between p-3.5 rounded-xl border border-[#1e202b] bg-[#12131b] hover:border-primary/50 hover:bg-[#151722] cursor-pointer transition-all duration-120 shadow-xs"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-base">{tmpl.categoryIcon}</span>
                        <span className="text-sm font-semibold text-white font-sans group-hover:text-primary transition-colors">
                          {tmpl.title}
                        </span>
                      </div>
                      <Badge variant="default" size="sm" className="capitalize text-[10px]">
                        {tmpl.category}
                      </Badge>
                    </div>

                    <p className="text-xs text-[#9ca3af] font-sans mt-2 line-clamp-2 leading-relaxed">
                      {tmpl.description}
                    </p>

                    <div className="flex flex-wrap items-center gap-1.5 mt-3">
                      {tmpl.tags.map((t) => (
                        <span
                          key={t}
                          className="px-1.5 py-0.2 rounded text-[10px] bg-[#1a1b24] text-[#8b8e99] border border-[#262836]"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-3 mt-3 border-t border-[#1c1e28] text-xs">
                    <span className="text-[11px] text-[#71717a] font-sans">
                      {tmpl.autonomy === 'autonomous' ? '⚡ Autonomous' : '🛡️ Approval Gate'}
                    </span>
                    <span className="text-xs text-primary font-medium group-hover:translate-x-0.5 transition-transform inline-flex items-center gap-1">
                      Use Template →
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Content Area: Tab 2: Studio Builder ─────────────────────────── */}
        {activeTab === 'builder' && (
          <form
            onSubmit={handleFinalSubmit}
            className="flex-1 overflow-y-auto p-5 space-y-4 text-xs font-sans"
          >
            {/* Top Row: Category Picker Chips */}
            <div>
              <label className="block text-[#a1a1aa] font-medium mb-1.5">
                Capability Category *
              </label>
              <div className="grid grid-cols-5 gap-2">
                {(
                  [
                    { id: 'skills', label: 'Skills', icon: '🎯' },
                    { id: 'agents', label: 'Agents', icon: '🤖' },
                    { id: 'tools', label: 'Tools', icon: '🛠️' },
                    { id: 'mcp', label: 'MCP', icon: '🔌' },
                    { id: 'plugins', label: 'Plugins', icon: '🧩' },
                  ] as const
                ).map((cat) => {
                  const isSel = capCategory === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setCapCategory(cat.id)}
                      className={`flex flex-col items-center justify-center p-2 rounded-xl border text-xs font-medium transition-all ${
                        isSel
                          ? 'bg-primary/15 border-primary text-white shadow-xs'
                          : 'bg-[#12131a] border-[#222430] text-[#8b8e99] hover:text-white hover:border-[#2f3244]'
                      }`}
                    >
                      <span className="text-sm mb-0.5">{cat.icon}</span>
                      <span>{cat.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Capability Identifier & Version */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-[#a1a1aa] font-medium mb-1">
                  Capability Name / Identifier *
                </label>
                <input
                  type="text"
                  required
                  value={capName}
                  onChange={(e) => setCapName(e.target.value)}
                  placeholder="e.g. code-synthesizer or ats-scoring"
                  className="w-full px-3 py-2 rounded-lg bg-[#14161f] border border-[#252836] text-white focus:outline-none focus:border-primary font-mono text-xs"
                />
              </div>

              <div>
                <label className="block text-[#a1a1aa] font-medium mb-1">Autonomy Policy</label>
                <select
                  value={capAutonomy}
                  onChange={(e) =>
                    setCapAutonomy(e.target.value as 'autonomous' | 'approval_required' | 'suggest')
                  }
                  className="w-full px-3 py-2 rounded-lg bg-[#14161f] border border-[#252836] text-white focus:outline-none focus:border-primary text-xs"
                >
                  <option value="autonomous">Autonomous Execution</option>
                  <option value="approval_required">Human Approval Gate</option>
                  <option value="suggest">Suggest to User Only</option>
                </select>
              </div>
            </div>

            {/* Summary Description */}
            <div>
              <label className="block text-[#a1a1aa] font-medium mb-1">Summary Description</label>
              <input
                type="text"
                value={capDescription}
                onChange={(e) => setCapDescription(e.target.value)}
                placeholder="Brief description explaining when agents should activate this capability"
                className="w-full px-3 py-2 rounded-lg bg-[#14161f] border border-[#252836] text-white focus:outline-none focus:border-primary text-xs"
              />
            </div>

            {/* Interactive Tag Manager */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[#a1a1aa] font-medium">Tags &amp; Taxonomy</label>
                <span className="text-[11px] text-[#71717a]">Click a chip to quickly add</span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 p-2 rounded-lg bg-[#14161f] border border-[#252836] min-h-[42px]">
                {capTags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-[#1d1f2b] text-[#e4e4e7] border border-[#2d3040]"
                  >
                    <span>{tag}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="text-[#71717a] hover:text-white ml-0.5"
                    >
                      ×
                    </button>
                  </span>
                ))}
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ',') {
                      e.preventDefault();
                      handleAddTag(tagInput);
                    }
                  }}
                  placeholder="+ Type tag and hit Enter..."
                  className="bg-transparent text-xs text-white placeholder-[#71717a] focus:outline-none flex-1 min-w-[140px] px-1"
                />
              </div>

              {/* Quick Suggestion Chips */}
              <div className="flex flex-wrap items-center gap-1 mt-1.5">
                {QUICK_TAG_SUGGESTIONS.filter((s) => !capTags.includes(s))
                  .slice(0, 6)
                  .map((suggest) => (
                    <button
                      key={suggest}
                      type="button"
                      onClick={() => handleAddTag(suggest)}
                      className="text-[10px] px-2 py-0.5 rounded bg-[#12131a] text-[#8b8e99] hover:text-white hover:bg-[#181a24] border border-[#20222e] transition-colors"
                    >
                      + {suggest}
                    </button>
                  ))}
              </div>
            </div>

            {/* Category Specific Control: Trigger Phrases (for Skills & Agents) */}
            {(capCategory === 'skills' || capCategory === 'agents') && (
              <div>
                <label className="block text-[#a1a1aa] font-medium mb-1">
                  Routing &amp; Trigger Keywords (comma-separated)
                </label>
                <input
                  type="text"
                  value={capTriggers}
                  onChange={(e) => setCapTriggers(e.target.value)}
                  placeholder="e.g. /review, pr audit, check code quality"
                  className="w-full px-3 py-2 rounded-lg bg-[#14161f] border border-[#252836] text-white focus:outline-none focus:border-primary text-xs"
                />
              </div>
            )}

            {/* Category Specific Control: Tool Parameter Builder (for Tools) */}
            {capCategory === 'tools' && (
              <div className="p-3.5 rounded-xl bg-[#101118] border border-[#222430] space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h5 className="font-semibold text-white">
                      Visual Parameter Builder (JSON Schema)
                    </h5>
                    <p className="text-[11px] text-[#71717a]">
                      Define typed arguments for agent function-calling.
                    </p>
                  </div>
                  <Button type="button" variant="secondary" size="sm" onClick={handleAddParam}>
                    + Add Parameter
                  </Button>
                </div>

                <div className="space-y-2">
                  {toolParams.map((p, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="param_name"
                        value={p.name}
                        onChange={(e) => {
                          const val = e.target.value;
                          setToolParams((prev) =>
                            prev.map((item, i) => (i === idx ? { ...item, name: val } : item)),
                          );
                        }}
                        className="w-1/3 px-2.5 py-1.5 rounded-lg bg-[#151722] border border-[#272a38] text-white font-mono text-xs focus:outline-none focus:border-primary"
                      />
                      <select
                        value={p.type}
                        onChange={(e) => {
                          const val = e.target.value;
                          setToolParams((prev) =>
                            prev.map((item, i) => (i === idx ? { ...item, type: val } : item)),
                          );
                        }}
                        className="w-24 px-2 py-1.5 rounded-lg bg-[#151722] border border-[#272a38] text-white text-xs focus:outline-none focus:border-primary"
                      >
                        <option value="string">string</option>
                        <option value="number">number</option>
                        <option value="boolean">boolean</option>
                        <option value="object">object</option>
                        <option value="array">array</option>
                      </select>
                      <input
                        type="text"
                        placeholder="Description of argument"
                        value={p.description}
                        onChange={(e) => {
                          const val = e.target.value;
                          setToolParams((prev) =>
                            prev.map((item, i) =>
                              i === idx ? { ...item, description: val } : item,
                            ),
                          );
                        }}
                        className="flex-1 px-2.5 py-1.5 rounded-lg bg-[#151722] border border-[#272a38] text-white text-xs focus:outline-none focus:border-primary"
                      />
                      <label className="flex items-center gap-1 text-[11px] text-[#a1a1aa] shrink-0">
                        <input
                          type="checkbox"
                          checked={p.required}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setToolParams((prev) =>
                              prev.map((item, i) =>
                                i === idx ? { ...item, required: checked } : item,
                              ),
                            );
                          }}
                          className="rounded border-[#2c2e3c] bg-[#151722] text-primary"
                        />
                        <span>Req</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => handleRemoveParam(idx)}
                        className="text-[#71717a] hover:text-red-400 p-1"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Category Specific Control: MCP Server Transport & Env (for MCP) */}
            {capCategory === 'mcp' && (
              <div className="p-3.5 rounded-xl bg-[#101118] border border-[#222430] space-y-3">
                <div className="flex items-center justify-between">
                  <h5 className="font-semibold text-white">MCP Protocol Configuration</h5>
                  <Badge variant="primary" size="sm">
                    MCP v2 Standard
                  </Badge>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[#a1a1aa] font-medium mb-1">Transport</label>
                    <select
                      value={mcpTransport}
                      onChange={(e) => setMcpTransport(e.target.value as 'stdio' | 'sse')}
                      className="w-full px-3 py-2 rounded-lg bg-[#151722] border border-[#272a38] text-white text-xs focus:outline-none focus:border-primary"
                    >
                      <option value="stdio">stdio (Local Command)</option>
                      <option value="sse">Streamable HTTP / SSE</option>
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[#a1a1aa] font-medium mb-1">
                      {mcpTransport === 'stdio' ? 'Command & Arguments' : 'SSE Endpoint URL'}
                    </label>
                    <input
                      type="text"
                      value={mcpCommand}
                      onChange={(e) => setMcpCommand(e.target.value)}
                      placeholder={
                        mcpTransport === 'stdio'
                          ? 'e.g. npx -y @modelcontextprotocol/server-filesystem /path'
                          : 'https://api.my-mcp.internal/sse'
                      }
                      className="w-full px-3 py-2 rounded-lg bg-[#151722] border border-[#272a38] text-white font-mono text-xs focus:outline-none focus:border-primary"
                    />
                  </div>
                </div>

                {/* Env Var Key/Val */}
                <div>
                  <label className="block text-[#a1a1aa] font-medium mb-1">
                    Environment Variables (Encrypted per-workspace)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="API_KEY_NAME"
                      value={mcpEnvKey}
                      onChange={(e) => setMcpEnvKey(e.target.value)}
                      className="w-1/3 px-2.5 py-1.5 rounded-lg bg-[#151722] border border-[#272a38] text-white font-mono text-xs focus:outline-none focus:border-primary"
                    />
                    <input
                      type="password"
                      placeholder="Value or vault secret reference"
                      value={mcpEnvVal}
                      onChange={(e) => setMcpEnvVal(e.target.value)}
                      className="flex-1 px-2.5 py-1.5 rounded-lg bg-[#151722] border border-[#272a38] text-white font-mono text-xs focus:outline-none focus:border-primary"
                    />
                    <Button type="button" variant="secondary" size="sm" onClick={handleAddEnvVar}>
                      + Add Env
                    </Button>
                  </div>

                  {mcpEnvList.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {mcpEnvList.map((env, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 rounded bg-[#161822] border border-[#262938] text-[11px] font-mono text-[#93c5fd] flex items-center gap-1.5"
                        >
                          <span>{env.key}=••••••</span>
                          <button
                            type="button"
                            onClick={() =>
                              setMcpEnvList((prev) => prev.filter((_, idx) => idx !== i))
                            }
                            className="text-[#71717a] hover:text-white"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Markdown Documentation & Rules Editor */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[#a1a1aa] font-medium">
                  Markdown Documentation &amp; Operational Rules
                </label>
                <button
                  type="button"
                  onClick={() => setPreviewOpen(!previewOpen)}
                  className="text-xs text-primary hover:underline"
                >
                  {previewOpen ? 'Edit Raw Markdown' : 'Preview Rendered'}
                </button>
              </div>

              {!previewOpen ? (
                <textarea
                  rows={6}
                  value={capDoc}
                  onChange={(e) => setCapDoc(e.target.value)}
                  placeholder={`# ${capName || 'Capability Title'}\n\n## When to Use\n- Use when...\n\n## Operating Rules\n1. Always verify parameters.\n2. ...`}
                  className="w-full px-3 py-2 rounded-lg bg-[#14161f] border border-[#252836] text-white focus:outline-none focus:border-primary font-mono text-xs leading-relaxed"
                />
              ) : (
                <div className="w-full p-4 rounded-lg bg-[#14161f] border border-[#252836] text-white prose prose-invert prose-xs max-w-none min-h-[140px] font-sans">
                  {capDoc ? (
                    <pre className="whitespace-pre-wrap font-sans text-xs text-[#d4d4d8] leading-relaxed">
                      {capDoc}
                    </pre>
                  ) : (
                    <span className="text-[#71717a] italic">No documentation entered yet.</span>
                  )}
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#1f212b] shrink-0">
              <Button type="button" variant="secondary" size="sm" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm">
                Create Capability
              </Button>
            </div>
          </form>
        )}

        {/* ── Content Area: Tab 3: Import Git / File Dropzone ─────────────── */}
        {activeTab === 'import' && (
          <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs font-sans">
            {/* Dropzone for SKILL.md and JSON */}
            <div>
              <h4 className="text-xs font-semibold text-white mb-1">
                Drag &amp; Drop SKILL.md or Specification File
              </h4>
              <p className="text-[11px] text-[#71717a] mb-2.5">
                Supports <code className="text-[#93c5fd]">SKILL.md</code> with YAML frontmatter,{' '}
                <code className="text-[#93c5fd]">mcp.json</code>, or OpenAPI schemas.
              </p>

              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleFileDrop}
                className={`border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer ${
                  dragOver
                    ? 'border-primary bg-primary/10'
                    : 'border-[#292c3a] bg-[#12131c] hover:border-[#383b4e] hover:bg-[#151622]'
                }`}
              >
                <div className="w-10 h-10 mx-auto mb-2 rounded-xl bg-[#1b1d28] border border-[#282a38] flex items-center justify-center text-lg">
                  📄
                </div>
                <p className="text-sm font-semibold text-white">Drop your capability file here</p>
                <p className="text-xs text-[#71717a] mt-1">or click to browse local files</p>
                <input
                  type="file"
                  accept=".md,.markdown,.json,.yaml,.yml"
                  onChange={handleFileInputChange}
                  className="hidden"
                  id="capability-file-input"
                />
                <label
                  htmlFor="capability-file-input"
                  className="inline-block mt-3 px-3 py-1.5 rounded-lg bg-[#1f212d] hover:bg-[#282b3a] text-xs font-medium text-white border border-[#2f3244] cursor-pointer transition-colors"
                >
                  Browse Files
                </label>
              </div>
            </div>

            {/* Git / Remote URL Fetcher */}
            <div className="pt-3 border-t border-[#1f212b]">
              <h4 className="text-xs font-semibold text-white mb-1">
                Import Capability from Git / URL
              </h4>
              <p className="text-[11px] text-[#71717a] mb-3">
                Clone a public GitHub skill directory, raw SKILL.md link, or remote MCP server
                endpoint.
              </p>

              <form onSubmit={handleImportSubmit} className="space-y-3">
                <div>
                  <label className="block text-[#a1a1aa] font-medium mb-1">
                    Repository URL / Endpoint *
                  </label>
                  <input
                    type="text"
                    required
                    value={importUrl}
                    onChange={(e) => setImportUrl(e.target.value)}
                    placeholder="https://github.com/vaeloom/skills-community/tree/main/rag-eval"
                    className="w-full px-3 py-2 rounded-lg bg-[#14161f] border border-[#252836] text-white focus:outline-none focus:border-primary text-xs font-mono"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[#a1a1aa] font-medium mb-1">Target Category</label>
                    <select
                      value={importCategory}
                      onChange={(e) => setImportCategory(e.target.value as CapabilityCategory)}
                      className="w-full px-3 py-2 rounded-lg bg-[#14161f] border border-[#252836] text-white focus:outline-none focus:border-primary text-xs"
                    >
                      <option value="skills">Skills</option>
                      <option value="plugins">Plugins</option>
                      <option value="agents">Agents</option>
                      <option value="mcp">MCP Connector</option>
                      <option value="tools">Tools</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#1f212b]">
                  <Button type="button" variant="secondary" size="sm" onClick={onClose}>
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    disabled={importLoading}
                    className="inline-flex items-center gap-2"
                  >
                    {importLoading ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Fetching &amp; Importing…</span>
                      </>
                    ) : (
                      <span>Import &amp; Activate</span>
                    )}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
