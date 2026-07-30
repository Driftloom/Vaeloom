import { LoadingSpinner } from '@/components/common/LoadingSpinner';

export default function AuthLoading() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-background">
      <LoadingSpinner size="md" />
    </main>
  );
}
