'use client';

import React from 'react';
import { Button, Textarea } from '@vaeloom/ui-kit';
import { useToast } from '@/components/shared/Toast';
import { type ManifestOmission } from './mcpManifest';

export interface McpManifestTabProps {
  configText: string;
  onChangeText: (text: string) => void;
  manifestOmissions: ManifestOmission[];
}

export const McpManifestTab: React.FC<McpManifestTabProps> = ({
  configText,
  onChangeText,
  manifestOmissions,
}) => {
  const { toast } = useToast();

  const handleCopy = () => {
    void navigator.clipboard?.writeText(configText).then(
      () => toast({ tone: 'info', title: 'Copied mcp.json to clipboard' }),
      () =>
        toast({
          tone: 'error',
          title: 'Copy failed',
          detail: 'The browser refused clipboard access.',
        }),
    );
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-surface">
      <div className="px-4 py-2 border-b border-border bg-surface-elevated/70 flex items-center justify-between gap-3 shrink-0">
        <h3 className="text-xs font-mono font-medium text-text">
          mcp.json
          <span className="text-2xs text-text-muted font-sans ml-2">
            Claude Desktop / Cursor compatible manifest
          </span>
        </h3>
        <Button variant="ghost" size="sm" onClick={handleCopy}>
          Copy JSON
        </Button>
      </div>

      {manifestOmissions.length > 0 && (
        <div className="px-4 py-2 border-b border-border bg-warning/10 text-2xs text-warning shrink-0">
          {manifestOmissions.length} server(s) are not in this manifest:{' '}
          {manifestOmissions.map((o) => `${o.key} (${o.reason})`).join('; ')}
        </div>
      )}

      <div className="flex-1 flex overflow-hidden bg-surface font-mono text-xs">
        <div
          aria-hidden="true"
          className="w-10 py-3 bg-surface-elevated border-r border-border text-right pr-2 text-text-muted select-none text-xs leading-5 shrink-0"
        >
          {configText.split('\n').map((_, index) => (
            <div key={index}>{index + 1}</div>
          ))}
        </div>

        <Textarea
          aria-label="mcp.json manifest"
          value={configText}
          onChange={(event) => onChangeText(event.target.value)}
          spellCheck={false}
          className="h-full min-h-[0px] rounded-[0px] border-[0px] bg-[transparent] px-[12px] py-[12px] leading-5 resize-none overflow-auto overscroll-contain selection:bg-primary/20 text-text font-mono text-xs"
        />
      </div>
    </div>
  );
};
