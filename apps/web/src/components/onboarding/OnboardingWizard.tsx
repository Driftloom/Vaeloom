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
  {
    id: 'CONNECTORS',
    title: 'Integrations',
    description: 'Connect external services for autonomous agents',
  },
] as const;

const CONNECTOR_OPTIONS = [
  {
    id: 'Google Drive / Docs',
    title: 'Google Drive & Docs',
    description: 'Import existing resumes, cover letters, and portfolio documents directly.',
    badge: 'Docs',
    badgeColor: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
    icon: (
      <svg className="w-5 h-5 text-amber-500 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
        <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM19 18H6c-2.21 0-4-1.79-4-4 0-2.05 1.53-3.76 3.56-3.97l1.07-.11.5-.95C8.08 7.14 9.94 6 12 6c2.62 0 4.88 1.86 5.39 4.43l.3 1.5 1.53.11c1.56.1 2.78 1.41 2.78 2.96 0 1.65-1.35 3-3 3z" />
      </svg>
    ),
  },
  {
    id: 'Gmail',
    title: 'Gmail & Calendar',
    description:
      'Autonomous recruiter communication tracking, interview scheduling, and smart drafts.',
    badge: 'Email',
    badgeColor: 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300',
    icon: (
      <svg className="w-5 h-5 text-rose-500 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
        <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" />
      </svg>
    ),
  },
  {
    id: 'GitHub',
    title: 'GitHub Repositories',
    description:
      'Sync public repositories, code contributions, and technical skill proofs for AI matching.',
    badge: 'Code',
    badgeColor: 'bg-surface-200 text-text border border-border',
    icon: (
      <svg className="w-5 h-5 text-text flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
        />
      </svg>
    ),
  },
  {
    id: 'LinkedIn / Resume Import',
    title: 'LinkedIn & Network Sync',
    description:
      'Import full employment timeline, certifications, endorsements, and professional contacts.',
    badge: 'Network',
    badgeColor: 'bg-info/15 text-info border border-info/30',
    icon: (
      <svg className="w-5 h-5 text-info flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
        <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 8.76a1.45 1.45 0 1 0 0-2.9 1.45 1.45 0 0 0 0 2.9M5.08 18.5h2.77v-8.37H5.08v8.37z" />
      </svg>
    ),
  },
];

