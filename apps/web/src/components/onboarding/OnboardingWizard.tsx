'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useToast } from '@/components/shared/Toast';

interface OnboardingState {
  id: string;
  userId: string;
  workspaceId?: string;
  currentStep: string;
  completedSteps: string[];
  isCompleted: boolean;
  stepData: Record<string, any>;
}

const STEPS = [
  { id: 'PROFILE', title: 'Profile', description: 'Tell us a bit about yourself' },
  { id: 'WORKSPACE', title: 'Workspace', description: 'Configure your primary workspace' },
  { id: 'RESUME', title: 'Resume & Skills', description: 'Add your professional background' },
  { id: 'CONNECTORS', title: 'Integrations', description: 'Connect external services' },
] as const;

export function OnboardingWizard() {
  const router = useRouter();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [, setState] = useState<OnboardingState | null>(null);

  // Form states
  const [displayName, setDisplayName] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [workspaceName, setWorkspaceName] = useState('');
  const [skills, setSkills] = useState('');
  const [connectedTools, setConnectedTools] = useState<string[]>([]);

  useEffect(() => {
    async function loadState() {
      try {
        const data = await api.request<OnboardingState>('/onboarding');
        setState(data);
        if (data.isCompleted) {
          router.push('/dashboard');
          return;
        }

        const stepIdx = STEPS.findIndex((s) => s.id === data.currentStep);
        if (stepIdx >= 0) {
          setCurrentStepIndex(stepIdx);
        }

        const sData = data.stepData || {};
        if (typeof sData['displayName'] === 'string') setDisplayName(sData['displayName']);
        if (typeof sData['jobTitle'] === 'string') setJobTitle(sData['jobTitle']);
        if (typeof sData['workspaceName'] === 'string') setWorkspaceName(sData['workspaceName']);
        if (typeof sData['skills'] === 'string') setSkills(sData['skills']);
        if (Array.isArray(sData['connectedTools'])) setConnectedTools(sData['connectedTools']);
      } catch (err: any) {
        toast({
          tone: 'error',
          title: 'Failed to load onboarding',
          detail: err?.message || 'Using local defaults',
        });
      } finally {
        setLoading(false);
      }
    }
    loadState();
  }, [router, toast]);

  const activeStep = STEPS[currentStepIndex] ?? STEPS[0];

  const handleNext = async () => {
    setSubmitting(true);

    let stepPayload: Record<string, any> = {};
    if (activeStep.id === 'PROFILE') {
      stepPayload = { displayName, jobTitle };
    } else if (activeStep.id === 'WORKSPACE') {
      stepPayload = { workspaceName };
    } else if (activeStep.id === 'RESUME') {
      stepPayload = { skills };
    } else if (activeStep.id === 'CONNECTORS') {
      stepPayload = { connectedTools };
    }

    try {
      if (currentStepIndex < STEPS.length - 1) {
        const nextStep = STEPS[currentStepIndex + 1]?.id ?? 'COMPLETED';
        const res = await api.request<OnboardingState>('/onboarding/step', {
          method: 'POST',
          body: JSON.stringify({ step: nextStep, step_data: stepPayload }),
        });
        setState(res);
        setCurrentStepIndex(currentStepIndex + 1);
      } else {
        // Final completion
        await api.request<OnboardingState>('/onboarding/complete', {
          method: 'POST',
          body: JSON.stringify({ final_data: stepPayload }),
        });
        toast({
          tone: 'success',
          title: 'Welcome to Vaeloom!',
          detail: 'Your workspace is ready.',
        });
        router.push('/dashboard');
      }
    } catch (err: any) {
      toast({
        tone: 'error',
        title: 'Step progression failed',
        detail: err?.message || 'Please try again',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSkip = async () => {
    if (currentStepIndex < STEPS.length - 1) {
      const nextStep = STEPS[currentStepIndex + 1]?.id ?? 'COMPLETED';
      try {
        const res = await api.request<OnboardingState>('/onboarding/step', {
          method: 'POST',
          body: JSON.stringify({ step: nextStep, step_data: {} }),
        });
        setState(res);
        setCurrentStepIndex(currentStepIndex + 1);
      } catch {
        setCurrentStepIndex(currentStepIndex + 1);
      }
    } else {
      router.push('/dashboard');
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary/30 border-t-primary" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl rounded-2xl border border-border bg-surface p-8 shadow-sm">
      {/* Stepper Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {STEPS.map((step, idx) => (
            <React.Fragment key={step.id}>
              <div className="flex flex-col items-center">
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold transition-colors ${
                    idx === currentStepIndex
                      ? 'bg-action text-action-fg'
                      : idx < currentStepIndex
                        ? 'bg-success text-white'
                        : 'border border-border bg-surface text-text-muted'
                  }`}
                >
                  {idx < currentStepIndex ? '✓' : idx + 1}
                </div>
                <span className="mt-2 text-xs font-medium text-text-muted">{step.title}</span>
              </div>
              {idx < STEPS.length - 1 && (
                <div
                  className={`h-0.5 flex-1 mx-3 ${
                    idx < currentStepIndex ? 'bg-success' : 'bg-border'
                  }`}
                />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Step Content */}
      <div className="mb-8">
        <h2 className="text-xl font-bold text-text">{activeStep.title}</h2>
        <p className="mt-1 text-sm text-text-muted">{activeStep.description}</p>

        <div className="mt-6 space-y-4">
          {activeStep.id === 'PROFILE' && (
            <>
              <div>
                <label className="block text-sm font-medium text-text">Display Name</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="e.g. Alex Doe"
                  className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text focus:border-action focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text">
                  Target Role / Job Title
                </label>
                <input
                  type="text"
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  placeholder="e.g. Staff Software Engineer"
                  className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text focus:border-action focus:outline-none"
                />
              </div>
            </>
          )}

          {activeStep.id === 'WORKSPACE' && (
            <div>
              <label className="block text-sm font-medium text-text">Workspace Name</label>
              <input
                type="text"
                value={workspaceName}
                onChange={(e) => setWorkspaceName(e.target.value)}
                placeholder="e.g. Engineering & Career"
                className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text focus:border-action focus:outline-none"
              />
            </div>
          )}

          {activeStep.id === 'RESUME' && (
            <div>
              <label className="block text-sm font-medium text-text">
                Key Skills (comma separated)
              </label>
              <textarea
                value={skills}
                onChange={(e) => setSkills(e.target.value)}
                rows={4}
                placeholder="Python, Next.js, Distributed Systems, Machine Learning..."
                className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text focus:border-action focus:outline-none"
              />
            </div>
          )}

          {activeStep.id === 'CONNECTORS' && (
            <div className="space-y-3">
              <p className="text-xs text-text-muted">
                Select connectors you plan to link to empower your autonomous agents:
              </p>
              {['Google Drive / Docs', 'Gmail', 'GitHub', 'LinkedIn / Resume Import'].map(
                (tool) => (
                  <label
                    key={tool}
                    className="flex items-center gap-3 rounded-lg border border-border p-3 hover:bg-surface-hover cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={connectedTools.includes(tool)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setConnectedTools([...connectedTools, tool]);
                        } else {
                          setConnectedTools(connectedTools.filter((t) => t !== tool));
                        }
                      }}
                      className="h-4 w-4 rounded border-border text-action focus:ring-action"
                    />
                    <span className="text-sm font-medium text-text">{tool}</span>
                  </label>
                ),
              )}
            </div>
          )}
        </div>
      </div>

      {/* Navigation Controls */}
      <div className="flex items-center justify-between border-t border-border pt-6">
        <button
          type="button"
          onClick={handleSkip}
          className="text-sm font-medium text-text-muted hover:text-text"
        >
          Skip for now
        </button>
        <button
          type="button"
          onClick={handleNext}
          disabled={submitting}
          className="rounded-lg bg-action px-5 py-2 text-sm font-semibold text-action-fg hover:bg-action-hover disabled:opacity-50"
        >
          {submitting
            ? 'Saving...'
            : currentStepIndex === STEPS.length - 1
              ? 'Complete & Launch'
              : 'Continue'}
        </button>
      </div>
    </div>
  );
}
