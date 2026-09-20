'use client';

import React, { useState } from 'react';
import { ScreeningQuestionItem, ProfileData, profileApi } from '@/lib/api-client';
import { Panel } from '@/components/shared/Panel';

interface ScreeningQuestionsCardProps {
  questions: ScreeningQuestionItem[];
  workspaceId?: string;
  onUpdate?: (updated: ProfileData) => void;
}

const DEFAULT_QUESTIONS = [
  {
    id: 'sq-1',
    question: 'What is your notice period / earliest available start date?',
    answer: '2 weeks from offer acceptance and signed agreement.',
    category: 'availability',
  },
  {
    id: 'sq-2',
    question: 'Have you ever been employed by this company or an affiliated entity?',
    answer: 'No, this would be my first time working with this organization.',
    category: 'history',
  },
  {
    id: 'sq-3',
    question: 'Are you currently bound by any active non-compete or non-solicitation covenants?',
    answer: 'No, I have no restrictive covenants or non-compete obligations.',
    category: 'legal',
  },
  {
    id: 'sq-4',
    question: 'What is your preferred work arrangement (Remote / Hybrid / In-Office)?',
    answer:
      'Primarily remote, with full willingness to travel for quarterly team offsites and critical on-sites.',
    category: 'preferences',
  },
  {
    id: 'sq-5',
    question: 'Why are you interested in this role and company?',
    answer:
      'I specialize in high-scale distributed systems and autonomous agent workflows. I am excited by the company mission, technical culture, and the opportunity to make an immediate measurable impact on high-growth problems.',
    category: 'motivation',
  },
];

export default function ScreeningQuestionsCard({
  questions = [],
  workspaceId,
  onUpdate,
}: ScreeningQuestionsCardProps) {
  const currentQuestions = questions.length > 0 ? questions : DEFAULT_QUESTIONS;
  const [items, setItems] = useState<ScreeningQuestionItem[]>(currentQuestions);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [newQuestion, setNewQuestion] = useState('');
  const [newAnswer, setNewAnswer] = useState('');
  const [newCategory, setNewCategory] = useState('general');
  const [isAdding, setIsAdding] = useState(false);

  const handleAnswerChange = (id: string, newAns: string) => {
    setItems((prev) => prev.map((q) => (q.id === id ? { ...q, answer: newAns } : q)));
  };

  const handleDelete = (id: string) => {
    setItems((prev) => prev.filter((q) => q.id !== id));
  };

  const handleAddNew = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQuestion.trim() || !newAnswer.trim()) return;

    const newItem: ScreeningQuestionItem = {
      id: `sq-${Date.now()}`,
      question: newQuestion.trim(),
      answer: newAnswer.trim(),
      category: newCategory,
    };
    setItems((prev) => [...prev, newItem]);
    setNewQuestion('');
    setNewAnswer('');
    setIsAdding(false);
  };

  const handleSaveAll = async () => {
    if (!workspaceId) return;

    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const updated = await profileApi.updateScreeningQuestions(items, workspaceId);
      onUpdate?.(updated);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save screening questions');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Panel className="mb-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold text-text flex items-center gap-2">
            <span>Screening Question Auto-Answer Bank</span>
            <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-surface-200 text-text-muted border border-border">
              {items.length} Standard Q&As
            </span>
          </h2>
          <p className="text-xs text-text-dim mt-0.5">
            Pre-approved answers used by Application Agents to answer common recruiter screening
            prompts without pausing
          </p>
        </div>
        {workspaceId && !isAdding && (
          <button
            onClick={() => setIsAdding(true)}
            className="text-xs font-medium px-2.5 py-1 rounded-md bg-surface-200 hover:bg-surface-hover text-text border border-border transition-colors flex items-center gap-1.5"
          >
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Add Question
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-500">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400">
          ✓ Screening question answers saved successfully!
        </div>
      )}

      {isAdding && (
        <form
          onSubmit={handleAddNew}
          className="mb-6 p-4 rounded-xl border border-border bg-surface-200 space-y-4"
        >
          <div className="flex items-center justify-between border-b border-border pb-2">
            <h3 className="text-sm font-semibold text-text">Add Custom Screening Prompt</h3>
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="text-text-muted hover:text-text text-xs"
            >
              Cancel
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-text-muted mb-1">
                Recruiter Question *
              </label>
              <input
                type="text"
                required
                value={newQuestion}
                onChange={(e) => setNewQuestion(e.target.value)}
                placeholder="e.g. Do you have experience managing distributed engineering teams?"
                className="w-full px-3 py-1.5 text-sm bg-surface border border-border rounded-lg text-text focus:outline-none focus:border-primary/50"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">Category</label>
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                className="w-full px-3 py-1.5 text-sm bg-surface border border-border rounded-lg text-text focus:outline-none focus:border-primary/50"
              >
                <option value="general">General</option>
                <option value="experience">Experience & Skills</option>
                <option value="availability">Availability & Notice</option>
                <option value="motivation">Motivation & Culture</option>
                <option value="legal">Legal & Compliance</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">
              Pre-Approved Answer *
            </label>
            <textarea
              required
              rows={2}
              value={newAnswer}
              onChange={(e) => setNewAnswer(e.target.value)}
              placeholder="Your pre-approved answer for agents to auto-fill..."
              className="w-full px-3 py-1.5 text-sm bg-surface border border-border rounded-lg text-text focus:outline-none focus:border-primary/50 resize-y"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-surface hover:bg-surface-hover text-text border border-border transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 text-xs font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary-hover transition-colors"
            >
              Add to Bank
            </button>
          </div>
        </form>
      )}

      <div className="space-y-4">
        {items.map((q) => (
          <div
            key={q.id}
            className="p-4 rounded-xl bg-surface-200 border border-border space-y-2 group"
          >
            <div className="flex items-start justify-between gap-4">
              <span className="text-xs font-semibold text-text leading-snug flex items-center gap-2">
                <span className="text-primary">Q:</span>
                <span>{q.question}</span>
              </span>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-surface border border-border text-text-dim">
                  {q.category}
                </span>
                {workspaceId && (
                  <button
                    type="button"
                    onClick={() => handleDelete(q.id)}
                    className="opacity-40 group-hover:opacity-100 hover:text-red-500 p-0.5 transition-opacity"
                    title="Remove question"
                  >
                    <svg
                      className="w-3.5 h-3.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={2}
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            </div>

            <div>
              <textarea
                rows={2}
                value={q.answer}
                onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                className="w-full px-3 py-1.5 text-xs bg-surface border border-border rounded-lg text-text focus:outline-none focus:border-primary/50 resize-y"
              />
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-end gap-3 pt-4 border-t border-border mt-4">
        <button
          onClick={handleSaveAll}
          disabled={saving}
          className="px-5 py-2 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary-hover disabled:opacity-50 transition-colors shadow-sm"
        >
          {saving ? 'Saving Answers...' : 'Save Question Bank'}
        </button>
      </div>
    </Panel>
  );
}
