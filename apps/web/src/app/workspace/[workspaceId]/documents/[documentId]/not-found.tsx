import Link from 'next/link';

/**
 * Route-level 404 for a document id that does not resolve.
 *
 * `DocumentDetailView` renders its own not-found state for a 404 from
 * `documentApi.getById`, so this boundary only catches ids that never reach the
 * component. It exists so a bad id resolves to a real 404 instead of bubbling
 * into the workspace-level boundary as an unexpected error.
 */
export default function DocumentNotFound() {
  return (
    <div className="flex h-full items-center justify-center min-h-[60dvh] p-4">
      <div className="max-w-md w-full text-center">
        <h2 className="text-lg font-semibold text-text">Document not found</h2>
        <p className="mt-2 text-sm text-text-muted">
          This document does not exist, or it belongs to a different workspace.
        </p>
        <Link
          href="."
          className="btn-primary mt-6 inline-flex items-center rounded-lg px-4 py-2 text-sm font-medium"
        >
          Back to documents
        </Link>
      </div>
    </div>
  );
}
