import Link from 'next/link';

export default function WorkspaceNotFound() {
  return (
    <div className="flex h-full flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <h1 className="text-6xl font-display font-bold text-primary mb-4">404</h1>
      <h2 className="text-xl font-display font-medium text-text mb-2">Workspace not found</h2>
      <p className="text-text-muted max-w-sm mb-8">This workspace does not exist or you do not have access to it.</p>
      <Link href="/" className="btn-primary">
        Go Home
      </Link>
    </div>
  );
}
