'use client';

import React, { useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useSSE } from '../../../../hooks/useApi';
import { api } from '../../../../lib/api';

interface OrchestratorResponse {
  agent_name: string;
  action: string;
  confidence: number;
  result: {
    summary: string;
    details: string | null;
    proposals: any[];
    questions: string[];
  };
  qa_flag?: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'agent';
  agent?: string;
  text: string;
  sources?: string[];
  proposals?: any[];
  questions?: string[];
  error?: boolean;
}

export default function ChatPage() {
  const params = useParams();
  const workspaceId = params?.['workspaceId'] as string | undefined;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Future SSE support — wrapped in try/catch for now
  try {
    useSSE(
      workspaceId ? `/workspaces/${workspaceId}/chat/stream` : '',
      () => {},
      () => {},
    );
  } catch {
    /* SSE not yet wired — will connect when backend streams are ready */
  }

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || !workspaceId || loading) return;

    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', text };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    setError(null);

    try {
      const res = await api.request<OrchestratorResponse>(`/workspaces/${workspaceId}/chat`, {
        method: 'POST',
        body: JSON.stringify({ message: text }),
      });

      const agentMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'agent',
        agent: res.agent_name,
        text: res.result.summary,
        proposals: res.result.proposals?.length ? res.result.proposals : undefined,
        questions: res.result.questions?.length ? res.result.questions : undefined,
        sources: res.result.details ? [res.result.details] : undefined,
      };
      setMessages((prev) => [...prev, agentMsg]);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Failed to send message';
      setError(errMsg);
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'agent',
          agent: 'Orchestrator',
          text: errMsg,
          error: true,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, [input, workspaceId, loading]);

  const retryLast = useCallback(() => {
    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    if (lastUser) {
      setInput(lastUser.text);
      setMessages((prev) => prev.filter((m) => m.error));
    }
  }, [messages]);

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <header className="mb-6">
        <h1 className="text-3xl font-display font-medium text-text mb-2">Agent Chat</h1>
        <p className="text-text-muted">Communicate directly with your Vaeloom agents.</p>
      </header>

      <div className="flex-1 card flex flex-col p-0 overflow-hidden">
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.length === 0 && !loading && (
            <div className="flex items-center justify-center h-full text-text-muted">
              Send a message to start chatting with your agents.
            </div>
          )}
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[80%] p-4 rounded-lg ${
                  msg.role === 'user'
                    ? 'bg-primary text-white rounded-tr-none'
                    : msg.error
                      ? 'bg-red-900/20 border border-red-500/50 text-red-300 rounded-tl-none'
                      : 'bg-surface-hover border border-border text-text rounded-tl-none'
                }`}
              >
                {msg.role === 'agent' && (
                  <div className="text-xs font-mono text-primary uppercase tracking-wider mb-2">
                    {msg.agent}
                  </div>
                )}
                <p>{msg.text}</p>
                {msg.proposals && msg.proposals.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-border/50">
                    <span className="text-xs text-text-muted font-mono uppercase">Proposals:</span>
                    <ul className="mt-1 space-y-1">
                      {msg.proposals.map((p: any, i: number) => (
                        <li key={i} className="text-sm text-text-muted">
                          {typeof p === 'string' ? p : JSON.stringify(p)}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {msg.questions && msg.questions.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-border/50">
                    <span className="text-xs text-text-muted font-mono uppercase">Questions:</span>
                    <ul className="mt-1 space-y-1">
                      {msg.questions.map((q, i) => (
                        <li key={i} className="text-sm text-text-muted">{q}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {msg.sources && msg.sources.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-border/50 flex gap-2 flex-wrap">
                    <span className="text-xs text-text-muted font-mono uppercase">Sources:</span>
                    {msg.sources.map((src) => (
                      <span
                        key={src}
                        className="text-xs bg-background px-2 py-1 rounded text-text-muted border border-border/50"
                      >
                        {src}
                      </span>
                    ))}
                  </div>
                )}
                {msg.error && (
                  <button className="mt-2 text-xs text-primary hover:underline" onClick={retryLast}>
                    Retry
                  </button>
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="max-w-[80%] p-4 rounded-lg bg-surface-hover border border-border text-text rounded-tl-none">
                <div className="flex gap-1 items-center">
                  <span className="w-2 h-2 bg-primary rounded-full animate-bounce" />
                  <span className="w-2 h-2 bg-primary rounded-full animate-bounce delay-100" />
                  <span className="w-2 h-2 bg-primary rounded-full animate-bounce delay-200" />
                  <span className="ml-2 text-xs text-text-muted font-mono">Agent is typing</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 bg-surface-hover border-t border-border flex gap-4">
          <input
            type="text"
            aria-label="Chat message"
            className="flex-1 bg-background border border-border rounded-md px-4 py-2 text-text focus:outline-none focus:border-primary disabled:opacity-50"
            placeholder="Ask your agents to do something..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            disabled={loading}
          />
          <button className="btn-primary disabled:opacity-50" onClick={handleSend} disabled={loading || !input.trim()}>
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
