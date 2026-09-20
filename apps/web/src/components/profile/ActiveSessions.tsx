'use client';

import React, { useState } from 'react';
import useSWR from 'swr';
import { api, type SessionItem } from '@/lib/api';
import { useToast } from '@/components/shared/Toast';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { Panel } from '@/components/shared/Panel';
import { Badge, Button, Skeleton } from '@vaeloom/ui-kit';

function parseUserAgent(ua?: string): { browser: string; os: string; isMobile: boolean } {
  if (!ua) return { browser: 'Unknown Browser', os: 'Unknown OS', isMobile: false };
  let browser = 'Web Browser';
  if (ua.includes('Firefox/')) browser = 'Firefox';
  else if (ua.includes('Edg/')) browser = 'Microsoft Edge';
  else if (ua.includes('Chrome/')) browser = 'Chrome';
  else if (ua.includes('Safari/') && !ua.includes('Chrome/')) browser = 'Safari';
  let os = 'Unknown OS';
  const isMobile = /iPhone|iPad|iPod|Android/i.test(ua);
  if (ua.includes('Windows NT 10.0') || ua.includes('Windows')) os = 'Windows';
  else if (ua.includes('Macintosh') || ua.includes('Mac OS X')) os = 'macOS';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';
  else if (ua.includes('Linux')) os = 'Linux';
  return { browser, os, isMobile };
}

export function ActiveSessions() {
  const { toast } = useToast();
  const { data, error, isLoading, mutate } = useSWR('user-sessions', () => api.listSessions());
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [revokingAll, setRevokingAll] = useState(false);
  const [showRevokeAllDialog, setShowRevokeAllDialog] = useState(false);

  const sessions: SessionItem[] = data?.sessions ?? [];
  const otherSessions = sessions.filter((s) => !s.isCurrent);

  const handleRevoke = async (sessionId: string) => {
    setRevokingId(sessionId);
    try {
      await api.revokeSession(sessionId);
      await mutate(
        (prev) => (prev ? { sessions: prev.sessions.filter((s) => s.id !== sessionId) } : prev),
        false,
      );
      toast({
        tone: 'success',
        title: 'Session revoked',
        detail: 'The selected device has been logged out successfully.',
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Please try again later.';
      toast({ tone: 'error', title: 'Failed to revoke session', detail: msg });
    } finally {
      setRevokingId(null);
    }
  };

  const handleRevokeAllOthers = async () => {
    setRevokingAll(true);
    setShowRevokeAllDialog(false);
    try {
      const res = await api.revokeOtherSessions();
      await mutate();
      toast({
        tone: 'success',
        title: 'All other sessions revoked',
        detail: `Signed out of ${res.revokedCount} other device${res.revokedCount === 1 ? '' : 's'}.`,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Please try again later.';
      toast({ tone: 'error', title: 'Failed to revoke sessions', detail: msg });
    } finally {
      setRevokingAll(false);
    }
  };

  return (
    <>
      <ConfirmDialog
        isOpen={showRevokeAllDialog}
        onClose={() => setShowRevokeAllDialog(false)}
        onConfirm={handleRevokeAllOthers}
        title="Log Out All Other Devices"
        message="This will immediately revoke access from all other devices and browsers. Your current session will remain active."
        confirmLabel="Log Out All Others"
        cancelLabel="Cancel"
        variant="danger"
        loading={revokingAll}
      />

      <Panel>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-4 mb-5">
          <div>
            <h2 className="text-base font-semibold text-text">Active Login Sessions</h2>
            <p className="text-sm text-text-muted mt-0.5">
              Devices that have logged into your account. You can revoke access at any time.
            </p>
          </div>
          {otherSessions.length > 0 && (
            <Button
              variant="danger"
              size="sm"
              onClick={() => setShowRevokeAllDialog(true)}
              loading={revokingAll}
            >
              Log Out All Other Devices
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <Skeleton key={i} className="h-16 rounded-lg" />
            ))}
          </div>
        ) : error ? (
          <div className="p-4 rounded-lg bg-error/10 border border-error/20 text-error text-sm">
            Failed to load active sessions.
          </div>
        ) : sessions.length === 0 ? (
          <p className="text-sm text-text-muted py-4">No active sessions found.</p>
        ) : (
          <div className="space-y-3">
            {sessions.map((session) => {
              const { browser, os, isMobile } = parseUserAgent(session.userAgent);
              const created = new Date(session.createdAt).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              });

              return (
                <div
                  key={session.id}
                  className="flex items-center justify-between p-4 rounded-lg border border-border/80 bg-background/50 hover:bg-background/80 transition-colors"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface border border-border text-text-muted">
                      {isMobile ? (
                        <svg
                          className="w-5 h-5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"
                          />
                        </svg>
                      ) : (
                        <svg
                          className="w-5 h-5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                          />
                        </svg>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-text truncate">
                          {browser} on {os}
                        </span>
                        {session.isCurrent && (
                          <Badge variant="success" size="sm">
                            Current Device
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-text-muted">
                        <span>{session.ipAddress || 'IP Unknown'}</span>
                        <span>•</span>
                        <span>Signed in {created}</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    {!session.isCurrent ? (
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => handleRevoke(session.id)}
                        loading={revokingId === session.id}
                      >
                        Revoke
                      </Button>
                    ) : (
                      <span className="text-xs font-mono text-success/80 pr-2">Active now</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Panel>
    </>
  );
}
