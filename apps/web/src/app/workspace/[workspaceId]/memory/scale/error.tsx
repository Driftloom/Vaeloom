'use client';

import MemorySectionError from '@/components/memory/MemorySectionError';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <MemorySectionError
      error={error}
      reset={reset}
      route="memory/scale"
      title="Multiscale memory error"
    />
  );
}
