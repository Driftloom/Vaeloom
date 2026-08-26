'use client';

import { useParams } from 'next/navigation';
import dynamic from 'next/dynamic';

const OverleafEditor = dynamic(
  () => import('@/components/resume/OverleafEditor').then((m) => ({ default: m.OverleafEditor })),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-[60vh] text-sm text-muted">
        Loading Overleaf editor…
      </div>
    ),
  },
);

export default function ResumeEditPage() {
  const params = useParams();
  const workspaceId = params?.['workspaceId'] as string | undefined;
  const resumeId = params?.['resumeId'] as string | undefined;

  if (!workspaceId || !resumeId) {
    return <div className="flex items-center justify-center h-full text-muted">Loading…</div>;
  }

  return (
    <div className="p-2 md:p-3">
      <OverleafEditor workspaceId={workspaceId} resumeId={resumeId} />
      <div className="mt-2 text-[11px] text-muted px-1">
        Why edit/see? Resume is high-stakes — you need <b>control</b> (source + visual),{' '}
        <b>trust</b> (provenance % + ATS heatmap per bullet), and <b>speed</b> (50ms WASM live vs
        300ms server). Overleaf way gives non-tech the form, power users the Typst/LaTeX, both
        synced.
      </div>
    </div>
  );
}
