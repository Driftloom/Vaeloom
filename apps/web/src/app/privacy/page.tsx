import Link from 'next/link';

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-background text-text px-6 py-12 max-w-4xl mx-auto">
      <header className="mb-8 border-b border-border pb-6">
        <h1 className="text-3xl font-display font-medium text-text mb-2">Privacy Policy</h1>
        <p className="text-text-muted text-sm">
          Effective Date: September 16, 2026 &bull; Version 1.0 (Production Release)
        </p>
      </header>

      <div className="space-y-8 text-sm text-text-muted leading-relaxed">
        <section className="space-y-3">
          <h2 className="text-lg font-medium text-text">
            1. Introduction &amp; Privacy-First Architecture
          </h2>
          <p>
            Vaeloom (&ldquo;we&rdquo;, &ldquo;our&rdquo;, or &ldquo;us&rdquo;) is an agentic,
            memory-first personal intelligence platform. We are engineered from the ground up on
            zero-trust and least-privilege principles. Your data belongs exclusively to you and is
            partitioned within dedicated workspace boundaries protected by cryptographic encryption
            and strict database isolation.
          </p>
          <p>
            This Privacy Policy explains how we collect, process, store, and safeguard your personal
            information when you use our web applications, APIs, and connected agentic services.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-medium text-text">2. Information We Collect</h2>
          <ul className="list-disc pl-5 space-y-2">
            <li>
              <strong className="text-text">Account Credentials:</strong> Name, business or personal
              email address, password hash (salted bcrypt), avatar URL, and optional profile
              metadata.
            </li>
            <li>
              <strong className="text-text">Workspace Content:</strong> Uploaded documents, resume
              source files, career timelines, and personal knowledge items that you ingest into your
              memory vault.
            </li>
            <li>
              <strong className="text-text">Connector &amp; Integration Data:</strong> When you
              connect third-party services (such as Google Workspace, GitHub, Slack, Notion, or
              Microsoft 365), we collect and store encrypted OAuth tokens (AES-256 Fernet) and
              retrieve the data items you explicitly authorize for indexing.
            </li>
            <li>
              <strong className="text-text">Agent Interaction History:</strong> Queries, system
              prompts, chat transcripts, reasoning steps, tool approval receipts, and feedback
              ratings.
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-medium text-text">
            3. How We Use Information &amp; AI Model Governance
          </h2>
          <p>We process your data strictly to deliver platform functionality, including:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              Generating vector embeddings and populating your personal knowledge graph for RAG
              retrieval;
            </li>
            <li>
              Providing contextual agent suggestions across career planning, resume tailoring, and
              job searching;
            </li>
            <li>Executing authorized background workflows and connector reconciliations.</li>
          </ul>
          <div className="p-4 rounded-lg bg-surface border border-border mt-3">
            <strong className="text-text block mb-1">Our AI Training Commitment</strong>
            <p className="text-xs text-text-muted">
              We <strong>NEVER</strong> sell your personal data or license your private workspace
              content to third parties. Your documents, resumes, and private memories are{' '}
              <strong>NEVER</strong> used to train public foundational AI models.
            </p>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-medium text-text">
            4. Multi-Tenant Isolation &amp; Security Measures
          </h2>
          <p>Vaeloom enforces strict multi-tenancy safeguards:</p>
          <ul className="list-disc pl-5 space-y-2">
            <li>
              <strong className="text-text">PostgreSQL Row-Level Security (RLS):</strong> Every
              database operation is bound to your authenticated tenant and workspace identity via
              transactional session variables. Cross-workspace access is prevented at the database
              engine level.
            </li>
            <li>
              <strong className="text-text">Encryption at Rest &amp; in Transit:</strong> All HTTP
              traffic requires TLS 1.3. API keys, connector tokens, and secret parameters are
              encrypted at rest using AES-256 Fernet encryption.
            </li>
            <li>
              <strong className="text-text">Dual-Layer AI Safety Firewalls:</strong> Real-time
              heuristic regex matching and auxiliary classification models scan incoming prompts to
              neutralize prompt injection, jailbreaks, and sensitive PII leaks.
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-medium text-text">
            5. Third-Party Connectors &amp; Least-Privilege Safeguards
          </h2>
          <p>Connector integrations operate under minimal necessary scopes:</p>
          <ul className="list-disc pl-5 space-y-2">
            <li>
              <strong className="text-text">Gmail Safeguard:</strong> Our Gmail connector is
              strictly draft-only. The platform cannot directly send emails on your behalf without
              your explicit human verification in the drafts folder.
            </li>
            <li>
              <strong className="text-text">Consent Revocation:</strong> You can disconnect any
              integration and revoke its access tokens at any time through Workspace Settings &rarr;
              Connectors.
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-medium text-text">
            6. Your Rights (GDPR &amp; CCPA Compliance)
          </h2>
          <p>
            Under GDPR (Articles 15&ndash;22) and the California Consumer Privacy Act (CCPA), you
            maintain comprehensive rights over your personal data:
          </p>
          <ul className="list-disc pl-5 space-y-2">
            <li>
              <strong className="text-text">Right to Access &amp; Portability:</strong> You may
              request a complete machine-readable JSON export of all your memories, documents, and
              agent histories via Settings or the <code>GET /api/v1/gdpr/export</code> endpoint.
            </li>
            <li>
              <strong className="text-text">Right to Complete Erasure:</strong> You may initiate an
              immediate, verified purge of all personal data via{' '}
              <code>POST /api/v1/gdpr/delete</code>. This triggers an automated erasure of your
              database entities, graph nodes, vector embeddings, resume artifacts, and raw storage
              objects.
            </li>
            <li>
              <strong className="text-text">Right to Object &amp; Restrict Processing:</strong> You
              may toggle agent autonomy settings or disable specific agents at any time.
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-medium text-text">
            7. Data Retention &amp; Backup Expiration
          </h2>
          <p>
            When data is deleted, relational database records and vector index entries are purged
            immediately. Ephemeral operational backups are completely rotated out and irreversibly
            destroyed within 30 days of deletion.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-medium text-text">8. Contact Us</h2>
          <p>
            For privacy inquiries, regulatory requests, or to contact our Data Protection Officer,
            please reach out to{' '}
            <a href="mailto:privacy@vaeloom.app" className="text-primary hover:underline">
              privacy@vaeloom.app
            </a>{' '}
            or write to Vaeloom Privacy Operations.
          </p>
        </section>
      </div>

      <footer className="mt-12 pt-6 border-t border-border flex items-center justify-between">
        <Link href="/login" className="btn-secondary">
          &larr; Back to sign in
        </Link>
        <Link href="/terms" className="text-sm text-text-muted hover:text-text hover:underline">
          View Terms of Service &rarr;
        </Link>
      </footer>
    </main>
  );
}
