import { LoadingSpinner } from '@/components/common/LoadingSpinner';

export default function HelpLoading() {
  return (
    <div className="flex h-full items-center justify-center min-h-[60vh]">
      <LoadingSpinner size="lg" text="Loading knowledge base…" />
    </div>
  );
}
