'use client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { EnterpriseGated, isEnterpriseEnabled } from '@/components/shared/EnterpriseGated';
import { EmptyState } from '@/components/shared/EmptyState';

/**
 * Developer console (Phase 02A / F-02 + F-03).
 *
 * The previous implementation fetched GET /api-keys (no such backend route —
 * only /provider-keys exists), generated fake API keys with Math.random(),
 * faked webhook deliveries and hardcoded rate-limit usage. Per the
 * no-fake-state rule the console is now an honest stub.
 *
 * REAL surfaces linked below:
 *   - Webhooks: full CRUD backed by /webhooks router.
 *   - Provider keys (BYOK): Settings page, backed by /provider-keys.
 *
 * NOT IMPLEMENTED — BACKEND DEPENDENCY:
 *   GET/POST/DELETE /api/v1/api-keys        (API key lifecycle)
 *   Rate-limit usage reporting endpoint for the current key set.
 */
export default function DeveloperPage() {
  const params = useParams<{ workspaceId: string }>();
  const workspaceId = params?.workspaceId ?? '';
  if (!isEnterpriseEnabled()) return <EnterpriseGated feature="Developer" />;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-display font-medium text-text mb-2">Developer</h1>
        <p className="text-text-muted">
          API access, webhooks, and integration tooling for your workspace.
        </p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link
          href={`/workspace/${workspaceId}/developer/webhooks`}
          className="card p-6 block hover:border-primary/50 transition-colors"
        >
          <h2 className="font-display font-medium text-text mb-1">Webhooks</h2>
          <p className="text-sm text-text-muted">
            Create, test, and monitor webhook endpoints. Fully functional.
          </p>
        </Link>
        <Link
          href={`/workspace/${workspaceId}/settings`}
          className="card p-6 block hover:border-primary/50 transition-colors"
        >
          <h2 className="font-display font-medium text-text mb-1">Provider Keys (BYOK)</h2>
          <p className="text-sm text-text-muted">
            Manage your own LLM provider credentials. Available in Settings.
          </p>
        </Link>
      </div>

      <div className="card p-6">
        <EmptyState
          title="API keys not configured"
          description="This environment has no API-key service yet. Keys cannot be created, listed, or revoked here — previously this console generated placeholder keys locally that were never valid. Configure an API-key backend to enable key management."
        />
      </div>
    </div>
  );
}
