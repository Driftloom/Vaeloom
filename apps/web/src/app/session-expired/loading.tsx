import React from 'react';

export default function SessionExpiredLoading() {
  return (
    <div
      role="status"
      aria-label="Loading session status"
      className="flex min-h-[70vh] items-center justify-center p-6 animate-pulse"
    >
      <div className="max-w-md w-full text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-surface-200 mx-auto" />
        <div className="h-6 w-48 bg-surface-200 rounded mx-auto" />
        <div className="h-4 w-64 bg-surface-200 rounded mx-auto" />
        <div className="h-9 w-36 bg-surface-200 rounded-lg mx-auto pt-2" />
      </div>
    </div>
  );
}
