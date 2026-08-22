'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getToken } from '../lib/api';

const features = [
  {
    icon: (
      <svg
        className="w-6 h-6"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z"
        />
      </svg>
    ),
    title: 'Memory-First AI',
    description:
      'Your knowledge graph grows smarter with every interaction. AI agents remember context across sessions.',
  },
  {
    icon: (
      <svg
        className="w-6 h-6"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z"
        />
      </svg>
    ),
    title: '8 Smart Agents',
    description:
      'Specialized AI agents handle your resume, job search, scheduling, email, and more—all working together.',
  },
  {
    icon: (
      <svg
        className="w-6 h-6"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
        />
      </svg>
    ),
    title: 'Enterprise Security',
    description:
      'SOC 2 compliant, end-to-end encryption, workspace isolation, and complete audit trails.',
  },
  {
    icon: (
      <svg
        className="w-6 h-6"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244"
        />
      </svg>
    ),
    title: 'Universal Connectors',
    description:
      'Connect Gmail, GitHub, Google Drive, Notion, Slack, and more. Your data, unified.',
  },
];

const steps = [
  {
    step: '01',
    title: 'Connect Your Data',
    description: 'Link your favorite tools and services in seconds.',
  },
  {
    step: '02',
    title: 'AI Organizes Everything',
    description: 'Our agents automatically categorize, tag, and build your knowledge graph.',
  },
  {
    step: '03',
    title: 'Get Intelligent Assist',
    description: 'Ask questions, get summaries, and let AI handle the busywork.',
  },
];

export default function LandingPage() {
  const router = useRouter();
  useEffect(() => {
    const token = getToken();
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        const { api } = await import('../lib/api');
        const me = await api.me();
        const ws = (me as unknown as { workspaces?: Array<{ id: string }> })?.workspaces;
        if (!cancelled && ws && ws.length > 0 && ws[0]?.id) {
          router.replace(`/workspace/${ws[0].id}`);
          return;
        }
        const workspaces = await api.listWorkspaces();
        if (!cancelled && Array.isArray(workspaces) && workspaces.length > 0 && workspaces[0]?.id) {
          router.replace(`/workspace/${workspaces[0].id}`);
        }
      } catch {
        // not authenticated or no workspace yet — stay on landing
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 to-accent-400 flex items-center justify-center">
              <span className="text-white font-bold text-base">V</span>
            </div>
            <span className="text-xl font-bold text-text">Vaeloom</span>
          </div>

          <div className="hidden md:flex items-center gap-8">
            <a
              href="#features"
              className="text-sm text-text-muted hover:text-text transition-colors"
            >
              Features
            </a>
            <a
              href="#how-it-works"
              className="text-sm text-text-muted hover:text-text transition-colors"
            >
              How it Works
            </a>
            <a
              href="#pricing"
              className="text-sm text-text-muted hover:text-text transition-colors"
            >
              Pricing
            </a>
          </div>

          <div className="flex items-center gap-3">
            <Link href="/login" className="btn-ghost text-sm">
              Sign in
            </Link>
            <Link href="/signup" className="btn-primary text-sm py-2.5 px-5">
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6 relative overflow-hidden">
        {/* Background effects */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-primary/5 rounded-full blur-[120px]" />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-accent/5 rounded-full blur-[100px]" />

        <div className="max-w-4xl mx-auto text-center relative z-10">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-surface-100 border border-border mb-8 animate-fade-in">
            <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
            <span className="text-sm text-text-muted">Now in public beta</span>
          </div>

          {/* Headline */}
          <h1 className="text-5xl md:text-7xl font-bold text-text leading-[1.1] mb-6 animate-slide-up">
            Your AI-powered
            <br />
            <span className="bg-gradient-to-r from-primary-400 via-primary-300 to-accent-400 bg-clip-text text-transparent">
              memory platform
            </span>
          </h1>

          {/* Subheadline */}
          <p className="text-xl text-text-muted max-w-2xl mx-auto mb-10 animate-slide-up stagger-1">
            Organize your thoughts, automate workflows, and let AI agents handle the busywork while
            you focus on what matters.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-slide-up stagger-2">
            <Link href="/signup" className="btn-primary text-base py-4 px-8 w-full sm:w-auto">
              Start for free
              <svg
                className="w-5 h-5 ml-2 inline"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 7l5 5m0 0l-5 5m5-5H6"
                />
              </svg>
            </Link>
            <a href="#how-it-works" className="btn-secondary text-base py-4 px-8 w-full sm:w-auto">
              See how it works
            </a>
          </div>

          {/* Value line */}
          <div className="mt-12 animate-slide-up stagger-3">
            <p className="text-sm text-text-muted">Built memory-first, private by default.</p>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 px-6 relative">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-text mb-4">Everything you need</h2>
            <p className="text-lg text-text-muted max-w-2xl mx-auto">
              A complete suite of AI-powered tools to organize, remember, and assist you.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, i) => (
              <div
                key={feature.title}
                className={`card-hover p-6 animate-slide-up stagger-${i + 1}`}
              >
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary mb-4">
                  {feature.icon}
                </div>
                <h3 className="text-lg font-semibold text-text mb-2">{feature.title}</h3>
                <p className="text-sm text-text-muted">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it Works Section */}
      <section id="how-it-works" className="py-24 px-6 bg-surface-50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-text mb-4">How it works</h2>
            <p className="text-lg text-text-muted max-w-2xl mx-auto">
              Three simple steps to transform how you work with information.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {steps.map((step, i) => (
              <div key={step.step} className="relative">
                <div className="text-6xl font-bold text-primary/10 mb-4">{step.step}</div>
                <h3 className="text-xl font-semibold text-text mb-2">{step.title}</h3>
                <p className="text-text-muted">{step.description}</p>
                {i < steps.length - 1 && (
                  <div className="hidden md:block absolute top-8 right-0 w-24 h-[2px] bg-gradient-to-r from-primary/30 to-transparent" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/5 to-transparent" />

        <div className="max-w-3xl mx-auto text-center relative z-10">
          <h2 className="text-3xl md:text-4xl font-bold text-text mb-6">Ready to get started?</h2>
          <p className="text-lg text-text-muted mb-10">
            Set up your workspace in minutes — connect sources and let the agents organize.
          </p>
          <Link href="/signup" className="btn-primary text-base py-4 px-10">
            Create your free account
            <svg
              className="w-5 h-5 ml-2 inline"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 7l5 5m0 0l-5 5m5-5H6"
              />
            </svg>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-border">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-accent-400 flex items-center justify-center">
                <span className="text-white font-bold text-sm">V</span>
              </div>
              <span className="text-lg font-bold text-text">Vaeloom</span>
            </div>

            <div className="flex items-center gap-6">
              <Link
                href="/login"
                className="text-sm text-text-muted hover:text-text transition-colors"
              >
                Login
              </Link>
              <Link
                href="/signup"
                className="text-sm text-text-muted hover:text-text transition-colors"
              >
                Sign up
              </Link>
            </div>
          </div>

          <div className="mt-8 pt-8 border-t border-border text-center">
            <p className="text-sm text-text-dim">
              &copy; {new Date().getFullYear()} Vaeloom. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
