'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Badge,
  Button,
  EmptyState,
  FormField,
  Input,
  SearchField,
  Select,
  TabPanel,
  Tabs,
  Textarea,
  Tooltip,
} from '@vaeloom/ui-kit';
import {
  capabilitiesApi,
  capabilityConfigAutonomy,
  MAX_REACT_ROUNDS,
  MIN_REACT_ROUNDS,
  CAPABILITY_MAX_REACT_ROUNDS_KEY,
} from '@/lib/api-client';
import type {
  CapabilityConfig,
  CapabilityDraftStatus,
  CapabilityDraftValidationResponse,
} from '@/lib/api-client';
import { getStoredCapabilities } from '@/lib/capabilities-data';
import type { CapabilityCategory, CapabilityItem } from '@/lib/capabilities-data';

// ─── Enumerated option types ─────────────────────────────────────────────────
//
// Every one of these replaces a former `as any` at a `<select onChange>` or a
// preset cast. The server validates the autonomy set and `validate_mcp_config`
// validates the transport set, so a value outside the union is rejected here
// rather than asserted.

const AUTONOMY_VALUES = ['suggest', 'autonomous', 'approval_required'] as const;
const MCP_TRANSPORTS = ['stdio', 'http'] as const;
const PLUGIN_HOOKS = ['on_tool_call', 'on_agent_start', 'on_agent_complete'] as const;
const PLUGIN_SANDBOXES = ['isolated_subprocess', 'wasm_sandbox', 'safe_thread'] as const;
const PLUGIN_TARGETS = ['both', 'desktop', 'agent'] as const;
const AGENT_ARCHETYPES = ['specialist', 'supervisor', 'auditor'] as const;
const AGENT_MODEL_TIERS = ['pro', 'flash', 'open_weights'] as const;
const TOOL_PARAM_TYPES = ['string', 'number', 'boolean', 'object', 'array'] as const;
const SECURITY_SCOPES = [
  'memory.read',
  'memory.write',
  'connector.mcp.execute',
  'system.execute',
] as const;
const TOOL_GROUPS = [
  'memory_read',
  'memory_write',
  'connector_read',
  'connector_write',
  'system',
] as const;

type Autonomy = (typeof AUTONOMY_VALUES)[number];
type McpTransport = (typeof MCP_TRANSPORTS)[number];
type PluginHook = (typeof PLUGIN_HOOKS)[number];
type PluginSandbox = (typeof PLUGIN_SANDBOXES)[number];
type PluginTarget = (typeof PLUGIN_TARGETS)[number];
type AgentArchetype = (typeof AGENT_ARCHETYPES)[number];
type AgentModelTier = (typeof AGENT_MODEL_TIERS)[number];
type ToolParamType = (typeof TOOL_PARAM_TYPES)[number];
type SecurityScope = (typeof SECURITY_SCOPES)[number];
type ToolGroup = (typeof TOOL_GROUPS)[number];

/**
 * Narrow a raw `<select>` string to a union, falling back instead of casting.
 *
 * A preset authored outside this build, a stale localStorage row or a hand-typed
 * value must not be able to place an unvalidated string in a field the server
 * rejects with a 400 or 422.
 */
function option<T extends string>(raw: string, allowed: readonly T[], fallback: T): T {
  return (allowed as readonly string[]).includes(raw) ? (raw as T) : fallback;
}

function asOptions<T extends string>(values: readonly T[]) {
  return values.map((value) => ({ value, label: value }));
}

// ─── Server contracts mirrored for instant feedback ──────────────────────────

/** The name pattern `routers/capabilities.py` validates on create. */
const NAME_PATTERN = /^[a-zA-Z0-9_\-. ]{1,255}$/;

/**
 * `validate_mcp_config`, clause by clause, so the form can say *why* a config will
 * be rejected instead of awarding points for having filled the field in. The
 * server re-checks every rule; this is a mirror, not the authority.
 */
const MCP_DENIED_COMMANDS = new Set([
  'sh',
  'bash',
  'dash',
  'zsh',
  'cmd',
  'cmd.exe',
  'powershell',
  'powershell.exe',
  'pwsh',
  'pwsh.exe',
]);
const MCP_SHELL_METACHARS = /[;&|`$><\r\n^%!]/;
const MCP_INLINE_EXEC_FLAGS = new Set(['-c', '-e', '--eval', '-r']);
const MCP_SCRIPT_INTERPRETERS = new Set([
  'python',
  'python3',
  'node',
  'deno',
  'bun',
  'ruby',
  'perl',
  'php',
]);
/**
 * Commands that only work through a Windows batch shim.
 *
 * `_resolve_command` in `mcp_client_service.py` documents this directly: Windows
 * CreateProcess cannot execute the `.cmd`/`.bat` shim these resolve to, so they are
 * wrapped in `cmd.exe /c` and that requires `allow_windows_batch=true`. The
 * resolution happens server-side, so the client cannot observe it -- the names are
 * listed here instead of being guessed per platform.
 */
const MCP_WINDOWS_SHIMS = new Set([
  'npx',
  'uvx',
  'pnpm',
  'yarn',
  'pipx',
  'pipx.cmd',
  'uvx.cmd',
  'npx.cmd',
  'pnpm.cmd',
  'yarn.cmd',
]);

/** `${NAME}`: an unsubstituted reference. A real credential never has this shape. */
const VAULT_REFERENCE = /^\$\{[A-Za-z_][A-Za-z0-9_]*\}$/;

/** JSON Schema property names have to be identifiers. */
const JSON_PROPERTY_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;

/** Calls that step outside the plugin sandbox entirely. */
const SANDBOX_ESCAPE = /\b(os\.system|os\.popen|subprocess\.|eval\s*\(|exec\s*\()/;

const AGENT_TOOLS = [
  { id: 'search_documents', name: 'search_documents' },
  { id: 'query_graph', name: 'query_graph' },
  { id: 'calculate_semantic_ats_score', name: 'calculate_semantic_ats_score' },
  { id: 'browse_job_page', name: 'browse_job_page' },
  { id: 'run_command', name: 'run_command' },
  { id: 'http_request', name: 'http_request' },
];
const AGENT_TOOL_IDS = new Set(AGENT_TOOLS.map((tool) => tool.id));

const QUICK_TAGS = ['Review', 'Engineering', 'QA', 'Design', 'DevOps', 'Memory', 'MCP', 'AI'];

/**
 * Privilege ranking for the autonomy/scope consistency check.
 *
 * Written out rather than inferred from `<select>` order, because the ordering is
 * the claim: `suggest` acquires nothing, `approval_required` puts a human in
 * front of everything except raw process execution, and only `autonomous` reaches
 * `system.execute`.
 */
const SCOPE_RANK: Record<SecurityScope, number> = {
  'memory.read': 1,
  'memory.write': 2,
  'connector.mcp.execute': 3,
  'system.execute': 4,
};
const AUTONOMY_CEILING: Record<Autonomy, SecurityScope | null> = {
  suggest: null,
  approval_required: 'connector.mcp.execute',
  autonomous: 'system.execute',
};

const slugify = (raw: string) =>
  raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\-_.]/g, '');

const splitArgs = (raw: string) =>
  raw
    .split(/[\s\n]+/)
    .map((token) => token.trim())
    .filter(Boolean);

const countHeadings = (markdown: string) =>
  markdown.split('\n').filter((line) => /^#{1,6}\s+\S/.test(line)).length;

// ─── Lexical scan of the plugin handler ──────────────────────────────────────

interface BracketVerdict {
  balanced: boolean;
  detail: string;
}

/**
 * Bracket balance for Python source, ignoring comments and string literals.
 *
 * Deliberately not called "compiles": it is a real lexical scan that catches the
 * unbalanced-delimiter class of syntax error, and the label says exactly that.
 */
function scanBrackets(code: string): BracketVerdict {
  const closers: Record<string, string> = { ')': '(', ']': '[', '}': '{' };
  const stack: string[] = [];
  let quote: string | null = null;
  let escaped = false;

  for (let i = 0; i < code.length; i += 1) {
    const char = code[i] ?? '';
    const prev = code[i - 1] ?? '';
    if (quote) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) quote = null;
      continue;
    }
    if (char === '#' && (prev === '' || prev === ' ' || prev === '\t')) {
      while (i < code.length && code[i] !== '\n') i += 1;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === '(' || char === '[' || char === '{') stack.push(char);
    const expected = closers[char];
    if (expected) {
      const open = stack.pop();
      if (open !== expected) {
        return {
          balanced: false,
          detail: `Unbalanced: '${char}' at offset ${i} closes '${open ?? 'nothing'}'.`,
        };
      }
    }
  }
  return stack.length > 0
    ? { balanced: false, detail: `${stack.length} unclosed bracket(s): ${stack.join(' ')}.` }
    : { balanced: true, detail: 'Brackets and string literals balance.' };
}

/** First line carrying a sandbox-escape construct, or null. */
function findSandboxEscape(code: string): { line: number; match: string } | null {
  const lines = code.split('\n');
  for (let i = 0; i < lines.length; i += 1) {
    const hit = SANDBOX_ESCAPE.exec(lines[i] ?? '');
    if (hit) return { line: i + 1, match: hit[0] };
  }
  return null;
}

// ─── Readiness audit ─────────────────────────────────────────────────────────

interface ReadinessCheck {
  id: string;
  label: string;
  passed: boolean;
  /** Not applicable: counted as neither a pass nor a failure. */
  skipped: boolean;
  weight: number;
  /** What the scan actually found. Reported whether or not it passed. */
  detail: string;
  /** A failure the submit path refuses to pass. */
  blocking: boolean;
}

interface Readiness {
  checks: ReadinessCheck[];
  applicable: number;
  passedCount: number;
  failureCount: number;
  earnedWeight: number;
  applicableWeight: number;
  blockingFailures: ReadinessCheck[];
}

/**
 * One row per check.
 *
 * The detail describes the state of the field either way, so a single string
 * carries the evidence and the mark carries the verdict. No caller can construct
 * a passing row without also supplying a reason derived from the form.
 */
function row(
  id: string,
  label: string,
  weight: number,
  passed: boolean,
  detail: string,
  blocking = false,
): ReadinessCheck {
  return { id, label, passed, skipped: false, weight, detail, blocking };
}

function skippedRow(id: string, label: string, weight: number, detail: string): ReadinessCheck {
  return { id, label, passed: false, skipped: true, weight, detail, blocking: false };
}

interface ToolParam {
  name: string;
  type: ToolParamType;
  description: string;
  required: boolean;
}

/**
 * Everything the audit and the submit path both need.
 *
 * One snapshot type so the two cannot drift: a check the badge shows as passing
 * but the submit ignores (or the reverse) is the same defect as a fabricated one.
 */
interface Draft {
  category: CapabilityCategory;
  name: string;
  description: string;
  tags: string[];
  triggers: string;
  doc: string;
  autonomy: Autonomy;
  transport: McpTransport;
  command: string;
  args: string[];
  url: string;
  allowWindowsBatch: boolean;
  allowInsecure: boolean;
  envList: Array<{ key: string; val: string }>;
  toolParams: ToolParam[];
  toolScope: SecurityScope;
  toolGroup: ToolGroup;
  archetype: AgentArchetype;
  modelTier: AgentModelTier;
  maxTurns: number;
  agentTools: string[];
  prompt: string;
  hook: PluginHook;
  sandbox: PluginSandbox;
  pluginTarget: PluginTarget;
  pluginCode: string;
  pluginAuthor: string;
  pluginLicense: string;
  pluginPermissions: string;
  minAppVersion: string;
  /** Lower-cased names already taken in this workspace, from every source. */
  collisions: ReadonlySet<string>;
}

interface ParsedJson {
  ok: boolean;
  value: Record<string, unknown>;
  reason: string;
}

/** JSON object parser with a reason, used for permissions and import payloads. */
function parseJsonObject(raw: string, what: string): ParsedJson {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: true, value: {}, reason: '' };
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch (err) {
    return { ok: false, value: {}, reason: err instanceof Error ? err.message : 'Not valid JSON.' };
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, value: {}, reason: `${what} must be a JSON object, not an array.` };
  }
  return { ok: true, value: parsed as Record<string, unknown>, reason: '' };
}

/**
 * The identity check, shared by every category.
 *
 * Collision is compared against the slug that will actually be submitted, because
 * the API dedupes on `(workspace_id, name, category)` and the modal slugifies
 * first: `My Tool` and `my-tool` are one row to the server and two strings here.
 */
function identityRow(draft: Draft): ReadinessCheck {
  const label = 'Identifier accepted by the API';
  const trimmed = draft.name.trim();
  if (!trimmed) return row('identity', label, 20, false, 'Empty.', true);
  if (trimmed.length > 255) {
    return row(
      'identity',
      label,
      20,
      false,
      `${trimmed.length} chars; the API caps it at 255.`,
      true,
    );
  }
  if (!NAME_PATTERN.test(trimmed)) {
    const detail = 'Contains a character outside the API set (letters, digits, _ - . and space).';
    return row('identity', label, 20, false, detail, true);
  }
  const slug = slugify(trimmed);
  if (!slug) return row('identity', label, 20, false, 'Slugifies to nothing.', true);
  if (draft.collisions.has(slug.toLowerCase())) {
    const detail = `"${slug}" already exists here; the API returns 409 for a duplicate.`;
    return row('identity', label, 20, false, detail, true);
  }
  return row('identity', label, 20, true, `"${slug}" is free in this workspace.`);
}

function schemaRow(params: ToolParam[]): ReadinessCheck {
  const label = 'JSON Schema input contract';
  const named = params.filter((param) => param.name.trim() !== '');
  if (named.length === 0) {
    const detail = 'No parameter names. A tool with an empty properties map takes no arguments.';
    return row('schema', label, 30, false, detail, true);
  }
  const badToken = named.find((param) => !JSON_PROPERTY_NAME.test(param.name.trim()));
  if (badToken) {
    return row(
      'schema',
      label,
      30,
      false,
      `"${badToken.name.trim()}" is not a JSON identifier.`,
      true,
    );
  }
  const seen = new Set<string>();
  const duplicate = named.find((param) => {
    const key = param.name.trim();
    if (seen.has(key)) return true;
    seen.add(key);
    return false;
  });
  if (duplicate) {
    const detail = `Duplicate property "${duplicate.name.trim()}"; JSON cannot repeat a key.`;
    return row('schema', label, 30, false, detail, true);
  }
  const badType = named.find((p) => !(TOOL_PARAM_TYPES as readonly string[]).includes(p.type));
  if (badType) {
    return row(
      'schema',
      label,
      30,
      false,
      `Type "${badType.type}" is outside the allowed set.`,
      true,
    );
  }
  const count = named.filter((p) => p.required).length;
  const detail = `${named.length} propert${named.length === 1 ? 'y' : 'ies'}, ${count} required, all names unique.`;
  return row('schema', label, 30, true, detail);
}

/**
 * Declared autonomy against declared scope.
 *
 * Both values are chosen in this form, so their inconsistency is knowable here.
 * An agent deliberately has no such check: its effective scopes come from the
 * `required_scope` of each tool it holds, which the client cannot read, and a
 * check against a scope nobody declared would be invented.
 */
function privilegeRow(draft: Draft, scope: SecurityScope): ReadinessCheck {
  const label = 'Scope is reachable under the declared autonomy';
  const ceiling = AUTONOMY_CEILING[draft.autonomy];
  if (ceiling === null) {
    return row('privilege', label, 25, false, `Autonomy "suggest" cannot acquire ${scope}.`, true);
  }
  if (SCOPE_RANK[scope] > SCOPE_RANK[ceiling]) {
    const detail = `${scope} outranks the ceiling for "${draft.autonomy}" (${ceiling}). Raise the autonomy or lower the scope.`;
    return row('privilege', label, 25, false, detail, true);
  }
  return row('privilege', label, 25, true, `"${draft.autonomy}" permits up to ${ceiling}.`);
}

/**
 * MCP checks.
 *
 * These replace the two rows that used to return `passed: true` regardless of
 * input -- "MCP v2 Protocol Contract" and "Encrypted Secrets" -- which is how an
 * otherwise empty form still scored 40. Every weight here is tied to something
 * this form can actually verify.
 */
function mcpRows(draft: Draft): ReadinessCheck[] {
  const endpoint = draft.url.trim();
  const shapeOk = draft.transport === 'stdio' ? draft.command.trim() !== '' : endpoint !== '';
  const endpointWord = draft.transport === 'stdio' ? 'a command' : 'an endpoint URL';

  const base = draft.command.trim().replace(/^"|"$/g, '').toLowerCase().replace(/\\/g, '/');
  const baseName = base.split('/').pop() ?? '';
  const interpreter = baseName.split('.')[0] ?? '';
  const metachar = [draft.command.trim(), ...draft.args].find((p) => MCP_SHELL_METACHARS.test(p));
  const inlineFlag = MCP_SCRIPT_INTERPRETERS.has(interpreter)
    ? draft.args.find((arg) => MCP_INLINE_EXEC_FLAGS.has(arg.trim().toLowerCase()))
    : undefined;
  const isExplicitBatch = /\.(cmd|bat)$/.test(baseName);
  const isWindowsShim = MCP_WINDOWS_SHIMS.has(baseName);

  let argvOk = baseName !== '';
  let argvDetail = baseName ? `${baseName} with ${draft.args.length} argument(s).` : 'No command.';
  if (!baseName) argvOk = false;
  else if (MCP_DENIED_COMMANDS.has(baseName)) {
    argvOk = false;
    argvDetail = `"${baseName}" is a shell interpreter; validate_mcp_config refuses it.`;
  } else if (metachar !== undefined) {
    argvOk = false;
    argvDetail = `Shell metacharacters in "${metachar.trim()}"; the server refuses command/args containing [;&|\`$><^%!].`;
  } else if (inlineFlag !== undefined) {
    argvOk = false;
    argvDetail = `Inline code flag "${inlineFlag}" is refused for ${interpreter}.`;
  } else if (isExplicitBatch && !draft.allowWindowsBatch) {
    argvOk = false;
    argvDetail = `"${baseName}" is a Windows batch wrapper and needs allow_windows_batch=true.`;
  } else if (isWindowsShim && !draft.allowWindowsBatch) {
    argvOk = false;
    argvDetail = `"${baseName}" resolves to a .cmd shim on Windows, which needs allow_windows_batch=true.`;
  }

  const literals = draft.envList.filter(
    (entry) => entry.key.trim() !== '' && !VAULT_REFERENCE.test(entry.val.trim()),
  );
  const secretsDetail =
    draft.envList.length === 0
      ? 'No environment variables declared; nothing to leak.'
      : literals.length === 0
        ? `All ${draft.envList.length} value(s) are \${VAR} references.`
        : `${literals.length} literal value(s) (${literals
            .map((entry) => entry.key)
            .join(', ')}). This form would write them to the workspace row in clear text.`;

  const urlCheck =
    draft.transport === 'stdio'
      ? skippedRow(
          'endpoint',
          'HTTP endpoint',
          15,
          'stdio launches a local process; no URL is used.',
        )
      : endpoint === ''
        ? row('endpoint', 'HTTP endpoint', 15, false, 'Empty.', true)
        : /^https:\/\//i.test(endpoint)
          ? row('endpoint', 'HTTP endpoint', 15, true, 'https:// endpoint.')
          : /^http:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?/i.test(endpoint)
            ? row(
                'endpoint',
                'HTTP endpoint',
                15,
                true,
                'Loopback http://. The server still requires allow_insecure=true.',
              )
            : row(
                'endpoint',
                'HTTP endpoint',
                15,
                false,
                'Not https:// and not loopback; the SSRF guard rejects it.',
                true,
              );

  return [
    identityRow(draft),
    row(
      'transport',
      'Transport declared',
      20,
      shapeOk,
      shapeOk
        ? `"${draft.transport}" with a matching ${endpointWord}.`
        : `Transport "${draft.transport}" needs ${endpointWord}.`,
      !shapeOk,
    ),
    row('argv', 'Command passes the server argv policy', 30, argvOk, argvDetail, !argvOk),
    urlCheck,
    row(
      'secrets',
      'Credentials are references, not literals',
      15,
      literals.length === 0,
      secretsDetail,
      literals.length > 0,
    ),
  ];
}

