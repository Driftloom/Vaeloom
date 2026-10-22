import React from 'react';
import { render, screen, within } from '@testing-library/react';

import { CustomProtocolModal } from '../connectors/CustomProtocolModal';

/**
 * Task 13 form-atoms rollout: every input in this modal must render through the
 * ui-kit Input atom. The atom's signature classes (`rounded-lg` plus
 * `focus:ring-2` on text inputs; the arbitrary neutralizers on the transport
 * radio) are absent from the hand-rolled markup, so their presence proves the
 * conversion rather than an incidental restyle.
 */

const noop = () => undefined;

function renderModal(overrides: Partial<React.ComponentProps<typeof CustomProtocolModal>> = {}) {
  const props: React.ComponentProps<typeof CustomProtocolModal> = {
    isOpen: true,
    onClose: noop,
    customType: 'mcp',
    onCustomTypeChange: noop,
    customName: '',
    onCustomNameChange: noop,
    customUrl: '',
    onCustomUrlChange: noop,
    customApiKey: '',
    onCustomApiKeyChange: noop,
    customMcpTransport: 'stdio',
    onCustomMcpTransportChange: noop,
    customCommand: '',
    onCustomCommandChange: noop,
    customArgs: '',
    onCustomArgsChange: noop,
    submittingCustom: false,
    onSubmit: noop,
    ...overrides,
  };
  render(<CustomProtocolModal {...props} />);
  return within(screen.getByRole('dialog'));
}

function expectUIKitClasses(id: string, ...expected: string[]) {
  const input = document.getElementById(id) as HTMLInputElement | null;
  expect(input).not.toBeNull();
  for (const cls of expected) {
    expect(input?.className).toContain(cls);
  }
}

describe('CustomProtocolModal renders through ui-kit form atoms', () => {
  it('routes the stdio transport fields through the Input atom', () => {
    renderModal();
    expectUIKitClasses('custom-connector-name', 'rounded-lg', 'focus:ring-2');
    expectUIKitClasses('custom-command', 'rounded-lg', 'focus:ring-2');
    expectUIKitClasses('custom-args', 'rounded-lg', 'focus:ring-2');
  });

  it('routes the transport radio through the Input atom with neutralized classes', () => {
    renderModal();
    const radios = within(screen.getByRole('dialog')).getAllByRole('radio');
    expect(radios).toHaveLength(2);
    for (const radio of radios) {
      expect(radio.className).toContain('rounded-[9999px]');
      expect(radio.className).toContain('w-[1rem]');
    }
  });

  it('routes the remote MCP URL through the Input atom', () => {
    renderModal({ customMcpTransport: 'http' });
    expectUIKitClasses('custom-mcp-url', 'rounded-lg', 'focus:ring-2');
  });

  it('routes the REST/GraphQL endpoint fields through the Input atom', () => {
    renderModal({ customType: 'rest' });
    expectUIKitClasses('custom-base-url', 'rounded-lg', 'focus:ring-2');
    expectUIKitClasses('custom-api-key', 'rounded-lg', 'focus:ring-2');
  });

  it('keeps the labels associated with the converted inputs', () => {
    const view = renderModal();
    expect(view.getByLabelText('Connector name')).toBeTruthy();
    expect(view.getByLabelText('Arguments (space separated)')).toBeTruthy();
  });
});
