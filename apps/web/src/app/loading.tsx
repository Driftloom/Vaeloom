import { LoadingSpinner } from '@/components/common/LoadingSpinner';

export default function RootLoading() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-background">
      <LoadingSpinner size="lg" text="Loading Vaeloom…" />
    </main>
  );
}
