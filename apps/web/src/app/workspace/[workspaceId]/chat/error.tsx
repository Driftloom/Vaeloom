'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { captureError } from '@/lib/error-tracking';

export default function ChatError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const params = useParams();
  const workspaceId = params['workspaceId'] as string | undefined;
  const retryRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    // `digest` is the only correlation handle Next.js hands a server-side boundary,
    // and it is populated for exactly the errors that are hardest to trace. Logged
    // without it, a chat failure is unjoinable against the server logs.
    captureError(error, { route: 'chat', digest: error.digest ?? null });
  }, [error]);

  useEffect(() => {
    // The boundary mounts with focus still parked on <body>, so role="alert" is
    // announced but a keyboard user has to Tab from the very top of the document to
    // reach the retry control. Move focus to the primary recovery action instead.
    retryRef.current?.focus();
  }, []);

  return (
    <div role="alert" className="flex h-full min-h-[60dvh] items-center justify-center p-4">
      <div className="w-full max-w-md rounded-card border border-error/30 bg-error/5 p-8 text-center">
        <div
          aria-hidden="true"
          className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-error/10 text-error"
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4M12 16h.01" />
          </svg>
        </div>

        <h2 className="text-lg font-medium text-text">Chat session error</h2>
        {/* Deliberately not error.message: for an ApiError that string is verbatim
            server output, and error boundaries are rendered to whoever hit the
            failure. The raw text still reaches support via the disclosure below. */}
        <p className="mt-2 text-sm text-text-muted">
          The chat session could not be loaded. This is usually temporary — retry, or leave the
          thread and come back once the agent runtime is reachable.
        </p>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          <button ref={retryRef} type="button" onClick={reset} className="btn-outline">
            Try again
          </button>
          <button type="button" onClick={() => window.location.reload()} className="btn-outline">
            Reload page
          </button>
          {workspaceId ? (
            <Link href={`/workspace/${workspaceId}`} className="btn-ghost">
              Back to workspace
            </Link>
          ) : null}
        </div>

        <details className="mt-6 w-full text-left">
          <summary className="cursor-pointer text-xs text-text-dim hover:text-text">
            Technical details
          </summary>
          <dl className="mt-2 space-y-1 font-mono text-xs text-text-dim">
            <dt className="text-text-muted">Message</dt>
            <dd className="break-words">{error.message || 'No message reported.'}</dd>
            {error.digest ? (
              <>
                <dt className="text-text-muted">Digest</dt>
                <dd className="break-words">{error.digest}</dd>
              </>
            ) : null}
          </dl>
        </details>
      </div>
    </div>
  );
}
