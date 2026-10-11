import '@testing-library/jest-dom';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryVaultExplorer } from '../MemoryVaultExplorer';

describe('Memory Vault Explorer', () => {
  it('filters memories by category tag and allows citing into composer', () => {
    const onCite = jest.fn();
    render(
      <MemoryVaultExplorer
        workspaceId="212ed9ca"
        onCiteMemory={onCite}
        onOpenVaultDrawer={jest.fn()}
      />,
    );

    expect(screen.getByPlaceholderText(/Search memories, skills, notes/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /#career/i })).toBeInTheDocument();

    const citeButtons = screen.getAllByRole('button', { name: /Cite in Chat/i });
    fireEvent.click(citeButtons[0]);
    expect(onCite).toHaveBeenCalled();
  });
});
