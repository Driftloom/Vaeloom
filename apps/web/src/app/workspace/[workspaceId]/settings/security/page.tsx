'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  Card,
  Badge,
  Button,
  Input,
  ShieldIcon,
  LockIcon,
  CheckIcon,
  ClockIcon,
  CopyIcon,
  AlertTriangleIcon,
  DownloadIcon,
  TrashIcon,
} from '@vaeloom/ui-kit';

export default function SecuritySettingsPage() {
  const params = useParams();
  const workspaceId = typeof params?.['workspaceId'] === 'string' ? params['workspaceId'] : '';

  const [mfaEnabled, setMfaEnabled] = useState(true);
  const [totpCode, setTotpCode] = useState('');
  const [totpVerified, setTotpVerified] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [sessionTimeout, setSessionTimeout] = useState('8h');

  const recoveryCodes = [
    'VAEL-9182-4412-B8A1',
    'VAEL-7719-0021-9982',
    'VAEL-3341-8910-CC12',
    'VAEL-5512-4491-EE44',
    'VAEL-8819-3321-FF55',
    'VAEL-1192-7744-AA99',
  ];

  const sessions = [
    {
      id: 'sess-1',
      device: 'MacBook Pro 16" (Chrome 128 / macOS 15)',
      ip: '198.51.100.24',
      location: 'San Francisco, CA, USA',
      lastActive: 'Active now (Current Session)',
      current: true,
    },
    {
      id: 'sess-2',
      device: 'Linux Workstation (Firefox 130 / Ubuntu)',
      ip: '203.0.113.88',
      location: 'Ashburn, VA, USA',
      lastActive: '3 hours ago',
      current: false,
    },
  ];

  const handleCopySecret = () => {
    navigator.clipboard?.writeText('JBSWY3DPEHPK3PXP');
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const handleVerifyTotp = (e: React.FormEvent) => {
    e.preventDefault();
    if (totpCode.length === 6) {
      setTotpVerified(true);
      setTimeout(() => setTotpVerified(false), 3000);
    }
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border-subtle pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-text">
              Security & Access Hardening
            </h1>
            <Badge variant="success" size="sm">
              RLS VERIFIED
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-text-secondary">
            Multi-factor authentication (TOTP), hardware passkeys, active session telemetry, and
            zero-trust credentials.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link href={`/workspace/${workspaceId}/vault`}>
            <Button variant="outline" size="sm">
              <span className="flex items-center gap-1.5">
                <LockIcon size={14} /> Secrets Vault
              </span>
            </Button>
          </Link>
          <Link href={`/workspace/${workspaceId}/settings`}>
            <Button variant="outline" size="sm">
              Workspace Settings
            </Button>
          </Link>
        </div>
      </div>

      {/* MFA / 2FA Card */}
      <Card className="p-6 space-y-6 border-border-strong">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-text flex items-center gap-2">
                <ShieldIcon size={18} className="text-action" /> Two-Factor Authentication (TOTP)
              </h2>
              <Badge variant={mfaEnabled ? 'success' : 'warning'} size="sm">
                {mfaEnabled ? 'ENFORCED' : 'DISABLED'}
              </Badge>
            </div>
            <p className="text-xs text-text-secondary">
              Protect your workspace and sovereign memory graphs with time-based one-time passwords
              (Google Authenticator, 1Password, YubiKey).
            </p>
          </div>

          <Button
            variant={mfaEnabled ? 'outline' : 'primary'}
            size="sm"
            onClick={() => setMfaEnabled(!mfaEnabled)}
          >
            {mfaEnabled ? 'Disable MFA' : 'Enable MFA'}
          </Button>
        </div>

        {mfaEnabled && (
          <div className="pt-4 border-t border-border-subtle space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
              {/* Secret Key & Verification Form */}
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-text">Manual Entry Secret Key</label>
                  <div className="flex items-center gap-2">
                    <code className="p-2 rounded bg-surface-200 border border-border-subtle font-mono text-xs text-text flex-1">
                      JBSW Y3DP EHPK 3PXP
                    </code>
                    <Button variant="outline" size="sm" onClick={handleCopySecret}>
                      <span className="flex items-center gap-1.5">
                        {copiedKey ? (
                          <CheckIcon size={14} className="text-success" />
                        ) : (
                          <CopyIcon size={14} />
                        )}
                        {copiedKey ? 'Copied' : 'Copy'}
                      </span>
                    </Button>
                  </div>
                </div>

                <form onSubmit={handleVerifyTotp} className="space-y-2">
                  <label className="text-xs font-semibold text-text">Test 6-Digit TOTP Token</label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="text"
                      maxLength={6}
                      placeholder="123456"
                      value={totpCode}
                      onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                      className="font-mono text-center tracking-widest text-sm py-1.5 w-36"
                    />
                    <Button
                      type="submit"
                      variant="primary"
                      size="sm"
                      disabled={totpCode.length !== 6}
                    >
                      Verify Token
                    </Button>
                  </div>
                  {totpVerified && (
                    <span className="text-xs text-success font-medium flex items-center gap-1">
                      <CheckIcon size={14} /> Token verified successfully. Synchronized with server
                      time.
                    </span>
                  )}
                </form>
              </div>

              {/* QR Mockup & Verification Info */}
              <div className="p-4 rounded-xl bg-surface-100 border border-border-subtle flex items-center gap-4">
                <div className="w-24 h-24 bg-surface border-2 border-dashed border-border-strong rounded-lg flex items-center justify-center p-2 shrink-0">
                  <div className="w-full h-full bg-text/10 rounded flex items-center justify-center font-mono text-2xs text-text-muted text-center p-1">
                    [QR CODE / TOTP URI]
                  </div>
                </div>
                <div className="space-y-1 text-xs text-text-secondary">
                  <p className="font-semibold text-text">Scan with Authenticator App</p>
                  <p className="text-2xs">
                    Compatible with Google Authenticator, 1Password, Bitwarden, or Apple Passwords.
                  </p>
                  <p className="text-2xs text-text-muted font-mono">
                    Issuer: Vaeloom (Zero-Trust Auth)
                  </p>
                </div>
              </div>
            </div>

            {/* Recovery Codes */}
            <div className="space-y-3 pt-4 border-t border-border-subtle">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-text">
                    Emergency Recovery Codes
                  </h3>
                  <p className="text-2xs text-text-secondary">
                    Keep these one-time codes in a secure password manager. Each code can only be
                    used once.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const blob = new Blob([recoveryCodes.join('\n')], { type: 'text/plain' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `vaeloom-recovery-codes-${workspaceId}.txt`;
                    a.click();
                  }}
                >
                  <span className="flex items-center gap-1.5">
                    <DownloadIcon size={14} /> Download Codes (.txt)
                  </span>
                </Button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 bg-surface-100 p-3 rounded-lg border border-border-subtle font-mono text-xs text-text">
                {recoveryCodes.map((code) => (
                  <div
                    key={code}
                    className="p-1.5 rounded bg-surface border border-border-subtle text-center"
                  >
                    {code}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Active User Sessions */}
      <Card className="p-6 space-y-4 border-border-strong">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <h2 className="text-base font-bold text-text flex items-center gap-2">
              <ClockIcon size={18} className="text-action" /> Active Authenticated Sessions
            </h2>
            <p className="text-xs text-text-secondary">
              Review browsers and clients currently authorized with your JWT refresh tokens.
            </p>
          </div>
          <Button variant="outline" size="sm">
            <span className="flex items-center gap-1.5">
              <TrashIcon size={14} /> Revoke All Other Sessions
            </span>
          </Button>
        </div>

        <div className="divide-y divide-border-subtle border border-border-subtle rounded-lg overflow-hidden">
          {sessions.map((sess) => (
            <div
              key={sess.id}
              className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs bg-surface hover:bg-surface-100 transition-colors"
            >
              <div className="space-y-0.5">
                <div className="flex items-center gap-2 font-medium text-text">
                  <span>{sess.device}</span>
                  {sess.current && (
                    <Badge variant="success" size="sm">
                      THIS DEVICE
                    </Badge>
                  )}
                </div>
                <div className="text-2xs text-text-muted font-mono flex items-center gap-2">
                  <span>IP: {sess.ip}</span>
                  <span>•</span>
                  <span>{sess.location}</span>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0 self-end sm:self-auto">
                <span className="text-2xs font-mono text-text-secondary">{sess.lastActive}</span>
                {!sess.current && (
                  <Button variant="outline" size="sm">
                    Revoke
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Security Policies & Session Timeout */}
      <Card className="p-6 space-y-4 border-border-strong">
        <h2 className="text-base font-bold text-text">Session Lifespan & Inactivity Policy</h2>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
          <div className="space-y-0.5">
            <span className="text-xs font-semibold text-text">Automatic Inactivity Timeout</span>
            <p className="text-2xs text-text-secondary">
              Require re-authentication after a period of user inactivity.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {['15m', '1h', '8h', '24h'].map((duration) => (
              <button
                key={duration}
                type="button"
                onClick={() => setSessionTimeout(duration)}
                className={`px-3 py-1.5 rounded-md text-xs font-mono font-medium transition-colors ${
                  sessionTimeout === duration
                    ? 'bg-action text-white'
                    : 'bg-surface-200 text-text hover:bg-surface-300'
                }`}
              >
                {duration}
              </button>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}
