import { TYPE_FILTERS } from '@/app/workspace/[workspaceId]/memory/page';
import { MemoryCard } from '@vaeloom/ui-kit';
import { render, screen } from '@testing-library/react';
import React from 'react';

/**
 * Invariant tests for the memory UI's fabricated-data defects.
 *
 * These assert the rules directly instead of driving the 857-line page through
 * a full render, so they stay meaningful when the page's layout changes.
 */

// The authoritative taxonomy: `MemoryType` in `apps/api/src/api/schemas/memory.py`,
// mirrored in `@vaeloom/shared-types`. 6 canonical + 16 enterprise additive +
// the `note`/`fact` legacy aliases.
//
// This list was wrong twice. First it mirrored a *source format* set
// (document/email/code/note/conversation/webpage/structured) that the API never
// accepted as memory types — only `document` and `note` overlapped, so five of
// the seven filter options matched nothing. Before that it used
// profile/career/skill/project/decision/goal/insight/task/relationship, which
// included `task` — also not a real type. Either way the filter silently emptied
// the list rather than looking broken.
const MEMORY_TYPES = [
  'profile',
  'document',
  'career',
  'episodic',
  'preference',
  'working',
  'note',
  'fact',
  'project',
  'skill',
  'organization',
  'relationship',
  'event',
  'insight',
  'goal',
  'feedback',
  'decision',
  'knowledge',
  'reference',
  'contact',
  'financial',
  'health',
  'learning',
  'workflow',
] as const;

describe('memory type filters', () => {
  it('every filter id except "all" is a real MemoryType', () => {
    const bogus = TYPE_FILTERS.map((f) => f.id).filter(
      (id) => id !== 'all' && !(MEMORY_TYPES as readonly string[]).includes(id),
    );
    expect(bogus).toEqual([]);
  });

  it('offers every real MemoryType', () => {
    const ids = TYPE_FILTERS.map((f) => f.id);
    for (const t of MEMORY_TYPES) {
      expect(ids).toContain(t);
    }
  });

  it('offers no source-format values the API rejects', () => {
    const ids = TYPE_FILTERS.map((f) => f.id);
    for (const bogus of ['email', 'code', 'conversation', 'webpage', 'structured', 'task']) {
      expect(ids).not.toContain(bogus);
    }
  });

  it('has a non-empty label for every option', () => {
    for (const f of TYPE_FILTERS) {
      expect(f.label.length).toBeGreaterThan(0);
    }
  });

  it('has no duplicate ids', () => {
    const ids = TYPE_FILTERS.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('MemoryCard confidence', () => {
  it('omits the indicator entirely when no score was stored', () => {
    // `confidence` was a required prop, which pushed callers to invent a
    // placeholder (the memory page used `?? 0.85`) and render it as if measured.
    render(<MemoryCard id="m-1" content="body" source="file" timestamp="now" />);
    expect(screen.queryByText(/85%/)).toBeNull();
    expect(screen.getByText('body')).toBeTruthy();
  });

  it('renders the real score when one exists', () => {
    render(<MemoryCard id="m-1" content="body" source="file" timestamp="now" confidence={0.42} />);
    expect(screen.getByText(/42%/)).toBeTruthy();
  });
});
