'use client';

import React, { useState } from 'react';
import QRCode from 'qrcode';
import { api } from '@/lib/api';
import { useToast } from '@/components/shared/Toast';

interface TwoFactorAuthCardProps {
  initialEnabled?: boolean;
  onStatusChange?: (enabled: boolean) => void;
}

export function TwoFactorAuthCard({
  initialEnabled = false,
  onStatusChange,
}: TwoFactorAuthCardProps) {
  const { toast } = useToast();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [modalOpen, setModalOpen] = useState(false);
  const [step, setStep] = useState<'setup' | 'verify' | 'recovery'>('setup');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Setup data
  const [secret, setSecret] = useState('');
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [savedCodesConfirmed, setSavedCodesConfirmed] = useState(false);

  const startSetup = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.mfa.setup();
      setSecret(data.secret);
      if (data.recoveryCodes) {
        setRecoveryCodes(data.recoveryCodes);
      }
      const url = await QRCode.toDataURL(data.otpauthUrl, {
        width: 200,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#ffffff',
        },
      });
      setQrCodeDataUrl(url);
      setStep('setup');
      setModalOpen(true);
    } catch (err: any) {
      toast({
        tone: 'error',
        title: 'MFA setup failed',
        detail: err?.message || 'Could not initiate 2FA setup.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifyCode || verifyCode.length < 6) {
      setError('Please enter a valid 6-digit code');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await api.mfa.enable(verifyCode);
      if (res.recoveryCodes && res.recoveryCodes.length > 0) {
        setRecoveryCodes(res.recoveryCodes);
      }
      setEnabled(true);
      onStatusChange?.(true);
      setStep('recovery');
      toast({
        tone: 'success',
        title: 'Two-Factor Authentication Enabled',
        detail: 'Please save your emergency recovery codes.',
      });
    } catch (err: any) {
      setError(err?.message || 'Invalid verification code. Please check your authenticator app.');
    } finally {
      setLoading(false);
    }
  };

  const copySecret = () => {
    navigator.clipboard.writeText(secret);
    toast({
      tone: 'info',
      title: 'Secret copied',
      detail: 'Manual entry secret copied to clipboard.',
    });
  };

  const copyAllRecoveryCodes = () => {
    navigator.clipboard.writeText(recoveryCodes.join('\n'));
    toast({
      tone: 'info',
      title: 'Recovery codes copied',
      detail: 'Codes copied to clipboard.',
    });
  };

  const downloadRecoveryCodes = () => {
    const text =
      `VAELOOM EMERGENCY RECOVERY CODES\nGenerated: ${new Date().toISOString()}\n\nEach code can only be used once:\n\n` +
      recoveryCodes.map((c, i) => `${i + 1}. ${c}`).join('\n') +
      `\n\nKeep these codes in a safe, secure place.`;
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vaeloom-recovery-codes-${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const closeModal = () => {
    setModalOpen(false);
    setVerifyCode('');
    setError(null);
  };

  return (
    <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border ${
              enabled
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-surface-hover border-border text-text-muted'
            }`}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-text">Two-Factor Authentication (2FA)</h2>
              <span
                className={`inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded-full border ${
                  enabled
                    ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                    : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                }`}
              >
                {enabled ? 'Active' : 'Disabled'}
              </span>
            </div>
            <p className="text-sm text-text-muted mt-0.5 max-w-xl">
              {enabled
                ? 'Your account is secured with standard RFC 6238 TOTP two-factor authentication.'
                : 'Protect your account by requiring an authentication code in addition to your password.'}
            </p>
          </div>
        </div>

        <div>
          {!enabled ? (
            <button
              type="button"
              onClick={startSetup}
              disabled={loading}
              className="inline-flex items-center justify-center px-4 py-2 text-sm font-semibold rounded-lg bg-action text-action-fg hover:bg-action-hover transition-colors disabled:opacity-50"
            >
              {loading ? 'Preparing...' : 'Set Up Two-Factor'}
            </button>
          ) : (
            <div className="flex items-center gap-2 text-xs font-mono text-emerald-400">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
              Protected
            </div>
          )}
        </div>
      </div>

      {/* Setup Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
              <h3 className="text-lg font-bold text-text">
                {step === 'setup' && '1. Scan QR Code'}
                {step === 'verify' && '2. Verify Authenticator Code'}
                {step === 'recovery' && '3. Save Emergency Recovery Codes'}
              </h3>
              {step !== 'recovery' && (
                <button
                  type="button"
                  onClick={closeModal}
                  className="text-text-muted hover:text-text text-sm"
                >
                  ✕
                </button>
              )}
            </div>

            {step === 'setup' && (
              <div className="space-y-4 text-center">
                <p className="text-xs text-text-muted text-left">
                  Scan this QR code with your authenticator app (e.g. Google Authenticator, Authy,
                  1Password):
                </p>

                {qrCodeDataUrl && (
                  <div className="flex justify-center my-2 p-3 bg-white rounded-xl mx-auto w-fit">
                    <img src={qrCodeDataUrl} alt="2FA QR Code" className="w-44 h-44" />
                  </div>
                )}

                <div className="rounded-lg bg-background p-3 border border-border text-left">
                  <span className="block text-xs font-medium text-text-muted mb-1">
                    Can&apos;t scan? Enter key manually:
                  </span>
                  <div className="flex items-center justify-between gap-2">
                    <code className="text-xs font-mono text-primary-400 break-all select-all">
                      {secret}
                    </code>
                    <button
                      type="button"
                      onClick={copySecret}
                      className="text-xs font-medium text-text-muted hover:text-text shrink-0 px-2 py-1 rounded border border-border"
                    >
                      Copy
                    </button>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-border">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="px-4 py-2 text-xs font-medium text-text-muted hover:text-text rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep('verify')}
                    className="px-4 py-2 text-xs font-semibold rounded-lg bg-action text-action-fg hover:bg-action-hover"
                  >
                    Next: Enter Code →
                  </button>
                </div>
              </div>
            )}

            {step === 'verify' && (
              <form onSubmit={handleVerify} className="space-y-4">
                <p className="text-xs text-text-muted">
                  Enter the 6-digit code currently displayed in your authenticator app:
                </p>

                <div>
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    autoFocus
                    value={verifyCode}
                    onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="000000"
                    className="w-full text-center text-2xl tracking-[0.4em] font-mono py-3 rounded-lg border border-border bg-background text-text focus:border-action focus:outline-none"
                  />
                  {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
                </div>

                <div className="flex justify-between items-center pt-3 border-t border-border">
                  <button
                    type="button"
                    onClick={() => setStep('setup')}
                    className="text-xs font-medium text-text-muted hover:text-text"
                  >
                    ← Back to QR
                  </button>
                  <button
                    type="submit"
                    disabled={loading || verifyCode.length < 6}
                    className="px-4 py-2 text-xs font-semibold rounded-lg bg-action text-action-fg hover:bg-action-hover disabled:opacity-50"
                  >
                    {loading ? 'Verifying...' : 'Verify & Activate'}
                  </button>
                </div>
              </form>
            )}

            {step === 'recovery' && (
              <div className="space-y-4">
                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300">
                  ⚠️ Save these single-use recovery codes. If you lose access to your device, they
                  are the ONLY way to access your account.
                </div>

                <div className="grid grid-cols-2 gap-2 p-3 bg-background rounded-lg border border-border font-mono text-xs text-text">
                  {recoveryCodes.map((code, idx) => (
                    <div
                      key={idx}
                      className="p-1.5 bg-surface rounded text-center border border-border/50"
                    >
                      {code}
                    </div>
                  ))}
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={copyAllRecoveryCodes}
                    className="flex-1 py-2 text-xs font-medium rounded-lg border border-border hover:bg-surface-hover text-text"
                  >
                    Copy all
                  </button>
                  <button
                    type="button"
                    onClick={downloadRecoveryCodes}
                    className="flex-1 py-2 text-xs font-medium rounded-lg border border-border hover:bg-surface-hover text-text"
                  >
                    Download .txt
                  </button>
                </div>

                <label className="flex items-start gap-2.5 cursor-pointer pt-2">
                  <input
                    type="checkbox"
                    checked={savedCodesConfirmed}
                    onChange={(e) => setSavedCodesConfirmed(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-border text-action focus:ring-action"
                  />
                  <span className="text-xs text-text-muted select-none">
                    I have safely stored these recovery codes.
                  </span>
                </label>

                <div className="pt-2 border-t border-border flex justify-end">
                  <button
                    type="button"
                    onClick={closeModal}
                    disabled={!savedCodesConfirmed}
                    className="w-full py-2.5 text-xs font-semibold rounded-lg bg-action text-action-fg hover:bg-action-hover disabled:opacity-50"
                  >
                    Done & Return to Profile
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
