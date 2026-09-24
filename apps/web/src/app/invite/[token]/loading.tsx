import React from 'react';
import { Spinner } from '@vaeloom/ui-kit';

export default function WorkspaceInviteLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Spinner size="lg" />
    </div>
  );
}