function pluginRows(draft: Draft): ReadinessCheck[] {
  const brackets = scanBrackets(draft.pluginCode);
  const escape = findSandboxEscape(draft.pluginCode);
  const hasEntryPoint = /^def\s+run\s*\(/m.test(draft.pluginCode);
  const permissions = parseJsonObject(draft.pluginPermissions, 'Permissions');
  const attributed = Boolean(draft.pluginAuthor.trim() && draft.pluginLicense.trim());

  return [
    identityRow(draft),
    row(
      'handler',
      'Sandbox handler shape',
      25,
      hasEntryPoint && brackets.balanced,
      hasEntryPoint
        ? brackets.detail
        : 'No top-level `def run(` entry point; the sandbox calls nothing.',
      !hasEntryPoint,
    ),
    row(
      'isolation',
      'No sandbox escape in the handler',
      25,
      escape === null,
      escape
        ? `Line ${escape.line} calls ${escape.match.trim()}. A subprocess hook must not open its own process.`
        : 'No os.system / os.popen / subprocess / eval / exec call in the source.',
      escape !== null,
    ),
    row(
      'attribution',
      'Author and license',
      10,
      attributed,
      attributed
        ? `${draft.pluginAuthor.trim()} / ${draft.pluginLicense.trim()}.`
        : 'The plugin registry requires both author and license.',
    ),
    row(
      'surface',
      'Hook, isolation and target declared',
      10,
      Boolean(draft.hook && draft.sandbox && draft.pluginTarget),
      `${draft.hook} · ${draft.sandbox} · ${draft.pluginTarget}.`,
    ),
    row(
      'permissions',
      'Declared permissions parse',
      15,
      permissions.ok,
      permissions.ok
        ? `${Object.keys(permissions.value).length} declared permission(s) as a JSON object.`
        : permissions.reason,
      !permissions.ok,
    ),
  ];
}

function buildReadiness(draft: Draft): Readiness {
  let checks: ReadinessCheck[];

  if (draft.category === 'connectors') {
    // Connectors are registered through the connectors API. The category stays
    // selectable so a wrong `defaultCategory` is visible instead of silently
    // rewritten, and the form states plainly that it will not write here.
    checks = [
      row(
        'scope',
        'This form does not create connectors',
        100,
        false,
        'A connector needs a type-specific row in POST /api/v1/connectors plus a credential flow. This form would write a capability with no working secret.',
        true,
      ),
    ];
  } else if (draft.category === 'skills') {
    const headings = countHeadings(draft.doc);
    const docLength = draft.doc.trim().length;
    const triggerCount = draft.triggers.split(',').filter((t) => t.trim() !== '').length;
    const authoredTags = draft.tags.filter((tag) => tag !== 'Custom').length;
    checks = [
      identityRow(draft),
      row(
        'activation',
        'Activation context',
        25,
        draft.description.trim() !== '',
        draft.description.trim() === ''
          ? 'Empty, so the runtime has nothing to match an incoming request against.'
          : `${draft.description.trim().length} characters for the matcher.`,
      ),
      row(
        'playbook',
        'Playbook operating rules',
        30,
        docLength >= 20 && headings > 0,
        docLength < 20
          ? `${docLength} characters; a stub is not a playbook.`
          : headings === 0
            ? `${docLength} characters but no Markdown heading, so there is no structure to follow.`
            : `${docLength} characters, ${headings} heading(s).`,
      ),
      row(
        'routing',
        'Routing triggers',
        25,
        triggerCount + authoredTags > 0,
        triggerCount + authoredTags === 0
          ? 'No trigger phrase and no tag beyond the default "Custom", so nothing selects this skill.'
          : `${triggerCount} trigger(s), ${authoredTags} authored tag(s).`,
      ),
    ];
  } else if (draft.category === 'agents') {
    const unknown = draft.agentTools.filter((id) => !AGENT_TOOL_IDS.has(id));
    const turnsOk =
      Number.isInteger(draft.maxTurns) &&
      draft.maxTurns >= MIN_REACT_ROUNDS &&
      draft.maxTurns <= MAX_REACT_ROUNDS;
    checks = [
      identityRow(draft),
      row(
        'policy',
        'Role and autonomy policy',
        25,
        turnsOk,
        turnsOk
          ? `${draft.archetype}, "${draft.autonomy}", ${draft.maxTurns} ReAct round(s).`
          : `max_react_rounds=${draft.maxTurns}; the runtime honours ${MIN_REACT_ROUNDS} to ${MAX_REACT_ROUNDS} and clamps anything outside that with a log.`,
      ),
      row(
        'prompt',
        'System template',
        20,
        draft.prompt.trim().length >= 20,
        `${draft.prompt.trim().length} characters in the system template.`,
      ),
      row(
        'tools',
        'Tool fleet resolves',
        30,
        unknown.length === 0 && draft.agentTools.length > 0,
        unknown.length > 0
          ? `Unknown tool id(s): ${unknown.join(', ')}. The registry has no such tool.`
          : draft.agentTools.length === 0
            ? 'No tools assigned, so the agent cannot read or change anything.'
            : `${draft.agentTools.length} tool(s), all in the workspace registry.`,
        unknown.length > 0,
      ),
    ];
  } else if (draft.category === 'mcp') {
    checks = mcpRows(draft);
  } else if (draft.category === 'plugins') {
    checks = pluginRows(draft);
  } else {
    const systemClass = draft.toolGroup === 'system';
    checks = [
      identityRow(draft),
      schemaRow(draft.toolParams),
      privilegeRow(draft, draft.toolScope),
      row(
        'classification',
        'Classification agrees with the scope',
        10,
        systemClass === (draft.toolScope === 'system.execute'),
        `"${draft.toolGroup}" paired with ${draft.toolScope}. A system class needs system.execute.`,
      ),
      skippedRow(
        'output',
        'Output schema',
        15,
        'This form has no field for an authored output schema. The envelope in the preview is generated here and is not stored.',
      ),
    ];
  }

  const applicable = checks.filter((check) => !check.skipped);
  const applicableWeight = applicable.reduce((total, check) => total + check.weight, 0);
  const earnedWeight = applicable.reduce(
    (total, check) => total + (check.passed ? check.weight : 0),
    0,
  );
  return {
    checks,
    applicable: applicable.length,
    passedCount: applicable.filter((check) => check.passed).length,
    failureCount: applicable.filter((check) => !check.passed).length,
    applicableWeight,
    earnedWeight,
    blockingFailures: checks.filter((check) => !check.skipped && !check.passed && check.blocking),
  };
}

// ─── Submit validation ───────────────────────────────────────────────────────

interface FieldIssue {
  field: string;
  message: string;
}

/**
 * Only the checks the audit marked blocking are enforced here, and both read the
 * same snapshot, so the badge cannot promise a submit the form then refuses.
 *
 * `workspaceId` is deliberately not required: the page owns the server write and
 * already reports a failed one, so a client-side requirement would block the
 * offline save for no gain.
 */
function validateDraft(draft: Draft, readiness: Readiness): FieldIssue[] {
  const issues = readiness.blockingFailures.map((check) => ({
    field: check.id,
    message: check.detail,
  }));
  if (
    draft.category === 'mcp' &&
    draft.transport === 'http' &&
    !draft.allowInsecure &&
    /^http:\/\//i.test(draft.url.trim())
  ) {
    issues.push({
      field: 'allowInsecure',
      message: 'An http:// endpoint requires allow_insecure=true, a development-only opt-in.',
    });
  }
  return issues;
}

// ─── Presets ─────────────────────────────────────────────────────────────────

interface Preset {
  id: string;
  name: string;
  category: CapabilityCategory;
  title: string;
  description: string;
  tags: string[];
  autonomy: Autonomy;
  triggers?: string[];
  doc?: string;
  parameters?: ToolParam[];
  mcp?: {
    transport: McpTransport;
    command: string;
    args: string[];
    allowWindowsBatch?: boolean;
    env: Record<string, string>;
  };
  plugin?: {
    hook: PluginHook;
    sandbox: PluginSandbox;
    target: PluginTarget;
    code: string;
    author: string;
    license: string;
  };
  agent?: {
    archetype: AgentArchetype;
    modelTier: AgentModelTier;
    maxTurns: number;
    tools: string[];
    prompt: string;
  };
}

const PRESETS: Preset[] = [
  {
    id: 'pr-code-reviewer',
    name: 'pr-code-reviewer',
    category: 'skills',
    title: 'PR & Forensic Code Reviewer',
    description:
      'Diff review with security regression checks, coverage checks and concrete replacements.',
    tags: ['Review', 'Engineering', 'Security'],
    autonomy: 'autonomous',
    triggers: ['/review', 'audit code changes'],
    doc: `# PR & Forensic Code Reviewer

## Mission
Review a diff for security regressions, confirm new logic is tested, and propose
concrete replacements for anything unsafe.

## Operating Rules
1. Read every touched file before judging the change.
2. Flag SQL injection, XSS and insecure deserialization with a file and line.
3. Do not approve a change whose new branches have no test.
`,
  },
  {
    id: 'agentic-workflow-orchestrator',
    name: 'agentic-workflow-orchestrator',
    category: 'skills',
    title: 'Agentic Workflow Orchestrator',
    description: 'Multi-step ReAct decomposition with per-step verification and a fallback.',
    tags: ['Workflow', 'Agentic', 'Reasoning'],
    autonomy: 'autonomous',
    triggers: ['/orchestrate', 'plan and execute'],
    doc: `# Agentic Workflow Orchestrator

## Mission
Turn a multi-turn objective into verified sub-goals and stop when a step cannot be verified.

## Execution Policy
1. At most 12 ReAct iterations.
2. Verify sub-goal progress after every tool call.
3. Fall back to deterministic heuristics when a tool is unreachable.
`,
  },
  {
    id: 'rest-api-webhook',
    name: 'rest-api-webhook',
    category: 'tools',
    title: 'REST API Webhook Tool',
    description: 'Dispatch an authenticated JSON payload to an external webhook.',
    tags: ['Webhook', 'API', 'Integration'],
    autonomy: 'approval_required',
    parameters: [
      { name: 'endpoint_url', type: 'string', description: 'HTTPS URL', required: true },
      { name: 'payload', type: 'object', description: 'Body to dispatch', required: true },
      { name: 'idempotency_key', type: 'string', description: 'Retry token', required: false },
    ],
  },
  {
    id: 'vector-semantic-search',
    name: 'vector-semantic-search',
    category: 'tools',
    title: 'Vector Semantic Search Tool',
    description: 'Top-k workspace knowledge by cosine similarity over the memory index.',
    tags: ['Search', 'Embeddings', 'Memory'],
    autonomy: 'autonomous',
    parameters: [
      { name: 'query', type: 'string', description: 'Search query', required: true },
      { name: 'top_k', type: 'number', description: 'Max matches (default 5)', required: false },
      { name: 'threshold', type: 'number', description: 'Min similarity', required: false },
    ],
  },
  {
    id: 'filesystem-mcp',
    name: 'filesystem-mcp',
    category: 'mcp',
    title: 'Local Filesystem MCP Server',
    description:
      'Community MCP reference server for scoped filesystem access. Third-party code, not audited here.',
    tags: ['MCP', 'Filesystem', 'Local'],
    autonomy: 'approval_required',
    mcp: {
      transport: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem', '/workspace'],
      // npx resolves to npx.cmd on Windows, which validate_mcp_config refuses
      // without an explicit opt-in. Preset it rather than shipping a config that
      // cannot start.
      allowWindowsBatch: true,
      env: {},
    },
  },
  {
    id: 'github-cloud-mcp',
    name: 'github-cloud-mcp',
    category: 'mcp',
    title: 'GitHub Cloud MCP Server',
    description: 'Community MCP reference server for pull requests, issues and repositories.',
    tags: ['MCP', 'GitHub', 'DevOps'],
    autonomy: 'approval_required',
    mcp: {
      transport: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-github'],
      allowWindowsBatch: true,
      env: { GITHUB_PERSONAL_ACCESS_TOKEN: '${GITHUB_PAT}' },
    },
  },
  {
    id: 'research-analyst-agent',
    name: 'research-analyst-agent',
    category: 'agents',
    title: 'Autonomous Research Analyst',
    description: 'Investigates a topic, gathers citations, writes a cited brief.',
    tags: ['Agent', 'Research', 'Synthesis'],
    autonomy: 'autonomous',
    agent: {
      archetype: 'specialist',
      modelTier: 'pro',
      maxTurns: 8,
      tools: ['search_documents', 'browse_job_page', 'query_graph'],
      prompt: `You are Research Analyst, an enterprise agent in Vaeloom.
Role: investigate a topic, synthesise findings, format a brief.

OPERATIONAL BOUNDARIES:
- Never fabricate a claim, a citation or a tool result.
- Every assertion must reference retrieved context or memory.
`,
    },
  },
  {
    id: 'egress-dlp-hook',
    name: 'egress-dlp-hook',
    category: 'plugins',
    title: 'Egress DLP Hook',
    description: 'on_tool_call hook that blocks private-address egress. Opens no subprocess.',
    tags: ['Plugin', 'Security', 'Egress'],
    autonomy: 'autonomous',
    plugin: {
      hook: 'on_tool_call',
      sandbox: 'isolated_subprocess',
      target: 'agent',
      author: 'Vaeloom Security Team',
      license: 'MIT',
      code: `def run(input: dict, context: dict) -> dict:
    """Block egress to private and metadata addresses."""
    endpoint = str(input.get("payload", {}).get("url", ""))
    denylist = ("127.0.0.1", "localhost", "169.254.169.254")
    if any(blocked in endpoint for blocked in denylist):
        return {"status": "BLOCKED", "reason": "private address egress prohibited"}
    return {"status": "PASSED"}
`,
    },
  },
];

/**
 * Derived artefacts, as pure functions of the snapshot.
 *
 * These were `useMemo`s with 30-line dependency arrays listing the same twenty
 * identifiers three times. One snapshot in, one artefact out: no list to forget to
 * update, and the functions are testable without rendering the modal.
 */
function buildInputSchema(draft: Draft) {
  const properties: Record<string, { type: string; description: string }> = {};
  const required: string[] = [];
  for (const param of draft.toolParams) {
    const key = param.name.trim();
    if (!key) continue;
    properties[key] = { type: param.type, description: param.description || `${key} input` };
    if (param.required) required.push(key);
  }
  return { type: 'object', properties, required };
}

type InputSchema = ReturnType<typeof buildInputSchema>;

const json = (value: unknown) => JSON.stringify(value, null, 2);

/** What the right-hand pane shows, and what would be copied out of the form. */
function buildSpec(draft: Draft, inputSchema: InputSchema): string {
  const { category } = draft;
  if (category === 'mcp') {
    // Mirrors validate_mcp_config: stdio carries command + args[], http a url.
    const server =
      draft.transport === 'stdio'
        ? {
            transport: 'stdio',
            command: draft.command.trim(),
            args: draft.args,
            ...(draft.allowWindowsBatch ? { allow_windows_batch: true } : {}),
            env: Object.fromEntries(draft.envList.map((entry) => [entry.key, entry.val])),
          }
        : {
            transport: 'http',
            url: draft.url.trim(),
            ...(draft.allowInsecure ? { allow_insecure: true } : {}),
            env: Object.fromEntries(draft.envList.map((entry) => [entry.key, entry.val])),
          };
    return json({ mcpServers: { [draft.name.trim() || 'mcp-server']: server } });
  }
  if (category === 'tools') {
    return json({
      name: draft.name,
      description: draft.description,
      inputSchema,
      // Generated for review only: nothing on this path stores it, and the form
      // has no field for an authored output schema.
      outputSchemaPreview: { type: 'object', properties: { result: { type: 'string' } } },
      category: draft.toolGroup,
      required_scope: draft.toolScope,
      autonomy: draft.autonomy,
    });
  }
  if (category === 'agents') {
    return json({
      name: draft.name,
      role: draft.archetype,
      model_tier: draft.modelTier,
      max_react_rounds: draft.maxTurns,
      autonomy: draft.autonomy,
      tools: draft.agentTools,
    });
  }
  // Skills and plugins render an editable source panel instead. The old frontmatter
  // and manifest previews for them were never stored by any write path, so showing
  // them as "the spec" would describe an artifact nothing produces.
  return '';
}

/** The markdown document the create request stores, per category. */
function buildMarkdownDoc(draft: Draft, inputSchema: InputSchema): string {
  const { category, name } = draft;
  if (category === 'skills') return draft.doc;
  if (category === 'connectors') return '';
  if (category === 'mcp') {
    const endpoint =
      draft.transport === 'stdio'
        ? `Command \`${draft.command}\` with args \`${draft.args.join(' ')}\``
        : `Endpoint \`${draft.url}\``;
    return `# ${name}\n\nTransport \`${draft.transport}\`\n\n${endpoint}\n`;
  }
  if (category === 'plugins') {
    return `# ${name}\n\nHook \`${draft.hook}\` on ${draft.pluginTarget}, isolated as ${draft.sandbox}.\n\n\`\`\`python\n${draft.pluginCode}\n\`\`\`\n`;
  }
  if (category === 'agents') {
    return `# ${name}\n\nRole: ${draft.archetype}. Tools: ${draft.agentTools.join(', ') || 'none'}.\n`;
  }
  return `# ${name}\n\nRequired scope: ${draft.toolScope}. ${Object.keys(inputSchema.properties).length} parameter(s).\n`;
}

/**
 * The `config` bag this form authors, in the server's own snake_case.
 *
 * Split out of `buildCapability` because two callers need it and they must not
 * disagree: the create payload, and the draft sent to
 * `POST /capabilities/validate`. A validator pointed at a different config than
 * the one that will be saved is how a form earns a clean verdict for a draft the
 * server would reject.
 */
function buildCapabilityConfig(draft: Draft, inputSchema: InputSchema): Record<string, unknown> {
  const { category, name } = draft;
  const slug = slugify(name);
  const scope =
    category === 'tools'
      ? draft.toolScope
      : category === 'mcp'
        ? 'connector.mcp.execute'
        : category === 'skills'
          ? undefined
          : 'system.execute';
  const metadata: Record<string, unknown> = {
    autonomy: draft.autonomy,
    markdown_doc: buildMarkdownDoc(draft, inputSchema),
    ...(scope ? { required_scope: scope } : {}),
  };

  if (category === 'mcp') {
    metadata['transport'] = draft.transport;
    metadata['env'] = Object.fromEntries(draft.envList.map((entry) => [entry.key, entry.val]));
    if (draft.transport === 'stdio') {
      metadata['command'] = draft.command.trim();
      metadata['args'] = draft.args;
      if (draft.allowWindowsBatch) metadata['allow_windows_batch'] = true;
    } else {
      metadata['url'] = draft.url.trim();
      if (draft.allowInsecure) metadata['allow_insecure'] = true;
    }
  } else if (category === 'plugins') {
    Object.assign(metadata, {
      hook: draft.hook,
      sandbox: draft.sandbox,
      target: draft.pluginTarget,
      entry_point: `${slug || 'plugin'}.py`,
      code: draft.pluginCode,
      min_app_version: draft.minAppVersion,
      permissions: parseJsonObject(draft.pluginPermissions, 'Permissions').value,
    });
  } else if (category === 'agents') {
    Object.assign(metadata, {
      archetype: draft.archetype,
      model_tier: draft.modelTier,
      // `max_react_rounds` is the key
      // `services/capability_runtime_config.resolve_agent_max_rounds` reads, and
      // the field `AgentCard` declares. `max_turns`, which this form wrote
      // before, is read by nothing on the server.
      max_react_rounds: draft.maxTurns,
      system_prompt: draft.prompt,
      tools: draft.agentTools,
    });
  } else if (category === 'tools') {
    Object.assign(metadata, {
      tool_category: draft.toolGroup,
      returns: { type: 'object', properties: { result: { type: 'string' } } },
    });
  }
  return metadata;
}

/**
 * The exact config `POST /capabilities` will receive for this draft.
 *
 * The page adds `parameters`, `doc` and `tags` on top of `metadata`; this adds
 * the same three so the endpoint measures the payload rather than a subset of
 * it. `parameters` matters most: the tool validator rejects a draft whose schema
 * is absent, and sending a config without it would report a violation the create
 * path would not hit.
 */
function buildDraftConfig(draft: Draft, inputSchema: InputSchema): CapabilityConfig {
  const base = buildCapabilityConfig(draft, inputSchema);
  const config: CapabilityConfig = {
    ...base,
    parameters: inputSchema,
    doc: buildMarkdownDoc(draft, inputSchema),
    tags: draft.tags,
  };
  return config;
}

/** The categories `routers/capabilities.py` accepts; the UI names are plural. */
const SERVER_CATEGORY: Record<CapabilityCategory, string> = {
  agents: 'agent',
  skills: 'skill',
  tools: 'tool',
  mcp: 'mcp',
  plugins: 'plugin',
  connectors: 'connector',
};

/**
 * The create payload.
 *
 * `metadata` keys are the server's own snake_case because request bodies are
 * `JSON.stringify`-ed verbatim (`transformKeys` runs on responses only). The page
 * spreads `metadata` into `config` and drops `CapabilityItem.requiredScope`, so the
 * scope has to travel here or it is silently lost. Skills get no invented
 * `required_scope`: this form never asks for one.
 */
function buildCapability(draft: Draft, inputSchema: InputSchema): CapabilityItem {
  const { category, name } = draft;
  const slug = slugify(name);
  const metadata = buildCapabilityConfig(draft, inputSchema);
  const scope =
    category === 'tools'
      ? draft.toolScope
      : category === 'mcp'
        ? 'connector.mcp.execute'
        : category === 'skills'
          ? undefined
          : 'system.execute';

  const triggers = draft.triggers
    .split(',')
    .map((trigger) => trigger.trim())
    .filter(Boolean);

  return {
    id: `${category}-${slug}-${Date.now()}`,
    name: slug,
    category,
    tags: draft.tags,
    description: draft.description,
    enabled: true,
    source: 'custom',
    usageCount: 0,
    lastUsedAt: null,
    ...(scope ? { requiredScope: scope } : {}),
    trustClass: category === 'mcp' ? 'mcp.workspace.write' : 'first_party',
    version: '1.0.0',
    author: category === 'plugins' ? draft.pluginAuthor : 'Workspace Member',
    autonomy: draft.autonomy,
    ...(triggers.length > 0 ? { triggers } : {}),
    ...(category === 'agents' ? { toolsUsed: draft.agentTools } : {}),
    ...(category === 'tools' ? { inputSchema } : {}),
    metadata,
    markdownDoc: String(metadata['markdown_doc']),
  };
}

// ─── Server validation outcome ───────────────────────────────────────────────

type DraftOutcome =
  | { kind: 'idle' }
  | { kind: 'running' }
  | { kind: 'done'; response: CapabilityDraftValidationResponse }
  | { kind: 'request_failed'; error: string };

/**
 * `not_validated` gets `info`, deliberately not `success` and not `warning`.
 *
 * It means the category is real but no validator covers it, so only the shared
 * draft rules ran. Painting it green claims an approval nobody gave; painting it
 * amber implies something failed. It is a third thing and it looks like one.
 */
const DRAFT_STATUS_TONE: Record<CapabilityDraftStatus, 'success' | 'warning' | 'error' | 'info'> = {
  success: 'success',
  warning: 'warning',
  error: 'error',
  not_validated: 'info',
};

const DRAFT_STATUS_LABEL: Record<CapabilityDraftStatus, string> = {
  success: 'success — every rule that ran passed',
  warning: 'warning — only soft rules failed, so the draft is still savable',
  error: 'error — a hard rule failed, so the create path would reject this draft',
  not_validated: 'not_validated — no validator exists for this category',
};

const stringify = (value: unknown) => {
  try {
    return JSON.stringify(value, null, 2) ?? String(value);
  } catch {
    return String(value);
  }
};

/**
 * The API's verdict on the unsaved draft, verbatim.
 *
 * Every field the endpoint sends is rendered and nothing is added to it: the
 * status word, the real rule count, `executed: false` and which source the rules
 * came from. `rules_checked` is the number of rules that ran, which is not the
 * violation count and not a score, so it is labelled as a count of rules.
 *
 * Severity is structural, not a word in a sentence: a hard violation and a soft
 * one are different facts about whether the create path would reject the draft,
 * and the previous single-colour list rendered them identically.
 */
function DraftValidationOutcome({ outcome }: { outcome: CapabilityDraftValidationResponse }) {
  return (
    <div className="space-y-2.5 border border-border rounded-lg p-2.5 bg-surface">
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant={DRAFT_STATUS_TONE[outcome.status]} size="sm">
          {outcome.status}
        </Badge>
        <Badge variant="default" size="sm">
          executed: false — nothing was run
        </Badge>
      </div>

      <p className="text-2xs text-text-secondary leading-relaxed">
        {DRAFT_STATUS_LABEL[outcome.status]}
      </p>

      <p className="text-2xs font-mono text-text-secondary">
        {outcome.rulesChecked} rule{outcome.rulesChecked === 1 ? '' : 's'} checked ·{' '}
        {outcome.violations.length} violation{outcome.violations.length === 1 ? '' : 's'}
      </p>

      <DraftSourceNote outcome={outcome} />

      {outcome.detail && (
        <p className="text-2xs font-mono text-text-secondary leading-relaxed break-words">
          {outcome.detail}
        </p>
      )}

      {outcome.violations.length > 0 && (
        <ul className="space-y-1.5">
          {outcome.violations.map((violation, index) => {
            const hard = violation.severity === 'hard';
            return (
              <li
                key={`${violation.rule}-${index}`}
                data-severity={violation.severity}
                className={`p-2 rounded border-l-2 bg-surface-elevated ${
                  hard
                    ? 'border-l-error border border-error/30'
                    : 'border-l-warning border border-warning/30'
                }`}
              >
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Badge variant={hard ? 'error' : 'warning'} size="sm">
                    <span aria-hidden="true">{hard ? '✗' : '!'}</span>{' '}
                    {violation.severity === 'hard' ? 'hard' : 'soft'}
                  </Badge>
                  <span className="text-2xs font-mono font-semibold text-text">
                    {violation.rule}
                  </span>
                  {typeof violation.line === 'number' && (
                    <span className="text-2xs font-mono text-text-muted">
                      line {violation.line}
                    </span>
                  )}
                </div>
                <p className="text-2xs text-text-secondary leading-relaxed mt-1">
                  {violation.message}
                </p>
              </li>
            );
          })}
        </ul>
      )}

      <details className="text-2xs">
        <summary className="cursor-pointer text-text-muted font-mono">Response body</summary>
        <pre className="p-2 rounded bg-surface-elevated border border-border font-mono text-2xs text-text max-h-40 overflow-auto whitespace-pre-wrap break-all mt-1">
          {stringify(outcome)}
        </pre>
      </details>
    </div>
  );
}

/**
 * Which text the rules above actually read.
 *
 * `catalog` is the important one: the author is editing a copy of a bundled
 * document, so a clean verdict is about the shipped text and says nothing about
 * the edits on screen. Presenting it as a pass on their draft would be the exact
 * inversion of what it means.
 */
function DraftSourceNote({ outcome }: { outcome: CapabilityDraftValidationResponse }) {
  const note: Record<CapabilityDraftValidationResponse['validatedSource'], string> = {
    draft: 'Rules read the document in this form.',
    catalog: `Rules read the bundled catalog document${
      outcome.catalogSlug ? ` (${outcome.catalogSlug})` : ''
    }, because this draft carried no document of its own — this is a verdict on the shipped text, not on the edits above.`,
    delegated:
      'A validator this endpoint does not own did the checking (a registry, a config validator or a schema).',
    none: 'Nothing validated the substance of this draft; only the shared draft rules ran.',
  };
  return (
    <p className="text-2xs text-text-muted leading-relaxed">
      <span className="font-mono">validated_source: {outcome.validatedSource}</span> —{' '}
      {note[outcome.validatedSource]}
    </p>
  );
}

// ─── Shared form pieces ──────────────────────────────────────────────────────

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * The tag editor, rendered once.
 *
 * It used to be copy-pasted into all five category branches verbatim, which is
 * how five `cap-tag-input-*` ids and five copies of the same handlers came to
 * exist.
 */
function TagEditor({
  tags,
  input,
  onInput,
  onAdd,
  onRemove,
}: {
  tags: string[];
  input: string;
  onInput: (value: string) => void;
  onAdd: (tag: string) => void;
  onRemove: (tag: string) => void;
}) {
  const suggestions = QUICK_TAGS.filter((tag) => !tags.includes(tag)).slice(0, 6);
  return (
    <FormField label="Tags & taxonomy">
      <div className="flex flex-wrap items-center gap-1.5 p-1.5 rounded-lg bg-surface border border-border min-h-[38px]">
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-2xs font-medium bg-surface-elevated text-text border border-border"
          >
            {tag}
            <button
              type="button"
              onClick={() => onRemove(tag)}
              aria-label={`Remove tag ${tag}`}
              className="text-text-muted hover:text-text ml-0.5 rounded focus:outline-none focus-visible:ring-1 focus-visible:ring-accent"
            >
              ×
            </button>
          </span>
        ))}
        <input
          type="text"
          aria-label="Add a tag"
          value={input}
          onChange={(event) => onInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ',') {
              event.preventDefault();
              onAdd(input);
            }
          }}
          placeholder="+ Type tag and press Enter"
          className="bg-transparent text-xs text-text placeholder:text-text-muted focus:outline-none flex-1 min-w-[120px] px-1"
        />
      </div>
      <div className="flex flex-wrap items-center gap-1">
        {suggestions.map((tag) => (
          <button
            key={tag}
            type="button"
            onClick={() => onAdd(tag)}
            className="text-2xs px-1.5 py-0.5 rounded bg-surface-elevated text-text-muted hover:text-text hover:bg-surface-hover border border-border"
          >
            + {tag}
          </button>
        ))}
      </div>
    </FormField>
  );
}

