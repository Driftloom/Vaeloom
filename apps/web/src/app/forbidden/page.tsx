import Link from 'next/link';

export default function Forbidden() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-background text-center px-4">
      <h1 className="text-6xl font-display font-bold text-primary mb-4">403</h1>
      <h2 className="text-2xl font-display font-medium text-text mb-2">Access denied</h2>
      <p className="text-text-muted max-w-sm mb-8">
        You do not have permission to view this page. If you believe this is a mistake, contact your
        workspace administrator.
      </p>
      <div className="flex flex-col sm:flex-row gap-3">
        <Link href="/" className="btn-primary">
          Go to workspace
        </Link>
        <Link href="/" className="btn-secondary">
          Go Home
        </Link>
      </div>
    </main>
  );
}
