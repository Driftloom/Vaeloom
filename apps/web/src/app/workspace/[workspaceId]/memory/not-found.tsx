import Link from 'next/link';

export default function MemoryNotFound() {
  return (
    <div
      role="status"
      className="flex flex-col items-center justify-center gap-4 py-20 text-center"
    >
      <h2 className="text-xl font-display font-medium text-[var(--color-text-primary)]">
        Memory page not found
      </h2>
      <p className="max-w-md text-sm text-[var(--color-text-secondary)]">
        This memory section does not exist. It may have been moved or renamed.
      </p>
      <Link
        href="../"
        className="text-sm font-medium text-[var(--color-brand-primary,#818cf8)] hover:underline"
      >
        Back to Memory
      </Link>
    </div>
  );
}
