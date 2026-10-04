import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { DocumentFolderTree } from '../DocumentFolderTree';
import type { FolderResponse, FolderTreeItem } from '@/lib/api-client';
import { documentApi } from '@/lib/api-client';

jest.mock('@/lib/api-client', () => ({
  documentApi: {
    listFolders: jest.fn().mockResolvedValue([]),
    getFolderTree: jest.fn().mockResolvedValue([]),
    createFolder: jest.fn(),
    deleteFolder: jest.fn(),
  },
}));

const WS = 'ws-test-1';

const folders: FolderResponse[] = [
  {
    id: 'f-legal',
    workspaceId: WS,
    parentId: null,
    name: 'Legal Contracts',
    createdAt: '2026-09-30T10:00:00Z',
    updatedAt: '2026-09-30T10:00:00Z',
  },
  {
    id: 'f-resumes',
    workspaceId: WS,
    parentId: null,
    name: 'Resumes',
    createdAt: '2026-09-30T10:00:00Z',
    updatedAt: '2026-09-30T10:00:00Z',
  },
];

const folderTree: FolderTreeItem[] = [
  {
    id: 'f-legal',
    workspaceId: WS,
    parentId: null,
    name: 'Legal Contracts',
    children: [
      {
        id: 'f-nda',
        workspaceId: WS,
        parentId: 'f-legal',
        name: 'NDAs',
        children: [],
      },
    ],
  },
  {
    id: 'f-resumes',
    workspaceId: WS,
    parentId: null,
    name: 'Resumes',
    children: [],
  },
];

/** The `<nav>` that holds every selectable folder row. */
const nav = (): HTMLElement => screen.getByRole('navigation', { name: 'Folders' });

/**
 * Every selectable row, in DOM order. `data-folder-row` is the hook the
 * component's ArrowUp/ArrowDown handler uses, so this is the same list the
 * keyboard navigation walks.
 */
const rows = (): HTMLButtonElement[] =>
  Array.from(nav().querySelectorAll<HTMLButtonElement>('[data-folder-row]'));

const rowFor = (id: string): HTMLButtonElement => {
  const found = rows().find((r) => r.dataset.folderId === id);
  if (!found) throw new Error(`no row rendered for folder id "${id}"`);
  return found;
};

const rowAccessibleName = (el: HTMLElement): string =>
  el.getAttribute('aria-label') ?? el.textContent ?? '';

