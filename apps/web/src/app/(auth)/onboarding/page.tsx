'use client';

import React from 'react';
import { OnboardingWizard } from '@/components/onboarding/OnboardingWizard';

export default function OnboardingPage() {
  return (
    <div className="min-h-screen flex flex-col justify-center bg-background px-4 py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center mb-8">
        <div className="inline-flex items-center gap-2 mb-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-accent-400 flex items-center justify-center">
            <span className="text-white font-bold text-lg">V</span>
          </div>
          <span className="text-2xl font-bold text-text">Vaeloom</span>
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-text">Set up your workspace</h1>
        <p className="mt-2 text-sm text-text-muted">
          Let's tailor your AI agents and data integrations to your career goals.
        </p>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-2xl">
        <OnboardingWizard />
      </div>
    </div>
  );
}
