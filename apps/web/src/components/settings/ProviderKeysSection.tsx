'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { providerKeysApi, type ProviderKeyResponse } from '@/lib/api-client';
import { useToast } from '@/components/shared/Toast';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import {
  Button,
  Badge,
  IconButton,
  KeyIcon,
  CheckIcon,
  TrashIcon,
  RefreshCwIcon,
  EyeIcon,
  EyeOffIcon,
  LockIcon,
  AlertCircleIcon,
  ShieldIcon,
  PlayIcon,
  PauseIcon,
} from '@vaeloom/ui-kit';

const PROVIDERS = [
  {
    id: 'openai',
    label: 'OpenAI',
    hint: 'sk-... (GPT-4o, o1, embeddings)',
    placeholder: 'sk-proj-... or sk-...',
  },
  {
    id: 'anthropic',
    label: 'Anthropic',
    hint: 'sk-ant-... (Claude 3.5 Sonnet / Opus)',
    placeholder: 'sk-ant-...',
  },
  {
    id: 'google',
    label: 'Google Gemini',
    hint: 'AI Studio / Gemini 1.5 Pro',
    placeholder: 'AIza...',
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    hint: 'sk-or-... (unified multi-model routing)',
    placeholder: 'sk-or-v1-...',
  },
  {
    id: 'groq',
    label: 'Groq',
    hint: 'gsk_... (ultra-low latency Llama)',
    placeholder: 'gsk_...',
  },
  {
    id: 'mistral',
    label: 'Mistral AI',
    hint: 'Mistral Large & Codestral API',
    placeholder: '...',
  },
] as const;

type ProviderId = (typeof PROVIDERS)[number]['id'];