describe('DocumentFolderTree keyboard accessibility', () => {
  let onSelectFolder: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    onSelectFolder = jest.fn();
  });

  const renderTree = (overrides: Partial<React.ComponentProps<typeof DocumentFolderTree>> = {}) =>
    render(
      <DocumentFolderTree
        workspaceId={WS}
        selectedFolderId={null}
        onSelectFolder={onSelectFolder}
        folders={folders}
        folderTree={folderTree}
        {...overrides}
      />,
    );

  it('renders every folder as a real tabbable button, not a div with onClick', () => {
    renderTree();

    // All Documents + both root folders, in visual order.
    expect(rows().map(rowAccessibleName)).toEqual(['All Documents', 'Legal Contracts', 'Resumes']);

    // A native <button> is in the tab order by default; assert no negative
    // tabindex has been introduced that would remove it again.
    for (const row of rows()) {
      expect(row.tagName).toBe('BUTTON');
      expect(row.getAttribute('type')).toBe('button');
      expect(row.getAttribute('tabindex')).toBeNull();
    }
  });

  it('selects a folder with Enter and reports the correct folder id', () => {
    renderTree();

    const legalRow = rowFor('f-legal');
    legalRow.focus();
    expect(document.activeElement).toBe(legalRow);

    fireEvent.keyDown(legalRow, { key: 'Enter' });

    expect(onSelectFolder).toHaveBeenCalledTimes(1);
    expect(onSelectFolder).toHaveBeenCalledWith('f-legal');
  });

  it('selects a folder with Space and reports the correct folder id', () => {
    renderTree();

    const resumesRow = rowFor('f-resumes');
    resumesRow.focus();
    expect(document.activeElement).toBe(resumesRow);

    fireEvent.keyDown(resumesRow, { key: ' ' });

    expect(onSelectFolder).toHaveBeenCalledTimes(1);
    expect(onSelectFolder).toHaveBeenCalledWith('f-resumes');
  });

  it('selects the root row with Enter and reports null, not a folder id', () => {
    renderTree();

    const rootRow = rowFor('root');
    rootRow.focus();
    fireEvent.keyDown(rootRow, { key: 'Enter' });

    expect(onSelectFolder).toHaveBeenCalledWith(null);
  });

  it('moves focus down between visible rows with ArrowDown', () => {
    renderTree();

    const [rootRow, legalRow, resumesRow] = rows();
    rootRow.focus();

    fireEvent.keyDown(rootRow, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(legalRow);

    fireEvent.keyDown(legalRow, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(resumesRow);

    // Nothing below the last row: focus stays put rather than escaping to <body>.
    fireEvent.keyDown(resumesRow, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(resumesRow);
  });

  it('moves focus back up between visible rows with ArrowUp', () => {
    renderTree();

    const [rootRow, legalRow, resumesRow] = rows();
    resumesRow.focus();

    fireEvent.keyDown(resumesRow, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(legalRow);

    fireEvent.keyDown(legalRow, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(rootRow);

    fireEvent.keyDown(rootRow, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(rootRow);
  });

  it('skips collapsed children when arrowing, and includes them once expanded', () => {
    renderTree();

    const [rootRow, legalRow] = rows();
    rootRow.focus();
    fireEvent.keyDown(rootRow, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(legalRow);

    // "NDAs" is a child of "Legal Contracts" and is not rendered while collapsed.
    expect(rows().map(rowAccessibleName)).not.toContain('NDAs');

    fireEvent.click(screen.getByRole('button', { name: 'Expand folder Legal Contracts' }));

    expect(rows().map(rowAccessibleName)).toEqual([
      'All Documents',
      'Legal Contracts',
      'NDAs',
      'Resumes',
    ]);

    fireEvent.keyDown(legalRow, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(rowFor('f-nda'));
  });

  it('exposes aria-current only on the selected folder row', () => {
    renderTree({ selectedFolderId: 'f-resumes' });

    expect(rowFor('f-resumes').getAttribute('aria-current')).toBe('true');
    expect(rowFor('f-legal').getAttribute('aria-current')).toBeNull();
    expect(rowFor('root').getAttribute('aria-current')).toBeNull();
  });

  it('exposes aria-current on the root row when nothing is selected', () => {
    renderTree();

    expect(rowFor('root').getAttribute('aria-current')).toBe('true');
    expect(rowFor('f-legal').getAttribute('aria-current')).toBeNull();
  });

  it('exposes aria-expanded only on rows that have children, and tracks the toggle', () => {
    renderTree();

    // Leaf rows must NOT claim an expanded/collapsed state they do not have.
    expect(rowFor('f-resumes').getAttribute('aria-expanded')).toBeNull();
    expect(rowFor('root').getAttribute('aria-expanded')).toBeNull();

    expect(rowFor('f-legal').getAttribute('aria-expanded')).toBe('false');

    fireEvent.click(screen.getByRole('button', { name: 'Expand folder Legal Contracts' }));
    expect(rowFor('f-legal').getAttribute('aria-expanded')).toBe('true');

    fireEvent.click(screen.getByRole('button', { name: 'Collapse folder Legal Contracts' }));
    expect(rowFor('f-legal').getAttribute('aria-expanded')).toBe('false');
  });

  it('keeps row action buttons in the tab order without a hover', () => {
    renderTree();

    const actions = screen.getByRole('button', { name: 'Add subfolder to Legal Contracts' });

    /*
     * Regression guard for the `hidden group-hover:flex` bug.
     *
     * jsdom does not load Tailwind, so it cannot tell us whether a class produces
     * `display:none` — computed style here would pass even against the broken
     * implementation. The contract therefore has to be asserted on the class
     * list itself: nothing on the action container may use `hidden`, or any
     * `hidden`+`group-hover:flex` pairing, because those remove the buttons from
     * the tab order in a real browser and no amount of `focus-within` can ever
     * reveal them.
     *
     * `IconButton` renders a bare <button> with no wrapper, so the button's
     * parentElement IS the per-row action container.
     */
    const container = actions.parentElement;
    expect(container).not.toBeNull();
    const containerClasses = (container as HTMLElement).className.split(/\s+/);
    expect(containerClasses).not.toContain('hidden');
    expect(containerClasses).not.toContain('invisible');
    expect(containerClasses).not.toContain('invisible');
    // It must be revealed by keyboard focus, not only by pointer hover.
    expect(containerClasses).toEqual(
      expect.arrayContaining([
        expect.stringContaining('group-hover:'),
        expect.stringContaining('focus-within:'),
      ]),
    );

    // Behavioural half: the button really is focusable and really fires.
    actions.focus();
    expect(document.activeElement).toBe(actions);

    fireEvent.click(actions);
    expect(documentApi.createFolder).not.toHaveBeenCalled();
    // The create modal opens instead (no onCreateFolder prop was supplied), which
    // proves the handler ran rather than the click being swallowed.
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('runs the row delete action from the keyboard', () => {
    const onDeleteFolder = jest.fn();
    renderTree({ onDeleteFolder });

    const remove = screen.getByRole('button', { name: 'Delete folder Legal Contracts' });
    remove.focus();
    expect(document.activeElement).toBe(remove);

    fireEvent.click(remove);
    expect(onDeleteFolder).toHaveBeenCalledTimes(1);
    expect(onDeleteFolder).toHaveBeenCalledWith('f-legal', 'Legal Contracts');
  });

  it('gives every interactive control in the tree a non-empty accessible name', () => {
    renderTree();

    const controls = within(nav())
      .getAllByRole('button')
      .concat(screen.getByRole('button', { name: /new folder/i }));

    expect(controls.length).toBeGreaterThanOrEqual(7);
    for (const control of controls) {
      expect(rowAccessibleName(control).trim()).not.toBe('');
    }

    // Spelled out explicitly so a regression that drops aria-label is named.
    expect(screen.getByRole('button', { name: 'Add subfolder to Legal Contracts' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Delete folder Legal Contracts' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Expand folder Legal Contracts' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Add subfolder to Resumes' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Delete folder Resumes' })).toBeTruthy();
  });
});

describe('DocumentFolderTree flat-list fallback', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the flat list when no tree is supplied, with labelled delete buttons', () => {
    const onSelectFolder = jest.fn();
    const onDeleteFolder = jest.fn();

    render(
      <DocumentFolderTree
        workspaceId={WS}
        selectedFolderId={null}
        onSelectFolder={onSelectFolder}
        folders={folders}
        folderTree={[]}
        onDeleteFolder={onDeleteFolder}
      />,
    );

    expect(rows().map(rowAccessibleName)).toEqual(['All Documents', 'Legal Contracts', 'Resumes']);

    // The flat-list delete button previously had only a `title`, which is not an
    // accessible name.
    const remove = screen.getByRole('button', { name: 'Delete folder Legal Contracts' });
    expect(remove.getAttribute('aria-label')).toBe('Delete folder Legal Contracts');
    expect(remove.getAttribute('title')).toBe('Delete folder');

    // The flat row is keyboard selectable too.
    const legalRow = rowFor('f-legal');
    legalRow.focus();
    fireEvent.keyDown(legalRow, { key: 'Enter' });
    expect(onSelectFolder).toHaveBeenCalledWith('f-legal');

    // And the reveal container must not be display-hidden either.
    const container = remove.parentElement as HTMLElement;
    expect(container.className.split(/\s+/)).not.toContain('hidden');
  });
});