const DESCRIPTION_LABEL: Record<CapabilityCategory, string> = {
  skills: 'When to activate',
  agents: 'Role mission & specialization',
  tools: 'Function description',
  mcp: 'Server description & scope',
  plugins: 'Summary description',
  connectors: 'Description',
};

function ReadinessPanel({ readiness }: { readiness: Readiness }) {
  const blocked = readiness.blockingFailures.length > 0;
  return (
    <div className="space-y-2">
      <div role="status" aria-live="polite" className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-text">Form checks (this browser only)</span>
        <Badge variant={blocked ? 'error' : 'info'} size="sm">
          {readiness.passedCount} of {readiness.applicable} applicable checks passed
        </Badge>
      </div>
      <p className="text-2xs text-text-muted leading-relaxed">
        Computed from the form state as you type, with no request. These mirror rules the server
        also enforces; they are not a server result.
      </p>
      {readiness.applicableWeight > 0 && (
        <p className="text-2xs text-text-muted font-mono">
          {readiness.earnedWeight} of {readiness.applicableWeight} weight points
        </p>
      )}
      <ul className="space-y-1">
        {readiness.checks.map((check) => (
          <li
            key={check.id}
            className="p-2 rounded-lg bg-surface border border-border flex items-start gap-2"
          >
            <Badge
              variant={
                check.skipped
                  ? 'default'
                  : check.passed
                    ? 'success'
                    : check.blocking
                      ? 'error'
                      : 'warning'
              }
              size="sm"
            >
              <span aria-hidden="true">{check.skipped ? '–' : check.passed ? '✓' : '✗'}</span>{' '}
              {check.label}
            </Badge>
            <span className="text-2xs text-text-secondary leading-relaxed min-w-0 flex-1">
              {check.detail}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SpecPanel({
  title,
  badge,
  spec,
  children,
}: {
  title: string;
  badge: string;
  spec: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="p-2.5 rounded-xl border border-border bg-surface-elevated space-y-2">
      <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-border">
        <span className="font-semibold text-text text-xs">{title}</span>
        <Badge variant="mono" size="sm">
          {badge}
        </Badge>
      </div>
      <div className="p-2.5 rounded-lg bg-surface border border-border text-primary font-mono text-xs overflow-auto max-h-[260px] whitespace-pre select-all">
        {spec}
      </div>
      {children}
    </div>
  );
}

/**
 * Editable source panel.
 *
 * One component for the three long-form editors (skill playbook, agent system
 * template, plugin handler) so the header, monospace styling and optional preview
 * toggle are defined once. All three are genuinely editable: rendering the
 * document read-only would leave the user with a field they can see and cannot
 * change.
 */
function EditorPanel({
  label,
  badge,
  value,
  onChange,
  placeholder,
  note,
  preview,
  onTogglePreview,
  renderPreview,
}: {
  label: string;
  badge: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  note: string;
  preview: boolean;
  onTogglePreview?: () => void;
  renderPreview?: (value: string) => React.ReactNode;
}) {
  return (
    <div className="p-2.5 rounded-xl border border-border bg-surface-elevated space-y-2">
      <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-border">
        <span className="font-semibold text-text text-xs">{label}</span>
        <Badge variant="mono" size="sm">
          {badge}
        </Badge>
      </div>

      {preview && renderPreview ? (
        <div className="p-2.5 rounded-lg bg-surface border border-border max-h-56 overflow-y-auto text-text">
          {renderPreview(value)}
        </div>
      ) : (
        <Textarea
          aria-label={label}
          rows={11}
          spellCheck={false}
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          className="font-mono text-xs leading-relaxed resize-none"
        />
      )}

      <div className="flex items-center justify-between gap-2 text-2xs text-text-muted">
        {onTogglePreview ? (
          <button
            type="button"
            onClick={onTogglePreview}
            className="text-primary hover:underline rounded focus:outline-none focus-visible:ring-1 focus-visible:ring-accent"
          >
            {preview ? 'Edit source' : 'Preview rendered'}
          </button>
        ) : (
          <span />
        )}
        <span>{note}</span>
      </div>
    </div>
  );
}

/**
 * One-line constructors for the two most repeated control shapes.
 *
 * Ten of each would otherwise be forty lines of label/value/onChange/options
 * boilerplate. Both narrow the incoming string through `option`, so a stale value
 * can never reach a union-typed field. `ariaLabel` drops the visible label for
 * inputs that live inside a labelled group, which is why they are distinct.
 */
function pickField<T extends string>(
  label: string,
  value: T,
  allowed: readonly T[],
  onChange: (value: T) => void,
  extra: {
    helperText?: string;
    error?: string;
    className?: string;
    ariaLabel?: string;
  } = {},
) {
  return (
    <Select
      label={extra.ariaLabel ? undefined : label}
      aria-label={extra.ariaLabel ?? label}
      value={value}
      onChange={(next) => onChange(option(next, allowed, value))}
      options={asOptions(allowed)}
      helperText={extra.helperText}
      error={extra.error}
      className={extra.className}
    />
  );
}

function textField(
  label: string,
  value: string,
  onChange: (value: string) => void,
  extra: {
    placeholder?: string;
    helperText?: string;
    error?: string;
    className?: string;
    ariaLabel?: string;
  } = {},
) {
  return (
    <Input
      label={extra.ariaLabel ? undefined : label}
      aria-label={extra.ariaLabel ?? label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={extra.placeholder}
      helperText={extra.helperText}
      error={extra.error}
      className={extra.className}
    />
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export type ImportOutcome = { ok: true } | { ok: false; message: string };

export interface AddCapabilityModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultCategory?: CapabilityCategory;
  /**
   * `'templates'` was in this union but the page never passed it: it opens the
   * modal either on the builder or on import, and Presets is reachable from the
   * in-modal tab bar. Removed so the initial view cannot be something the only
   * caller cannot ask for.
   */
  initialMode?: 'builder' | 'import';
  onCreate: (capability: CapabilityItem) => void;
  /**
   * Reports the outcome instead of rejecting.
   *
   * A rejected promise had no owner: the submit handler is awaited by nothing,
   * so a re-throw became an unhandled rejection, and a resolved promise closed
   * the dialog even when the server had registered nothing. Returning the outcome
   * makes the page the single producer of the message and this component its
   * presenter, so the form stays open only when there is something to fix.
   */
  onImport: (url: string, category: CapabilityCategory) => Promise<ImportOutcome>;
  /**
   * Names already taken in this workspace.
   *
   * Previously declared and never read, which is why the create path checked only
   * for a non-empty name and let the server answer 409. The page does not pass it
   * today, so the modal falls back to the names in the workspace's local store
   * and the check is live either way.
   */
  installedNames?: Set<string>;
  workspaceId?: string;
}

type ModalTab = 'templates' | 'builder' | 'import';

const DEFAULT_DOC = `# Operational Playbook

## Mission
Execute the designated task with verifiable evidence and a clear audit trail.

## Operating Rules
1. Check assumptions against workspace context before acting.
2. Produce output in the project's declared format.
3. Fall back to deterministic heuristics when a tool is unreachable.
`;

const DEFAULT_PLUGIN_CODE = `def run(input: dict, context: dict) -> dict:
    """Vaeloom Python sandbox transform."""
    text = input.get("text", "")
    return {"length": len(text), "tokens_approx": len(text.split())}
`;

const DEFAULT_AGENT_PROMPT = `You are {{ name }}, an enterprise agent in Vaeloom.
Role: {{ description }}

OPERATIONAL BOUNDARIES:
- Never fabricate a claim, a credential or a tool result.
- Verify every claim against memory or an available tool.
`;

const STUDIO: Record<CapabilityCategory, { title: string; blurb: string }> = {
  skills: {
    title: 'Skill Studio',
    blurb: 'Reasoning playbooks injected into agent context. No code execution, no approval gate.',
  },
  agents: {
    title: 'Agent Studio',
    blurb: 'AgentCard contracts with an autonomy policy and a tool fleet that resolves.',
  },
  tools: {
    title: 'Tool Studio',
    blurb: 'Typed functions with a JSON Schema input contract and a required security scope.',
  },
  mcp: {
    title: 'MCP Studio',
    blurb: 'Protocol endpoints. Every rule here mirrors validate_mcp_config.',
  },
  plugins: {
    title: 'Plugin Studio',
    blurb: 'Python lifecycle hooks validated against the registry manifest contract.',
  },
  connectors: {
    title: 'Connectors',
    blurb: 'Connectors are registered through the connectors API, not through this form.',
  },
};

const CATEGORY_CHOICES: Array<{ id: CapabilityCategory; label: string; desc: string }> = [
  { id: 'skills', label: 'Skills', desc: 'Reasoning loop' },
  { id: 'agents', label: 'Agents', desc: 'Autonomous actor' },
  { id: 'tools', label: 'Tools', desc: 'Typed function' },
  { id: 'mcp', label: 'MCP', desc: 'Protocol bridge' },
  { id: 'plugins', label: 'Plugins', desc: 'Lifecycle hook' },
  { id: 'connectors', label: 'Connectors', desc: 'SaaS & API' },
];

export function AddCapabilityModal({
  isOpen,
  onClose,
  defaultCategory = 'skills',
  initialMode = 'builder',
  onCreate,
  onImport,
  installedNames,
  workspaceId,
}: AddCapabilityModalProps) {
  const [activeTab, setActiveTab] = useState<ModalTab>(initialMode);
  const [category, setCategory] = useState<CapabilityCategory>(defaultCategory);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState<string[]>(['Custom']);
  const [tagInput, setTagInput] = useState('');
  const [autonomy, setAutonomy] = useState<Autonomy>('autonomous');
  const [triggers, setTriggers] = useState('');
  const [doc, setDoc] = useState(DEFAULT_DOC);
  const [docPreview, setDocPreview] = useState(false);

  const [toolParams, setToolParams] = useState<ToolParam[]>([
    { name: 'query', type: 'string', description: 'Primary input query', required: true },
  ]);
  const [toolScope, setToolScope] = useState<SecurityScope>('memory.read');
  const [toolGroup, setToolGroup] = useState<ToolGroup>('memory_read');

  const [transport, setTransport] = useState<McpTransport>('stdio');
  const [command, setCommand] = useState('npx');
  const [argsText, setArgsText] = useState('-y @modelcontextprotocol/server-example');
  const [url, setUrl] = useState('');
  const [allowWindowsBatch, setAllowWindowsBatch] = useState(false);
  const [allowInsecure, setAllowInsecure] = useState(false);
  const [envKey, setEnvKey] = useState('');
  const [envVal, setEnvVal] = useState('');
  const [envList, setEnvList] = useState<Array<{ key: string; val: string }>>([]);

  const [pluginAuthor, setPluginAuthor] = useState('Workspace Member');
  const [pluginLicense, setPluginLicense] = useState('MIT');
  const [pluginHook, setPluginHook] = useState<PluginHook>('on_tool_call');
  const [pluginSandbox, setPluginSandbox] = useState<PluginSandbox>('isolated_subprocess');
  const [pluginTarget, setPluginTarget] = useState<PluginTarget>('both');
  const [pluginCode, setPluginCode] = useState(DEFAULT_PLUGIN_CODE);
  const [pluginPermissions, setPluginPermissions] = useState('{\n  "egress.inspect": true\n}');
  const [minAppVersion, setMinAppVersion] = useState('1.0.0');
  const [testPayload, setTestPayload] = useState('{\n  "text": "Hello Vaeloom"\n}');
  const [testPayloadIssue, setTestPayloadIssue] = useState<string | null>(null);

  const [archetype, setArchetype] = useState<AgentArchetype>('specialist');
  const [modelTier, setModelTier] = useState<AgentModelTier>('pro');
  const [maxTurns, setMaxTurns] = useState(12);
  const [agentTools, setAgentTools] = useState<string[]>(['search_documents', 'query_graph']);
  const [agentPrompt, setAgentPrompt] = useState(DEFAULT_AGENT_PROMPT);

  const [importUrl, setImportUrl] = useState('');
  const [importCategory, setImportCategory] = useState<CapabilityCategory>('skills');
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [fileReport, setFileReport] = useState<{ name: string; detail: string } | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  const [presetSearch, setPresetSearch] = useState('');
  const [presetFilter, setPresetFilter] = useState('all');
  const [draftOutcome, setDraftOutcome] = useState<DraftOutcome>({ kind: 'idle' });
  const [issues, setIssues] = useState<FieldIssue[]>([]);
  const [collisions, setCollisions] = useState<ReadonlySet<string>>(() => new Set<string>());

  const nameRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const lastFocusedRef = useRef<HTMLElement | null>(null);
  const submittingRef = useRef(false);

  // Names already taken, read once per open. `getStoredCapabilities` parses JSON
  // and can write a migration envelope, which is not something to do on every
  // character typed into the name field.
  useEffect(() => {
    if (!isOpen) return;
    const names = new Set<string>();
    installedNames?.forEach((entry) => names.add(entry.toLowerCase()));
    if (workspaceId) {
      try {
        for (const item of getStoredCapabilities(workspaceId)) {
          names.add(item.name.toLowerCase());
          names.add(slugify(item.name).toLowerCase());
        }
      } catch {
        // getStoredCapabilities records the reason on the storage-health channel,
        // which the page surfaces. The set simply stays short here and the
        // server's 409 remains the backstop.
      }
    }
    setCollisions(names);
  }, [isOpen, installedNames, workspaceId]);

  useEffect(() => {
    if (!isOpen) return;
    setActiveTab(initialMode);
    setCategory(defaultCategory);
    setIssues([]);
    setImportError(null);
    setDraftOutcome({ kind: 'idle' });
    submittingRef.current = false;
    lastFocusedRef.current = document.activeElement as HTMLElement | null;
    return () => lastFocusedRef.current?.focus?.();
  }, [isOpen, initialMode, defaultCategory]);

  useEffect(() => {
    if (!isOpen) return;
    const first = dialogRef.current?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? dialogRef.current)?.focus();
  }, [isOpen]);

  /**
   * Escape and the focus trap live on the dialog element, not on `window`.
   *
   * A window listener fired for keystrokes aimed anywhere on the page, which is
   * how Ctrl+Enter used to submit the Presets view: a view with no form and no
   * submit button, in a modal whose footer hid the submit control.
   */
  const onDialogKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const nodes = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
      const firstNode = nodes[0];
      const lastNode = nodes[nodes.length - 1];
      if (!firstNode || !lastNode) {
        event.preventDefault();
        dialogRef.current.focus();
      } else if (event.shiftKey && document.activeElement === firstNode) {
        event.preventDefault();
        lastNode.focus();
      } else if (!event.shiftKey && document.activeElement === lastNode) {
        event.preventDefault();
        firstNode.focus();
      }
    },
    [onClose],
  );

  const addTag = useCallback((tag: string) => {
    const trimmed = tag.trim().replace(/^#/, '');
    if (!trimmed) return;
    setTags((previous) => (previous.includes(trimmed) ? previous : [...previous, trimmed]));
    setTagInput('');
  }, []);

  const patchParam = useCallback((index: number, patch: Partial<ToolParam>) => {
    setToolParams((prev) => prev.map((param, i) => (i === index ? { ...param, ...patch } : param)));
  }, []);

  /**
   * Derived values, computed plainly.
   *
   * Memoising these cost five dependency arrays listing the same thirty
   * identifiers, which is thirty lines to protect a few microseconds of work in a
   * form that re-renders on every keystroke anyway. A bracket scan over a few
   * hundred characters of plugin source is not what makes this dialog slow.
   */
  const args = splitArgs(argsText);
  const triggerList = triggers
    .split(',')
    .map((trigger) => trigger.trim())
    .filter(Boolean);

  const draft: Draft = {
    category,
    name,
    description,
    tags,
    triggers,
    doc,
    autonomy,
    transport,
    command,
    args,
    url,
    allowWindowsBatch,
    allowInsecure,
    envList,
    toolParams,
    toolScope,
    toolGroup,
    archetype,
    modelTier,
    maxTurns,
    agentTools,
    prompt: agentPrompt,
    hook: pluginHook,
    sandbox: pluginSandbox,
    pluginTarget,
    pluginCode,
    pluginAuthor,
    pluginLicense,
    pluginPermissions,
    minAppVersion,
    collisions,
  };

  const inputSchema = buildInputSchema(draft);
  const readiness = buildReadiness(draft);
  const spec = buildSpec(draft, inputSchema);
  const markdownDoc = buildMarkdownDoc(draft, inputSchema);
  const nameIssue =
    readiness.blockingFailures.find((check) => check.id === 'identity')?.detail ?? null;
  const permissionsIssue =
    readiness.blockingFailures.find((check) => check.id === 'permissions')?.detail ?? null;
  const argvIssue = readiness.blockingFailures.find((check) => check.id === 'argv')?.detail ?? null;
  const endpointIssue =
    readiness.blockingFailures.find((check) => check.id === 'endpoint')?.detail ?? null;

  /**
   * The one submit path.
   *
   * Ctrl+Enter, the footer's Create button and the browser's own form submit all
   * land here. `submittingRef` stays set until the modal is reopened, so a second
   * keystroke or a double click cannot produce two `onCreate` calls.
   *
   * Not wrapped in `useCallback`: it closes over the freshly-built `draft`, and
   * memoising it would only mean listing every field again.
   */
  function submit() {
    if (submittingRef.current) return;
    const found = validateDraft(draft, readiness);
    if (found.length > 0) {
      setIssues(found);
      nameRef.current?.focus();
      return;
    }
    submittingRef.current = true;
    setIssues([]);
    onCreate(buildCapability(draft, inputSchema));
    onClose();
  }

  function onFormSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submit();
  }

  function onFormKeyDown(event: React.KeyboardEvent<HTMLFormElement>) {
    if (event.key !== 'Enter' || (!event.ctrlKey && !event.metaKey)) return;
    // Scoped to the form. The previous window-level listener fired from any view in
    // the modal, including Presets, which has no form to submit.
    event.preventDefault();
    submit();
  }

  const applyPreset = useCallback((preset: Preset) => {
    setName(preset.name);
    setCategory(preset.category);
    setTags(preset.tags);
    setDescription(preset.description);
    setAutonomy(preset.autonomy);
    setIssues([]);
    setDraftOutcome({ kind: 'idle' });
    if (preset.doc) setDoc(preset.doc);
    if (preset.triggers) setTriggers(preset.triggers.join(', '));
    if (preset.parameters) setToolParams(preset.parameters);
    if (preset.mcp) {
      setTransport(preset.mcp.transport);
      setCommand(preset.mcp.command);
      setArgsText(preset.mcp.args.join(' '));
      setAllowWindowsBatch(preset.mcp.allowWindowsBatch ?? false);
      setEnvList(Object.entries(preset.mcp.env).map(([key, val]) => ({ key, val })));
    }
    if (preset.plugin) {
      setPluginHook(option(preset.plugin.hook, PLUGIN_HOOKS, 'on_tool_call'));
      setPluginSandbox(option(preset.plugin.sandbox, PLUGIN_SANDBOXES, 'isolated_subprocess'));
      setPluginTarget(option(preset.plugin.target, PLUGIN_TARGETS, 'both'));
      setPluginCode(preset.plugin.code);
      setPluginAuthor(preset.plugin.author);
      setPluginLicense(preset.plugin.license);
    }
    if (preset.agent) {
      setArchetype(option(preset.agent.archetype, AGENT_ARCHETYPES, 'specialist'));
      setModelTier(option(preset.agent.modelTier, AGENT_MODEL_TIERS, 'pro'));
      setMaxTurns(preset.agent.maxTurns);
      setAgentTools(preset.agent.tools);
      setAgentPrompt(preset.agent.prompt);
    }
    setActiveTab('builder');
  }, []);

  /**
   * Parse a dropped or browsed capability file into the builder.
   *
   * `parsed.category` is accepted only when it names a category this form can
   * author. The previous version wrote an arbitrary string straight from the file
   * into a `CapabilityCategory` field, so a file saying `"category":
   * "everything"` put a value in a union the compiler believed was closed.
   */
  const handleFile = useCallback((file: File) => {
    const reader = new FileReader();
    const notes: string[] = [];

    reader.onerror = () => {
      setFileReport(null);
      setFileError(`Could not read ${file.name}.`);
    };

    reader.onload = (event) => {
      const content = typeof event.target?.result === 'string' ? event.target.result : '';
      if (!content) {
        setFileReport(null);
        setFileError(`${file.name} is empty.`);
        return;
      }
      setName(
        file.name
          .replace(/\.[^/.]+$/, '')
          .toLowerCase()
          .replace(/[^a-z0-9_-]/g, '-'),
      );

      if (file.name.toLowerCase().endsWith('.json')) {
        let parsed: Record<string, unknown> | null = null;
        try {
          const candidate: unknown = JSON.parse(content);
          if (candidate !== null && typeof candidate === 'object' && !Array.isArray(candidate)) {
            parsed = candidate as Record<string, unknown>;
          }
        } catch {
          parsed = null;
        }
        if (!parsed) {
          notes.push('not a JSON object, so it was loaded as raw documentation');
          setDoc(content);
        } else {
          const declaredName = parsed['name'];
          if (typeof declaredName === 'string') {
            if (NAME_PATTERN.test(declaredName.trim()) && declaredName.trim() !== '') {
              setName(declaredName.trim());
            } else {
              notes.push(
                'the file name was empty or outside the API pattern, so the filename was used',
              );
            }
          }
          if (typeof parsed['description'] === 'string') {
            setDescription((parsed['description'] as string).trim());
          }
          if (Array.isArray(parsed['tags'])) {
            const found = parsed['tags'].filter((tag): tag is string => typeof tag === 'string');
            if (found.length > 0) setTags(found);
          }
          const servers = parsed['mcpServers'];
          const isMcp =
            (servers !== null && typeof servers === 'object') || parsed['transport'] !== undefined;
          const declaredCategory = parsed['category'];
          if (isMcp) {
            setCategory('mcp');
            if (typeof parsed['command'] === 'string') setCommand(parsed['command']);
            if (Array.isArray(parsed['args'])) {
              setArgsText(
                parsed['args'].filter((arg): arg is string => typeof arg === 'string').join(' '),
              );
            }
            if (typeof parsed['url'] === 'string' && parsed['url'].trim() !== '') {
              setUrl(parsed['url']);
              setTransport('http');
            }
            if (parsed['transport'] === 'stdio' || parsed['transport'] === 'http') {
              setTransport(parsed['transport']);
            }
            notes.push('read as an MCP server definition');
          } else if (typeof declaredCategory === 'string') {
            const known = CATEGORY_CHOICES.find((choice) => choice.id === declaredCategory);
            if (known && known.id !== 'skills') {
              setCategory(known.id);
              notes.push(`category set to "${known.id}"`);
            } else if (!known) {
              notes.push(
                `category "${declaredCategory}" is not one this form authors, so it was left alone`,
              );
            }
          }
          setDoc(content);
        }
      } else {
        setCategory('skills');
        setDoc(content);
        const title = /^#\s+(.+)$/m.exec(content);
        if (title?.[1]) {
          setName(
            title[1]
              .trim()
              .toLowerCase()
              .replace(/[^a-z0-9_-]/g, '-'),
          );
        }
        const summary = /^##\s+(?:Mission|Description|Overview)\s*\n+([^#\n]+)/im.exec(content);
        if (summary?.[1]) setDescription(summary[1].trim());
        notes.push('read as a Markdown playbook');
      }

      setFileError(null);
      setFileReport({
        name: file.name,
        detail: [`${content.length} characters`, ...notes].join(' · '),
      });
      setActiveTab('builder');
    };

    reader.readAsText(file);
  }, []);

  /**
   * The page already toasts an import failure and re-throws it so a caller could
   * react. This layer swallows the rejection: re-throwing here produced an
   * unhandled rejection, because nothing awaits this handler either. The outcome
   * carries the message instead, so a failure keeps the form open with the reason
   * on screen and only a real success closes the dialog.
   */
  const onImportSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const target = importUrl.trim();
      if (!target) return;
      setImportLoading(true);
      setImportError(null);
      // The contract is that onImport resolves with an outcome and never
      // throws - the page's handler owns the message for exactly that reason.
      // Treated as advisory rather than enforced: a handler that rejects would
      // otherwise skip setImportLoading, so the button stays stuck on
      // "Registering..." forever and the rejection escapes a handler nobody
      // awaits. A UI boundary should not depend on every caller remembering.
      let outcome: ImportOutcome;
      try {
        outcome = await onImport(target, importCategory);
      } catch (error) {
        outcome = {
          ok: false,
          message: error instanceof Error ? error.message : String(error),
        };
      }
      setImportLoading(false);
      if (!outcome.ok) {
        setImportError(outcome.message);
        return;
      }
      onClose();
    },
    [importUrl, importCategory, onImport, onClose],
  );

  const canValidate = Boolean(workspaceId);

  /**
   * Validate the unsaved draft.
   *
   * `POST /capabilities/validate` measures the fields a create would write, so
   * the config sent here is built by the same function the create payload uses
   * (`buildDraftConfig`). The previous version of this handler called
   * `POST /agents/capabilities/test`, which looks a capability up *by name in the
   * database* — so inside this modal it could only ever report on a row that did
   * not exist yet, or on a catalog entry with the same name.
   *
   * The plugin payload editor is not part of the draft: `testPayload` is a sample
   * `run(input)` call, and the sandbox handler is what a plugin actually declares.
   * Sending the sample instead of the handler would have the registry validator
   * read the wrong document, so the payload editor no longer feeds this call.
   *
   * Not wrapped in `useCallback`, for the same reason `submit` is not: it reads
   * the freshly built `draft`, and a dependency array would either be thirty
   * identifiers long or a lie about what it depends on.
   */
  async function runDraftValidation() {
    const slug = slugify(name);
    if (!slug) {
      setDraftOutcome({
        kind: 'request_failed',
        error:
          'There is no identifier to send. The server requires a name of at least one character, so no request was made and no verdict was obtained.',
      });
      return;
    }

    const config = buildDraftConfig(draft, inputSchema);
    setTestPayloadIssue(null);
    setDraftOutcome({ kind: 'running' });
    try {
      setDraftOutcome({
        kind: 'done',
        response: await capabilitiesApi.validateDraft({
          name: slug,
          category: SERVER_CATEGORY[category],
          description,
          config,
          // Read back through the typed getter rather than sent from the raw
          // select state, so the top-level field and `config.autonomy` cannot
          // disagree about what this form is authoring.
          autonomy: capabilityConfigAutonomy(config),
        }),
      });
    } catch (err) {
      setDraftOutcome({
        kind: 'request_failed',
        error: err instanceof Error ? err.message : 'The validation request failed.',
      });
    }
  }

  const filteredPresets = PRESETS.filter((preset) => {
    if (presetFilter !== 'all' && preset.category !== presetFilter) return false;
    const query = presetSearch.trim().toLowerCase();
    if (!query) return true;
    return (
      preset.title.toLowerCase().includes(query) ||
      preset.description.toLowerCase().includes(query) ||
      preset.tags.some((tag) => tag.toLowerCase().includes(query))
    );
  });

  /**
   * Category-specific field groups.
   *
   * Plain functions returning JSX, called as `{mcpFields()}`, rather than JSX
   * components: a component defined in the render body is a new type on every
   * render, which remounts its subtree and drops focus out of the field being
   * typed into.
   */

  const mcpFields = () => (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {pickField('Transport', transport, MCP_TRANSPORTS, setTransport)}
        {transport === 'stdio' ? (
          <>
            {textField('Command', command, setCommand, { placeholder: 'npx' })}
            {textField(`Arguments (${args.length})`, argsText, setArgsText, {
              placeholder: '-y @modelcontextprotocol/server-filesystem /data',
            })}
          </>
        ) : (
          <div className="sm:col-span-2">
            {textField('Endpoint URL', url, setUrl, {
              placeholder: 'https://api.example.internal/mcp',
              error: endpointIssue ?? undefined,
            })}
          </div>
        )}
      </div>

      {argvIssue && (
        <p role="alert" className="text-xs text-error">
          {argvIssue}
        </p>
      )}

      <div className="space-y-1.5">
        <label className="flex items-start gap-2 text-xs text-text-secondary cursor-pointer">
          <input
            type="checkbox"
            checked={allowWindowsBatch}
            onChange={(event) => setAllowWindowsBatch(event.target.checked)}
            className="mt-0.5"
          />
          <span>
            Allow Windows batch wrapper (<code className="font-mono">.cmd</code>/
            <code className="font-mono">.bat</code>)
            <span className="block text-2xs text-text-muted">
              Required for <code className="font-mono">npx</code> and{' '}
              <code className="font-mono">uvx</code> on Windows: they resolve to a shim
              CreateProcess cannot run, and validate_mcp_config refuses the connector without this
              opt-in.
            </span>
          </span>
        </label>
        {transport === 'http' && (
          <label className="flex items-start gap-2 text-xs text-text-secondary cursor-pointer">
            <input
              type="checkbox"
              checked={allowInsecure}
              onChange={(event) => setAllowInsecure(event.target.checked)}
              className="mt-0.5"
            />
            <span>
              Allow plain http:// endpoint (development only)
              <span className="block text-2xs text-text-muted">
                An http:// URL is refused by validate_mcp_config unless this is set.
              </span>
            </span>
          </label>
        )}
      </div>

      <FormField
        label="Environment variables"
        hint="Values must be ${VAR} references. A literal is written to the workspace row in clear text."
      >
        <div className="flex items-center gap-1.5">
          {textField('KEY', envKey, setEnvKey, { ariaLabel: 'Environment variable name' })}
          {textField('${VAULT_KEY}', envVal, setEnvVal, {
            ariaLabel: 'Environment variable value reference',
          })}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => {
              if (!envKey.trim()) return;
              setEnvList((prev) => [...prev, { key: envKey.trim(), val: envVal.trim() }]);
              setEnvKey('');
              setEnvVal('');
            }}
          >
            + Env
          </Button>
        </div>
      </FormField>

      {envList.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {envList.map((entry, index) => (
            <li
              key={`${entry.key}-${index}`}
              className="px-2 py-0.5 rounded bg-surface-elevated border border-border text-2xs font-mono text-primary flex items-center gap-1"
            >
              {entry.key}
              {VAULT_REFERENCE.test(entry.val) ? '=reference' : '=literal'}
              <button
                type="button"
                aria-label={`Remove environment variable ${entry.key}`}
                onClick={() => setEnvList((prev) => prev.filter((_, idx) => idx !== index))}
                className="text-text-muted hover:text-text rounded focus:outline-none focus-visible:ring-1 focus-visible:ring-accent"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );

  const toolFields = () => (
    <>
      <FormField label="Parameter schema (JSON Schema)" required>
        <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
          {toolParams.map((param, index) => (
            <div key={index} className="flex items-center gap-1.5">
              {textField('name', param.name, (value) => patchParam(index, { name: value }), {
                ariaLabel: `Parameter ${index + 1} name`,
                className: 'w-28',
              })}
              {pickField(
                'type',
                param.type,
                TOOL_PARAM_TYPES,
                (value) => patchParam(index, { type: value }),
                {
                  ariaLabel: `Parameter ${index + 1} type`,
                  className: 'w-24',
                },
              )}
              {textField(
                'Description',
                param.description,
                (value) => patchParam(index, { description: value }),
                {
                  ariaLabel: `Parameter ${index + 1} description`,
                },
              )}
              <label className="flex items-center gap-1 text-2xs text-text-muted shrink-0">
                <input
                  type="checkbox"
                  checked={param.required}
                  onChange={(event) => patchParam(index, { required: event.target.checked })}
                />
                Req
              </label>
              <Tooltip content="Remove this parameter">
                <button
                  type="button"
                  aria-label={`Remove parameter ${param.name || index + 1}`}
                  onClick={() => setToolParams((prev) => prev.filter((_, i) => i !== index))}
                  className="text-text-muted hover:text-danger rounded focus:outline-none focus-visible:ring-1 focus-visible:ring-accent"
                >
                  ×
                </button>
              </Tooltip>
            </div>
          ))}
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() =>
            setToolParams((prev) => [
              ...prev,
              {
                name: `param_${prev.length + 1}`,
                type: 'string',
                description: '',
                required: false,
              },
            ])
          }
        >
          + Add parameter
        </Button>
      </FormField>

      <div className="grid grid-cols-2 gap-2.5">
        {pickField('Required security scope', toolScope, SECURITY_SCOPES, setToolScope)}
        {pickField('Category classification', toolGroup, TOOL_GROUPS, setToolGroup)}
      </div>
    </>
  );

  const pluginFields = () => (
    <>
      <div className="grid grid-cols-2 gap-2.5">
        {pickField('Lifecycle hook', pluginHook, PLUGIN_HOOKS, setPluginHook)}
        {pickField('Isolation', pluginSandbox, PLUGIN_SANDBOXES, setPluginSandbox)}
      </div>
      <div className="grid grid-cols-3 gap-2.5">
        {pickField('Execution target', pluginTarget, PLUGIN_TARGETS, setPluginTarget)}
        {textField('Author', pluginAuthor, setPluginAuthor)}
        {textField('SPDX license', pluginLicense, setPluginLicense)}
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        {textField('Min app version', minAppVersion, setMinAppVersion)}
        <Textarea
          label="Sandbox input payload (JSON)"
          rows={3}
          spellCheck={false}
          value={testPayload}
          helperText="A sample input for your own run(input) call. It is not sent anywhere: draft validation reads the handler and the manifest."
          onChange={(event) => setTestPayload(event.target.value)}
          onBlur={() => {
            // Local parse only, and it never blocks the draft call: this payload
            // is not part of the request, so a malformed sample is a note about
            // the author's own test harness rather than a server verdict.
            setTestPayloadIssue(parseJsonObject(testPayload, 'The payload').reason || null);
          }}
        />
      </div>
      <Textarea
        label="Declared permissions (JSON object)"
        rows={3}
        spellCheck={false}
        value={pluginPermissions}
        onChange={(event) => setPluginPermissions(event.target.value)}
        error={permissionsIssue ?? undefined}
        helperText="The registry requires an object. Edit it to match what the hook does; nothing on this form grants it."
      />
      {testPayloadIssue && (
        <p role="alert" className="text-xs text-error">
          Sandbox payload: {testPayloadIssue}
        </p>
      )}
    </>
  );

  if (!isOpen) return null;

  const studio = STUDIO[category];
  const pluginEscape = category === 'plugins' ? findSandboxEscape(pluginCode) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-capability-modal-title"
        aria-describedby="add-capability-modal-desc"
        tabIndex={-1}
        onKeyDown={onDialogKeyDown}
        className="relative w-full max-w-5xl h-[670px] max-h-[90dvh] bg-surface border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden text-text antialiased focus:outline-none"
      >
        <header className="px-5 py-3 border-b border-border bg-surface-elevated flex items-start justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
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
            <div className="min-w-0">
              <h2
                id="add-capability-modal-title"
                className="text-sm font-semibold text-text font-sans"
              >
                Add Custom Capability <span className="text-text-muted font-normal">•</span>{' '}
                <span className="text-primary">{studio.title}</span>
              </h2>
              <p id="add-capability-modal-desc" className="text-xs text-text-muted font-sans">
                {studio.blurb}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="text-text-muted hover:text-text p-1 rounded-lg hover:bg-surface-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent shrink-0"
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

        {issues.length > 0 && (
          <div
            role="alert"
            className="px-5 py-2 bg-error/10 border-b border-error/30 flex items-start justify-between gap-3 text-xs text-error shrink-0"
          >
            <span>
              Not submitted. {issues.length} blocking {issues.length === 1 ? 'problem' : 'problems'}
              : {issues.map((issue) => issue.message).join(' ')}
            </span>
            <button
              type="button"
              onClick={() => setIssues([])}
              aria-label="Dismiss validation problems"
              className="rounded focus:outline-none focus-visible:ring-1 focus-visible:ring-error"
            >
              ×
            </button>
          </div>
        )}

        {/*
          File-parse notices live outside the tab panels on purpose. A successful
          parse switches the modal to the builder, so a confirmation rendered inside
          the Import tab is unmounted by the very action it reports -- which is why
          `fileParseSuccess` was dead state in the previous version too.
        */}
        {fileReport && (
          <div
            role="status"
            className="px-5 py-2 bg-success/10 border-b border-success/30 flex items-start justify-between gap-3 text-xs text-success shrink-0"
          >
            <span>
              <strong>{fileReport.name}</strong> was read into the builder — {fileReport.detail}.
            </span>
            <button
              type="button"
              onClick={() => setFileReport(null)}
              aria-label="Dismiss file parse result"
              className="rounded focus:outline-none focus-visible:ring-1 focus-visible:ring-success"
            >
              ×
            </button>
          </div>
        )}

        {fileError && (
          <div
            role="alert"
            className="px-5 py-2 bg-error/10 border-b border-error/30 flex items-start justify-between gap-3 text-xs text-error shrink-0"
          >
            <span>{fileError}</span>
            <button
              type="button"
              onClick={() => setFileError(null)}
              aria-label="Dismiss file error"
              className="rounded focus:outline-none focus-visible:ring-1 focus-visible:ring-error"
            >
              ×
            </button>
          </div>
        )}

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain">
          <Tabs
            className="sticky top-0 z-10 border-b border-border rounded-none"
            ariaLabel="Capability source"
            size="sm"
            tabs={[
              { id: 'templates', label: 'Presets' },
              { id: 'builder', label: 'Studio Builder' },
              { id: 'import', label: 'Import Git / File' },
            ]}
            activeTab={activeTab}
            onTabChange={(id) => setActiveTab(id as ModalTab)}
          />

          {/* ── Presets ─────────────────────────────────────────────────── */}
          <TabPanel id="templates" activeTab={activeTab} className="p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-border">
              <div>
                <h3 className="text-sm font-semibold text-text">Production scaffolds</h3>
                <p className="text-xs text-text-muted">
                  Each preset seeds the builder. Every field stays editable and every check is
                  re-run against what you leave in the form.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <SearchField
                  value={presetSearch}
                  onChange={setPresetSearch}
                  placeholder="Search blueprints"
                  aria-label="Search presets"
                  className="w-44"
                />
                <Select
                  value={presetFilter}
                  onChange={setPresetFilter}
                  aria-label="Filter presets by category"
                  options={[
                    { value: 'all', label: 'All types' },
                    ...CATEGORY_CHOICES.filter((choice) => choice.id !== 'connectors').map(
                      (choice) => ({ value: choice.id, label: choice.label }),
                    ),
                  ]}
                />
              </div>
            </div>

            {filteredPresets.length === 0 ? (
              <EmptyState
                title="No presets match"
                description="Clear the search or widen the category filter."
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filteredPresets.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => applyPreset(preset)}
                    className="group text-left p-3.5 rounded-xl border border-border bg-surface-elevated hover:bg-surface-hover hover:border-primary/50 transition-all flex flex-col justify-between gap-3"
                  >
                    <span className="block">
                      <span className="flex items-center justify-between gap-2 mb-1.5">
                        <span className="text-xs font-semibold text-text group-hover:text-primary">
                          {preset.title}
                        </span>
                        <Badge variant="mono" size="sm" className="capitalize text-2xs">
                          {preset.category}
                        </Badge>
                      </span>
                      <span className="block text-xs text-text-muted line-clamp-2 leading-relaxed">
                        {preset.description}
                      </span>
                    </span>
                    <span className="flex items-center justify-between gap-2 pt-2.5 border-t border-border text-xs">
                      <span className="flex flex-wrap gap-1">
                        {preset.tags.map((tag) => (
                          <span
                            key={tag}
                            className="px-1.5 py-0.2 rounded text-2xs bg-surface text-text-muted border border-border"
                          >
                            {tag}
                          </span>
                        ))}
                      </span>
                      <span className="text-primary font-medium">Use template →</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </TabPanel>

          {/* ── Builder ─────────────────────────────────────────────────── */}
          <TabPanel id="builder" activeTab={activeTab} className="p-5">
            <form
              onSubmit={onFormSubmit}
              onKeyDown={onFormKeyDown}
              noValidate
              className="space-y-4"
            >
              <FormField label="Capability category" required>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {CATEGORY_CHOICES.map((choice) => (
                    <button
                      key={choice.id}
                      type="button"
                      aria-pressed={category === choice.id}
                      onClick={() => {
                        setCategory(choice.id);
                        setIssues([]);
                        setDraftOutcome({ kind: 'idle' });
                      }}
                      className={`flex flex-col items-center justify-center p-2 rounded-xl border text-xs font-medium transition-all ${
                        category === choice.id
                          ? 'bg-primary/15 border-primary text-primary shadow-xs ring-1 ring-primary/40'
                          : 'bg-surface border-border text-text-muted hover:text-text hover:bg-surface-hover'
                      }`}
                    >
                      <span className="font-semibold text-xs text-text">{choice.label}</span>
                      <span className="text-2xs text-text-muted font-normal">{choice.desc}</span>
                    </button>
                  ))}
                </div>
              </FormField>

              {category === 'connectors' ? (
                <EmptyState
                  title="Connectors are not authored here"
                  description="A connector needs a type-specific row in POST /api/v1/connectors plus its own credential flow. This form would write a capability row with no working secret, so it refuses to. Use the Connectors tab, or pick another category."
                />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-start">
                  {/* Identity, shared by every category */}
                  <div className="space-y-3.5">
                    <FormField label="Name / identifier" required error={nameIssue ?? undefined}>
                      {({ id, errorId }) => (
                        <input
                          ref={nameRef}
                          id={id}
                          type="text"
                          value={name}
                          aria-invalid={nameIssue ? true : undefined}
                          aria-describedby={nameIssue ? errorId : undefined}
                          onChange={(event) => {
                            setName(event.target.value);
                            setIssues([]);
                          }}
                          placeholder="e.g. code-synthesizer or ats-scoring"
                          className="w-full px-3 py-1.5 rounded-lg bg-surface border border-border text-text placeholder:text-text-muted focus:outline-none focus:border-primary font-mono text-xs focus-visible:ring-2 focus-visible:ring-accent"
                        />
                      )}
                    </FormField>

                    {textField(DESCRIPTION_LABEL[category], description, setDescription, {
                      placeholder: 'What this does, and when the runtime should reach for it',
                    })}

                    {pickField('Autonomy policy', autonomy, AUTONOMY_VALUES, setAutonomy, {
                      helperText:
                        'Validated server-side against suggest | autonomous | approval_required.',
                    })}

                    <TagEditor
                      tags={tags}
                      input={tagInput}
                      onInput={setTagInput}
                      onAdd={addTag}
                      onRemove={(tag) => setTags((prev) => prev.filter((entry) => entry !== tag))}
                    />

                    {category === 'skills' &&
                      textField('Routing & trigger keywords', triggers, setTriggers, {
                        placeholder: '/review, pr audit, check code quality',
                        helperText:
                          'Comma separated. The runtime matches incoming work against these.',
                      })}

                    {category === 'agents' && (
                      <>
                        <div className="grid grid-cols-2 gap-2.5">
                          {pickField('Role archetype', archetype, AGENT_ARCHETYPES, setArchetype)}
                          {pickField('Model tier', modelTier, AGENT_MODEL_TIERS, setModelTier)}
                        </div>
                        <Input
                          label="Max ReAct rounds"
                          type="number"
                          min={MIN_REACT_ROUNDS}
                          max={MAX_REACT_ROUNDS}
                          helperText={`Stored as config.${CAPABILITY_MAX_REACT_ROUNDS_KEY}. The runtime resolves the budget from this row, then the agent card, then AGENT_MAX_REACT_ROUNDS (default 5), then 5 — and clamps anything outside ${MIN_REACT_ROUNDS}–${MAX_REACT_ROUNDS} with a log.`}
                          value={maxTurns}
                          onChange={(event) => {
                            const parsed = Number.parseInt(event.target.value, 10);
                            if (Number.isNaN(parsed)) return;
                            setMaxTurns(parsed);
                          }}
                        />
                        <FormField
                          label={`Assigned workspace tools (${agentTools.length} selected)`}
                        >
                          <div className="grid grid-cols-2 gap-1.5 max-h-32 overflow-y-auto pr-1">
                            {AGENT_TOOLS.map((tool) => {
                              const checked = agentTools.includes(tool.id);
                              return (
                                <label
                                  key={tool.id}
                                  className={`flex items-center gap-2 p-1.5 rounded border text-xs cursor-pointer ${
                                    checked
                                      ? 'bg-primary/10 border-primary/40 text-primary'
                                      : 'bg-surface border-border text-text-muted hover:text-text'
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() =>
                                      setAgentTools((prev) =>
                                        checked
                                          ? prev.filter((entry) => entry !== tool.id)
                                          : [...prev, tool.id],
                                      )
                                    }
                                  />
                                  <span className="font-mono text-xs truncate">{tool.name}</span>
                                </label>
                              );
                            })}
                          </div>
                        </FormField>
                      </>
                    )}

                    {category === 'mcp' && mcpFields()}

                    {category === 'tools' && toolFields()}

                    {category === 'plugins' && pluginFields()}
                  </div>

                  {/* Spec, checks and server validation */}
                  <div className="space-y-3">
                    {category === 'skills' && (
                      <EditorPanel
                        label="Playbook documentation"
                        badge="SKILL.md"
                        value={doc}
                        onChange={setDoc}
                        placeholder={'# Title\n\n## Mission\nState what the skill does.'}
                        note={`${doc.trim().length} chars · ${countHeadings(doc)} heading(s)`}
                        preview={docPreview}
                        onTogglePreview={() => setDocPreview((open) => !open)}
                        renderPreview={(value) =>
                          value ? (
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{value}</ReactMarkdown>
                          ) : (
                            <span className="text-text-muted italic">No documentation yet.</span>
                          )
                        }
                      />
                    )}

                    {category === 'agents' && (
                      <>
                        <EditorPanel
                          label="System template"
                          badge="Jinja2"
                          value={agentPrompt}
                          onChange={setAgentPrompt}
                          placeholder="You are {{ name }}..."
                          note={`${agentPrompt.trim().length} chars`}
                          preview={false}
                        />
                        <SpecPanel title="AgentCard" badge="v1.0" spec={spec} />
                      </>
                    )}

                    {category === 'mcp' && (
                      <SpecPanel
                        title="mcpServers manifest"
                        badge="validate_mcp_config"
                        spec={spec}
                      >
                        <div className="flex justify-end">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => void navigator.clipboard?.writeText(spec)}
                          >
                            Copy JSON
                          </Button>
                        </div>
                      </SpecPanel>
                    )}

                    {category === 'plugins' && (
                      <EditorPanel
                        label="Python sandbox handler"
                        badge="Python"
                        value={pluginCode}
                        onChange={setPluginCode}
                        placeholder={'def run(input: dict, context: dict) -> dict:\n    ...'}
                        note={
                          pluginEscape
                            ? `Sandbox escape on line ${pluginEscape.line}.`
                            : 'No os.system / os.popen / subprocess / eval / exec call found.'
                        }
                        preview={false}
                      />
                    )}

                    {category === 'tools' && (
                      <SpecPanel title="JSON Schema contract" badge="2020-12" spec={spec} />
                    )}

                    <ReadinessPanel readiness={readiness} />

                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="text-xs font-semibold text-text">
                          Server validation of this draft
                        </span>
                        {canValidate ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            loading={draftOutcome.kind === 'running'}
                            onClick={() => void runDraftValidation()}
                          >
                            Validate draft against the API
                          </Button>
                        ) : (
                          <Badge variant="warning" size="sm">
                            no workspace
                          </Badge>
                        )}
                      </div>

                      {/*
                        The two panels above and below answer different questions
                        and neither is a substitute for the other. Form checks are
                        computed in this browser from the fields on screen, with no
                        request, so they are instant and they are a mirror of
                        server rules rather than the server. This call is the
                        authority: it runs the real validators against the config a
                        create would write. Keeping them apart in the copy is the
                        point — a form check presented as server-verified is a claim
                        nothing checked.
                      */}
                      <p className="text-2xs text-text-muted leading-relaxed">
                        The checks above are computed in this browser from the fields on screen.
                        They are instant and they are not server-verified. This call is the
                        authoritative answer:{' '}
                        <code className="font-mono">POST /api/v1/capabilities/validate</code> runs
                        the real validators against the unsaved draft — the same fields a create
                        would write, so nothing has to be saved first. It persists nothing and
                        executes nothing (<code className="font-mono">executed: false</code>); for a
                        plugin it reads the manifest and never runs the handler.
                      </p>

                      {!canValidate && (
                        <p className="text-2xs text-warning leading-relaxed">
                          The endpoint resolves the workspace from the request context, so it cannot
                          be called from outside a workspace route. No request was made and no
                          result is shown, because none was obtained.
                        </p>
                      )}

                      {draftOutcome.kind === 'request_failed' && (
                        <p
                          role="alert"
                          className="p-2.5 rounded bg-error/10 border border-error/30 text-xs text-error font-mono"
                        >
                          Request failed: {draftOutcome.error}. No validation result was obtained.
                        </p>
                      )}

                      {draftOutcome.kind === 'done' && (
                        <DraftValidationOutcome outcome={draftOutcome.response} />
                      )}
                    </div>
                  </div>
                </div>
              )}
            </form>
          </TabPanel>

          {/* ── Import ──────────────────────────────────────────────────── */}
          <TabPanel id="import" activeTab={activeTab} className="p-5 space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-text mb-1">Drop a capability file</h3>
              <p className="text-xs text-text-muted mb-2.5">
                Supports <code className="text-primary">SKILL.md</code>,{' '}
                <code className="text-primary">mcp.json</code> and OpenAPI documents. The file is
                read into the builder; nothing is fetched, compiled or executed.
              </p>

              <div
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(event) => {
                  event.preventDefault();
                  setDragOver(false);
                  const dropped = event.dataTransfer?.files?.[0];
                  if (dropped) handleFile(dropped);
                }}
                className={`border-2 border-dashed rounded-xl p-5 text-center transition-all ${
                  dragOver
                    ? 'border-primary bg-primary/10'
                    : 'border-border bg-surface-elevated hover:border-primary/50 hover:bg-surface-hover'
                }`}
              >
                <p className="text-xs font-semibold text-text">Drop your capability file here</p>
                <p className="text-2xs text-text-muted mt-0.5">or browse (.md, .json, .yaml)</p>
                <input
                  type="file"
                  accept=".md,.markdown,.json,.yaml,.yml"
                  className="sr-only"
                  id="capability-file-input"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) handleFile(file);
                  }}
                />
                <label
                  htmlFor="capability-file-input"
                  className="inline-block mt-2 px-3 py-1 rounded-md bg-surface hover:bg-surface-hover text-xs font-medium text-text border border-border cursor-pointer"
                >
                  Browse files
                </label>
              </div>
            </div>

            <div className="pt-3 border-t border-border">
              <h3 className="text-xs font-semibold text-text mb-1">Import from a Git or URL</h3>
              <p className="text-xs text-text-muted mb-2.5">
                Records the source URL against a workspace capability row. Vaeloom has no remote
                fetcher, so nothing at the other end is compiled or run.
              </p>

              <form onSubmit={onImportSubmit} className="space-y-3">
                <Input
                  label="Repository URL / endpoint"
                  required
                  value={importUrl}
                  onChange={(event) => setImportUrl(event.target.value)}
                  placeholder="https://github.com/vaeloom/skills-community/tree/main/rag-eval"
                />
                <Select
                  label="Target category"
                  value={importCategory}
                  onChange={(value) =>
                    setImportCategory(
                      option(
                        value,
                        CATEGORY_CHOICES.filter((choice) => choice.id !== 'connectors').map(
                          (choice) => choice.id,
                        ),
                        importCategory,
                      ),
                    )
                  }
                  options={CATEGORY_CHOICES.filter((choice) => choice.id !== 'connectors').map(
                    (choice) => ({ value: choice.id, label: choice.label }),
                  )}
                />

                {importError && (
                  <p role="alert" className="text-xs text-error">
                    {importError} The modal stayed open so the URL is not lost.
                  </p>
                )}

                <div className="flex items-center justify-end gap-2 pt-2">
                  <Button type="button" variant="secondary" size="sm" onClick={onClose}>
                    Cancel
                  </Button>
                  <Button type="submit" variant="primary" size="sm" loading={importLoading}>
                    {importLoading ? 'Registering…' : 'Import & activate'}
                  </Button>
                </div>
              </form>
            </div>
          </TabPanel>
        </div>

        <footer className="px-5 py-3 border-t border-border bg-surface-elevated flex items-center justify-between gap-3 shrink-0 z-20 font-sans">
          <div className="flex items-center gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <span className="text-xs text-text-muted hidden sm:inline-block">
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

          {activeTab === 'builder' && category !== 'connectors' && (
            <Button type="button" variant="primary" size="sm" onClick={submit}>
              Create Capability
            </Button>
          )}
        </footer>
      </div>
    </div>
  );
}
