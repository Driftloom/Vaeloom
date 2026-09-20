'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { realtimeClient, RealtimeMessage } from '@/lib/realtime-client';
import { useAuth } from '@/hooks/useAuth';

export type RealtimeConnectionStatus = 'connected' | 'connecting' | 'disconnected' | 'error';

interface RealtimeContextValue {
  status: RealtimeConnectionStatus;
  subscribe: (channel: string, handler: (msg: RealtimeMessage) => void) => () => void;
  send: (msg: RealtimeMessage) => void;
  latestAgentStep: any;
  latestToolExecution: any;
}

const RealtimeContext = createContext<RealtimeContextValue | null>(null);

export function RealtimeProvider({
  workspaceId,
  children,
}: {
  workspaceId: string;
  children: React.ReactNode;
}) {
  const { isAuthenticated } = useAuth();
  const [status, setStatus] = useState<RealtimeConnectionStatus>('disconnected');
  const [latestAgentStep, setLatestAgentStep] = useState<any>(null);
  const [latestToolExecution, setLatestToolExecution] = useState<any>(null);

  useEffect(() => {
    if (!isAuthenticated) return;

    realtimeClient.connect();
    setStatus('connected');

    const workspaceChannel = `workspace:${workspaceId}`;
    realtimeClient.subscribe(workspaceChannel);

    const unsubChannel = realtimeClient.on(
      `channel:${workspaceChannel}`,
      (msg: RealtimeMessage) => {
        const eventName = msg.event || (msg.type as string);
        if (eventName === 'AGENT_STEP') {
          setLatestAgentStep(msg.data);
        } else if (eventName === 'AGENT_TOOL_EXECUTION') {
          setLatestToolExecution(msg.data);
        } else if (eventName === 'AGENT_COMPLETE') {
          setLatestAgentStep(null);
          setLatestToolExecution(null);
        }
      },
    );

    const unsubConnect = realtimeClient.on('CONNECT', () => setStatus('connected'));
    const unsubDisconnect = realtimeClient.on('DISCONNECT', () => setStatus('disconnected'));
    const unsubError = realtimeClient.on('ERROR', () => setStatus('error'));

    return () => {
      unsubChannel();
      unsubConnect();
      unsubDisconnect();
      unsubError();
      realtimeClient.unsubscribe(workspaceChannel);
    };
  }, [workspaceId, isAuthenticated]);

  const subscribe = useCallback((channel: string, handler: (msg: RealtimeMessage) => void) => {
    realtimeClient.subscribe(channel);
    return realtimeClient.on(`channel:${channel}`, handler);
  }, []);

  const send = useCallback((msg: RealtimeMessage) => {
    realtimeClient.send(msg);
  }, []);

  return (
    <RealtimeContext.Provider
      value={{
        status,
        subscribe,
        send,
        latestAgentStep,
        latestToolExecution,
      }}
    >
      {children}
    </RealtimeContext.Provider>
  );
}

export function useRealtime(): RealtimeContextValue {
  const context = useContext(RealtimeContext);
  if (!context) {
    return {
      status: 'disconnected',
      subscribe: () => () => {},
      send: () => {},
      latestAgentStep: null,
      latestToolExecution: null,
    };
  }
  return context;
}