export function OnboardingWizard() {
  const router = useRouter();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [state, setState] = useState<OnboardingState | null>(null);

  // Form states
  const [displayName, setDisplayName] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [workspaceName, setWorkspaceName] = useState('');
  const [skills, setSkills] = useState('');
  const [connectedTools, setConnectedTools] = useState<string[]>([]);
  const [uploadingResume, setUploadingResume] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);

  const navigateToWorkspace = (workspaceId?: string) => {
    if (workspaceId) {
      router.push(`/workspace/${workspaceId}`);
    } else {
      router.push('/workspace');
    }
  };

  const handleResumeFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingResume(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await api.request<{
        filename: string;
        extractedSkills: string[];
        skillsCount: number;
        state: OnboardingState;
      }>('/onboarding/resume', {
        method: 'POST',
        body: formData,
      });

      setUploadedFileName(res.filename);
      if (res.extractedSkills && res.extractedSkills.length > 0) {
        setSkills((prev) => {
          const current = prev
            ? prev
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean)
            : [];
          const combined = Array.from(new Set([...current, ...res.extractedSkills]));
          return combined.join(', ');
        });
      }
      toast({
        tone: 'success',
        title: 'Resume uploaded & analyzed',
        detail: `Extracted ${res.skillsCount} key skills from ${res.filename}`,
      });
    } catch (err: any) {
      toast({
        tone: 'error',
        title: 'Upload failed',
        detail: err?.message || 'Could not parse resume file',
      });
    } finally {
      setUploadingResume(false);
    }
  };

  useEffect(() => {
    async function loadState() {
      try {
        const data = await api.request<OnboardingState>('/onboarding');
        setState(data);
        if (data.isCompleted) {
          navigateToWorkspace(data.workspaceId);
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
        const res = await api.request<OnboardingState>('/onboarding/complete', {
          method: 'POST',
          body: JSON.stringify({ final_data: stepPayload }),
        });
        toast({
          tone: 'success',
          title: 'Welcome to Vaeloom!',
          detail: 'Your workspace is ready.',
        });
        navigateToWorkspace(res?.workspaceId || state?.workspaceId);
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
      navigateToWorkspace(state?.workspaceId);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary/30 border-t-primary" />
      </div>
    );
  }

  const skillList = skills
    ? skills
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

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
                      ? 'bg-action text-action-fg shadow-sm'
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
                  className={`h-0.5 flex-1 mx-3 transition-colors ${
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
              <p className="mt-2 text-xs text-text-muted">
                Your workspace isolates your documents, agent workflows, and integration secrets.
              </p>
            </div>
          )}

          {activeStep.id === 'RESUME' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text mb-1">
                  Upload Resume (Optional)
                </label>
                <div className="relative border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-action transition-colors bg-surface">
                  <input
                    type="file"
                    accept=".pdf,.docx,.txt,.md"
                    onChange={handleResumeFileUpload}
                    disabled={uploadingResume}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                  />
                  <div className="flex flex-col items-center justify-center space-y-2">
                    <svg
                      className="w-8 h-8 text-text-muted"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                      />
                    </svg>
                    {uploadingResume ? (
                      <p className="text-sm font-medium text-action animate-pulse">
                        Analyzing resume & extracting skills...
                      </p>
                    ) : uploadedFileName ? (
                      <div>
                        <p className="text-sm font-medium text-success">
                          ✓ Uploaded: {uploadedFileName}
                        </p>
                        <p className="text-xs text-text-muted mt-1">
                          Click or drag another file to replace
                        </p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-sm font-medium text-text">
                          Click to upload or drag & drop
                        </p>
                        <p className="text-xs text-text-muted mt-1">
                          PDF, DOCX, TXT, or MD (max 10MB) — AI extracts skills automatically
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-text">
                  Key Skills (comma separated)
                </label>
                <textarea
                  value={skills}
                  onChange={(e) => setSkills(e.target.value)}
                  rows={3}
                  placeholder="Python, Next.js, Distributed Systems, Machine Learning..."
                  className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text focus:border-action focus:outline-none"
                />
                {skillList.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {skillList.map((s) => (
                      <span
                        key={s}
                        className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-action/10 text-action"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeStep.id === 'CONNECTORS' && (
            <div className="space-y-4">
              <p className="text-xs text-text-muted">
                Select connectors you plan to link to empower your autonomous agents with real data:
              </p>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {CONNECTOR_OPTIONS.map((item) => {
                  const isChecked = connectedTools.includes(item.id);
                  return (
                    <div
                      key={item.id}
                      onClick={() => {
                        if (isChecked) {
                          setConnectedTools(connectedTools.filter((t) => t !== item.id));
                        } else {
                          setConnectedTools([...connectedTools, item.id]);
                        }
                      }}
                      className={`relative flex flex-col justify-between p-4 rounded-xl border cursor-pointer transition-all duration-150 select-none ${
                        isChecked
                          ? 'border-action bg-action/5 shadow-xs'
                          : 'border-border bg-surface hover:border-text-muted/40 hover:bg-surface-hover'
                      }`}
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2.5">
                            {item.icon}
                            <span className="text-sm font-semibold text-text">{item.title}</span>
                          </div>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {}} // Handled by container click
                            className="h-4 w-4 rounded border-border text-action focus:ring-action pointer-events-none mt-0.5"
                          />
                        </div>
                        <p className="mt-2 text-xs text-text-muted line-clamp-2">
                          {item.description}
                        </p>
                      </div>
                      <div className="mt-3 flex items-center gap-1.5">
                        <span
                          className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${item.badgeColor}`}
                        >
                          {item.badge}
                        </span>
                        <span className="text-[10px] text-text-muted">
                          {isChecked ? 'Ready to sync' : 'Available'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Ready to Launch Summary Card */}
              <div className="mt-6 rounded-xl border border-border/80 bg-surface-hover/50 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-text uppercase tracking-wider">
                    Workspace Launch Preview
                  </span>
                  <span className="text-xs text-text-muted">
                    {connectedTools.length}{' '}
                    {connectedTools.length === 1 ? 'connector' : 'connectors'} selected
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-text-muted">Member: </span>
                    <span className="font-medium text-text">
                      {displayName || 'Anonymous Member'}
                    </span>
                  </div>
                  <div>
                    <span className="text-text-muted">Target: </span>
                    <span className="font-medium text-text">{jobTitle || 'General Career'}</span>
                  </div>
                  <div>
                    <span className="text-text-muted">Workspace: </span>
                    <span className="font-medium text-text">
                      {workspaceName || 'Default Workspace'}
                    </span>
                  </div>
                  <div>
                    <span className="text-text-muted">Skills: </span>
                    <span className="font-medium text-text">{skillList.length} indexed</span>
                  </div>
                </div>
              </div>
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
          className="rounded-lg bg-action px-6 py-2 text-sm font-semibold text-action-fg hover:bg-action-hover disabled:opacity-50 shadow-sm transition-all"
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
