'use client';
import React, { useState } from 'react';

export default function ChatPage() {
  const [messages, setMessages] = useState([
    { id: '1', role: 'user', text: 'Can you help me tailor my resume for the Google role?' },
    { 
      id: '2', 
      role: 'agent', 
      agent: 'Orchestrator',
      text: 'I have delegated this to the Resume Agent. It is currently comparing your master resume with the Google job description.',
      sources: []
    },
    { 
      id: '3', 
      role: 'agent', 
      agent: 'Resume Agent',
      text: 'I have created a new variant "Google SWE". I highlighted your Python and scalable systems experience. You can review it in the Resume tab.',
      sources: ['Resume.pdf', 'Google JD']
    }
  ]);
  const [input, setInput] = useState('');

  const handleSend = () => {
    if (!input.trim()) return;
    setMessages([...messages, { id: Date.now().toString(), role: 'user', text: input }]);
    setInput('');
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <header className="mb-6">
        <h1 className="text-3xl font-display font-medium text-text mb-2">Agent Chat</h1>
        <p className="text-text-muted">Communicate directly with your Vaeloom agents.</p>
      </header>

      <div className="flex-1 card flex flex-col p-0 overflow-hidden">
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.map(msg => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] p-4 rounded-lg ${msg.role === 'user' ? 'bg-primary text-white rounded-tr-none' : 'bg-surface-hover border border-border text-text rounded-tl-none'}`}>
                {msg.role === 'agent' && (
                  <div className="text-xs font-mono text-primary uppercase tracking-wider mb-2">
                    {msg.agent}
                  </div>
                )}
                <p>{msg.text}</p>
                {msg.sources && msg.sources.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-border/50 flex gap-2 flex-wrap">
                    <span className="text-xs text-text-muted font-mono uppercase">Sources:</span>
                    {msg.sources.map(src => (
                      <span key={src} className="text-xs bg-background px-2 py-1 rounded text-text-muted border border-border/50">
                        {src}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
        
        <div className="p-4 bg-surface-hover border-t border-border flex gap-4">
          <input 
            type="text" 
            className="flex-1 bg-background border border-border rounded-md px-4 py-2 text-text focus:outline-none focus:border-primary"
            placeholder="Ask your agents to do something..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          />
          <button className="btn-primary" onClick={handleSend}>Send</button>
        </div>
      </div>
    </div>
  );
}
