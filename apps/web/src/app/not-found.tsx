import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-background text-center px-4">
      <h1 className="text-6xl font-display font-bold text-primary mb-4">404</h1>
      <h2 className="text-2xl font-display font-medium text-text mb-2">Page not found</h2>
      <p className="text-text-muted max-w-sm mb-8">The page you are looking for does not exist or has been moved.</p>
      <Link href="/" className="btn-primary">
        Go Home
      </Link>
    </main>
  );
}
