import type { FilterOption } from '@vaeloom/ui-kit';

// Must match the backend `MemoryType` literal (apps/api/src/api/schemas/memory.py).
// This list was wrong twice: first it used a source-format set
// (email/code/conversation/webpage/structured) that the API rejects, and before
// that it used profile/career/skill/project/decision/goal/insight/task/
// relationship, where `task`/`insight`-style values were not all real either.
// Either way every non-matching option filtered all rows out and the UI looked
// empty rather than broken. Lives outside `page.tsx` (Next pages may not export
// arbitrary values) so a test can still assert the invariant.
export const TYPE_FILTERS: FilterOption[] = [
  { id: 'all', label: 'All Types' },
  { id: 'profile', label: 'Profile' },
  { id: 'document', label: 'Documents' },
  { id: 'career', label: 'Career' },
  { id: 'episodic', label: 'Episodic' },
  { id: 'preference', label: 'Preferences' },
  { id: 'working', label: 'Working' },
  { id: 'note', label: 'Notes' },
  { id: 'fact', label: 'Facts' },
  { id: 'project', label: 'Projects' },
  { id: 'skill', label: 'Skills' },
  { id: 'organization', label: 'Organizations' },
  { id: 'relationship', label: 'Relationships' },
  { id: 'event', label: 'Events' },
  { id: 'insight', label: 'Insights' },
  { id: 'goal', label: 'Goals' },
  { id: 'feedback', label: 'Feedback' },
  { id: 'decision', label: 'Decisions' },
  { id: 'knowledge', label: 'Knowledge' },
  { id: 'reference', label: 'References' },
  { id: 'contact', label: 'Contacts' },
  { id: 'financial', label: 'Financial' },
  { id: 'health', label: 'Health' },
  { id: 'learning', label: 'Learning' },
  { id: 'workflow', label: 'Workflows' },
];
