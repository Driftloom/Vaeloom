import { LoadingSpinner } from '@/components/common/LoadingSpinner';

export default function CareerLoading() {
  return (
    <div className="flex h-full items-center justify-center min-h-[60dvh]">
      <LoadingSpinner size="lg" text="Calibrating career competency radar…" />
    </div>
  );
}
