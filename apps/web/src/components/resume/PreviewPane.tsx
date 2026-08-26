'use client';

import { useEffect, useRef, useState } from 'react';

interface Props {
  htmlPreview: string | null;
  atsScore?: number | null;
  title?: string;
  onDownloadPdf?: () => void;
}

export function PreviewPane({
  htmlPreview,
  atsScore,
  title = 'Live Preview',
  onDownloadPdf,
}: Props) {
  const [zoom, setZoom] = useState(100);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Synced scroll: not full Overleaf Synctex yet — placeholder for future
  useEffect(() => {
    // Could add postMessage sync between Monaco and iframe scroll
  }, [htmlPreview]);

  return (
    <div className="h-full w-full flex flex-col bg-surface-50">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-white text-xs">
        <div className="flex items-center gap-2">
          <span className="font-medium">{title}</span>
          {atsScore !== null && atsScore !== undefined && (
            <span
              className={`px-2 py-0.5 rounded-full text-[11px] font-medium border ${
                atsScore >= 90
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : atsScore >= 75
                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                    : 'bg-red-50 text-red-700 border-red-200'
              }`}
            >
              ATS {atsScore}%
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setZoom((z) => Math.max(50, z - 10))}
            className="px-2 py-1 rounded hover:bg-surface-100 border border-transparent hover:border-border"
          >
            −
          </button>
          <span className="w-12 text-center">{zoom}%</span>
          <button
            onClick={() => setZoom((z) => Math.min(200, z + 10))}
            className="px-2 py-1 rounded hover:bg-surface-100 border border-transparent hover:border-border"
          >
            +
          </button>
          {onDownloadPdf && (
            <button
              onClick={onDownloadPdf}
              className="ml-2 px-3 py-1 rounded bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90"
            >
              Download PDF
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-[#525659] p-4 flex justify-center">
        {htmlPreview ? (
          <div
            className="bg-white shadow-lg w-full max-w-[794px] min-h-[1100px] overflow-hidden"
            style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top center' }}
          >
            <iframe
              ref={iframeRef}
              title="Resume live preview"
              srcDoc={htmlPreview}
              sandbox="allow-same-origin"
              className="w-full h-[1100px] border-0"
            />
          </div>
        ) : (
          <div className="text-white/70 text-sm self-center">Start typing to see live preview…</div>
        )}
      </div>

      <div className="px-3 py-1 border-t border-border bg-white text-[11px] text-muted flex items-center justify-between">
        <span>Page 1 of 1 · A4 · {zoom}%</span>
        <span className="opacity-70">Hybrid: Typst WASM 50ms live → Playwright PDF for export</span>
      </div>
    </div>
  );
}
