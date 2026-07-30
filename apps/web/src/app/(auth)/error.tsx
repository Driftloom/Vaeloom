'use client';

import { ErrorState } from '@/components/shared/ErrorState';

export default function AuthError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="min-h-screen flex items-center justify-center bg-background">
      <ErrorState title="Authentication error" message={error.message || 'Something went wrong during authentication.'} onRetry={reset} />
    </main>
  );
}
