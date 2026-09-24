import { LoadingSpinner } from '@/components/common/LoadingSpinner';

export default function SecurityLoading() {
  return (
    <div className="flex h-full items-center justify-center min-h-[60vh]">
      <LoadingSpinner size="lg" text="Verifying zero-trust security invariants…" />
    </div>
  );
}
