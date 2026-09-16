import Link from 'next/link';

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-background text-text px-6 py-12 max-w-4xl mx-auto">
      <header className="mb-8 border-b border-border pb-6">
        <h1 className="text-3xl font-display font-medium text-text mb-2">Terms of Service</h1>
        <p className="text-text-muted text-sm">
          Effective Date: September 16, 2026 &bull; Version 1.0 (Production Release)
        </p>
      </header>

      <div className="space-y-8 text-sm text-text-muted leading-relaxed">
        <section className="space-y-3">
          <h2 className="text-lg font-medium text-text">1. Agreement to Terms</h2>
          <p>
            Welcome to Vaeloom. By accessing or using our websites, software, APIs, or AI agent
            services (collectively, the &ldquo;Platform&rdquo;), you agree to be legally bound by
            these Terms of Service (&ldquo;Terms&rdquo;). If you are accessing or using the Platform
            on behalf of an organization or enterprise entity, you represent and warrant that you
            have authority to bind that entity to these Terms.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-medium text-text">
            2. Accounts, Workspaces, and Multi-Tenancy
          </h2>
          <p>
            To use the Platform, you must register for an account and create or join a workspace.
            You are responsible for safeguarding your credentials, session tokens, and API keys. You
            must immediately notify us of any unauthorized use or security compromise of your
            workspace.
          </p>
          <p>
            Each workspace operates under cryptographic and database-enforced multi-tenant
            isolation. You agree not to attempt to circumvent, probe, or breach the tenant
            boundaries or PostgreSQL Row-Level Security (RLS) policies of any other user or
            workspace.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-medium text-text">
            3. User Ownership &amp; Intellectual Property
          </h2>
          <p>
            You retain 100% ownership and all intellectual property rights in and to any data,
            resumes, documents, notes, and messages you submit, upload, or ingest into the Platform
            (&ldquo;Customer Content&rdquo;).
          </p>
          <p>
            You grant Vaeloom a limited, non-exclusive, revocable license strictly to host, index,
            parse, chunk, embed, and process your Customer Content solely to provide the services to
            you. Vaeloom does not claim ownership over any memory records, knowledge graph
            projections, or compiled documents derived from your data.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-medium text-text">
            4. AI Agentic Systems &amp; Human Approval Policy
          </h2>
          <p>
            Vaeloom provides autonomous and semi-autonomous AI agents designed to assist with career
            development, scheduling, communications drafting, and document generation:
          </p>
          <ul className="list-disc pl-5 space-y-2">
            <li>
              <strong className="text-text">Suggest-Mode by Default:</strong> Agents operate
              primarily in suggestion mode. They produce drafts, recommendations, and plans that
              require your explicit review.
            </li>
            <li>
              <strong className="text-text">Consequential Action Gates:</strong> Any action that
              modifies external systems, dispatches communication, or mutates persistent
              configurations is approval-gated. You are solely responsible for reviewing and
              approving actions executed by agents on your behalf.
            </li>
            <li>
              <strong className="text-text">AI Accuracy &amp; No Warranty:</strong> AI outputs are
              probabilistic. While Vaeloom includes deterministic QA validators and hallucination
              scoring, outputs may occasionally contain errors. You must verify critical information
              (e.g., job application details, legal dates, resume qualifications) prior to
              submission.
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-medium text-text">
            5. Third-Party Connectors &amp; Least Privilege
          </h2>
          <p>
            When connecting integrations (such as Google, GitHub, Slack, Notion, or Microsoft
            Graph), you authorize Vaeloom to interact with the respective APIs on your behalf.
            Connectors operate with strict scope limits. In particular, our Gmail integration is
            draft-only and cannot dispatch outbound email without user interaction in the mail
            client.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-medium text-text">6. Acceptable Use Policy</h2>
          <p>You agree not to use the Platform to:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              Conduct adversarial prompt injection, jailbreaking, or attempt to bypass agent
              security filters;
            </li>
            <li>
              Harvest, mine, or reverse engineer platform models, agent prompt chains, or system
              architecture;
            </li>
            <li>Upload malicious payloads, viruses, or exploit files;</li>
            <li>
              Transmit unsolicited communications or engage in unlawful or deceptive activities.
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-medium text-text">
            7. Termination and Complete Data Erasure
          </h2>
          <p>
            You may terminate your account at any time. Under our zero-trust commitment, you have
            the right to request full, irreversible erasure of all personal data, vector embeddings,
            graph nodes, and files via Settings or our GDPR deletion endpoints.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-medium text-text">8. Limitation of Liability</h2>
          <p>
            TO THE MAXIMUM EXTENT PERMITTED BY LAW, VAELOOM SHALL NOT BE LIABLE FOR ANY INDIRECT,
            INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR FOR LOSS OF PROFITS, DATA,
            OR GOODWILL, ARISING OUT OF OR IN CONNECTION WITH YOUR ACCESS TO OR USE OF THE PLATFORM
            OR AI AGENT SUGGESTIONS.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-medium text-text">9. Contact &amp; Legal Notices</h2>
          <p>
            For legal inquiries, copyright notices, or questions regarding these Terms, please
            contact{' '}
            <a href="mailto:legal@vaeloom.app" className="text-primary hover:underline">
              legal@vaeloom.app
            </a>
            .
          </p>
        </section>
      </div>

      <footer className="mt-12 pt-6 border-t border-border flex items-center justify-between">
        <Link href="/login" className="btn-secondary">
          &larr; Back to sign in
        </Link>
        <Link href="/privacy" className="text-sm text-text-muted hover:text-text hover:underline">
          View Privacy Policy &rarr;
        </Link>
      </footer>
    </main>
  );
}
