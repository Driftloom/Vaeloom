'use client';

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
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
// Production-Ready Enterprise Presets / Scaffolds (Vaeloom Sovereign Standards)
// ─────────────────────────────────────────────────────────────────────────────
interface PresetTemplate {
  id: string;
  name: string;
  category: CapabilityCategory;
  title: string;
  description: string;
  tags: string[];
  autonomy: 'autonomous' | 'approval_required' | 'suggest';
  triggers: string[];
  parameters?: Array<{ name: string; type: string; description: string; required: boolean }>;
  mcpConfig?: { transport: 'stdio' | 'sse'; command: string; env: Record<string, string> };
  pluginConfig?: { hook: string; sandbox: string };
  doc: string;
}

const PRESET_TEMPLATES: PresetTemplate[] = [
  {
    id: 'pr-code-reviewer',
    name: 'pr-code-reviewer',
    category: 'skills',
    title: 'PR & Forensic Code Reviewer',
    description:
      'Autonomous pull request review skill with AST safety analysis, security linting, and regression checks.',
    tags: ['Review', 'Engineering', 'Security', 'QA'],
    autonomy: 'autonomous',
    triggers: ['/review', 'review this pull request', 'audit code changes'],
    doc: `# PR & Forensic Code Reviewer

## Mission
Performs deep structural and security code reviews on pull request diffs, checks test coverage, and flags anti-patterns.

## When to Use
- User triggers \`/review\` or requests PR validation.
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
  {
    id: 'security-audit-plugin',
    name: 'security-audit-plugin',
    category: 'plugins',
    title: 'Zero-Trust Security Audit Hook',
    description:
      'Lifecycle plugin that validates outbound payloads, inspects SSRF vectors, and enforces workspace data loss prevention rules.',
    tags: ['Plugin', 'Security', 'Lifecycle', 'DLP'],
    autonomy: 'autonomous',
    triggers: ['audit tool call', 'validate outbound egress'],
    pluginConfig: {
      hook: 'on_tool_call',
      sandbox: 'isolated_subprocess',
    },
    doc: `# Zero-Trust Security Audit Hook

## Lifecycle Hook Point
- Event: \`on_tool_call\`
- Isolation: \`isolated_subprocess\`

## Policies Enforced
1. SSRF Guardrail: Enforces private IP denylist.
2. DLP Inspection: Replaces high-entropy API tokens with synthetic tokens.
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
  const [rightPanelTab, setRightPanelTab] = useState<'doc' | 'spec' | 'audit'>('doc');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

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

  // Plugin-specific configuration
  const [pluginHook, setPluginHook] = useState<
    'on_agent_start' | 'on_tool_call' | 'on_agent_complete'
  >('on_tool_call');
  const [pluginSandbox, setPluginSandbox] = useState<
    'isolated_subprocess' | 'wasm_sandbox' | 'safe_thread'
  >('isolated_subprocess');

  // Agent-specific configuration
  const [agentArchetype, setAgentArchetype] = useState<'supervisor' | 'specialist' | 'auditor'>(
    'specialist',
  );
  const [agentMaxTurns, setAgentMaxTurns] = useState<number>(12);

  // Import Mode State
  const [importUrl, setImportUrl] = useState('');
  const [importCategory, setImportCategory] = useState<CapabilityCategory>('skills');
  const [importLoading, setImportLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [fileParseSuccess, setFileParseSuccess] = useState<string | null>(null);

  // Preset filter state
  const [presetSearch, setPresetSearch] = useState('');
  const [presetCategoryFilter, setPresetCategoryFilter] = useState<string>('all');

  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialMode);
      setValidationError(null);
    }
  }, [isOpen, initialMode]);

  // Enterprise Readiness Score (0 - 100%)
  const readinessAudit = useMemo(() => {
    const checks = [
      {
        id: 'slug',
        label: 'Identifier defined',
        passed: Boolean(capName.trim()),
        weight: 25,
      },
      {
        id: 'description',
        label: 'Executive description (≥ 10 chars)',
        passed: Boolean(capDescription.trim().length >= 10),
        weight: 20,
      },
      {
        id: 'taxonomy',
        label: 'Taxonomy tag defined',
        passed: capTags.length > 0,
        weight: 15,
      },
      {
        id: 'protocol',
        label:
          capCategory === 'mcp'
            ? 'MCP Command & Transport'
            : capCategory === 'tools'
              ? 'Input Parameters Schema'
              : capCategory === 'plugins'
                ? 'Lifecycle Hook & Sandbox'
                : 'Execution Directives',
        passed:
          capCategory === 'mcp'
            ? Boolean(mcpCommand.trim())
            : capCategory === 'tools'
              ? toolParams.some((p) => Boolean(p.name.trim()))
              : true,
        weight: 20,
      },
      {
        id: 'docs',
        label: 'Operational rules & doc (≥ 20 chars)',
        passed: Boolean(capDoc.trim().length >= 20),
        weight: 20,
      },
    ];

    const total = checks.reduce((acc, c) => acc + (c.passed ? c.weight : 0), 0);
    return { checks, score: total };
  }, [capName, capDescription, capTags, capCategory, mcpCommand, toolParams, capDoc]);

  // Select Preset Template
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
    if (template.pluginConfig) {
      setPluginHook(template.pluginConfig.hook as any);
      setPluginSandbox(template.pluginConfig.sandbox as any);
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

  // Tool Parameter Management
  const handleAddParam = useCallback(() => {
    setToolParams((prev) => [
      ...prev,
      { name: `param_${prev.length + 1}`, type: 'string', description: '', required: false },
    ]);
  }, []);

  const handleRemoveParam = useCallback((index: number) => {
    setToolParams((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // MCP Env Management
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

  // Live Spec Generator for Spec Tab
  const generatedSpecString = useMemo(() => {
    if (capCategory === 'mcp') {
      const manifest = {
        mcpServers: {
          [capName || 'mcp-server']: {
            transport: mcpTransport,
            command: mcpCommand,
            env: Object.fromEntries(mcpEnvList.map((e) => [e.key, e.val])),
            protocolVersion: '2024-11-05',
          },
        },
      };
      return JSON.stringify(manifest, null, 2);
    }
    if (capCategory === 'tools') {
      return JSON.stringify(
        {
          name: capName || 'tool_name',
          description: capDescription || 'Tool description',
          inputSchema: generatedInputSchema || { type: 'object', properties: {} },
          timeoutSeconds: 30,
        },
        null,
        2,
      );
    }
    if (capCategory === 'plugins') {
      return JSON.stringify(
        {
          plugin: capName || 'plugin-name',
          hookPoint: pluginHook,
          isolation: pluginSandbox,
          autonomy: capAutonomy,
        },
        null,
        2,
      );
    }
    // Default SKILL.md Frontmatter Spec
    const frontmatter = `---
name: "${capName || 'custom-capability'}"
description: "${capDescription || 'Capability description'}"
category: "${capCategory}"
autonomy: "${capAutonomy}"
tags: [${capTags.map((t) => `"${t}"`).join(', ')}]
triggers: [${capTriggers
      .split(',')
      .map((t) => `"${t.trim()}"`)
      .filter(Boolean)
      .join(', ')}]
---

${capDoc || '# Operational Rules\n1. Define sovereign instructions here.'}
`;
    return frontmatter;
  }, [
    capCategory,
    capName,
    capDescription,
    capAutonomy,
    capTags,
    capTriggers,
    capDoc,
    mcpTransport,
    mcpCommand,
    mcpEnvList,
    generatedInputSchema,
    pluginHook,
    pluginSandbox,
  ]);

  // File Drag & Drop Parser
  const parseDroppedContent = useCallback((filename: string, content: string) => {
    try {
      if (filename.endsWith('.md') || filename.endsWith('.markdown')) {
        const frontmatterMatch = content.match(
          /^---\s*[\r\n]+([\s\S]*?)[\r\n]+---\s*[\r\n]+([\s\S]*)$/,
        );
        if (frontmatterMatch && frontmatterMatch[1] && frontmatterMatch[2]) {
          const fmText = frontmatterMatch[1];
          const bodyDoc = frontmatterMatch[2];

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
      }
    } catch {
      setValidationError(`Could not parse file ${filename}. Check formatting.`);
    }
  }, []);

  const handleFileDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const files = Array.from(e.dataTransfer.files);
      const firstFile = files[0];
      if (!firstFile) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        if (content) {
          parseDroppedContent(firstFile.name, content);
        }
      };
      reader.readAsText(firstFile);
    },
    [parseDroppedContent],
  );

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      const firstFile = files[0];
      if (!firstFile) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        if (content) {
          parseDroppedContent(firstFile.name, content);
        }
      };
      reader.readAsText(firstFile);
    },
    [parseDroppedContent],
  );

  // Form Submit Handler
  const handleFinalSubmit = useCallback(
    (e?: React.FormEvent) => {
      if (e) e.preventDefault();

      const rawName = capName.trim();
      if (!rawName) {
        setValidationError('Capability name / identifier is required.');
        nameInputRef.current?.focus();
        return;
      }

      const slug = rawName
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-_]/g, '');

      const triggerList = capTriggers
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      const newCap: CapabilityItem = {
        id: `${capCategory}-${slug}-${Date.now()}`,
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
            : capCategory === 'plugins'
              ? {
                  hook: pluginHook,
                  sandbox: pluginSandbox,
                }
              : capCategory === 'agents'
                ? {
                    archetype: agentArchetype,
                    maxTurns: agentMaxTurns,
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
      pluginHook,
      pluginSandbox,
      agentArchetype,
      agentMaxTurns,
      onCreate,
      onClose,
    ],
  );

  // Keyboard shortcut: Escape to close, Ctrl+Enter to submit
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleFinalSubmit();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleFinalSubmit, onClose]);

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

  const filteredPresets = useMemo(() => {
    return PRESET_TEMPLATES.filter((tmpl) => {
      if (presetCategoryFilter !== 'all' && tmpl.category !== presetCategoryFilter) {
        return false;
      }
      if (presetSearch.trim()) {
        const q = presetSearch.toLowerCase();
        return (
          tmpl.title.toLowerCase().includes(q) ||
          tmpl.description.toLowerCase().includes(q) ||
          tmpl.tags.some((t) => t.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [presetCategoryFilter, presetSearch]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-capability-modal-title"
      aria-describedby="add-capability-modal-desc"
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div className="w-full max-w-5xl h-[660px] max-h-[90vh] bg-[#0c0d12] border border-[#232738] rounded-2xl shadow-2xl flex flex-col overflow-hidden text-[#f4f4f5] antialiased">
        {/* ── 1. Top Header: Title, Description, and Mode Navigation ─────────── */}
        <header className="px-5 py-3 border-b border-[#1c1e28] bg-[#0f1118] flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/15 border border-primary/30 flex items-center justify-center text-primary text-xs font-semibold shrink-0">
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2
                  id="add-capability-modal-title"
                  className="text-sm font-semibold text-white tracking-tight font-sans"
                >
                  Add Custom Capability
                </h2>
                {activeTab === 'builder' && (
                  <Badge
                    variant={
                      readinessAudit.score >= 90
                        ? 'success'
                        : readinessAudit.score >= 50
                          ? 'info'
                          : 'warning'
                    }
                    size="sm"
                    className="text-[10px] font-mono"
                  >
                    Score: {readinessAudit.score}%{' '}
                    {readinessAudit.score >= 90 ? '• Enterprise Ready' : '• In Progress'}
                  </Badge>
                )}
              </div>
              <p id="add-capability-modal-desc" className="text-[11px] text-[#a1a1aa] font-sans">
                Author custom skills, import via Git / file, or instantiate enterprise scaffolds
              </p>
            </div>
          </div>

          {/* Mode Switcher Buttons */}
          <div className="flex items-center gap-1 p-0.5 rounded-lg bg-[#141620] border border-[#222533] text-xs font-sans">
            <button
              type="button"
              onClick={() => setActiveTab('templates')}
              className={`px-3 py-1 rounded-md transition-all font-medium inline-flex items-center gap-1.5 ${
                activeTab === 'templates'
                  ? 'bg-[#222638] text-white shadow-xs'
                  : 'text-[#8b8e99] hover:text-[#f4f4f5]'
              }`}
            >
              <span>⚡ Presets</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('builder')}
              className={`px-3 py-1 rounded-md transition-all font-medium inline-flex items-center gap-1.5 ${
                activeTab === 'builder'
                  ? 'bg-[#222638] text-white shadow-xs'
                  : 'text-[#8b8e99] hover:text-[#f4f4f5]'
              }`}
            >
              <span>🛠️ Studio Builder</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('import')}
              className={`px-3 py-1 rounded-md transition-all font-medium inline-flex items-center gap-1.5 ${
                activeTab === 'import'
                  ? 'bg-[#222638] text-white shadow-xs'
                  : 'text-[#8b8e99] hover:text-[#f4f4f5]'
              }`}
            >
              <span>📁 Import Git / File</span>
            </button>
          </div>

          {/* Close Button */}
          <button
            type="button"
            onClick={onClose}
            className="text-[#8b8e99] hover:text-white p-1 rounded-lg hover:bg-[#181a24] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label="Close modal"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </header>

        {/* ── Notification Banners ────────────────────────────────────────── */}
        {fileParseSuccess && (
          <div className="px-5 py-2 bg-emerald-950/40 border-b border-emerald-900/40 flex items-center justify-between text-xs text-emerald-300 font-sans shrink-0">
            <span className="flex items-center gap-2">
              <svg
                className="w-3.5 h-3.5 text-emerald-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
              <span>{fileParseSuccess}</span>
            </span>
            <button
              type="button"
              onClick={() => setFileParseSuccess(null)}
              className="text-emerald-400 hover:text-emerald-200"
            >
              ×
            </button>
          </div>
        )}

        {validationError && (
          <div className="px-5 py-2 bg-rose-950/40 border-b border-rose-900/40 flex items-center justify-between text-xs text-rose-300 font-sans shrink-0">
            <span className="flex items-center gap-2">
              <svg
                className="w-3.5 h-3.5 text-rose-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
                />
              </svg>
              <span>{validationError}</span>
            </span>
            <button
              type="button"
              onClick={() => setValidationError(null)}
              className="text-rose-400 hover:text-rose-200"
            >
              ×
            </button>
          </div>
        )}

        {/* ── 2. Content Body (Scrollable, Clean Master-Detail Two-Column Layout) ─── */}
        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
          {/* ──────────────────────────────────────────────────────────────── */}
          {/* TAB 1: Enterprise Production Scaffolds (Presets)                  */}
          {/* ──────────────────────────────────────────────────────────────── */}
          {activeTab === 'templates' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-[#1c1e28]">
                <div>
                  <h3 className="text-sm font-semibold text-white font-sans">
                    Enterprise Production Scaffolds
                  </h3>
                  <p className="text-xs text-[#a1a1aa] font-sans mt-0.5">
                    Select a pre-configured template to bootstrap your capability with production
                    rules and typed schemas.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Search blueprints..."
                    value={presetSearch}
                    onChange={(e) => setPresetSearch(e.target.value)}
                    className="px-2.5 py-1 text-xs rounded-lg bg-[#141620] border border-[#222533] text-white focus:outline-none focus:border-primary w-44"
                  />
                  <select
                    value={presetCategoryFilter}
                    onChange={(e) => setPresetCategoryFilter(e.target.value)}
                    aria-label="Filter presets by category"
                    className="px-2 py-1 text-xs rounded-lg bg-[#141620] border border-[#222533] text-[#d4d4d8] focus:outline-none focus:border-primary"
                  >
                    <option value="all">All Types</option>
                    <option value="skills">Skills</option>
                    <option value="tools">Tools</option>
                    <option value="mcp">MCP</option>
                    <option value="agents">Agents</option>
                    <option value="plugins">Plugins</option>
                  </select>
                </div>
              </div>

              {/* Presets Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filteredPresets.map((template) => (
                  <div
                    key={template.id}
                    onClick={() => handleSelectTemplate(template)}
                    className="group p-3.5 rounded-xl border border-[#202330] bg-[#10121a] hover:bg-[#151824] hover:border-primary/50 transition-all cursor-pointer flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-semibold text-white group-hover:text-primary transition-colors">
                          {template.title}
                        </span>
                        <Badge variant="mono" size="sm" className="capitalize text-[10px]">
                          {template.category}
                        </Badge>
                      </div>
                      <p className="text-xs text-[#a1a1aa] line-clamp-2 leading-relaxed">
                        {template.description}
                      </p>
                    </div>

                    <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-[#181a24] text-[11px]">
                      <div className="flex flex-wrap gap-1">
                        {template.tags.slice(0, 3).map((t) => (
                          <span
                            key={t}
                            className="px-1.5 py-0.2 rounded text-[10px] bg-[#161822] text-[#8b8e99] border border-[#222432]"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                      <span className="text-primary font-medium group-hover:translate-x-0.5 transition-transform flex items-center gap-1 text-[11px]">
                        Use Template →
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ──────────────────────────────────────────────────────────────── */}
          {/* TAB 2: Studio Builder (Interactive Master-Detail Authoring)        */}
          {/* ──────────────────────────────────────────────────────────────── */}
          {activeTab === 'builder' && (
            <form onSubmit={handleFinalSubmit} className="space-y-4">
              {/* Category Segmented Bar */}
              <div>
                <label className="block text-xs font-medium text-[#a1a1aa] mb-1.5">
                  Capability Category *
                </label>
                <div className="grid grid-cols-5 gap-2">
                  {[
                    { id: 'skills', label: 'Skills', desc: 'Reasoning loop' },
                    { id: 'agents', label: 'Agents', desc: 'Autonomous actor' },
                    { id: 'tools', label: 'Tools', desc: 'Typed function' },
                    { id: 'mcp', label: 'MCP', desc: 'Protocol bridge' },
                    { id: 'plugins', label: 'Plugins', desc: 'Lifecycle hook' },
                  ].map((cat) => {
                    const isSel = capCategory === cat.id;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => {
                          setCapCategory(cat.id as CapabilityCategory);
                          setValidationError(null);
                        }}
                        className={`flex flex-col items-center justify-center p-2 rounded-xl border text-xs font-medium transition-all ${
                          isSel
                            ? 'bg-primary/15 border-primary text-white shadow-xs ring-1 ring-primary/40'
                            : 'bg-[#12131a] border-[#222430] text-[#8b8e99] hover:text-white hover:border-[#2f3244]'
                        }`}
                      >
                        <span className="font-semibold text-xs text-white">{cat.label}</span>
                        <span className="text-[10px] text-[#71717a] font-normal">{cat.desc}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Master-Detail 2-Column Responsive Studio Layout */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
                {/* ── Left Column: Structured Form Controls (col-span-7) ────── */}
                <div className="md:col-span-7 space-y-3.5">
                  {/* Name and Autonomy Policy */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2">
                      <label
                        htmlFor="cap-name-input"
                        className="block text-xs font-medium text-[#a1a1aa] mb-1"
                      >
                        Capability Name / Identifier *
                      </label>
                      <input
                        ref={nameInputRef}
                        id="cap-name-input"
                        type="text"
                        required
                        value={capName}
                        onChange={(e) => {
                          setCapName(e.target.value);
                          setValidationError(null);
                        }}
                        placeholder="e.g. code-synthesizer or ats-scoring"
                        className="w-full px-3 py-1.5 rounded-lg bg-[#12141c] border border-[#232636] text-white focus:outline-none focus:border-primary font-mono text-xs focus-visible:ring-2 focus-visible:ring-primary"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="cap-autonomy-select"
                        className="block text-xs font-medium text-[#a1a1aa] mb-1"
                      >
                        Autonomy Policy
                      </label>
                      <select
                        id="cap-autonomy-select"
                        value={capAutonomy}
                        onChange={(e) =>
                          setCapAutonomy(
                            e.target.value as 'autonomous' | 'approval_required' | 'suggest',
                          )
                        }
                        className="w-full px-3 py-1.5 rounded-lg bg-[#12141c] border border-[#232636] text-white focus:outline-none focus:border-primary text-xs"
                      >
                        <option value="autonomous">Autonomous Execution</option>
                        <option value="approval_required">Human Approval Gate</option>
                        <option value="suggest">Suggest to User Only</option>
                      </select>
                    </div>
                  </div>

                  {/* Summary Description */}
                  <div>
                    <label
                      htmlFor="cap-desc-input"
                      className="block text-xs font-medium text-[#a1a1aa] mb-1"
                    >
                      Summary Description
                    </label>
                    <input
                      id="cap-desc-input"
                      type="text"
                      value={capDescription}
                      onChange={(e) => setCapDescription(e.target.value)}
                      placeholder="Brief description explaining when agents should activate this capability"
                      className="w-full px-3 py-1.5 rounded-lg bg-[#12141c] border border-[#232636] text-white focus:outline-none focus:border-primary text-xs"
                    />
                  </div>

                  {/* Interactive Tag Manager */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label htmlFor="cap-tag-input" className="text-xs font-medium text-[#a1a1aa]">
                        Tags &amp; Taxonomy
                      </label>
                      <span className="text-[11px] text-[#71717a]">
                        Click a chip to quickly add
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 p-1.5 rounded-lg bg-[#12141c] border border-[#232636] min-h-[38px]">
                      {capTags.map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-[#1a1c26] text-[#e4e4e7] border border-[#292c3a]"
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
                        id="cap-tag-input"
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
                        className="bg-transparent text-xs text-white placeholder-[#71717a] focus:outline-none flex-1 min-w-[120px] px-1 font-sans"
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
                            className="text-[10px] px-1.5 py-0.2 rounded bg-[#10121a] text-[#8b8e99] hover:text-white hover:bg-[#181a24] border border-[#20222e] transition-colors"
                          >
                            + {suggest}
                          </button>
                        ))}
                    </div>
                  </div>

                  {/* Routing & Triggers (Skills / Agents) */}
                  {(capCategory === 'skills' || capCategory === 'agents') && (
                    <div>
                      <label
                        htmlFor="cap-triggers-input"
                        className="block text-xs font-medium text-[#a1a1aa] mb-1"
                      >
                        Routing &amp; Trigger Keywords (comma-separated)
                      </label>
                      <input
                        id="cap-triggers-input"
                        type="text"
                        value={capTriggers}
                        onChange={(e) => setCapTriggers(e.target.value)}
                        placeholder="e.g. /review, pr audit, check code quality"
                        className="w-full px-3 py-1.5 rounded-lg bg-[#12141c] border border-[#232636] text-white focus:outline-none focus:border-primary text-xs"
                      />
                    </div>
                  )}

                  {/* Agent Specific Settings */}
                  {capCategory === 'agents' && (
                    <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-[#101118] border border-[#222430]">
                      <div>
                        <label
                          htmlFor="agent-archetype-select"
                          className="block text-xs font-medium text-[#a1a1aa] mb-1"
                        >
                          Role Archetype
                        </label>
                        <select
                          id="agent-archetype-select"
                          value={agentArchetype}
                          onChange={(e) => setAgentArchetype(e.target.value as any)}
                          className="w-full px-2 py-1.5 rounded bg-[#151722] border border-[#272a38] text-white text-xs focus:outline-none focus:border-primary"
                        >
                          <option value="specialist">Specialist Agent</option>
                          <option value="supervisor">Supervisor Orchestrator</option>
                          <option value="auditor">Forensic Auditor</option>
                        </select>
                      </div>
                      <div>
                        <label
                          htmlFor="agent-max-turns"
                          className="block text-xs font-medium text-[#a1a1aa] mb-1"
                        >
                          Max ReAct Iterations
                        </label>
                        <input
                          id="agent-max-turns"
                          type="number"
                          min={1}
                          max={30}
                          value={agentMaxTurns}
                          onChange={(e) => setAgentMaxTurns(parseInt(e.target.value, 10) || 12)}
                          className="w-full px-2 py-1.5 rounded bg-[#151722] border border-[#272a38] text-white text-xs focus:outline-none focus:border-primary"
                        />
                      </div>
                    </div>
                  )}

                  {/* Plugin Specific Settings */}
                  {capCategory === 'plugins' && (
                    <div className="p-3 rounded-xl bg-[#101118] border border-[#222430] space-y-2.5">
                      <div className="flex items-center justify-between pb-1.5 border-b border-[#1b1c24]">
                        <h4 className="font-semibold text-white text-xs">
                          Plugin Lifecycle Architecture
                        </h4>
                        <Badge variant="default" size="sm">
                          Enterprise Hook
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label
                            htmlFor="plugin-hook-select"
                            className="block text-xs font-medium text-[#a1a1aa] mb-1"
                          >
                            Lifecycle Hook Point
                          </label>
                          <select
                            id="plugin-hook-select"
                            value={pluginHook}
                            onChange={(e) => setPluginHook(e.target.value as any)}
                            className="w-full px-2 py-1.5 rounded bg-[#151722] border border-[#272a38] text-white text-xs focus:outline-none focus:border-primary"
                          >
                            <option value="on_tool_call">on_tool_call (Pre/Post Egress)</option>
                            <option value="on_agent_start">on_agent_start (Context Inject)</option>
                            <option value="on_agent_complete">
                              on_agent_complete (Audit Sink)
                            </option>
                          </select>
                        </div>
                        <div>
                          <label
                            htmlFor="plugin-sandbox-select"
                            className="block text-xs font-medium text-[#a1a1aa] mb-1"
                          >
                            Sandbox Isolation
                          </label>
                          <select
                            id="plugin-sandbox-select"
                            value={pluginSandbox}
                            onChange={(e) => setPluginSandbox(e.target.value as any)}
                            className="w-full px-2 py-1.5 rounded bg-[#151722] border border-[#272a38] text-white text-xs focus:outline-none focus:border-primary"
                          >
                            <option value="isolated_subprocess">
                              Subprocess Isolation (Secure)
                            </option>
                            <option value="wasm_sandbox">WASM Sandbox Container</option>
                            <option value="safe_thread">In-Process Worker</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Tool Parameters Builder (Tools) */}
                  {capCategory === 'tools' && (
                    <div className="p-3 rounded-xl bg-[#101118] border border-[#222430] space-y-2.5">
                      <div className="flex items-center justify-between pb-1.5 border-b border-[#1b1c24]">
                        <h4 className="font-semibold text-white text-xs">
                          Visual Parameter Builder (JSON Schema)
                        </h4>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={handleAddParam}
                        >
                          + Add Param
                        </Button>
                      </div>

                      <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                        {toolParams.map((p, idx) => (
                          <div key={idx} className="flex items-center gap-1.5">
                            <input
                              type="text"
                              placeholder="name"
                              value={p.name}
                              onChange={(e) => {
                                const val = e.target.value;
                                setToolParams((prev) =>
                                  prev.map((item, i) =>
                                    i === idx ? { ...item, name: val } : item,
                                  ),
                                );
                              }}
                              className="w-28 px-2 py-1 rounded bg-[#151722] border border-[#272a38] text-white font-mono text-xs focus:outline-none focus:border-primary"
                            />
                            <select
                              value={p.type}
                              onChange={(e) => {
                                const val = e.target.value;
                                setToolParams((prev) =>
                                  prev.map((item, i) =>
                                    i === idx ? { ...item, type: val } : item,
                                  ),
                                );
                              }}
                              className="w-20 px-2 py-1 rounded bg-[#151722] border border-[#272a38] text-white text-xs focus:outline-none focus:border-primary"
                            >
                              <option value="string">string</option>
                              <option value="number">number</option>
                              <option value="boolean">boolean</option>
                              <option value="object">object</option>
                              <option value="array">array</option>
                            </select>
                            <input
                              type="text"
                              placeholder="Description"
                              value={p.description}
                              onChange={(e) => {
                                const val = e.target.value;
                                setToolParams((prev) =>
                                  prev.map((item, i) =>
                                    i === idx ? { ...item, description: val } : item,
                                  ),
                                );
                              }}
                              className="flex-1 px-2 py-1 rounded bg-[#151722] border border-[#272a38] text-white text-xs focus:outline-none focus:border-primary"
                            />
                            <label className="flex items-center gap-1 text-[10px] text-[#a1a1aa] shrink-0">
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
                              className="text-[#71717a] hover:text-red-400 p-0.5"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* MCP Protocol Configuration (MCP) */}
                  {capCategory === 'mcp' && (
                    <div className="p-3 rounded-xl bg-[#101118] border border-[#222430] space-y-2.5">
                      <div className="flex items-center justify-between pb-1.5 border-b border-[#1b1c24]">
                        <h4 className="font-semibold text-white text-xs">
                          MCP Protocol Configuration
                        </h4>
                        <Badge variant="primary" size="sm">
                          MCP v2 Standard
                        </Badge>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <div>
                          <label
                            htmlFor="mcp-transport-select"
                            className="block text-xs font-medium text-[#a1a1aa] mb-1"
                          >
                            Transport
                          </label>
                          <select
                            id="mcp-transport-select"
                            value={mcpTransport}
                            onChange={(e) => setMcpTransport(e.target.value as 'stdio' | 'sse')}
                            className="w-full px-2 py-1.5 rounded bg-[#151722] border border-[#272a38] text-white text-xs focus:outline-none focus:border-primary"
                          >
                            <option value="stdio">stdio (Local Command)</option>
                            <option value="sse">Streamable HTTP / SSE</option>
                          </select>
                        </div>
                        <div className="sm:col-span-2">
                          <label
                            htmlFor="mcp-cmd-input"
                            className="block text-xs font-medium text-[#a1a1aa] mb-1"
                          >
                            {mcpTransport === 'stdio' ? 'Command & Arguments' : 'SSE Endpoint URL'}
                          </label>
                          <input
                            id="mcp-cmd-input"
                            type="text"
                            value={mcpCommand}
                            onChange={(e) => setMcpCommand(e.target.value)}
                            placeholder={
                              mcpTransport === 'stdio'
                                ? 'e.g. npx -y @modelcontextprotocol/server-filesystem /path'
                                : 'https://api.my-mcp.internal/sse'
                            }
                            className="w-full px-2.5 py-1.5 rounded bg-[#151722] border border-[#272a38] text-white font-mono text-xs focus:outline-none focus:border-primary"
                          />
                        </div>
                      </div>

                      {/* Env Vars */}
                      <div>
                        <label className="block text-xs font-medium text-[#a1a1aa] mb-1">
                          Environment Variables
                        </label>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            placeholder="KEY"
                            value={mcpEnvKey}
                            onChange={(e) => setMcpEnvKey(e.target.value)}
                            className="w-1/3 px-2 py-1 rounded bg-[#151722] border border-[#272a38] text-white font-mono text-xs focus:outline-none focus:border-primary"
                          />
                          <input
                            type="password"
                            placeholder="SECRET_VAL"
                            value={mcpEnvVal}
                            onChange={(e) => setMcpEnvVal(e.target.value)}
                            className="flex-1 px-2 py-1 rounded bg-[#151722] border border-[#272a38] text-white font-mono text-xs focus:outline-none focus:border-primary"
                          />
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={handleAddEnvVar}
                          >
                            + Env
                          </Button>
                        </div>

                        {mcpEnvList.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-1.5">
                            {mcpEnvList.map((env, i) => (
                              <span
                                key={i}
                                className="px-2 py-0.5 rounded bg-[#161822] border border-[#262938] text-[10px] font-mono text-[#93c5fd] flex items-center gap-1"
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
                </div>

                {/* ── Right Column: Studio Live Inspector & Documentation (col-span-5) ─ */}
                <div className="md:col-span-5 flex flex-col min-h-[380px] bg-[#090a0f] rounded-xl border border-[#1e202d] p-3.5 space-y-2.5">
                  {/* Right Header Tabs */}
                  <div className="flex items-center justify-between pb-2 border-b border-[#1a1c26]">
                    <div className="flex items-center gap-2 text-xs">
                      <button
                        type="button"
                        onClick={() => setRightPanelTab('doc')}
                        className={`font-medium pb-0.5 border-b-2 transition-colors ${
                          rightPanelTab === 'doc'
                            ? 'text-white border-primary'
                            : 'text-[#8b8e99] border-transparent hover:text-[#d4d4d8]'
                        }`}
                      >
                        Documentation
                      </button>
                      <button
                        type="button"
                        onClick={() => setRightPanelTab('spec')}
                        className={`font-medium pb-0.5 border-b-2 transition-colors ${
                          rightPanelTab === 'spec'
                            ? 'text-white border-primary'
                            : 'text-[#8b8e99] border-transparent hover:text-[#d4d4d8]'
                        }`}
                      >
                        Live Spec
                      </button>
                      <button
                        type="button"
                        onClick={() => setRightPanelTab('audit')}
                        className={`font-medium pb-0.5 border-b-2 transition-colors ${
                          rightPanelTab === 'audit'
                            ? 'text-white border-primary'
                            : 'text-[#8b8e99] border-transparent hover:text-[#d4d4d8]'
                        }`}
                      >
                        Readiness
                      </button>
                    </div>

                    {rightPanelTab === 'doc' && (
                      <button
                        type="button"
                        onClick={() => setPreviewOpen(!previewOpen)}
                        className="text-xs text-primary hover:underline"
                      >
                        {previewOpen ? 'Edit Raw Markdown' : 'Preview Rendered'}
                      </button>
                    )}
                  </div>

                  {/* Right Tab 1: Documentation */}
                  {rightPanelTab === 'doc' && (
                    <>
                      {!previewOpen ? (
                        <textarea
                          rows={11}
                          value={capDoc}
                          onChange={(e) => setCapDoc(e.target.value)}
                          placeholder={`# ${capName || 'Capability Title'}\n\n## When to Use\n- Use when...\n\n## Operating Rules\n1. Always verify assumptions.`}
                          className="w-full flex-1 p-2.5 rounded-lg bg-[#12141c] border border-[#232636] text-white focus:outline-none focus:border-primary font-mono text-xs leading-relaxed resize-none"
                        />
                      ) : (
                        <div className="w-full flex-1 p-3 rounded-lg bg-[#12141c] border border-[#232636] text-[#e4e4e7] overflow-y-auto max-h-[290px] prose prose-invert prose-xs max-w-none">
                          {capDoc ? (
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{capDoc}</ReactMarkdown>
                          ) : (
                            <span className="text-[#71717a] italic">
                              No documentation entered yet.
                            </span>
                          )}
                        </div>
                      )}

                      {/* Snippets Toolbar */}
                      <div className="flex flex-wrap items-center gap-1 pt-1 text-[10px] text-[#71717a]">
                        <span>Insert:</span>
                        <button
                          type="button"
                          onClick={() =>
                            setCapDoc(
                              (prev) =>
                                `${prev}\n\n## Mission\nExecute mission with verifiable evidence.`,
                            )
                          }
                          className="px-1.5 py-0.5 rounded bg-[#141620] hover:text-white border border-[#232636]"
                        >
                          + Mission
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setCapDoc(
                              (prev) =>
                                `${prev}\n\n## Operating Rules\n1. Enforce zero-trust boundaries.\n2. Fall back to deterministic heuristics.`,
                            )
                          }
                          className="px-1.5 py-0.5 rounded bg-[#141620] hover:text-white border border-[#232636]"
                        >
                          + Rules
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setCapDoc(
                              (prev) =>
                                `${prev}\n\n## Security Fence\nRequires supervisor audit before network egress.`,
                            )
                          }
                          className="px-1.5 py-0.5 rounded bg-[#141620] hover:text-white border border-[#232636]"
                        >
                          + Security
                        </button>
                      </div>
                    </>
                  )}

                  {/* Right Tab 2: Live Generated Spec */}
                  {rightPanelTab === 'spec' && (
                    <div className="flex-1 flex flex-col justify-between">
                      <div className="p-2.5 rounded-lg bg-[#12141c] border border-[#232636] text-[#93c5fd] font-mono text-[11px] overflow-x-auto max-h-[290px] whitespace-pre leading-relaxed select-all">
                        {generatedSpecString}
                      </div>
                      <p className="text-[10px] text-[#71717a] mt-2">
                        Dynamic sovereign manifest compiled in real-time from active builder
                        parameters.
                      </p>
                    </div>
                  )}

                  {/* Right Tab 3: Enterprise Readiness Audit */}
                  {rightPanelTab === 'audit' && (
                    <div className="flex-1 space-y-2.5 p-1 overflow-y-auto">
                      <div className="p-2.5 rounded-lg bg-[#12141c] border border-[#222430]">
                        <div className="flex items-center justify-between text-xs mb-1.5">
                          <span className="font-semibold text-white">Overall Capability Score</span>
                          <span className="font-mono font-bold text-primary">
                            {readinessAudit.score}%
                          </span>
                        </div>
                        <div className="w-full bg-[#1b1e2a] h-1.5 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all duration-300 ${
                              readinessAudit.score >= 90
                                ? 'bg-emerald-500'
                                : readinessAudit.score >= 50
                                  ? 'bg-primary'
                                  : 'bg-amber-500'
                            }`}
                            style={{ width: `${readinessAudit.score}%` }}
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5 text-xs">
                        {readinessAudit.checks.map((c) => (
                          <div
                            key={c.id}
                            className="flex items-center justify-between p-2 rounded-lg bg-[#11131a] border border-[#1e202d]"
                          >
                            <span className="flex items-center gap-2 text-[#d4d4d8]">
                              {c.passed ? (
                                <svg
                                  className="w-3.5 h-3.5 text-emerald-400"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                  strokeWidth={2.5}
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M4.5 12.75l6 6 9-13.5"
                                  />
                                </svg>
                              ) : (
                                <svg
                                  className="w-3.5 h-3.5 text-amber-400"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                  strokeWidth={2}
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
                                  />
                                </svg>
                              )}
                              <span>{c.label}</span>
                            </span>
                            <span
                              className={`font-mono text-[10px] ${c.passed ? 'text-emerald-400' : 'text-[#71717a]'}`}
                            >
                              +{c.weight}%
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </form>
          )}

          {/* ──────────────────────────────────────────────────────────────── */}
          {/* TAB 3: Remote Git / File Dropzone                                 */}
          {/* ──────────────────────────────────────────────────────────────── */}
          {activeTab === 'import' && (
            <div className="space-y-4 text-xs font-sans">
              <div>
                <h3 className="text-sm font-semibold text-white mb-1">
                  Drag &amp; Drop SKILL.md or Specification File
                </h3>
                <p className="text-[11px] text-[#a1a1aa] mb-2.5">
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
                  className={`border-2 border-dashed rounded-xl p-5 text-center transition-all cursor-pointer ${
                    dragOver
                      ? 'border-primary bg-primary/10'
                      : 'border-[#292c3a] bg-[#11131b] hover:border-[#383b4e] hover:bg-[#141622]'
                  }`}
                >
                  <div className="w-8 h-8 mx-auto mb-1.5 rounded-lg bg-[#181a24] border border-[#262838] flex items-center justify-center text-primary">
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
                      />
                    </svg>
                  </div>
                  <p className="text-xs font-semibold text-white">Drop your capability file here</p>
                  <p className="text-[10px] text-[#71717a] mt-0.5">
                    or click to browse local files
                  </p>
                  <input
                    type="file"
                    accept=".md,.markdown,.json,.yaml,.yml"
                    onChange={handleFileInputChange}
                    className="hidden"
                    id="capability-file-input"
                  />
                  <label
                    htmlFor="capability-file-input"
                    className="inline-block mt-2 px-3 py-1 rounded-md bg-[#1b1e2a] hover:bg-[#252838] text-xs font-medium text-white border border-[#2d3144] cursor-pointer transition-colors"
                  >
                    Browse Files
                  </label>
                </div>
              </div>

              {/* Git / Remote URL Fetcher */}
              <div className="pt-3 border-t border-[#1c1e28]">
                <h4 className="text-xs font-semibold text-white mb-1">
                  Import Capability from Git / URL
                </h4>
                <p className="text-[11px] text-[#a1a1aa] mb-2.5">
                  Clone a public GitHub skill directory, raw SKILL.md link, or remote MCP server
                  endpoint.
                </p>

                <form onSubmit={handleImportSubmit} className="space-y-3">
                  <div>
                    <label
                      htmlFor="import-url-input"
                      className="block text-[#a1a1aa] font-medium mb-1"
                    >
                      Repository URL / Endpoint *
                    </label>
                    <input
                      id="import-url-input"
                      type="text"
                      required
                      value={importUrl}
                      onChange={(e) => setImportUrl(e.target.value)}
                      placeholder="https://github.com/vaeloom/skills-community/tree/main/rag-eval"
                      className="w-full px-3 py-2 rounded-lg bg-[#12141c] border border-[#232636] text-white focus:outline-none focus:border-primary text-xs font-mono"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label
                        htmlFor="import-cat-select"
                        className="block text-[#a1a1aa] font-medium mb-1"
                      >
                        Target Category
                      </label>
                      <select
                        id="import-cat-select"
                        value={importCategory}
                        onChange={(e) => setImportCategory(e.target.value as CapabilityCategory)}
                        className="w-full px-3 py-2 rounded-lg bg-[#12141c] border border-[#232636] text-white focus:outline-none focus:border-primary text-xs"
                      >
                        <option value="skills">Skills</option>
                        <option value="plugins">Plugins</option>
                        <option value="agents">Agents</option>
                        <option value="mcp">MCP Connector</option>
                        <option value="tools">Tools</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2">
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

        {/* ── 3. Sticky Bottom Footer (ALWAYS 100% VISIBLE & PINNED) ─────────── */}
        <footer className="px-5 py-3 border-t border-[#1c1e28] bg-[#0c0d12] flex items-center justify-between gap-3 shrink-0 z-20 font-sans">
          <div className="flex items-center gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <span className="text-[11px] text-[#71717a] hidden sm:inline-block">
              Press{' '}
              <kbd className="px-1 py-0.5 rounded bg-[#171822] text-[#93c5fd] font-mono text-[10px]">
                Esc
              </kbd>{' '}
              to exit •{' '}
              <kbd className="px-1 py-0.5 rounded bg-[#171822] text-[#93c5fd] font-mono text-[10px]">
                Ctrl+Enter
              </kbd>{' '}
              to save
            </span>
          </div>

          <div className="flex items-center gap-2">
            {activeTab !== 'import' && (
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => handleFinalSubmit()}
                className="inline-flex items-center gap-1.5 font-medium shadow-sm"
              >
                <span>Create Capability</span>
              </Button>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}
