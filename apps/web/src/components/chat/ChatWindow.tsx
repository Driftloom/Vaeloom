'use client';

import React, { useState, useCallback } from 'react';
import { chatApi } from '@/lib/api-client';

interface ChatMessage {
  id: string;
  role: 'user' | 'agent';
  text: string;
  error?: boolean;
}

export function ChatWindow({ workspaceId }: { workspaceId: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || !workspaceId || loading) return;

    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', text };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    setError(null);

    try {
      const res = await chatApi.send(workspaceId, { message: text });
      setMessages((prev) => [
        ...prev,
        { id: (Date.now() + 1).toString(), role: 'agent', text: res.reply || 'No response' },
      ]);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Failed to send message';
      setError(errMsg);
      setMessages((prev) => [
        ...prev,
        { id: (Date.now() + 1).toString(), role: 'agent', text: errMsg, error: true },
      ]);
    } finally {
      setLoading(false);
    }
  }, [input, workspaceId, loading]);

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <header className="mb-6">
        <h1 className="text-3xl font-display font-medium text-text mb-2">Agent Chat</h1>
        <p className="text-text-muted">Communicate directly with your Vaeloom agents.</p>
      </header>

      <div className="flex-1 card flex flex-col p-0 overflow-hidden">
        <div
          className="flex-1 overflow-y-auto p-6 space-y-6"
          role="log"
          aria-live="polite"
          aria-label="Chat messages"
        >
          {messages.length === 0 && !loading && (
            <div className="flex items-center justify-center h-full text-text-muted">
              Send a message to start chatting with your agents.
            </div>
          )}
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] p-4 rounded-lg ${
                  msg.role === 'user'
                    ? 'bg-primary text-white rounded-tr-none'
                    : msg.error
                      ? 'bg-red-900/20 border border-red-500/50 text-red-300 rounded-tl-none'
                      : 'bg-surface-hover border border-border text-text rounded-tl-none'
                }`}
              >
                <p>{msg.text}</p>
                {!msg.error && msg.role === 'agent' && (
                  <p className="mt-2 text-[10px] text-text-muted border-t border-border pt-2">
                    AI-generated suggestion — verify facts before acting. Agents only propose;
                    nothing is sent or applied without your approval.
                  </p>
                )}
                {msg.error && (
                  <button
                    className="mt-2 text-xs text-primary hover:underline"
                    onClick={() => {
                      const lastUser = [...messages].reverse().find((m) => m.role === 'user');
                      if (lastUser) setInput(lastUser.text);
                    }}
                  >
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
          <button
            className="btn-primary disabled:opacity-50"
            onClick={handleSend}
            disabled={loading || !input.trim()}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
