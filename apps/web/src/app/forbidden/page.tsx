import Link from 'next/link';
import { PageHeader } from '@/components/shared/Page';

export default function Forbidden() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-background text-center px-4">
      <div className="w-full max-w-md mb-6">
        {/* The status code is a label, not the page title, so it is not the h1. */}
        <p className="text-6xl font-display font-bold text-primary">403</p>
        <PageHeader
          title="Access denied"
          description="You do not have permission to view this page. If you believe this is a mistake, contact your workspace administrator."
          className="text-center"
        />
      </div>
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
