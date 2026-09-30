import Link from 'next/link';
import { PageHeader } from '@/components/shared/Page';

export default function WorkspaceNotFound() {
  return (
    <div className="flex h-full flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <p className="text-6xl font-display font-bold text-primary mb-4">404</p>
      <PageHeader
        title="Workspace not found"
        description="This workspace does not exist or you do not have access to it."
        className="text-center"
      />
      <Link href="/" className="btn-primary mt-8">
        Go Home
      </Link>
    </div>
  );
}
