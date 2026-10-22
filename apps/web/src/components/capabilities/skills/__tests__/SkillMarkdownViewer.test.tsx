/**
 * (T15 adopts shared markdown theme; sibling T6 h2 pin retired.)
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SkillMarkdownViewer } from '../SkillMarkdownViewer';

jest.mock('react-markdown', () => ({
  __esModule: true,
  default: function MockReactMarkdown(props: {
    components: Record<
      string,
      (componentProps: { children?: React.ReactNode; className?: string }) => React.ReactNode
    >;
  }) {
    return (
      <div data-testid="markdown-harness">
        {props.components.h2 ? (
          props.components.h2({ children: 'Getting Started' })
        ) : (
          <h2>Getting Started</h2>
        )}
        {props.components.code({ className: 'language-bash', children: 'abcdefghij one\n' })}
        {props.components.code({ className: 'language-bash', children: 'abcdefghij two\n' })}
      </div>
    );
  },
}));

jest.mock('remark-gfm', () => () => {});

const setClipboard = (value: unknown) => {
  Object.defineProperty(navigator, 'clipboard', { value, configurable: true });
};

const renderViewer = () => render(<SkillMarkdownViewer content={'# Docs'} />);

describe('SkillMarkdownViewer', () => {
  afterEach(() => {
    setClipboard(undefined);
  });

  it('renders its root with the shared markdown-body theme (T15)', () => {
    const { container } = renderViewer();
    expect(container.firstElementChild?.className).toContain('markdown-body');
  });

  it('renders h2 with no inline className override (T15; sibling T6 h2 pin retired)', () => {
    renderViewer();
    const heading = screen.getByRole('heading', { level: 2 });
    expect(heading.textContent).toBe('Getting Started');
    // T15: the shared `.markdown-body h2` descendant rules govern, so the
    // override component and every hand-rolled inline utility on it is gone.
    const inheritedClass = heading.getAttribute('class');
    expect(inheritedClass === null || inheritedClass === '').toBe(true);
  });

  it('keeps copy state per block when two blocks share a prefix (A8)', async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    setClipboard({ writeText });
    renderViewer();
    const buttons = screen.getAllByRole('button', { name: 'Copy code block' });
    expect(buttons).toHaveLength(2);

    fireEvent.click(buttons[0]);
    await waitFor(() => expect(buttons[0].textContent).toBe('Copied'));
    expect(buttons[1].textContent).toBe('Copy');
    expect(writeText).toHaveBeenCalledWith('abcdefghij one');
  });

  it('does not claim success when the clipboard write rejects (A8)', async () => {
    const writeText = jest.fn().mockRejectedValue(new Error('NotAllowedError'));
    setClipboard({ writeText });
    renderViewer();
    const buttons = screen.getAllByRole('button', { name: 'Copy code block' });

    fireEvent.click(buttons[0]);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(writeText).toHaveBeenCalledWith('abcdefghij one');
    expect(buttons[0].textContent).toBe('Copy');
    expect(buttons[1].textContent).toBe('Copy');
  });

  it('leaves state untouched when the clipboard API is unavailable (A8)', () => {
    setClipboard(undefined);
    renderViewer();
    const buttons = screen.getAllByRole('button', { name: 'Copy code block' });
    fireEvent.click(buttons[0]);
    expect(buttons[0].textContent).toBe('Copy');
  });
});
