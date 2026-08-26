'use client';

import Editor from '@monaco-editor/react';
import { useEffect, useRef } from 'react';

interface Props {
  value: string;
  language?: 'typst' | 'latex';
  onChange: (v: string) => void;
  onSelection?: (startLine: number, endLine: number, selectedText: string) => void;
  markers?: Array<{ line: number; severity: 'error' | 'warning'; message: string }>;
  provenanceMap?: Map<number, string>;
}

export function EditorPane({
  value,
  language = 'typst',
  onChange,
  onSelection,
  markers = [],
  provenanceMap,
}: Props) {
  const editorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);

  const handleMount = (editor: any, monaco: any) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // Typst language (minimal) — if not already registered, register
    if (
      language === 'typst' &&
      !monaco.languages.getLanguages().some((l: any) => l.id === 'typst')
    ) {
      monaco.languages.register({ id: 'typst' });
      monaco.languages.setMonarchTokensProvider('typst', {
        tokenizer: {
          root: [
            [/#\w+/, 'keyword'],
            [/\/\/.*$/, 'comment'],
            [/"[^"]*"/, 'string'],
            [/\[.*?\]/, 'string'],
          ],
        },
      });
    }

    editor.onDidChangeCursorSelection((e: any) => {
      if (!onSelection) return;
      const sel = e.selection;
      const startLine = sel.startLineNumber;
      const endLine = sel.endLineNumber;
      const model = editor.getModel();
      if (!model) return;
      const text = model.getValueInRange(sel);
      if (text && text.trim().length > 3) {
        onSelection(startLine, endLine, text);
      }
    });
  };

  // Apply markers (ATS errors, LaTeX log)
  useEffect(() => {
    if (!editorRef.current || !monacoRef.current) return;
    const model = editorRef.current.getModel();
    if (!model) return;
    const monaco = monacoRef.current;
    const mks = markers.map((m) => ({
      startLineNumber: m.line,
      startColumn: 1,
      endLineNumber: m.line,
      endColumn: 120,
      message: m.message,
      severity:
        m.severity === 'error' ? monaco.MarkerSeverity.Error : monaco.MarkerSeverity.Warning,
    }));
    monaco.editor.setModelMarkers(model, 'overleaf', mks);
  }, [markers]);

  return (
    <div className="h-full w-full relative flex flex-col border-r border-border">
      <div className="flex items-center justify-between px-2 py-1 bg-surface-50 border-b border-border text-xs text-muted">
        <span className="font-medium">main.{language === 'typst' ? 'typ' : 'tex'}</span>
        <span className="opacity-70">
          {language === 'typst' ? 'Typst WASM 50ms' : 'Tectonic 300ms'}
        </span>
      </div>
      <div className="flex-1 relative">
        <Editor
          height="100%"
          language={language === 'typst' ? 'typst' : 'latex'}
          value={value}
          onChange={(v) => onChange(v ?? '')}
          onMount={handleMount}
          options={{
            minimap: { enabled: false },
            fontSize: 13,
            lineHeight: 18,
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            tabSize: 2,
            renderWhitespace: 'selection',
            quickSuggestions: false,
          }}
        />
        {/* Provenance gutter badges — floating top-right */}
        {provenanceMap && provenanceMap.size > 0 && (
          <div className="absolute top-2 right-2 flex flex-col gap-1 pointer-events-none opacity-60 text-[10px]">
            {Array.from(provenanceMap.entries())
              .slice(0, 3)
              .map(([line, docId]) => (
                <span
                  key={line}
                  className="bg-emerald-50 text-emerald-700 border border-emerald-200 rounded px-1.5 py-0.5"
                >
                  L{line} ◎ {docId.slice(0, 8)}
                </span>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
