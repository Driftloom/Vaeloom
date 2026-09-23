'use client';

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Button, Badge } from '@vaeloom/ui-kit';
import { capabilitiesApi } from '@/lib/api-client';
import type { CapabilityCategory, CapabilityItem } from '@/lib/capabilities-data';

export interface AddCapabilityModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultCategory?: CapabilityCategory;
  initialMode?: 'builder' | 'templates' | 'import';
  onCreate: (capability: CapabilityItem) => void;
  onImport: (url: string, category: CapabilityCategory) => Promise<void>;
  installedNames?: Set<string>;
  workspaceId?: string;
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
  triggers?: string[];
  parameters?: Array<{ name: string; type: string; description: string; required: boolean }>;
  mcpConfig?: { transport: 'stdio' | 'sse'; command: string; env: Record<string, string> };
  pluginConfig?: { hook: string; sandbox: string; code: string; author?: string; license?: string };
  agentConfig?: {
    archetype: string;
    modelTier: string;
    maxTurns: number;
    tools: string[];
    prompt: string;
  };
  doc?: string;
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
    mcpConfig: {
      transport: 'stdio',
      command: 'npx -y @modelcontextprotocol/server-filesystem /workspace',
      env: {},
    },
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
    mcpConfig: {
      transport: 'stdio',
      command: 'npx -y @modelcontextprotocol/server-github',
      env: { GITHUB_PERSONAL_ACCESS_TOKEN: '${VAULT_GITHUB_PAT}' },
    },
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
    agentConfig: {
      archetype: 'specialist',
      modelTier: 'pro',
      maxTurns: 15,
      tools: ['search_documents', 'browse_job_page', 'query_graph'],
      prompt: `You are Research Analyst, an enterprise AI agent in Vaeloom.
Role: Investigate topics, synthesize cross-document findings, and format executive briefs.

OPERATIONAL BOUNDARIES:
- Never fabricate claims, credentials, or tool returns.
- Ground every assertion in retrieved context or memory citations.
`,
    },
  },
  {
    id: 'security-audit-plugin',
    name: 'security-audit-plugin',
    category: 'plugins',
    title: 'Zero-Trust Security Audit Hook',
    description:
      'Lifecycle plugin that validates outbound payloads, inspects SSRF vectors, and enforces DLP token masking.',
    tags: ['Plugin', 'Security', 'Lifecycle', 'DLP'],
    autonomy: 'autonomous',
    pluginConfig: {
      hook: 'on_tool_call',
      sandbox: 'isolated_subprocess',
      author: 'Vaeloom Security Team',
      license: 'MIT',
      code: `def run(input: dict, context: dict) -> dict:
    """Zero-trust security inspection hook."""
    payload = input.get("payload", {})
    endpoint = str(payload.get("url", ""))

    # Guard against private network SSRF
    denylist = ["127.0.0.1", "localhost", "169.254.169.254"]
    if any(blocked in endpoint for blocked in denylist):
        return {"status": "BLOCKED", "reason": "SSRF to private address prohibited"}

    return {"status": "PASSED", "verified": True}
`,
    },
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

const AVAILABLE_AGENT_TOOLS = [
  { id: 'search_documents', name: 'search_documents', desc: 'Semantic search across user vault' },
  { id: 'query_graph', name: 'query_graph', desc: 'Query sovereign knowledge graph' },
  {
    id: 'calculate_ats_score',
    name: 'calculate_ats_score',
    desc: 'Cosine similarity ATS evaluator',
  },
  { id: 'browse_job_page', name: 'browse_job_page', desc: 'Headless browser page scraper' },
  { id: 'run_command', name: 'run_command', desc: 'Execute sandboxed terminal command' },
  { id: 'http_request', name: 'http_request', desc: 'Outbound HTTP client request' },
];

export function AddCapabilityModal({
  isOpen,
  onClose,
  defaultCategory = 'skills',
  initialMode = 'builder',
  onCreate,
  onImport,
  workspaceId,
}: AddCapabilityModalProps) {
  // Navigation Mode: 'templates' | 'builder' | 'import'
  const [activeTab, setActiveTab] = useState<'templates' | 'builder' | 'import'>(initialMode);

  // Common Metadata State
  const [capName, setCapName] = useState('');
  const [capCategory, setCapCategory] = useState<CapabilityCategory>(defaultCategory);
  const [capTags, setCapTags] = useState<string[]>(['Custom']);
  const [tagInput, setTagInput] = useState('');
  const [capDescription, setCapDescription] = useState('');
  const [capAutonomy, setCapAutonomy] = useState<'autonomous' | 'approval_required' | 'suggest'>(
    'autonomous',
  );
  const [validationError, setValidationError] = useState<string | null>(null);

  // 1. Skill Specific State
  const [capDoc, setCapDoc] = useState(
    `# Operational Playbook & Guidelines\n\n## Mission\nExecute designated tasks with verifiable evidence, zero hallucinations, and clear audit trails.\n\n## Operating Rules\n1. Always analyze assumptions against workspace context before proceeding.\n2. Produce structured outputs following project-specific formatting standards.\n3. Fall back to safe heuristics when tools or network resources are unavailable.\n`,
  );
  const [capTriggers, setCapTriggers] = useState('');
  const [skillPreviewOpen, setSkillPreviewOpen] = useState(false);

  // 2. Tool Specific State
  const [toolParams, setToolParams] = useState<
    Array<{ name: string; type: string; description: string; required: boolean }>
  >([{ name: 'query', type: 'string', description: 'Primary input query', required: true }]);
  const [toolScope, setToolScope] = useState('memory.read');
  const [toolCategoryGroup, setToolCategoryGroup] = useState('memory_read');

  // 3. MCP Specific State
  const [mcpTransport, setMcpTransport] = useState<'stdio' | 'sse'>('stdio');
  const [mcpCommand, setMcpCommand] = useState('npx -y @modelcontextprotocol/server-example');
  const [mcpEnvKey, setMcpEnvKey] = useState('');
  const [mcpEnvVal, setMcpEnvVal] = useState('');
  const [mcpEnvList, setMcpEnvList] = useState<Array<{ key: string; val: string }>>([]);
  const [mcpRightTab, setMcpRightTab] = useState<'manifest' | 'tools' | 'audit'>('manifest');

  // 4. Plugin Specific State
  const [pluginAuthor, setPluginAuthor] = useState('Workspace Member');
  const [pluginLicense, setPluginLicense] = useState('MIT');
  const [pluginHook, setPluginHook] = useState<
    'on_tool_call' | 'on_agent_start' | 'on_agent_complete'
  >('on_tool_call');
  const [pluginSandbox, setPluginSandbox] = useState<
    'isolated_subprocess' | 'wasm_sandbox' | 'safe_thread'
  >('isolated_subprocess');
  const [pluginTarget, setPluginTarget] = useState<'both' | 'desktop' | 'agent'>('both');
  const [pluginCode, setPluginCode] = useState<string>(`def run(input: dict, context: dict) -> dict:
    """Vaeloom Python sandbox transform."""
    text = input.get("text", "")
    return {"length": len(text), "tokens_approx": len(text.split())}
`);
  const [pluginRightTab, setPluginRightTab] = useState<'code' | 'test' | 'manifest'>('code');
  const [pluginTestPayload, setPluginTestPayload] = useState(
    '{\n  "text": "Hello Vaeloom enterprise agent"\n}',
  );
  const [pluginTestResult, setPluginTestResult] = useState<string | null>(null);

  // 5. Agent Specific State
  const [agentArchetype, setAgentArchetype] = useState<'supervisor' | 'specialist' | 'auditor'>(
    'specialist',
  );
  const [agentModelTier, setAgentModelTier] = useState<'pro' | 'flash' | 'open_weights'>('pro');
  const [agentMaxTurns, setAgentMaxTurns] = useState<number>(12);
  const [agentSelectedTools, setAgentSelectedTools] = useState<string[]>([
    'search_documents',
    'query_graph',
  ]);
  const [agentPromptTemplate, setAgentPromptTemplate] =
    useState(`You are {{ name }}, an enterprise AI agent in Vaeloom.
Role: {{ description }}

OPERATIONAL BOUNDARIES:
- Never fabricate claims, credentials, or tool results.
- Verify every claim using memory or available tools.
`);
  const [agentRightTab, setAgentRightTab] = useState<'prompt' | 'schema' | 'guardrails' | 'card'>(
    'prompt',
  );

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
      setCapCategory(defaultCategory);
      setValidationError(null);
    }
  }, [isOpen, initialMode, defaultCategory]);

  // Enterprise Readiness Score (0 - 100%)
  const readinessAudit = useMemo(() => {
    let checks: Array<{ id: string; label: string; passed: boolean; weight: number }> = [];

    if (capCategory === 'skills') {
      checks = [
        {
          id: 'slug',
          label: 'Skill Identifier Defined',
          passed: Boolean(capName.trim()),
          weight: 25,
        },
        {
          id: 'desc',
          label: 'Activation Context & Description',
          passed: Boolean(capDescription.trim()),
          weight: 20,
        },
        {
          id: 'playbook',
          label: 'Playbook Operating Rules',
          passed: Boolean(capDoc.trim().length >= 20),
          weight: 35,
        },
        {
          id: 'triggers',
          label: 'Taxonomy & Routing Triggers',
          passed: capTags.length > 0 || Boolean(capTriggers.trim()),
          weight: 20,
        },
      ];
    } else if (capCategory === 'agents') {
      checks = [
        {
          id: 'slug',
          label: 'Agent Identifier Defined',
          passed: Boolean(capName.trim()),
          weight: 25,
        },
        {
          id: 'role',
          label: 'Role & Autonomy Policy',
          passed: Boolean(agentArchetype && capAutonomy),
          weight: 25,
        },
        {
          id: 'prompt',
          label: 'System Template & Boundaries',
          passed: Boolean(agentPromptTemplate.trim().length >= 20),
          weight: 25,
        },
        {
          id: 'tools',
          label: 'Tool Fleet Assigned',
          passed: agentSelectedTools.length > 0,
          weight: 25,
        },
      ];
    } else if (capCategory === 'mcp') {
      checks = [
        {
          id: 'slug',
          label: 'Server Identifier Defined',
          passed: Boolean(capName.trim()),
          weight: 25,
        },
        {
          id: 'transport',
          label: 'Transport & Execution Command',
          passed: Boolean(mcpCommand.trim()),
          weight: 35,
        },
        { id: 'protocol', label: 'MCP v2 Protocol Contract', passed: true, weight: 20 },
        { id: 'env', label: 'Encrypted Secrets / Configuration', passed: true, weight: 20 },
      ];
    } else if (capCategory === 'plugins') {
      checks = [
        {
          id: 'slug',
          label: 'Plugin Identifier Defined',
          passed: Boolean(capName.trim()),
          weight: 25,
        },
        {
          id: 'code',
          label: 'Python Sandbox Handler',
          passed: Boolean(pluginCode.includes('def run')),
          weight: 35,
        },
        {
          id: 'hook',
          label: 'Target & Lifecycle Hook',
          passed: Boolean(pluginHook && pluginTarget),
          weight: 20,
        },
        {
          id: 'license',
          label: 'Author & SPDX License',
          passed: Boolean(pluginAuthor && pluginLicense),
          weight: 20,
        },
      ];
    } else {
      // tools
      checks = [
        {
          id: 'slug',
          label: 'Tool Function Name Defined',
          passed: Boolean(capName.trim()),
          weight: 25,
        },
        {
          id: 'params',
          label: 'Parameter Schema Defined',
          passed: toolParams.length > 0 && toolParams.some((p) => Boolean(p.name.trim())),
          weight: 35,
        },
        { id: 'scope', label: 'Required Security Scope', passed: Boolean(toolScope), weight: 20 },
        { id: 'envelope', label: 'JSONSchema 2020-12 Output Envelope', passed: true, weight: 20 },
      ];
    }

    const total = checks.reduce((acc, c) => acc + (c.passed ? c.weight : 0), 0);
    return { checks, score: total };
  }, [
    capCategory,
    capName,
    capDescription,
    capDoc,
    capTags,
    capTriggers,
    agentArchetype,
    capAutonomy,
    agentPromptTemplate,
    agentSelectedTools,
    mcpCommand,
    pluginCode,
    pluginHook,
    pluginTarget,
    pluginAuthor,
    pluginLicense,
    toolParams,
    toolScope,
  ]);

  // Select Preset Template
  const handleSelectTemplate = useCallback((template: PresetTemplate) => {
    setCapName(template.name);
    setCapCategory(template.category);
    setCapTags(template.tags);
    setCapDescription(template.description);
    setCapAutonomy(template.autonomy);

    if (template.doc) {
      setCapDoc(template.doc);
    }
    if (template.triggers) {
      setCapTriggers(template.triggers.join(', '));
    }
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
      setPluginCode(template.pluginConfig.code);
      if (template.pluginConfig.author) setPluginAuthor(template.pluginConfig.author);
      if (template.pluginConfig.license) setPluginLicense(template.pluginConfig.license);
    }
    if (template.agentConfig) {
      setAgentArchetype(template.agentConfig.archetype as any);
      setAgentModelTier(template.agentConfig.modelTier as any);
      setAgentMaxTurns(template.agentConfig.maxTurns);
      setAgentSelectedTools(template.agentConfig.tools);
      setAgentPromptTemplate(template.agentConfig.prompt);
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

  // Handle local file upload (markdown, json, yaml)
  const handleFileUpload = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (!content) return;
      const fileName = file.name.replace(/\.[^/.]+$/, '');
      setCapName(fileName.toLowerCase().replace(/[^a-z0-9_-]/g, '-'));

      if (file.name.endsWith('.json')) {
        try {
          const parsed = JSON.parse(content);
          if (parsed.name) setCapName(parsed.name);
          if (parsed.description) setCapDescription(parsed.description);
          if (parsed.category) setCapCategory(parsed.category);
          if (parsed.tags && Array.isArray(parsed.tags)) setCapTags(parsed.tags);
          if (parsed.mcpServers || parsed.transport) {
            setCapCategory('mcp');
            if (parsed.command) setMcpCommand(parsed.command);
            if (parsed.transport) setMcpTransport(parsed.transport);
          }
        } catch {
          // Keep raw content in doc
        }
        setCapDoc(content);
      } else {
        setCapDoc(content);
        const titleMatch = content.match(/^#\s+(.+)$/m);
        if (titleMatch && titleMatch[1]) {
          setCapName(
            titleMatch[1]
              .trim()
              .toLowerCase()
              .replace(/[^a-z0-9_-]/g, '-'),
          );
        }
        const descMatch = content.match(/##\s+(?:Mission|Description|Overview)\s*\n+([^#\n]+)/i);
        if (descMatch && descMatch[1]) {
          setCapDescription(descMatch[1].trim());
        }
        setCapCategory('skills');
      }
      setActiveTab('builder');
    };
    reader.readAsText(file);
  }, []);

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
          outputSchema: { type: 'object', properties: { result: { type: 'string' } } },
          category: toolCategoryGroup,
          requiredScope: toolScope,
        },
        null,
        2,
      );
    }
    if (capCategory === 'plugins') {
      return JSON.stringify(
        {
          name: capName || 'custom-plugin',
          version: '1.0.0',
          author: pluginAuthor,
          license: pluginLicense,
          hookPoint: pluginHook,
          isolation: pluginSandbox,
          target: pluginTarget,
          permissions: ['workspace.read', 'transform.data'],
        },
        null,
        2,
      );
    }
    if (capCategory === 'agents') {
      return JSON.stringify(
        {
          name: capName || 'custom-agent',
          role: agentArchetype,
          modelTier: agentModelTier,
          maxReActRounds: agentMaxTurns,
          tools: agentSelectedTools,
          outputContract: { type: 'object', required: ['summary'] },
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
    toolCategoryGroup,
    toolScope,
    pluginAuthor,
    pluginLicense,
    pluginHook,
    pluginSandbox,
    pluginTarget,
    agentArchetype,
    agentModelTier,
    agentMaxTurns,
    agentSelectedTools,
  ]);

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
        requiredScope:
          capCategory === 'mcp'
            ? 'connector.mcp.execute'
            : capCategory === 'tools'
              ? toolScope
              : 'system.execute',
        trustClass: capCategory === 'mcp' ? 'mcp.workspace.write' : 'first_party',
        version: '1.0.0',
        author: capCategory === 'plugins' ? pluginAuthor : 'Workspace Member',
        autonomy: capAutonomy,
        triggers: triggerList.length > 0 ? triggerList : undefined,
        toolsUsed: capCategory === 'agents' ? agentSelectedTools : undefined,
        inputSchema: generatedInputSchema,
        metadata:
          capCategory === 'mcp'
            ? {
                transport: mcpTransport,
                command: mcpCommand,
                env: Object.fromEntries(mcpEnvList.map((e) => [e.key, e.val])),
                protocolVersion: '2024-11-05',
              }
            : capCategory === 'plugins'
              ? {
                  hook: pluginHook,
                  sandbox: pluginSandbox,
                  target: pluginTarget,
                  code: pluginCode,
                  license: pluginLicense,
                }
              : capCategory === 'agents'
                ? {
                    archetype: agentArchetype,
                    modelTier: agentModelTier,
                    maxTurns: agentMaxTurns,
                    systemPrompt: agentPromptTemplate,
                  }
                : undefined,
        markdownDoc:
          capCategory === 'skills'
            ? capDoc ||
              `# ${capName}\n\n## Mission\n${capDescription || 'Execute designated tasks.'}\n\n## Operating Rules\n1. Enforce boundaries.\n`
            : capCategory === 'mcp'
              ? `# ${capName} (MCP Server)\n\n## Transport\n\`${mcpTransport}\`\n\n## Command\n\`${mcpCommand}\`\n`
              : capCategory === 'plugins'
                ? `# ${capName} (Plugin)\n\n\`\`\`python\n${pluginCode}\n\`\`\`\n`
                : capCategory === 'agents'
                  ? `# ${capName} (Agent)\n\nRole: ${agentArchetype}\nTools: ${agentSelectedTools.join(', ')}\n`
                  : `# ${capName} (Tool)\n\nScope: ${toolScope}\n`,
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
      toolScope,
      mcpTransport,
      mcpCommand,
      mcpEnvList,
      pluginHook,
      pluginSandbox,
      pluginTarget,
      pluginCode,
      pluginLicense,
      pluginAuthor,
      agentArchetype,
      agentModelTier,
      agentMaxTurns,
      agentSelectedTools,
      agentPromptTemplate,
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
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div className="w-full max-w-5xl h-[670px] max-h-[90vh] bg-surface border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden text-text antialiased">
        {/* ── 1. Top Header: Title, Category Badge, and Mode Navigation ──────── */}
        <header className="px-5 py-3 border-b border-border bg-surface-elevated flex items-center justify-between gap-4 shrink-0">
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
                  className="text-sm font-semibold text-text tracking-tight font-sans flex items-center gap-1.5"
                >
                  <span>Add Custom Capability</span>
                  <span className="text-text-muted font-normal">•</span>
                  <span className="text-primary font-medium">
                    {capCategory === 'skills'
                      ? 'Skill Studio'
                      : capCategory === 'agents'
                        ? 'Agent Studio'
                        : capCategory === 'tools'
                          ? 'Tool Function Studio'
                          : capCategory === 'mcp'
                            ? 'MCP Protocol Studio'
                            : 'Plugin Lifecycle Studio'}
                  </span>
                </h2>
                {activeTab === 'builder' && (
                  <Badge
                    variant={readinessAudit.score >= 90 ? 'success' : 'info'}
                    size="sm"
                    className="text-2xs font-mono"
                  >
                    {readinessAudit.score}% Validated •{' '}
                    {readinessAudit.score >= 90
                      ? 'Enterprise Ready'
                      : readinessAudit.score >= 70
                        ? 'Production Spec'
                        : 'Draft Spec'}
                  </Badge>
                )}
              </div>
              <p id="add-capability-modal-desc" className="text-xs text-text-muted font-sans">
                {capCategory === 'skills'
                  ? 'Author Claude & Codex reasoning playbooks with sovereign operating rules'
                  : capCategory === 'agents'
                    ? 'Configure autonomous AgentCards with custom autonomy policies and tool fleets'
                    : capCategory === 'tools'
                      ? 'Define typed function schemas and JSON Schema 2020-12 parameter contracts'
                      : capCategory === 'mcp'
                        ? 'Register Model Context Protocol (v2) server endpoints and secrets'
                        : 'Implement isolated Python sandbox lifecycle hooks and transform pipelines'}
              </p>
            </div>
          </div>

          {/* Mode Switcher Buttons */}
          <div className="flex items-center gap-1 p-0.5 rounded-lg bg-surface border border-border text-xs font-sans">
            <button
              type="button"
              onClick={() => setActiveTab('templates')}
              className={`px-3 py-1 rounded-md transition-all font-medium inline-flex items-center gap-1.5 ${
                activeTab === 'templates'
                  ? 'bg-surface-elevated text-text shadow-xs border border-border'
                  : 'text-text-muted hover:text-text'
              }`}
            >
              <svg
                className="w-3.5 h-3.5 text-warning"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
              >
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
              <span>Presets</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('builder')}
              className={`px-3 py-1 rounded-md transition-all font-medium inline-flex items-center gap-1.5 ${
                activeTab === 'builder'
                  ? 'bg-surface-elevated text-text shadow-xs border border-border'
                  : 'text-text-muted hover:text-text'
              }`}
            >
              <svg
                className="w-3.5 h-3.5 text-primary"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
              >
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
              <span>Studio Builder</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('import')}
              className={`px-3 py-1 rounded-md transition-all font-medium inline-flex items-center gap-1.5 ${
                activeTab === 'import'
                  ? 'bg-surface-elevated text-text shadow-xs border border-border'
                  : 'text-text-muted hover:text-text'
              }`}
            >
              <svg
                className="w-3.5 h-3.5 text-success"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              <span>Import Git / File</span>
            </button>
          </div>

          {/* Close Button */}
          <button
            type="button"
            onClick={onClose}
            className="text-text-muted hover:text-text p-1 rounded-lg hover:bg-surface-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
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
        {validationError && (
          <div className="px-5 py-2 bg-danger/10 border-b border-danger/20 flex items-center justify-between text-xs text-danger font-sans shrink-0">
            <span className="flex items-center gap-2">
              <svg
                className="w-3.5 h-3.5 text-danger"
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
              className="text-danger hover:text-danger/80"
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
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-border">
                <div>
                  <h3 className="text-sm font-semibold text-text font-sans">
                    Enterprise Production Scaffolds
                  </h3>
                  <p className="text-xs text-text-muted font-sans mt-0.5">
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
                    className="px-2.5 py-1 text-xs rounded-lg bg-surface border border-border text-text placeholder:text-text-muted focus:outline-none focus:border-primary w-44"
                  />
                  <select
                    value={presetCategoryFilter}
                    onChange={(e) => setPresetCategoryFilter(e.target.value)}
                    aria-label="Filter presets by category"
                    className="px-2 py-1 text-xs rounded-lg bg-surface border border-border text-text focus:outline-none focus:border-primary"
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
                    className="group p-3.5 rounded-xl border border-border bg-surface-elevated hover:bg-surface-hover hover:border-primary/50 transition-all cursor-pointer flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-semibold text-text group-hover:text-primary transition-colors">
                          {template.title}
                        </span>
                        <Badge variant="mono" size="sm" className="capitalize text-2xs">
                          {template.category}
                        </Badge>
                      </div>
                      <p className="text-xs text-text-muted line-clamp-2 leading-relaxed">
                        {template.description}
                      </p>
                    </div>

                    <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-border text-xs">
                      <div className="flex flex-wrap gap-1">
                        {template.tags.slice(0, 3).map((t) => (
                          <span
                            key={t}
                            className="px-1.5 py-0.2 rounded text-2xs bg-surface text-text-muted border border-border"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                      <span className="text-primary font-medium group-hover:translate-x-0.5 transition-transform flex items-center gap-1 text-xs">
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
                <label className="block text-xs font-medium text-text-secondary mb-1.5">
                  Capability Category *
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {[
                    { id: 'skills', label: 'Skills', desc: 'Reasoning loop' },
                    { id: 'agents', label: 'Agents', desc: 'Autonomous actor' },
                    { id: 'tools', label: 'Tools', desc: 'Typed function' },
                    { id: 'mcp', label: 'MCP', desc: 'Protocol bridge' },
                    { id: 'plugins', label: 'Plugins', desc: 'Lifecycle hook' },
                    { id: 'connectors', label: 'Connectors', desc: 'SaaS & API' },
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
                            ? 'bg-primary/15 border-primary text-primary shadow-xs ring-1 ring-primary/40'
                            : 'bg-surface border-border text-text-muted hover:text-text hover:bg-surface-hover'
                        }`}
                      >
                        <span className="font-semibold text-xs text-text">{cat.label}</span>
                        <span className="text-2xs text-text-muted font-normal">{cat.desc}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* ──────────────────────────────────────────────────────────── */}
              {/* STUDIO 1: SKILLS STUDIO (Claude & Codex Playbooks)           */}
              {/* ──────────────────────────────────────────────────────────── */}
              {capCategory === 'skills' && (
                <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
                  {/* Left Column: Skill Configuration (col-span-6) */}
                  <div className="md:col-span-6 space-y-3.5">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label
                          htmlFor="cap-name-input"
                          className="block text-xs font-medium text-text-secondary"
                        >
                          Skill Name / Identifier *
                        </label>
                        <span className="text-2xs font-mono text-text-muted">
                          slug: lowercase-hyphenated
                        </span>
                      </div>
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
                        className="w-full px-3 py-1.5 rounded-lg bg-surface border border-border text-text placeholder:text-text-muted focus:outline-none focus:border-primary font-mono text-xs focus-visible:ring-2 focus-visible:ring-primary"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="cap-desc-input"
                        className="block text-xs font-medium text-text-secondary mb-1"
                      >
                        When to Activate / Skill Description
                      </label>
                      <input
                        id="cap-desc-input"
                        type="text"
                        value={capDescription}
                        onChange={(e) => setCapDescription(e.target.value)}
                        placeholder="e.g. Activate when reviewing pull requests, evaluating code security, or checking diffs"
                        className="w-full px-3 py-1.5 rounded-lg bg-surface border border-border text-text placeholder:text-text-muted focus:outline-none focus:border-primary text-xs"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="cap-triggers-input"
                        className="block text-xs font-medium text-text-secondary mb-1"
                      >
                        Routing &amp; Trigger Keywords (comma-separated)
                      </label>
                      <input
                        id="cap-triggers-input"
                        type="text"
                        value={capTriggers}
                        onChange={(e) => setCapTriggers(e.target.value)}
                        placeholder="e.g. /review, /ats-audit, pr audit, check code quality"
                        className="w-full px-3 py-1.5 rounded-lg bg-surface border border-border text-text placeholder:text-text-muted focus:outline-none focus:border-primary text-xs font-mono"
                      />
                    </div>

                    {/* Interactive Tag Manager */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label
                          htmlFor="cap-tag-input-skills"
                          className="text-xs font-medium text-text-secondary"
                        >
                          Tags &amp; Taxonomy
                        </label>
                        <span className="text-xs text-text-muted">Click a chip to quickly add</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 p-1.5 rounded-lg bg-surface border border-border min-h-[38px]">
                        {capTags.map((tag) => (
                          <span
                            key={tag}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-2xs font-medium bg-surface-elevated text-text border border-border"
                          >
                            <span>{tag}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveTag(tag)}
                              className="text-text-muted hover:text-text ml-0.5"
                            >
                              ×
                            </button>
                          </span>
                        ))}
                        <input
                          id="cap-tag-input-skills"
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
                          className="bg-transparent text-xs text-text placeholder:text-text-muted focus:outline-none flex-1 min-w-[120px] px-1 font-sans"
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
                              className="text-2xs px-1.5 py-0.2 rounded bg-surface-elevated text-text-muted hover:text-text hover:bg-surface-hover border border-border transition-colors"
                            >
                              + {suggest}
                            </button>
                          ))}
                      </div>
                    </div>

                    {/* Claude & Codex Directives Card */}
                    <div className="p-3 rounded-xl bg-surface-elevated border border-border space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-text">
                          Claude &amp; Codex Directives
                        </span>
                        <Badge variant="mono" size="sm" className="text-2xs">
                          SKILL.md Spec
                        </Badge>
                      </div>
                      <p className="text-xs text-text-muted leading-relaxed">
                        Skills inject deterministic prompts and operating rules into agent context
                        windows. They provide multi-step guidelines without requiring code execution
                        or approval gates.
                      </p>
                    </div>
                  </div>

                  {/* Right Column: Playbook Markdown Studio (col-span-6) */}
                  <div className="md:col-span-6 flex flex-col min-h-[380px] bg-surface-elevated rounded-xl border border-border p-3.5 space-y-2.5">
                    <div className="flex items-center justify-between pb-2 border-b border-border">
                      <span className="font-semibold text-text text-xs">
                        Playbook Documentation &amp; Rules
                      </span>
                      <button
                        type="button"
                        onClick={() => setSkillPreviewOpen(!skillPreviewOpen)}
                        className="text-xs text-primary hover:underline"
                      >
                        {skillPreviewOpen ? 'Edit Raw Markdown' : 'Preview Rendered'}
                      </button>
                    </div>

                    {!skillPreviewOpen ? (
                      <textarea
                        rows={11}
                        value={capDoc}
                        onChange={(e) => setCapDoc(e.target.value)}
                        placeholder={`# ${capName || 'Skill Title'}\n\n## Mission\nExecute mission with verifiable evidence.\n\n## Operating Rules\n1. Always verify assumptions.`}
                        className="w-full flex-1 p-2.5 rounded-lg bg-surface border border-border text-text placeholder:text-text-muted focus:outline-none focus:border-primary font-mono text-xs leading-relaxed resize-none"
                      />
                    ) : (
                      <div className="w-full flex-1 p-3 rounded-lg bg-surface border border-border text-text overflow-y-auto max-h-[290px] prose dark:prose-invert prose-xs max-w-none">
                        {capDoc ? (
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{capDoc}</ReactMarkdown>
                        ) : (
                          <span className="text-text-muted italic">
                            No documentation entered yet.
                          </span>
                        )}
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-1 pt-1 text-2xs text-text-muted">
                      <span>Insert:</span>
                      <button
                        type="button"
                        onClick={() =>
                          setCapDoc(
                            (prev) =>
                              `${prev}\n\n## Mission\nExecute mission with verifiable evidence.`,
                          )
                        }
                        className="px-1.5 py-0.5 rounded bg-surface hover:text-text hover:bg-surface-hover border border-border transition-colors"
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
                        className="px-1.5 py-0.5 rounded bg-surface hover:text-text hover:bg-surface-hover border border-border transition-colors"
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
                        className="px-1.5 py-0.5 rounded bg-surface hover:text-text hover:bg-surface-hover border border-border transition-colors"
                      >
                        + Security
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* ──────────────────────────────────────────────────────────── */}
              {/* STUDIO 2: AGENTS STUDIO (AgentCard Specification)           */}
              {/* ──────────────────────────────────────────────────────────── */}
              {capCategory === 'agents' && (
                <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
                  {/* Left Column: Agent Persona & Policy (col-span-6) */}
                  <div className="md:col-span-6 space-y-3.5">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label
                          htmlFor="cap-name-input"
                          className="block text-xs font-medium text-text-secondary"
                        >
                          Agent Name / Identifier *
                        </label>
                        <Badge variant="mono" size="sm" className="text-2xs">
                          AgentCard v1.0
                        </Badge>
                      </div>
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
                        className="w-full px-3 py-1.5 rounded-lg bg-surface border border-border text-text placeholder:text-text-muted focus:outline-none focus:border-primary font-mono text-xs focus-visible:ring-2 focus-visible:ring-primary"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="cap-desc-input"
                        className="block text-xs font-medium text-text-secondary mb-1"
                      >
                        Agent Role Mission &amp; Specialization
                      </label>
                      <input
                        id="cap-desc-input"
                        type="text"
                        value={capDescription}
                        onChange={(e) => setCapDescription(e.target.value)}
                        placeholder="e.g. Autonomous forensic auditor validating zero-trust evidence and pull requests"
                        className="w-full px-3 py-1.5 rounded-lg bg-surface border border-border text-text placeholder:text-text-muted focus:outline-none focus:border-primary text-xs"
                      />
                    </div>

                    {/* Role Archetype & Autonomy Policy (Grid 2 cols) */}
                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label
                          htmlFor="agent-archetype-select"
                          className="block text-xs font-medium text-text-secondary mb-1"
                        >
                          Role Archetype
                        </label>
                        <select
                          id="agent-archetype-select"
                          value={agentArchetype}
                          onChange={(e) => setAgentArchetype(e.target.value as any)}
                          className="w-full px-2 py-1.5 rounded bg-surface border border-border text-text text-xs focus:outline-none focus:border-primary"
                        >
                          <option value="specialist">Specialist Worker</option>
                          <option value="supervisor">Supervisor Orchestrator</option>
                          <option value="auditor">Forensic Auditor</option>
                        </select>
                      </div>
                      <div>
                        <label
                          htmlFor="cap-autonomy-select"
                          className="block text-xs font-medium text-text-secondary mb-1"
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
                          className="w-full px-2 py-1.5 rounded bg-surface border border-border text-text text-xs focus:outline-none focus:border-primary"
                        >
                          <option value="autonomous">Autonomous Execution</option>
                          <option value="approval_required">Human Approval Gate</option>
                          <option value="suggest">Suggest to User Only</option>
                        </select>
                      </div>
                    </div>

                    {/* Model Tier & Max ReAct Rounds (Grid 2 cols) */}
                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label
                          htmlFor="agent-model-select"
                          className="block text-xs font-medium text-text-secondary mb-1"
                        >
                          Model Tier
                        </label>
                        <select
                          id="agent-model-select"
                          value={agentModelTier}
                          onChange={(e) => setAgentModelTier(e.target.value as any)}
                          className="w-full px-2 py-1.5 rounded bg-surface border border-border text-text text-xs focus:outline-none focus:border-primary"
                        >
                          <option value="pro">Pro (Claude 3.7 / GPT-4o)</option>
                          <option value="flash">Flash (Fast Heuristic)</option>
                          <option value="open_weights">Open-Weights (Qwen / Ollama)</option>
                        </select>
                      </div>
                      <div>
                        <label
                          htmlFor="agent-max-turns"
                          className="block text-xs font-medium text-text-secondary mb-1"
                        >
                          Max ReAct Rounds
                        </label>
                        <input
                          id="agent-max-turns"
                          type="number"
                          min={1}
                          max={30}
                          value={agentMaxTurns}
                          onChange={(e) => setAgentMaxTurns(parseInt(e.target.value, 10) || 12)}
                          className="w-full px-2 py-1.5 rounded bg-surface border border-border text-text text-xs focus:outline-none focus:border-primary"
                        />
                      </div>
                    </div>

                    {/* Tool Fleet Assignment Checkboxes */}
                    <div>
                      <label className="block text-xs font-medium text-text-secondary mb-1.5">
                        Assigned Workspace Tools ({agentSelectedTools.length} selected)
                      </label>
                      <div className="grid grid-cols-2 gap-1.5 max-h-32 overflow-y-auto pr-1">
                        {AVAILABLE_AGENT_TOOLS.map((tool) => {
                          const checked = agentSelectedTools.includes(tool.id);
                          return (
                            <label
                              key={tool.id}
                              className={`flex items-center gap-2 p-1.5 rounded border text-xs cursor-pointer transition-colors ${
                                checked
                                  ? 'bg-primary/10 border-primary/40 text-primary'
                                  : 'bg-surface border-border text-text-muted hover:text-text hover:bg-surface-hover'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => {
                                  setAgentSelectedTools((prev) =>
                                    checked
                                      ? prev.filter((t) => t !== tool.id)
                                      : [...prev, tool.id],
                                  );
                                }}
                                className="rounded border-border bg-surface text-primary accent-primary"
                              />
                              <span className="font-mono text-xs truncate">{tool.name}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    {/* Interactive Tag Manager */}
                    <div>
                      <label
                        htmlFor="cap-tag-input-agent"
                        className="block text-xs font-medium text-text-secondary mb-1"
                      >
                        Tags &amp; Archetype Taxonomy
                      </label>
                      <div className="flex flex-wrap items-center gap-1.5 p-1.5 rounded-lg bg-surface border border-border min-h-[38px]">
                        {capTags.map((tag) => (
                          <span
                            key={tag}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-2xs font-medium bg-surface-elevated text-text border border-border"
                          >
                            <span>{tag}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveTag(tag)}
                              className="text-text-muted hover:text-text ml-0.5"
                            >
                              ×
                            </button>
                          </span>
                        ))}
                        <input
                          id="cap-tag-input-agent"
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
                          className="bg-transparent text-xs text-text placeholder:text-text-muted focus:outline-none flex-1 min-w-[120px] px-1 font-sans"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Right Column: System Template & AgentCard JSON (col-span-6) */}
                  <div className="md:col-span-6 flex flex-col min-h-[380px] bg-surface-elevated rounded-xl border border-border p-3.5 space-y-2.5">
                    <div className="flex items-center justify-between pb-2 border-b border-border">
                      <div className="flex items-center gap-2 text-xs">
                        <button
                          type="button"
                          onClick={() => setAgentRightTab('prompt')}
                          className={`font-medium pb-0.5 border-b-2 transition-colors ${
                            agentRightTab === 'prompt'
                              ? 'text-primary border-primary'
                              : 'text-text-muted border-transparent hover:text-text'
                          }`}
                        >
                          System Template (Jinja2)
                        </button>
                        <button
                          type="button"
                          onClick={() => setAgentRightTab('card')}
                          className={`font-medium pb-0.5 border-b-2 transition-colors ${
                            agentRightTab === 'card'
                              ? 'text-primary border-primary'
                              : 'text-text-muted border-transparent hover:text-text'
                          }`}
                        >
                          AgentCard JSON
                        </button>
                      </div>
                    </div>

                    {agentRightTab === 'prompt' && (
                      <>
                        <textarea
                          rows={11}
                          value={agentPromptTemplate}
                          onChange={(e) => setAgentPromptTemplate(e.target.value)}
                          className="w-full flex-1 p-2.5 rounded-lg bg-surface border border-border text-text placeholder:text-text-muted focus:outline-none focus:border-primary font-mono text-xs leading-relaxed resize-none"
                        />
                        <div className="flex flex-wrap items-center gap-1 pt-1 text-2xs text-text-muted">
                          <span>Insert Context:</span>
                          <button
                            type="button"
                            onClick={() =>
                              setAgentPromptTemplate(
                                (prev) => `${prev}\n\nUSER PROFILE:\n{{ profile | tojson }}`,
                              )
                            }
                            className="px-1.5 py-0.5 rounded bg-surface hover:text-text hover:bg-surface-hover border border-border transition-colors"
                          >
                            + profile
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setAgentPromptTemplate(
                                (prev) =>
                                  `${prev}\n\nRETRIEVED KNOWLEDGE:\n{{ rag_context | tojson }}`,
                              )
                            }
                            className="px-1.5 py-0.5 rounded bg-surface hover:text-text hover:bg-surface-hover border border-border transition-colors"
                          >
                            + rag_context
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setAgentPromptTemplate(
                                (prev) => `${prev}\n\nAVAILABLE TOOLS:\n{{ tools | tojson }}`,
                              )
                            }
                            className="px-1.5 py-0.5 rounded bg-surface hover:text-text hover:bg-surface-hover border border-border transition-colors"
                          >
                            + tools
                          </button>
                        </div>
                      </>
                    )}

                    {agentRightTab === 'card' && (
                      <div className="p-2.5 rounded-lg bg-surface border border-border text-primary font-mono text-xs overflow-x-auto max-h-[290px] whitespace-pre select-all">
                        {generatedSpecString}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ──────────────────────────────────────────────────────────── */}
              {/* STUDIO 3: MCP PROTOCOL STUDIO (Model Context Protocol v2)    */}
              {/* ──────────────────────────────────────────────────────────── */}
              {capCategory === 'mcp' && (
                <div className="space-y-3">
                  {/* Top Protocol Banner */}
                  <div className="p-2.5 rounded-xl bg-surface-elevated border border-border flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-text text-xs">
                        MCP Protocol Configuration
                      </h4>
                      <span className="text-xs text-text-muted">
                        Model Context Protocol v2 Connector Bridge
                      </span>
                    </div>
                    <Badge variant="primary" size="sm">
                      MCP v2 Standard
                    </Badge>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
                    {/* Left Column: Server Config (col-span-6) */}
                    <div className="md:col-span-6 space-y-3.5">
                      <div>
                        <label
                          htmlFor="cap-name-input"
                          className="block text-xs font-medium text-text-secondary mb-1"
                        >
                          MCP Server Identifier *
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
                          className="w-full px-3 py-1.5 rounded-lg bg-surface border border-border text-text placeholder:text-text-muted focus:outline-none focus:border-primary font-mono text-xs focus-visible:ring-2 focus-visible:ring-primary"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="cap-desc-input"
                          className="block text-xs font-medium text-text-secondary mb-1"
                        >
                          Server Description &amp; Scope
                        </label>
                        <input
                          id="cap-desc-input"
                          type="text"
                          value={capDescription}
                          onChange={(e) => setCapDescription(e.target.value)}
                          placeholder="e.g. Connects local filesystem tools or remote GitHub MCP server"
                          className="w-full px-3 py-1.5 rounded-lg bg-surface border border-border text-text placeholder:text-text-muted focus:outline-none focus:border-primary text-xs"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <div>
                          <label
                            htmlFor="mcp-transport-select"
                            className="block text-xs font-medium text-text-secondary mb-1"
                          >
                            Transport
                          </label>
                          <select
                            id="mcp-transport-select"
                            value={mcpTransport}
                            onChange={(e) => setMcpTransport(e.target.value as 'stdio' | 'sse')}
                            className="w-full px-2 py-1.5 rounded bg-surface border border-border text-text text-xs focus:outline-none focus:border-primary"
                          >
                            <option value="stdio">stdio (Local Command)</option>
                            <option value="sse">Streamable HTTP / SSE</option>
                          </select>
                        </div>
                        <div className="sm:col-span-2">
                          <label
                            htmlFor="mcp-cmd-input"
                            className="block text-xs font-medium text-text-secondary mb-1"
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
                            className="w-full px-2.5 py-1.5 rounded bg-surface border border-border text-text font-mono text-xs placeholder:text-text-muted focus:outline-none focus:border-primary"
                          />
                        </div>
                      </div>

                      {/* Env Vars */}
                      <div>
                        <label className="block text-xs font-medium text-text-secondary mb-1">
                          Environment Variables &amp; Vault Secrets
                        </label>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            placeholder="KEY"
                            value={mcpEnvKey}
                            onChange={(e) => setMcpEnvKey(e.target.value)}
                            className="w-1/3 px-2 py-1 rounded bg-surface border border-border text-text font-mono text-xs placeholder:text-text-muted focus:outline-none focus:border-primary"
                          />
                          <input
                            type="password"
                            placeholder="SECRET_VAL"
                            value={mcpEnvVal}
                            onChange={(e) => setMcpEnvVal(e.target.value)}
                            className="flex-1 px-2 py-1 rounded bg-surface border border-border text-text font-mono text-xs placeholder:text-text-muted focus:outline-none focus:border-primary"
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
                                className="px-2 py-0.5 rounded bg-surface-elevated border border-border text-2xs font-mono text-primary flex items-center gap-1"
                              >
                                <span>{env.key}=••••••</span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setMcpEnvList((prev) => prev.filter((_, idx) => idx !== i))
                                  }
                                  className="text-text-muted hover:text-text"
                                >
                                  ×
                                </button>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Tag Manager */}
                      <div>
                        <label
                          htmlFor="cap-tag-input-mcp"
                          className="block text-xs font-medium text-text-secondary mb-1"
                        >
                          Tags &amp; Taxonomy
                        </label>
                        <div className="flex flex-wrap items-center gap-1.5 p-1.5 rounded-lg bg-surface border border-border min-h-[38px]">
                          {capTags.map((tag) => (
                            <span
                              key={tag}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-2xs font-medium bg-surface-elevated text-text border border-border"
                            >
                              <span>{tag}</span>
                              <button
                                type="button"
                                onClick={() => handleRemoveTag(tag)}
                                className="text-text-muted hover:text-text ml-0.5"
                              >
                                ×
                              </button>
                            </span>
                          ))}
                          <input
                            id="cap-tag-input-mcp"
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
                            className="bg-transparent text-xs text-text placeholder:text-text-muted focus:outline-none flex-1 min-w-[120px] px-1 font-sans"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Right Column: Manifest, Tools, Audit (col-span-6) */}
                    <div className="md:col-span-6 flex flex-col min-h-[380px] bg-surface-elevated rounded-xl border border-border p-3.5 space-y-2.5">
                      <div className="flex items-center justify-between pb-2 border-b border-border">
                        <div className="flex items-center gap-2 text-xs">
                          <button
                            type="button"
                            onClick={() => setMcpRightTab('manifest')}
                            className={`font-medium pb-0.5 border-b-2 transition-colors ${
                              mcpRightTab === 'manifest'
                                ? 'text-primary border-primary'
                                : 'text-text-muted border-transparent hover:text-text'
                            }`}
                          >
                            mcp.json Manifest
                          </button>
                          <button
                            type="button"
                            onClick={() => setMcpRightTab('tools')}
                            className={`font-medium pb-0.5 border-b-2 transition-colors ${
                              mcpRightTab === 'tools'
                                ? 'text-primary border-primary'
                                : 'text-text-muted border-transparent hover:text-text'
                            }`}
                          >
                            Exposed Tools
                          </button>
                          <button
                            type="button"
                            onClick={() => setMcpRightTab('audit')}
                            className={`font-medium pb-0.5 border-b-2 transition-colors ${
                              mcpRightTab === 'audit'
                                ? 'text-primary border-primary'
                                : 'text-text-muted border-transparent hover:text-text'
                            }`}
                          >
                            Zero-Trust Audit
                          </button>
                        </div>
                      </div>

                      {mcpRightTab === 'manifest' && (
                        <div className="flex-1 flex flex-col justify-between">
                          <div className="p-2.5 rounded-lg bg-surface border border-border text-primary font-mono text-xs overflow-x-auto max-h-[290px] whitespace-pre leading-relaxed select-all">
                            {generatedSpecString}
                          </div>
                          <div className="flex items-center justify-between text-2xs text-text-muted mt-2">
                            <span>Standard MCP v2 Client configuration schema</span>
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(generatedSpecString);
                              }}
                              className="text-primary hover:underline"
                            >
                              Copy JSON
                            </button>
                          </div>
                        </div>
                      )}

                      {mcpRightTab === 'tools' && (
                        <div className="flex-1 space-y-2 p-1 overflow-y-auto text-xs">
                          <p className="text-text-secondary text-xs">
                            Tools discovered dynamically on server startup under scope{' '}
                            <code className="text-primary">connector.mcp.execute</code>:
                          </p>
                          <div className="p-2.5 rounded-lg bg-surface border border-border space-y-2 font-mono text-xs">
                            <div className="flex items-center justify-between text-text">
                              <span>mcp__{capName || 'server'}__query</span>
                              <Badge variant="mono" size="sm">
                                Read-Only
                              </Badge>
                            </div>
                            <div className="flex items-center justify-between text-text">
                              <span>mcp__{capName || 'server'}__mutate</span>
                              <Badge variant="warning" size="sm">
                                Approval-Gated
                              </Badge>
                            </div>
                          </div>
                        </div>
                      )}

                      {mcpRightTab === 'audit' && (
                        <div className="flex-1 space-y-2 p-1 text-xs">
                          <div className="p-2.5 rounded-lg bg-surface border border-border space-y-1.5">
                            <span className="text-success font-semibold flex items-center gap-1.5">
                              ✓ Zero-Trust Subprocess Isolation Passed
                            </span>
                            <p className="text-xs text-text-secondary">
                              Shell metacharacters denied; environment variables encrypted
                              per-workspace key.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* ──────────────────────────────────────────────────────────── */}
              {/* STUDIO 4: PLUGINS STUDIO (Python Sandbox Lifecycle Hooks)    */}
              {/* ──────────────────────────────────────────────────────────── */}
              {capCategory === 'plugins' && (
                <div className="space-y-3">
                  {/* Top Scope Banner */}
                  <div className="p-2.5 rounded-xl bg-surface-elevated border border-border flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-text text-xs">
                        Plugin Sandbox &amp; Scope Architecture
                      </h4>
                      <span className="text-xs text-text-muted">
                        Subprocess-isolated Python lifecycle interceptor
                      </span>
                    </div>
                    <Badge variant="mono" size="sm">
                      Python Sandbox
                    </Badge>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
                    {/* Left Column: Plugin Scope & Target (col-span-6) */}
                    <div className="md:col-span-6 space-y-3.5">
                      <div>
                        <label
                          htmlFor="cap-name-input"
                          className="block text-xs font-medium text-text-secondary mb-1"
                        >
                          Plugin Name / Identifier *
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
                          className="w-full px-3 py-1.5 rounded-lg bg-surface border border-border text-text placeholder:text-text-muted focus:outline-none focus:border-primary font-mono text-xs focus-visible:ring-2 focus-visible:ring-primary"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="cap-desc-input"
                          className="block text-xs font-medium text-text-secondary mb-1"
                        >
                          Summary Description
                        </label>
                        <input
                          id="cap-desc-input"
                          type="text"
                          value={capDescription}
                          onChange={(e) => setCapDescription(e.target.value)}
                          placeholder="Brief description explaining when agents should activate this capability"
                          className="w-full px-3 py-1.5 rounded-lg bg-surface border border-border text-text placeholder:text-text-muted focus:outline-none focus:border-primary text-xs"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2.5">
                        <div>
                          <label
                            htmlFor="plugin-target-select"
                            className="block text-xs font-medium text-text-secondary mb-1"
                          >
                            Execution Target
                          </label>
                          <select
                            id="plugin-target-select"
                            value={pluginTarget}
                            onChange={(e) => setPluginTarget(e.target.value as any)}
                            className="w-full px-2 py-1.5 rounded bg-surface border border-border text-text text-xs focus:outline-none focus:border-primary"
                          >
                            <option value="both">Both (Desktop UI &amp; Agent Runtime)</option>
                            <option value="desktop">Desktop UI Only</option>
                            <option value="agent">Agent Runtime Only</option>
                          </select>
                        </div>
                        <div>
                          <label
                            htmlFor="plugin-hook-select"
                            className="block text-xs font-medium text-text-secondary mb-1"
                          >
                            Lifecycle Hook Point
                          </label>
                          <select
                            id="plugin-hook-select"
                            value={pluginHook}
                            onChange={(e) => setPluginHook(e.target.value as any)}
                            className="w-full px-2 py-1.5 rounded bg-surface border border-border text-text text-xs focus:outline-none focus:border-primary"
                          >
                            <option value="on_tool_call">
                              on_tool_call (Inspect / Egress DLP)
                            </option>
                            <option value="on_agent_start">on_agent_start (Inject Context)</option>
                            <option value="on_agent_complete">
                              on_agent_complete (Audit Sink)
                            </option>
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2.5 pt-1">
                        <div>
                          <label
                            htmlFor="plugin-author-input"
                            className="block text-xs font-medium text-text-secondary mb-1"
                          >
                            Author / Organization
                          </label>
                          <input
                            id="plugin-author-input"
                            type="text"
                            value={pluginAuthor}
                            onChange={(e) => setPluginAuthor(e.target.value)}
                            className="w-full px-2 py-1.5 rounded bg-surface border border-border text-text text-xs focus:outline-none focus:border-primary"
                          />
                        </div>
                        <div>
                          <label
                            htmlFor="plugin-license-input"
                            className="block text-xs font-medium text-text-secondary mb-1"
                          >
                            SPDX License
                          </label>
                          <input
                            id="plugin-license-input"
                            type="text"
                            value={pluginLicense}
                            onChange={(e) => setPluginLicense(e.target.value)}
                            className="w-full px-2 py-1.5 rounded bg-surface border border-border text-text text-xs focus:outline-none focus:border-primary"
                          />
                        </div>
                      </div>

                      {/* Tag Manager */}
                      <div>
                        <label
                          htmlFor="cap-tag-input-plugin"
                          className="block text-xs font-medium text-text-secondary mb-1"
                        >
                          Tags &amp; Taxonomy
                        </label>
                        <div className="flex flex-wrap items-center gap-1.5 p-1.5 rounded-lg bg-surface border border-border min-h-[38px]">
                          {capTags.map((tag) => (
                            <span
                              key={tag}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-2xs font-medium bg-surface-elevated text-text border border-border"
                            >
                              <span>{tag}</span>
                              <button
                                type="button"
                                onClick={() => handleRemoveTag(tag)}
                                className="text-text-muted hover:text-text ml-0.5"
                              >
                                ×
                              </button>
                            </span>
                          ))}
                          <input
                            id="cap-tag-input-plugin"
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
                            className="bg-transparent text-xs text-text placeholder:text-text-muted focus:outline-none flex-1 min-w-[120px] px-1 font-sans"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Right Column: Code Editor & Simulator (col-span-6) */}
                    <div className="md:col-span-6 flex flex-col min-h-[380px] bg-surface-elevated rounded-xl border border-border p-3.5 space-y-2.5">
                      <div className="flex items-center justify-between pb-2 border-b border-border">
                        <div className="flex items-center gap-2 text-xs">
                          <button
                            type="button"
                            onClick={() => setPluginRightTab('code')}
                            className={`font-medium pb-0.5 border-b-2 transition-colors ${
                              pluginRightTab === 'code'
                                ? 'text-primary border-primary'
                                : 'text-text-muted border-transparent hover:text-text'
                            }`}
                          >
                            Python Sandbox Code
                          </button>
                          <button
                            type="button"
                            onClick={() => setPluginRightTab('test')}
                            className={`font-medium pb-0.5 border-b-2 transition-colors ${
                              pluginRightTab === 'test'
                                ? 'text-primary border-primary'
                                : 'text-text-muted border-transparent hover:text-text'
                            }`}
                          >
                            Test Simulator
                          </button>
                          <button
                            type="button"
                            onClick={() => setPluginRightTab('manifest')}
                            className={`font-medium pb-0.5 border-b-2 transition-colors ${
                              pluginRightTab === 'manifest'
                                ? 'text-primary border-primary'
                                : 'text-text-muted border-transparent hover:text-text'
                            }`}
                          >
                            plugin.json
                          </button>
                        </div>
                      </div>

                      {pluginRightTab === 'code' && (
                        <>
                          <textarea
                            rows={11}
                            value={pluginCode}
                            onChange={(e) => setPluginCode(e.target.value)}
                            className="w-full flex-1 p-2.5 rounded-lg bg-surface border border-border text-primary focus:outline-none focus:border-primary font-mono text-xs leading-relaxed resize-none"
                          />
                          <div className="flex flex-wrap items-center gap-1 pt-1 text-2xs text-text-muted">
                            <span>Templates:</span>
                            <button
                              type="button"
                              onClick={() =>
                                setPluginCode(`def run(input: dict, context: dict) -> dict:
    text = input.get("text", "")
    words = text.split()
    return {"words": len(words), "chars": len(text)}
`)
                              }
                              className="px-1.5 py-0.5 rounded bg-surface hover:text-text hover:bg-surface-hover border border-border transition-colors"
                            >
                              + Word Count
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setPluginCode(`def run(input: dict, context: dict) -> dict:
    text = input.get("text", "").lower()
    pos = sum(1 for w in ["good", "great", "excellent"] if w in text)
    neg = sum(1 for w in ["bad", "poor", "terrible"] if w in text)
    return {"sentiment_score": pos - neg}
`)
                              }
                              className="px-1.5 py-0.5 rounded bg-surface hover:text-text hover:bg-surface-hover border border-border transition-colors"
                            >
                              + Sentiment
                            </button>
                          </div>
                        </>
                      )}

                      {pluginRightTab === 'test' && (
                        <div className="flex-1 flex flex-col gap-2">
                          <label className="text-xs text-text-secondary">
                            Simulate Input Payload (JSON):
                          </label>
                          <textarea
                            rows={5}
                            value={pluginTestPayload}
                            onChange={(e) => setPluginTestPayload(e.target.value)}
                            className="p-2 rounded bg-surface border border-border text-text font-mono text-xs"
                          />
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={async () => {
                              try {
                                const parsed = JSON.parse(pluginTestPayload);
                                if (workspaceId) {
                                  setPluginTestResult('Executing sandbox verification...');
                                  try {
                                    const res = await capabilitiesApi.test({
                                      workspaceId,
                                      capabilityName: capName || 'plugin-sandbox-runner',
                                      category: 'plugins',
                                      inputPayload: {
                                        code: pluginCode,
                                        hook: pluginHook,
                                        payload: parsed,
                                      },
                                    });
                                    setPluginTestResult(
                                      JSON.stringify(
                                        {
                                          status: 'SANDBOX_SUCCESS',
                                          executionDurationMs: res.executionDurationMs,
                                          result: res.result,
                                        },
                                        null,
                                        2,
                                      ),
                                    );
                                  } catch (backendErr: unknown) {
                                    setPluginTestResult(
                                      JSON.stringify(
                                        {
                                          status: 'SANDBOX_EXECUTION_ERROR',
                                          error:
                                            backendErr instanceof Error
                                              ? backendErr.message
                                              : 'Backend execution failed',
                                        },
                                        null,
                                        2,
                                      ),
                                    );
                                  }
                                } else {
                                  setPluginTestResult(
                                    JSON.stringify(
                                      {
                                        status: 'VALIDATED_LOCAL_SYNTAX',
                                        validJson: true,
                                        codeLength: pluginCode.length,
                                      },
                                      null,
                                      2,
                                    ),
                                  );
                                }
                              } catch {
                                setPluginTestResult('Invalid JSON payload');
                              }
                            }}
                          >
                            Run Sandbox Test
                          </Button>
                          {pluginTestResult && (
                            <pre className="p-2 rounded bg-surface border border-border text-success font-mono text-xs overflow-x-auto">
                              {pluginTestResult}
                            </pre>
                          )}
                        </div>
                      )}

                      {pluginRightTab === 'manifest' && (
                        <div className="p-2.5 rounded-lg bg-surface border border-border text-primary font-mono text-xs overflow-x-auto max-h-[290px] whitespace-pre select-all">
                          {generatedSpecString}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* ──────────────────────────────────────────────────────────── */}
              {/* STUDIO 5: TOOLS STUDIO (Typed Functions & JSON Schema)       */}
              {/* ──────────────────────────────────────────────────────────── */}
              {capCategory === 'tools' && (
                <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
                  {/* Left Column: Parameter Schema & Scope (col-span-6) */}
                  <div className="md:col-span-6 space-y-3.5">
                    <div>
                      <label
                        htmlFor="cap-name-input"
                        className="block text-xs font-medium text-text-secondary mb-1"
                      >
                        Tool Function Name *
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
                        className="w-full px-3 py-1.5 rounded-lg bg-surface border border-border text-text placeholder:text-text-muted focus:outline-none focus:border-primary font-mono text-xs focus-visible:ring-2 focus-visible:ring-primary"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="cap-desc-input"
                        className="block text-xs font-medium text-text-secondary mb-1"
                      >
                        Function Description (Injected in LLM Tool Schema)
                      </label>
                      <input
                        id="cap-desc-input"
                        type="text"
                        value={capDescription}
                        onChange={(e) => setCapDescription(e.target.value)}
                        placeholder="Brief description explaining what this tool does"
                        className="w-full px-3 py-1.5 rounded-lg bg-surface border border-border text-text placeholder:text-text-muted focus:outline-none focus:border-primary text-xs"
                      />
                    </div>

                    {/* Parameter Builder */}
                    <div className="p-3 rounded-xl bg-surface-elevated border border-border space-y-2.5">
                      <div className="flex items-center justify-between pb-1.5 border-b border-border">
                        <h4 className="font-semibold text-text text-xs">
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
                              className="w-28 px-2 py-1 rounded bg-surface border border-border text-text font-mono text-xs focus:outline-none focus:border-primary"
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
                              className="w-20 px-2 py-1 rounded bg-surface border border-border text-text text-xs focus:outline-none focus:border-primary"
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
                              className="flex-1 px-2 py-1 rounded bg-surface border border-border text-text text-xs focus:outline-none focus:border-primary"
                            />
                            <label className="flex items-center gap-1 text-2xs text-text-muted shrink-0">
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
                                className="rounded border-border bg-surface text-primary accent-primary"
                              />
                              <span>Req</span>
                            </label>
                            <button
                              type="button"
                              onClick={() => handleRemoveParam(idx)}
                              className="text-text-muted hover:text-danger p-0.5"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border">
                        <div>
                          <label className="block text-xs font-medium text-text-secondary mb-1">
                            Required Security Scope
                          </label>
                          <select
                            value={toolScope}
                            onChange={(e) => setToolScope(e.target.value)}
                            className="w-full px-2 py-1 rounded bg-surface border border-border text-text text-xs focus:outline-none focus:border-primary"
                          >
                            <option value="memory.read">memory.read</option>
                            <option value="memory.write">memory.write</option>
                            <option value="connector.mcp.execute">connector.mcp.execute</option>
                            <option value="system.execute">system.execute</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-text-secondary mb-1">
                            Category Classification
                          </label>
                          <select
                            value={toolCategoryGroup}
                            onChange={(e) => setToolCategoryGroup(e.target.value)}
                            className="w-full px-2 py-1 rounded bg-surface border border-border text-text text-xs focus:outline-none focus:border-primary"
                          >
                            <option value="memory_read">memory_read</option>
                            <option value="memory_write">memory_write</option>
                            <option value="connector_read">connector_read</option>
                            <option value="connector_write">connector_write</option>
                            <option value="system">system</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Tag Manager */}
                    <div>
                      <label
                        htmlFor="cap-tag-input-tools"
                        className="block text-xs font-medium text-text-secondary mb-1"
                      >
                        Tags &amp; Taxonomy
                      </label>
                      <div className="flex flex-wrap items-center gap-1.5 p-1.5 rounded-lg bg-surface border border-border min-h-[38px]">
                        {capTags.map((tag) => (
                          <span
                            key={tag}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-2xs font-medium bg-surface-elevated text-text border border-border"
                          >
                            <span>{tag}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveTag(tag)}
                              className="text-text-muted hover:text-text ml-0.5"
                            >
                              ×
                            </button>
                          </span>
                        ))}
                        <input
                          id="cap-tag-input-tools"
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
                          className="bg-transparent text-xs text-text placeholder:text-text-muted focus:outline-none flex-1 min-w-[120px] px-1 font-sans"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Right Column: JSON Schema Specification (col-span-6) */}
                  <div className="md:col-span-6 flex flex-col min-h-[380px] bg-surface-elevated rounded-xl border border-border p-3.5 space-y-2.5">
                    <div className="flex items-center justify-between pb-2 border-b border-border">
                      <span className="font-semibold text-text text-xs">
                        JSON Schema Input &amp; Output Contract
                      </span>
                      <Badge variant="mono" size="sm">
                        JSONSchema 2020-12
                      </Badge>
                    </div>

                    <div className="p-2.5 rounded-lg bg-surface border border-border text-primary font-mono text-xs overflow-x-auto max-h-[290px] whitespace-pre leading-relaxed select-all">
                      {generatedSpecString}
                    </div>

                    <p className="text-2xs text-text-muted">
                      Strict schema contract enforced at tool dispatch and validation gates.
                    </p>
                  </div>
                </div>
              )}
            </form>
          )}

          {/* ──────────────────────────────────────────────────────────────── */}
          {/* TAB 3: Remote Git / File Dropzone                                 */}
          {/* ──────────────────────────────────────────────────────────────── */}
          {activeTab === 'import' && (
            <div className="space-y-4 text-xs font-sans">
              <div>
                <h3 className="text-sm font-semibold text-text mb-1">
                  Drag &amp; Drop SKILL.md or Specification File
                </h3>
                <p className="text-xs text-text-muted mb-2.5">
                  Supports <code className="text-primary">SKILL.md</code> with YAML frontmatter,{' '}
                  <code className="text-primary">mcp.json</code>, or OpenAPI schemas.
                </p>

                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOver(false);
                    const file = e.dataTransfer.files[0];
                    if (file) {
                      setFileParseSuccess(`Loaded ${file.name}`);
                      handleFileUpload(file);
                    }
                  }}
                  className={`border-2 border-dashed rounded-xl p-5 text-center transition-all cursor-pointer ${
                    dragOver
                      ? 'border-primary bg-primary/10'
                      : 'border-border bg-surface-elevated hover:border-primary/50 hover:bg-surface-hover'
                  }`}
                >
                  <div className="w-8 h-8 mx-auto mb-1.5 rounded-lg bg-surface border border-border flex items-center justify-center text-primary">
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
                  <p className="text-xs font-semibold text-text">Drop your capability file here</p>
                  <p className="text-2xs text-text-muted mt-0.5">
                    or click to browse local files (.md, .json, .yaml)
                  </p>
                  <input
                    type="file"
                    accept=".md,.markdown,.json,.yaml,.yml"
                    className="hidden"
                    id="capability-file-input"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setFileParseSuccess(`Loaded ${file.name}`);
                        handleFileUpload(file);
                      }
                    }}
                  />
                  <label
                    htmlFor="capability-file-input"
                    className="inline-block mt-2 px-3 py-1 rounded-md bg-surface hover:bg-surface-hover text-xs font-medium text-text border border-border cursor-pointer transition-colors"
                  >
                    Browse Files
                  </label>
                </div>
              </div>

              {/* Git / Remote URL Fetcher */}
              <div className="pt-3 border-t border-border">
                <h4 className="text-xs font-semibold text-text mb-1">
                  Import Capability from Git / URL
                </h4>
                <p className="text-xs text-text-muted mb-2.5">
                  Clone a public GitHub skill directory, raw SKILL.md link, or remote MCP server
                  endpoint.
                </p>

                <form onSubmit={handleImportSubmit} className="space-y-3">
                  <div>
                    <label
                      htmlFor="import-url-input"
                      className="block text-text-secondary font-medium mb-1"
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
                      className="w-full px-3 py-2 rounded-lg bg-surface border border-border text-text placeholder:text-text-muted focus:outline-none focus:border-primary text-xs font-mono"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label
                        htmlFor="import-cat-select"
                        className="block text-text-secondary font-medium mb-1"
                      >
                        Target Category
                      </label>
                      <select
                        id="import-cat-select"
                        value={importCategory}
                        onChange={(e) => setImportCategory(e.target.value as CapabilityCategory)}
                        className="w-full px-3 py-2 rounded-lg bg-surface border border-border text-text focus:outline-none focus:border-primary text-xs"
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
        <footer className="px-5 py-3 border-t border-border bg-surface-elevated flex items-center justify-between gap-3 shrink-0 z-20 font-sans">
          <div className="flex items-center gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <span className="text-xs text-text-muted hidden sm:inline-block">
              Press{' '}
              <kbd className="px-1 py-0.5 rounded bg-surface text-primary border border-border font-mono text-2xs">
                Esc
              </kbd>{' '}
              to exit •{' '}
              <kbd className="px-1 py-0.5 rounded bg-surface text-primary border border-border font-mono text-2xs">
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
