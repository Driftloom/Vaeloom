'use client';

import { ErrorState } from '@/components/shared/ErrorState';

export default function RootError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="min-h-screen flex items-center justify-center bg-background">
      <ErrorState title="Something went wrong" message={error.message || 'An unexpected error occurred.'} onRetry={reset} />
    </main>
  );
}
