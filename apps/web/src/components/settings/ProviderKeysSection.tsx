'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { providerKeysApi, type ProviderKeyResponse } from '@/lib/api-client';
import { useToast } from '@/components/shared/Toast';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';

const PROVIDERS = [
  {
    id: 'openai',
    label: 'OpenAI',
    hint: 'sk-... (GPT / embeddings)',
    placeholder: 'sk-proj-... or sk-...',
  },
  { id: 'anthropic', label: 'Anthropic', hint: 'sk-ant-... (Claude)', placeholder: 'sk-ant-...' },
  { id: 'google', label: 'Google', hint: 'AI Studio / Gemini', placeholder: 'AIza...' },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    hint: 'sk-or-... (multi-model)',
    placeholder: 'sk-or-v1-...',
  },
  { id: 'groq', label: 'Groq', hint: 'gsk_... (fast Llama)', placeholder: 'gsk_...' },
  { id: 'mistral', label: 'Mistral', hint: 'Mistral API', placeholder: '...' },
] as const;

type ProviderId = (typeof PROVIDERS)[number]['id'];

function maskHint(key: ProviderKeyResponse) {
  return key.keyHint || `${key.keyPrefix}••••`;
}

export function ProviderKeysSection({ workspaceId }: { workspaceId?: string }) {
  const [keys, setKeys] = useState<ProviderKeyResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [validating, setValidating] = useState<string | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<ProviderId>('openai');
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [scope, setScope] = useState<'user' | 'workspace'>('user');
  const [showKey, setShowKey] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<ProviderKeyResponse | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { toast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await providerKeysApi.list({ workspace_id: workspaceId });
      setKeys(res.keys ?? []);
    } catch {
      // silent - empty state
      setKeys([]);
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSave = async () => {
    const raw = apiKeyInput.trim();
    if (!raw || raw.length < 8) {
      toast({ tone: 'error', title: 'Invalid key', detail: 'API key looks too short.' });
      return;
    }
    setSaving(selectedProvider);
    try {
      const wsId = scope === 'workspace' && workspaceId ? workspaceId : null;
      await providerKeysApi.create({
        provider: selectedProvider,
        api_key: raw,
        workspace_id: wsId,
      });
      toast({
        tone: 'success',
        title: 'Key saved',
        detail: `${PROVIDERS.find((p) => p.id === selectedProvider)?.label} key stored encrypted. Resolution: ${wsId ? 'workspace' : 'user'} → system fallback.`,
      });
      setApiKeyInput('');
      await load();
    } catch (err) {
      toast({
        tone: 'error',
        title: 'Save failed',
        detail: err instanceof Error ? err.message : 'Could not save key.',
      });
    } finally {
      setSaving(null);
    }
  };

  const handleValidate = async (k: ProviderKeyResponse) => {
    setValidating(k.id);
    try {
      const res = await providerKeysApi.validate(k.id);
      toast({
        tone: res.isValid ? 'success' : 'error',
        title: res.isValid ? 'Key valid' : 'Key invalid',
        detail: res.message,
      });
      await load();
    } catch (err) {
      toast({
        tone: 'error',
        title: 'Validation failed',
        detail: err instanceof Error ? err.message : 'Could not validate.',
      });
    } finally {
      setValidating(null);
    }
  };

  const handleDelete = async (k: ProviderKeyResponse) => {
    // F-12: native confirm() replaced by the canonical ConfirmDialog; the
    // pending key is tracked in state and the dialog drives execution.
    setPendingDelete(k);
  };

  const confirmDelete = async () => {
    const k = pendingDelete;
    if (!k) return;
    setDeleting(true);
    try {
      await providerKeysApi.delete(k.id);
      toast({ tone: 'success', title: 'Key removed', detail: `${k.provider} key deleted.` });
      await load();
      setPendingDelete(null);
    } catch (err) {
      toast({
        tone: 'error',
        title: 'Delete failed',
        detail: err instanceof Error ? err.message : 'Could not delete.',
      });
    } finally {
      setDeleting(false);
    }
  };

  const handleToggle = async (k: ProviderKeyResponse) => {
    try {
      await providerKeysApi.update(k.id, { is_active: !k.isActive });
      await load();
    } catch (err) {
      toast({
        tone: 'error',
        title: 'Update failed',
        detail: err instanceof Error ? err.message : 'Could not update.',
      });
    }
  };

  const providerMeta = (id: string) => PROVIDERS.find((p) => p.id === id);

  return (
    <section className="space-y-4" aria-label="Bring Your Own Key">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-display font-medium text-text">Bring Your Own Key (BYOK)</h3>
          <p className="text-sm text-text-muted mt-1 max-w-2xl">
            Use your own LLM keys. Encrypted with Fernet (app-level) and stored per-user or
            per-workspace. Priority:{' '}
            <span className="font-mono text-xs bg-surface-hover px-1 py-0.5 rounded">
              workspace
            </span>{' '}
            → <span className="font-mono text-xs bg-surface-hover px-1 py-0.5 rounded">user</span> →{' '}
            <span className="font-mono text-xs bg-surface-hover px-1 py-0.5 rounded">system</span>.
            Never logged in plaintext.
          </p>
        </div>
        <span className="hidden md:inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 text-xs text-text-muted">
          <span className="h-2 w-2 rounded-full bg-success animate-pulse" /> Encrypted at rest
        </span>
      </div>

      {/* Add key form */}
      <div className="card border-border">
        <div className="grid gap-4 md:grid-cols-[180px_1fr] items-end">
          <div>
            <label
              htmlFor="provider-select"
              className="block text-xs font-mono uppercase tracking-widest text-text-dim mb-1"
            >
              Provider
            </label>
            <select
              id="provider-select"
              value={selectedProvider}
              onChange={(e) => setSelectedProvider(e.target.value as ProviderId)}
              className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm text-text focus:outline-none focus:border-primary"
            >
              {PROVIDERS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-text-muted">{providerMeta(selectedProvider)?.hint}</p>
          </div>

          <div>
            <label className="block text-xs font-mono uppercase tracking-widest text-text-dim mb-1">
              API Key
              <button
                type="button"
                onClick={() => setShowKey((v) => !v)}
                className="ml-2 text-[10px] normal-case tracking-normal text-primary hover:underline"
              >
                {showKey ? 'hide' : 'show'}
              </button>
            </label>
            <div className="flex gap-2">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                placeholder={providerMeta(selectedProvider)?.placeholder}
                className="flex-1 bg-background border border-border rounded-md px-3 py-2 text-sm font-mono text-text placeholder:text-text-dim focus:outline-none focus:border-primary"
                autoComplete="off"
                spellCheck={false}
              />
              <button
                onClick={() => void handleSave()}
                disabled={!!saving}
                className="btn-primary shrink-0 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 rounded-md border border-border bg-surface-hover px-3 py-1.5">
            <span className="text-xs text-text-muted">Scope</span>
            <div className="flex rounded bg-background p-0.5">
              <button
                onClick={() => setScope('user')}
                className={`px-3 py-1 text-xs rounded ${scope === 'user' ? 'bg-primary text-white' : 'text-text-muted hover:text-text'}`}
              >
                User (global)
              </button>
              <button
                onClick={() => setScope('workspace')}
                disabled={!workspaceId}
                title={
                  !workspaceId ? 'No workspace context' : 'Workspace override (highest priority)'
                }
                className={`px-3 py-1 text-xs rounded ${scope === 'workspace' ? 'bg-primary text-white' : 'text-text-muted hover:text-text'} disabled:opacity-40`}
              >
                Workspace
              </button>
            </div>
          </div>
          <p className="text-xs text-text-muted">
            {scope === 'workspace'
              ? 'Overrides user key for this workspace only.'
              : 'Applies to all your workspaces unless overridden.'}
          </p>
          <span className="ml-auto text-xs text-text-dim hidden md:inline">
            Keys are stored encrypted — only hint is shown.
          </span>
        </div>
      </div>

      {/* Keys list */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded bg-surface-hover" />
          ))}
        </div>
      ) : keys.length === 0 ? (
        <div className="card border-dashed flex flex-col items-center justify-center py-8 text-center">
          <p className="text-sm text-text">No BYOK keys configured</p>
          <p className="text-xs text-text-muted mt-1 max-w-md">
            Add your OpenAI or Anthropic key above. If none, Vaeloom falls back to the system{' '}
            <span className="font-mono">LLM_API_KEY</span>. Embeddings require OpenAI.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-1.5">
            {PROVIDERS.slice(0, 3).map((p) => (
              <span
                key={p.id}
                className="rounded-full border border-border bg-surface px-2.5 py-1 text-xs text-text-muted"
              >
                {p.label}
              </span>
            ))}
          </div>
        </div>
      ) : (
        <div className="grid gap-3">
          {keys.map((k) => (
            <div
              key={k.id}
              className={`card flex flex-wrap items-center justify-between gap-3 ${!k.isActive ? 'opacity-60' : ''} ${k.isValid === false ? 'border-error/30 bg-error/10' : ''}`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="inline-flex items-center rounded-full bg-surface-hover border border-border px-2.5 py-0.5 text-xs font-mono text-text">
                    {providerMeta(k.provider)?.label ?? k.provider}
                  </span>
                  <span className="font-mono text-sm text-text">{maskHint(k)}</span>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${k.isValid === true ? 'bg-success/10 text-success border border-success/30' : k.isValid === false ? 'bg-error/10 text-error border border-error/30' : 'bg-surface-hover text-text-muted border border-border'}`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${k.isValid === true ? 'bg-success' : k.isValid === false ? 'bg-error' : 'bg-text-dim'}`}
                    />
                    {k.isValid === true
                      ? 'valid'
                      : k.isValid === false
                        ? 'invalid'
                        : 'not validated'}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs border ${k.isActive ? 'bg-primary/10 text-primary border-primary/20' : 'bg-surface-hover text-text-muted border-border'}`}
                  >
                    {k.isActive ? 'active' : 'paused'}
                  </span>
                  {k.workspaceId ? (
                    <span className="rounded-full bg-primary/10 border border-primary/20 px-2 py-0.5 text-xs text-primary">
                      workspace
                    </span>
                  ) : (
                    <span className="rounded-full bg-surface-hover border border-border px-2 py-0.5 text-xs text-text-muted">
                      user global
                    </span>
                  )}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-text-muted">
                  <span className="font-mono">prefix {k.keyPrefix}</span>
                  <span>•</span>
                  <span>updated {new Date(k.updatedAt).toLocaleDateString()}</span>
                  {k.lastValidatedAt && (
                    <>
                      <span>•</span>
                      <span>checked {new Date(k.lastValidatedAt).toLocaleString()}</span>
                    </>
                  )}
                  {k.validationError && (
                    <span className="text-error truncate max-w-[260px]">• {k.validationError}</span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => void handleValidate(k)}
                  disabled={!!validating}
                  className="btn-secondary text-xs !px-3 !py-1.5 disabled:opacity-50"
                >
                  {validating === k.id ? 'Checking...' : 'Validate'}
                </button>
                <button
                  onClick={() => void handleToggle(k)}
                  className="btn-secondary text-xs !px-3 !py-1.5"
                >
                  {k.isActive ? 'Pause' : 'Enable'}
                </button>
                <button
                  onClick={() => void handleDelete(k)}
                  className="text-xs px-3 py-1.5 rounded border border-border text-text-muted hover:text-error hover:border-error/30 hover:bg-error/10 dark:hover:bg-error/10"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-md border border-border bg-surface-hover p-3 text-xs text-text-muted">
        <p className="font-medium text-text mb-1">How resolution works</p>
        <ul className="list-disc ml-4 space-y-0.5">
          <li>
            Embeddings: only <span className="font-mono">OpenAI</span> is supported — add an OpenAI
            BYOK key to enable memory vectors.
          </li>
          <li>
            Chat / agents: model name decides provider — <span className="font-mono">gpt-*</span> →
            OpenAI, <span className="font-mono">claude-*</span> → Anthropic. Set the matching
            provider key.
          </li>
          <li>
            All keys are encrypted with Fernet using{' '}
            <span className="font-mono">ENCRYPTION_KEY</span>. Plaintext is never returned by the
            API.
          </li>
        </ul>
      </div>

      {/* F-12: canonical confirmation for destructive key removal. */}
      <ConfirmDialog
        isOpen={pendingDelete !== null}
        onClose={() => (deleting ? undefined : setPendingDelete(null))}
        onConfirm={confirmDelete}
        title={`Remove ${pendingDelete?.provider ?? ''} key?`}
        message={`Remove ${pendingDelete?.provider ?? ''} key ${pendingDelete?.keyHint ?? ''}? Agents will fall back to the system key (if one is set). This cannot be undone.`}
        confirmLabel="Remove key"
        variant="danger"
        loading={deleting}
      />
    </section>
  );
}
