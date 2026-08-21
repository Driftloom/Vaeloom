import Link from 'next/link';
export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-background text-text px-6 py-12 max-w-3xl mx-auto">
      <h1 className="text-3xl font-display font-medium mb-4">Privacy Policy</h1>
      <p className="text-text-muted text-sm mb-6">Last updated: 2026-08-21. Placeholder — replace with counsel-reviewed policy before launch.</p>
      <div className="space-y-4 text-sm text-text-muted leading-relaxed">
        <p>Vaeloom processes data per workspace tenant isolation (see TenantMiddleware + RLS). Connector access is least-privilege (read-only where possible, scopes shown pre-consent). Agent autonomy is suggest-mode-first; consequential actions require approval unless you explicitly enable full autonomy per agent in Settings.</p>
        <p>Consent scopes: <span className="font-mono text-text">data_processing</span>, <span className="font-mono text-text">agent_access</span> are grantable/revocable in Settings. Email send (<span className="font-mono">gmail.send</span>) is gated behind T3 legal review and disabled by default.</p>
        <p>You may export JSON via Settings or delete everything (anonymized, backups expire within 30 days). Contact privacy@vaeloom.app for requests.</p>
      </div>
      <Link href="/login" className="btn-secondary mt-8 inline-block">Back to sign in</Link>
    </main>
  );
}
