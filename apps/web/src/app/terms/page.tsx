import Link from 'next/link';
export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background text-text px-6 py-12 max-w-3xl mx-auto">
      <h1 className="text-3xl font-display font-medium mb-4">Terms of Service</h1>
      <p className="text-text-muted text-sm mb-6">
        Last updated: 2026-08-21. This is a placeholder for Vaeloom MVP terms â€” replace before
        production with legal-approved content.
      </p>
      <div className="space-y-4 text-sm text-text-muted leading-relaxed">
        <p>
          Vaeloom is a memory-first personal intelligence platform. By using the service you agree
          to workspace-scoped data processing, least-privilege connectors, and reversible agent
          actions described in-app.
        </p>
        <p>
          Uploads remain your property. Vaeloom extracts memories with your consent and logs agent
          actions to History for audit. You may export or delete all workspace data at any time via
          Settings â†’ Data & Privacy (type DELETE to confirm).
        </p>
        <p>Questions: contact legal@vaeloom.app.</p>
      </div>
      <Link href="/login" className="btn-secondary mt-8 inline-block">
        Back to sign in
      </Link>
    </div>
  );
}