function maskHint(key: ProviderKeyResponse) {
  return key.keyHint || `${key.keyPrefix}••••••••`;
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
        title: 'Key saved securely',
        detail: `${PROVIDERS.find((p) => p.id === selectedProvider)?.label} key stored encrypted with Fernet.`,
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
        title: res.isValid ? 'Key verified' : 'Key invalid',
        detail: res.message,
      });
      await load();
    } catch (err) {
      toast({
        tone: 'error',
        title: 'Validation failed',
        detail: err instanceof Error ? err.message : 'Could not validate key.',
      });
    } finally {
      setValidating(null);
    }
  };

  const handleDelete = (k: ProviderKeyResponse) => {
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
        detail: err instanceof Error ? err.message : 'Could not delete key.',
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
        detail: err instanceof Error ? err.message : 'Could not update key state.',
      });
    }
  };

  const providerMeta = (id: string) => PROVIDERS.find((p) => p.id === id);

  return (
    <section className="space-y-6" aria-label="Bring Your Own Key">
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-surface border border-border">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-lg bg-primary/10 text-primary shrink-0 mt-0.5">
            <KeyIcon size={20} />
          </div>
          <div>
            <h3 className="text-base font-semibold text-text">Bring Your Own Key (BYOK)</h3>
            <p className="text-xs text-text-muted mt-1 leading-relaxed max-w-xl">
              Provide your own LLM credentials for unthrottled agent execution. Keys are
              Fernet-encrypted at rest and resolved hierarchically:{' '}
              <span className="font-mono text-text">workspace</span> →{' '}
              <span className="font-mono text-text">user</span> →{' '}
              <span className="font-mono text-text">system fallback</span>.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
          <Badge variant="success" size="sm">
            <ShieldIcon size={12} className="mr-1" />
            Encrypted at rest
          </Badge>
        </div>
      </div>

      {/* Add key card */}
      <div className="rounded-xl border border-border bg-surface p-5 shadow-xs space-y-4">
        <h4 className="text-sm font-semibold text-text flex items-center gap-2">
          <span>Add Provider Credential</span>
        </h4>

        <div className="grid gap-4 md:grid-cols-[200px_1fr] items-start">
          <div>
            <label
              htmlFor="provider-select"
              className="block text-xs font-mono uppercase tracking-wider text-text-dim mb-1.5"
            >
              Provider
            </label>
            <select
              id="provider-select"
              value={selectedProvider}
              onChange={(e) => setSelectedProvider(e.target.value as ProviderId)}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {PROVIDERS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-text-dim">{providerMeta(selectedProvider)?.hint}</p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="api-key-input"
                className="block text-xs font-mono uppercase tracking-wider text-text-dim"
              >
                API Key
              </label>
              <button
                type="button"
                onClick={() => setShowKey((v) => !v)}
                className="text-xs text-primary hover:underline inline-flex items-center gap-1"
              >
                {showKey ? (
                  <>
                    <EyeOffIcon size={12} />
                    <span>Hide</span>
                  </>
                ) : (
                  <>
                    <EyeIcon size={12} />
                    <span>Show</span>
                  </>
                )}
              </button>
            </div>
            <div className="flex gap-2">
              <input
                id="api-key-input"
                type={showKey ? 'text' : 'password'}
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                placeholder={providerMeta(selectedProvider)?.placeholder}
                className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm font-mono text-text placeholder:text-text-dim focus:outline-none focus:ring-1 focus:ring-primary"
                autoComplete="off"
                spellCheck={false}
              />
              <Button
                variant="primary"
                size="md"
                onClick={() => void handleSave()}
                loading={!!saving}
                disabled={!apiKeyInput.trim()}
              >
                Save Key
              </Button>
            </div>
          </div>
        </div>

        {/* Scope selector */}
        <div className="pt-3 border-t border-border flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <span className="text-text-muted font-medium">Scope:</span>
            <div className="inline-flex rounded-lg border border-border bg-background p-0.5">
              <button
                type="button"
                onClick={() => setScope('user')}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  scope === 'user'
                    ? 'bg-primary text-white shadow-xs'
                    : 'text-text-muted hover:text-text'
                }`}
              >
                User (Global)
              </button>
              <button
                type="button"
                onClick={() => setScope('workspace')}
                disabled={!workspaceId}
                title={
                  !workspaceId ? 'No workspace context' : 'Workspace override (highest priority)'
                }
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  scope === 'workspace'
                    ? 'bg-primary text-white shadow-xs'
                    : 'text-text-muted hover:text-text disabled:opacity-40'
                }`}
              >
                Workspace Override
              </button>
            </div>
            <span className="text-text-dim">
              {scope === 'workspace'
                ? 'Applies exclusively to this workspace.'
                : 'Applies across all workspaces unless overridden.'}
            </span>
          </div>
          <span className="text-text-dim hidden md:inline">
            Ciphertext is never exposed in responses.
          </span>
        </div>
      </div>

      {/* Keys list */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-text">Configured Provider Keys</h4>

        {loading ? (
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="h-18 animate-pulse rounded-xl bg-surface border border-border"
              />
            ))}
          </div>
        ) : keys.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-8 text-center bg-surface/50">
            <div className="w-10 h-10 rounded-full bg-surface-hover flex items-center justify-center mx-auto mb-3 text-text-muted">
              <KeyIcon size={20} />
            </div>
            <p className="text-sm font-medium text-text">No BYOK credentials configured</p>
            <p className="text-xs text-text-muted mt-1 max-w-md mx-auto">
              Add your API key above to enable high-throughput agent loops. If none are configured,
              Vaeloom falls back to the system key.
            </p>
          </div>
        ) : (
          <div className="grid gap-3">
            {keys.map((k) => (
              <div
                key={k.id}
                className={`rounded-xl border p-4 bg-surface transition-all flex flex-wrap items-center justify-between gap-4 ${
                  !k.isActive ? 'opacity-65 border-border' : 'border-border hover:border-border/80'
                } ${k.isValid === false ? 'border-error/40 bg-error/5' : ''}`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <Badge variant="default" size="sm">
                      {providerMeta(k.provider)?.label ?? k.provider}
                    </Badge>
                    <span className="font-mono text-sm font-medium text-text">{maskHint(k)}</span>
                    <Badge
                      variant={
                        k.isValid === true ? 'success' : k.isValid === false ? 'error' : 'default'
                      }
                      size="sm"
                    >
                      {k.isValid === true ? (
                        <>
                          <CheckIcon size={12} className="mr-1" />
                          valid
                        </>
                      ) : k.isValid === false ? (
                        <>
                          <AlertCircleIcon size={12} className="mr-1" />
                          invalid
                        </>
                      ) : (
                        'unvalidated'
                      )}
                    </Badge>
                    <Badge variant={k.isActive ? 'info' : 'default'} size="sm">
                      {k.isActive ? 'active' : 'paused'}
                    </Badge>
                    <span className="text-xs text-text-dim font-mono">
                      {k.workspaceId ? 'workspace' : 'user global'}
                    </span>
                  </div>

                  <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-text-muted">
                    <span className="font-mono">prefix: {k.keyPrefix}</span>
                    <span>•</span>
                    <span>Updated {new Date(k.updatedAt).toLocaleDateString()}</span>
                    {k.lastValidatedAt && (
                      <>
                        <span>•</span>
                        <span>Checked {new Date(k.lastValidatedAt).toLocaleTimeString()}</span>
                      </>
                    )}
                    {k.validationError && (
                      <span className="text-error truncate max-w-[280px]">
                        • {k.validationError}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => void handleValidate(k)}
                    loading={validating === k.id}
                  >
                    <RefreshCwIcon size={13} className="mr-1.5" />
                    Validate
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => void handleToggle(k)}>
                    {k.isActive ? (
                      <>
                        <PauseIcon size={13} className="mr-1.5" />
                        Pause
                      </>
                    ) : (
                      <>
                        <PlayIcon size={13} className="mr-1.5" />
                        Enable
                      </>
                    )}
                  </Button>
                  <IconButton
                    aria-label="Delete key"
                    variant="danger"
                    size="sm"
                    onClick={() => handleDelete(k)}
                  >
                    <TrashIcon size={15} />
                  </IconButton>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Help Note */}
      <div className="rounded-xl border border-border bg-surface-hover/60 p-4 text-xs text-text-muted space-y-2">
        <div className="font-semibold text-text flex items-center gap-1.5">
          <LockIcon size={14} className="text-primary" />
          <span>Security & Provider Routing Rules</span>
        </div>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            <strong>Embeddings:</strong> Memory vectors require OpenAI credentials (
            <code className="font-mono text-text">text-embedding-3-small</code>).
          </li>
          <li>
            <strong>Reasoning Models:</strong> Prompts routing to{' '}
            <code className="font-mono text-text">gpt-4o</code> or{' '}
            <code className="font-mono text-text">claude-3-5-sonnet</code> dynamically pick the
            configured active key.
          </li>
          <li>
            <strong>Zero-Trust Isolation:</strong> Keys are never passed to the client browser or
            included in trace payloads.
          </li>
        </ul>
      </div>

      {/* Canonical Confirm Dialog */}
      <ConfirmDialog
        isOpen={pendingDelete !== null}
        onClose={() => (deleting ? undefined : setPendingDelete(null))}
        onConfirm={confirmDelete}
        title={`Remove ${providerMeta(pendingDelete?.provider ?? '')?.label ?? pendingDelete?.provider ?? ''} Key?`}
        message={`Are you sure you want to delete this credential (${pendingDelete?.keyHint || pendingDelete?.keyPrefix})? Agents relying on this provider will fall back to system defaults.`}
        confirmLabel="Delete Key"
        variant="danger"
        loading={deleting}
      />
    </section>
  );
}
