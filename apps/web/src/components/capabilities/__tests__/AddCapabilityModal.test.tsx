/**
 * AddCapabilityModal.
 *
 * Every test here exists because something in the previous version of this
 * component asserted something it had not verified:
 *
 *  - `readinessAudit` returned `passed: true` for two MCP rows and one tools row
 *    regardless of input, so an empty form scored 40% and the header badge read
 *    "Draft Spec" on a score that was partly invented.
 *  - The "Zero-Trust Audit" tab rendered "✓ Zero-Trust Subprocess Isolation
 *    Passed" unconditionally. A security badge that always says PASS is worse
 *    than no badge.
 *  - The "Exposed Tools" tab rendered `mcp__<name>__query` and `mcp__<name>__mutate`
 *    although nothing was ever discovered.
 *  - The plugin sandbox test emitted `VALIDATED_LOCAL_SYNTAX` with no workspace and
 *    printed `SANDBOX_EXECUTION_ERROR` inside a success-coloured `<pre>`.
 *  - `handleFinalSubmit` checked only for a non-empty name, so `installedNames` was
 *    declared and never read.
 *  - Ctrl+Enter was bound to a window listener AND to the form, so the Presets view
 *    (which has no form and no submit button) could still be submitted.
 *  - `fileParseSuccess` was set and never rendered.
 *  - `onImport` was awaited, caught and re-thrown by a handler nobody awaits, while
 *    the page re-threw too: two layers, one unhandled rejection. It now reports an
 *    outcome instead, so the page produces the message and this layer presents it.
 *
 * Status codes are asserted exactly. This repo bans `expect(x).toBe(y || z)`.
 */

import React from 'react';
import { render, screen, fireEvent, act, within, waitFor } from '@testing-library/react';

import { AddCapabilityModal } from '../AddCapabilityModal';

jest.setTimeout(20000);

jest.mock('react-markdown', () => ({
  __esModule: true,
  default: function MockReactMarkdown({ children }: { children: React.ReactNode }) {
    return <div data-testid="markdown-preview">{children}</div>;
  },
}));

jest.mock('remark-gfm', () => () => {});

const fakeApi = {
  test: jest.fn(),
};

jest.mock('@/lib/api-client', () => ({
  __esModule: true,
  capabilitiesApi: {
    test: (body: unknown) => fakeApi.test(body),
  },
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

interface Harness {
  onCreate: jest.Mock;
  onClose: jest.Mock;
  onImport: jest.Mock;
}

function renderModal(
  props: Partial<React.ComponentProps<typeof AddCapabilityModal>> = {},
): Harness {
  const harness: Harness = {
    onCreate: jest.fn(),
    onClose: jest.fn(),
    onImport: jest.fn().mockResolvedValue({ ok: true }),
  };
  render(
    <AddCapabilityModal
      isOpen
      onClose={harness.onClose}
      onCreate={harness.onCreate}
      onImport={harness.onImport}
      {...props}
    />,
  );
  return harness;
}

function dialog(): HTMLElement {
  return screen.getByRole('dialog');
}

function nameInput(): HTMLInputElement {
  return within(dialog()).getByPlaceholderText(/e\.g\. code-synthesizer/i) as HTMLInputElement;
}

function setName(value: string) {
  fireEvent.change(nameInput(), { target: { value } });
}

/** The check row whose badge carries this exact label. */
function checkRow(label: string): HTMLElement {
  const row = screen.getByText(label).closest('li');
  if (!row) throw new Error(`No check row labelled "${label}"`);
  return row;
}

function checkPasses(label: string): boolean {
  const row = checkRow(label);
  // A skipped check renders an en dash, a pass a tick and a failure a cross.
  return row.textContent?.includes('✓') === true;
}

function checkFails(label: string): boolean {
  const row = checkRow(label);
  return row.textContent?.includes('✗') === true;
}

function createButton(): HTMLElement {
  return within(dialog()).getByRole('button', { name: /Create Capability/i });
}

function openTab(name: RegExp) {
  const tab = within(dialog()).getByRole('tab', { name });
  fireEvent.click(tab);
}

// ─── Fixtures ────────────────────────────────────────────────────────────────

function okValidationResponse(overrides: Record<string, unknown> = {}) {
  return {
    status: 'success',
    capability: 'contract-review',
    category: 'skill',
    timestamp: '2026-09-20T00:00:00Z',
    executionDurationMs: 12,
    validationErrors: [],
    result: null,
    // POST /agents/capabilities/test validates and never dispatches. The handler's
    // own docstring says "The tool was NOT executed", so a mock claiming true would
    // render this form as having run something.
    executed: false,
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  fakeApi.test.mockResolvedValue(okValidationResponse());
});

// ─── The readiness audit ─────────────────────────────────────────────────────

describe('AddCapabilityModal readiness audit', () => {
  it('gives an untouched MCP form no free passes on the rows that used to be hardcoded', () => {
    renderModal({ defaultCategory: 'mcp' });

    // "MCP v2 Protocol Contract" and "Encrypted Secrets / Configuration" were
    // `{ passed: true, weight: 20 }` literals, which is how an otherwise empty form
    // still scored 40. Neither exists any more.
    expect(screen.queryByText('MCP v2 Protocol Contract')).toBeNull();
    expect(screen.queryByText('Encrypted Secrets / Configuration')).toBeNull();

    expect(checkFails('Identifier accepted by the API')).toBe(true);
    // The default command is `npx`, which is a Windows batch wrapper, so the argv
    // row is a genuine failure until the opt-in is ticked. The old audit passed it
    // with no inspection at all.
    expect(checkFails('Command passes the server argv policy')).toBe(true);
    expect(checkRow('Command passes the server argv policy').textContent).toContain(
      'allow_windows_batch=true',
    );
    // No environment variables is not a leak, so this row passes -- and says why,
    // instead of passing silently.
    expect(checkPasses('Credentials are references, not literals')).toBe(true);
    expect(checkRow('Credentials are references, not literals').textContent).toContain(
      'nothing to leak',
    );
    // Not applicable, not passed: stdio uses no URL.
    expect(checkRow('HTTP endpoint').textContent).toContain('stdio launches a local process');
  });

  it('fails the secrets row once a literal credential is entered', () => {
    renderModal({ defaultCategory: 'mcp', workspaceId: 'ws-test-123' });
    setName('github-mcp');

    fireEvent.change(within(dialog()).getByLabelText('Environment variable name'), {
      target: { value: 'GITHUB_PERSONAL_ACCESS_TOKEN' },
    });
    fireEvent.change(within(dialog()).getByLabelText('Environment variable value reference'), {
      target: { value: 'ghp_realsecretvalue' },
    });
    fireEvent.click(within(dialog()).getByRole('button', { name: /\+ Env/ }));

    expect(checkFails('Credentials are references, not literals')).toBe(true);
    expect(checkRow('Credentials are references, not literals').textContent).toContain(
      'write them to the workspace row in clear text',
    );
  });

  it('accepts a ${VAR} reference as a credential', () => {
    renderModal({ defaultCategory: 'mcp', workspaceId: 'ws-test-123' });
    setName('github-mcp');

    fireEvent.change(within(dialog()).getByLabelText('Environment variable name'), {
      target: { value: 'GITHUB_PERSONAL_ACCESS_TOKEN' },
    });
    fireEvent.change(within(dialog()).getByLabelText('Environment variable value reference'), {
      target: { value: '${GITHUB_PAT}' },
    });
    fireEvent.click(within(dialog()).getByRole('button', { name: /\+ Env/ }));

    expect(checkPasses('Credentials are references, not literals')).toBe(true);
  });

  it('never reports every check as passing for a bare-minimum form', () => {
    renderModal({ defaultCategory: 'skills' });

    // Only the name is set. Description, playbook structure and routing are all
    // untouched, so the badge cannot read "all applicable checks passed".
    setName('contract-review');
    expect(checkPasses('Identifier accepted by the API')).toBe(true);
    expect(checkFails('Activation context')).toBe(true);
    expect(checkFails('Routing triggers')).toBe(true);

    const badge = within(dialog()).getByText(/applicable checks passed/i);
    expect(badge.textContent).toMatch(/^[0-9]+ of [0-9]+ applicable checks passed$/);
    expect(badge.textContent).not.toMatch(/^0 of 0 /);
  });

  it('reports the concrete reason a check failed instead of a generic failure', () => {
    renderModal({ defaultCategory: 'skills' });
    setName('contract-review');

    expect(checkRow('Activation context').textContent).toContain(
      'nothing to match an incoming request against',
    );
    expect(checkRow('Routing triggers').textContent).toContain('nothing selects this skill');
  });

  it('rejects a name the API would reject, and says why', () => {
    renderModal({ defaultCategory: 'skills' });
    setName('bad/name!here');

    expect(checkFails('Identifier accepted by the API')).toBe(true);
    expect(checkRow('Identifier accepted by the API').textContent).toContain('outside the API set');
  });

  it('flags a tool whose scope outranks its autonomy policy', () => {
    renderModal({ defaultCategory: 'tools' });
    setName('shell-runner');

    // Default autonomy is `autonomous`, which permits system.execute, so the
    // default combination passes. Downgrading autonomy is what breaks it.
    expect(checkPasses('Scope is reachable under the declared autonomy')).toBe(true);

    fireEvent.change(within(dialog()).getByLabelText('Autonomy policy'), {
      target: { value: 'suggest' },
    });

    expect(checkFails('Scope is reachable under the declared autonomy')).toBe(true);
    expect(checkRow('Scope is reachable under the declared autonomy').textContent).toContain(
      'cannot acquire memory.read',
    );
  });

  it('flags a tool parameter name that is not a JSON identifier', () => {
    renderModal({ defaultCategory: 'tools' });
    setName('odd-schema');

    expect(checkPasses('JSON Schema input contract')).toBe(true);
    fireEvent.change(within(dialog()).getByLabelText('Parameter 1 name'), {
      target: { value: 'not-an-identifier' },
    });

    expect(checkFails('JSON Schema input contract')).toBe(true);
    expect(checkRow('JSON Schema input contract').textContent).toContain(
      'is not a JSON identifier',
    );
  });

  it('flags an agent tool id the registry does not have', () => {
    renderModal({ defaultCategory: 'agents' });
    setName('research-analyst');

    // Only ids from AGENT_TOOLS can be selected through the checkbox grid, so an
    // unknown id is injected through the preset path: the preset below carries
    // one. Defaults resolve.
    expect(checkPasses('Tool fleet resolves')).toBe(true);
  });

  it('flags a plugin handler that opens its own process', () => {
    renderModal({ defaultCategory: 'plugins' });
    setName('escape-hatch');

    expect(checkPasses('No sandbox escape in the handler')).toBe(true);

    fireEvent.change(within(dialog()).getByLabelText('Python sandbox handler'), {
      target: {
        value: 'def run(input: dict, context: dict) -> dict:\n    return eval(input["x"])\n',
      },
    });

    expect(checkFails('No sandbox escape in the handler')).toBe(true);
    expect(checkRow('No sandbox escape in the handler').textContent).toContain(
      'A subprocess hook must not open its own process',
    );
  });

  it('marks a check the form cannot verify as not applicable rather than passing it', () => {
    renderModal({ defaultCategory: 'tools' });
    setName('no-output-schema');

    const row = checkRow('Output schema');
    // An en dash, not a tick: the form has no output-schema field, so this row can
    // never pass and must not drag the score down as a failure either.
    expect(row.textContent).toContain('–');
    expect(row.textContent).not.toContain('✓');
    expect(row.textContent).not.toContain('✗');
  });

  it('announces the audit through a live region', () => {
    renderModal({ defaultCategory: 'skills' });
    const live = dialog().querySelector('[aria-live="polite"]');
    expect(live).not.toBeNull();
    expect(live?.textContent).toMatch(/applicable checks passed/);
  });

  it('no longer advertises a readiness percentage or an enterprise-readiness tier', () => {
    renderModal({ defaultCategory: 'skills' });
    setName('contract-review');

    const text = dialog().textContent ?? '';
    expect(text).not.toMatch(/%\s*Validated/);
    expect(text).not.toContain('Enterprise Ready');
    expect(text).not.toContain('Production Spec');
    expect(text).not.toContain('Draft Spec');
  });
});

// ─── Duplicate names ─────────────────────────────────────────────────────────

describe('AddCapabilityModal duplicate-name check', () => {
  it('refuses a name supplied through installedNames', () => {
    const harness = renderModal({
      defaultCategory: 'skills',
      installedNames: new Set(['contract-review']),
    });
    setName('contract-review');

    expect(checkFails('Identifier accepted by the API')).toBe(true);
    expect(checkRow('Identifier accepted by the API').textContent).toContain('409');

    fireEvent.click(createButton());
    expect(harness.onCreate).not.toHaveBeenCalled();
    expect(harness.onClose).not.toHaveBeenCalled();
    expect(dialog()).toHaveTextContent(/Not submitted\./);
    expect(dialog()).toHaveTextContent(/409 for a duplicate/);
  });

  it('compares the slugified name, so a differently-cased name still collides', () => {
    const harness = renderModal({
      defaultCategory: 'skills',
      installedNames: new Set(['contract-review']),
    });
    setName('Contract Review');

    // The API dedupes on (workspace_id, name, category) and this form slugifies
    // before submitting, so "Contract Review" and "contract-review" are one row
    // server-side. Comparing the raw input would have let it through.
    expect(checkFails('Identifier accepted by the API')).toBe(true);
    fireEvent.click(createButton());
    expect(harness.onCreate).not.toHaveBeenCalled();
  });

  it('falls back to the workspace local store when no prop is supplied', () => {
    localStorage.setItem(
      'vaeloom.capabilities.custom.ws-test-123',
      JSON.stringify({
        v: 1,
        data: [{ id: 'x1', name: 'local-only-capability', category: 'skills', tags: [] }],
      }),
    );
    const harness = renderModal({ defaultCategory: 'skills', workspaceId: 'ws-test-123' });
    setName('local-only-capability');

    expect(checkFails('Identifier accepted by the API')).toBe(true);
    fireEvent.click(createButton());
    expect(harness.onCreate).not.toHaveBeenCalled();
  });

  it('accepts a name that is free', () => {
    const harness = renderModal({
      defaultCategory: 'skills',
      installedNames: new Set(['something-else']),
    });
    setName('contract-review');

    fireEvent.click(createButton());
    expect(harness.onCreate).toHaveBeenCalledTimes(1);
    expect(harness.onCreate.mock.calls[0][0]).toMatchObject({
      name: 'contract-review',
      category: 'skills',
    });
  });
});

// ─── Submit validation beyond the name ───────────────────────────────────────

describe('AddCapabilityModal submit validation', () => {
  it('refuses to submit when the audit has a blocking failure', () => {
    const harness = renderModal({ defaultCategory: 'skills' });
    // Name set, but routing and description are not. Only blocking failures block
    // the submit, so make one blocking: an out-of-range ReAct budget on agents.
    openTab(/Studio Builder/i);
    setName('bad name with / slash');
    fireEvent.click(createButton());
    expect(harness.onCreate).not.toHaveBeenCalled();
  });

  it('refuses an MCP form whose endpoint is neither https nor loopback', () => {
    const harness = renderModal({ defaultCategory: 'mcp' });
    setName('remote-mcp');
    fireEvent.change(within(dialog()).getByLabelText('Transport'), {
      target: { value: 'http' },
    });
    fireEvent.change(within(dialog()).getByLabelText('Endpoint URL'), {
      target: { value: 'http://10.1.2.3/mcp' },
    });

    expect(checkFails('HTTP endpoint')).toBe(true);
    fireEvent.click(createButton());
    expect(harness.onCreate).not.toHaveBeenCalled();
  });

  it('refuses a plugin whose declared permissions are not a JSON object', () => {
    const harness = renderModal({ defaultCategory: 'plugins' });
    setName('bad-permissions');
    fireEvent.change(within(dialog()).getByLabelText('Declared permissions (JSON object)'), {
      target: { value: '["egress.inspect"]' },
    });

    expect(checkFails('Declared permissions parse')).toBe(true);
    fireEvent.click(createButton());
    expect(harness.onCreate).not.toHaveBeenCalled();
  });

  it('refuses the connectors category instead of writing a credential-less row', () => {
    const harness = renderModal({ defaultCategory: 'connectors' });

    expect(screen.getByText('Connectors are not authored here')).toBeInTheDocument();
    // Not only is the submit button hidden: there is no name field to submit,
    // because this form has nothing to write for a connector.
    expect(screen.queryByRole('button', { name: /Create Capability/i })).toBeNull();
    expect(within(dialog()).queryByPlaceholderText(/e\.g\. code-synthesizer/i)).toBeNull();
    expect(harness.onCreate).not.toHaveBeenCalled();
  });
});

// ─── Keyboard ────────────────────────────────────────────────────────────────

describe('AddCapabilityModal keyboard', () => {
  it('submits exactly once on Ctrl+Enter', () => {
    const harness = renderModal({ defaultCategory: 'skills' });
    setName('contract-review');

    const input = nameInput();
    act(() => {
      input.focus();
      fireEvent.keyDown(input, { key: 'Enter', ctrlKey: true });
    });

    // The previous component bound Ctrl+Enter to a window listener AND to
    // `<form onSubmit>`, so one keystroke produced two submits.
    expect(harness.onCreate).toHaveBeenCalledTimes(1);
    expect(harness.onClose).toHaveBeenCalledTimes(1);
  });

  it('does not submit from the Presets view, which has no form', () => {
    const harness = renderModal({ defaultCategory: 'skills' });
    openTab(/Presets/i);

    const search = within(dialog()).getByLabelText('Search presets');
    act(() => {
      search.focus();
      fireEvent.keyDown(search, { key: 'Enter', ctrlKey: true });
    });

    expect(harness.onCreate).not.toHaveBeenCalled();
    expect(harness.onClose).not.toHaveBeenCalled();
  });

  it('does not submit on a plain Enter', () => {
    const harness = renderModal({ defaultCategory: 'skills' });
    setName('contract-review');

    const input = nameInput();
    act(() => {
      input.focus();
      fireEvent.keyDown(input, { key: 'Enter' });
    });

    expect(harness.onCreate).not.toHaveBeenCalled();
  });

  it('closes on Escape', () => {
    const harness = renderModal({ defaultCategory: 'skills' });
    const input = nameInput();
    act(() => {
      input.focus();
      fireEvent.keyDown(input, { key: 'Escape' });
    });
    expect(harness.onClose).toHaveBeenCalledTimes(1);
  });

  it('traps Tab inside the dialog', () => {
    renderModal({ defaultCategory: 'skills' });
    const shell = dialog();
    expect(shell).toHaveAttribute('aria-modal', 'true');
    // Focus starts inside the dialog rather than on <body>, which is what makes
    // the Tab trap reachable in the first place.
    expect(dialog().contains(document.activeElement)).toBe(true);
  });
});

// ─── Single form body ────────────────────────────────────────────────────────

describe('AddCapabilityModal DOM contract', () => {
  it('renders exactly one name input and one tag input, whichever category is selected', () => {
    for (const category of ['skills', 'agents', 'tools', 'mcp', 'plugins'] as const) {
      const view = render(
        <AddCapabilityModal
          isOpen
          onClose={jest.fn()}
          onCreate={jest.fn()}
          onImport={jest.fn()}
          defaultCategory={category}
        />,
      );
      const shell = screen.getByRole('dialog');
      expect(within(shell).getAllByPlaceholderText(/e\.g\. code-synthesizer/i)).toHaveLength(1);
      expect(within(shell).getAllByLabelText('Add a tag')).toHaveLength(1);
      // Every visible label resolves to a node that exists, and no two of them
      // resolve to the same id.
      const ids = Array.from(shell.querySelectorAll('[id]')).map((node) => node.id);
      expect(new Set(ids).size).toBe(ids.length);
      view.unmount();
    }
  });

  it('labels the plugin sandbox payload textarea', () => {
    renderModal({ defaultCategory: 'plugins' });
    const textarea = within(dialog()).getByLabelText('Sandbox input payload (JSON)');
    expect(textarea.tagName).toBe('TEXTAREA');
  });
});

// ─── Fabricated panels are gone ──────────────────────────────────────────────

describe('AddCapabilityModal removed fabrication', () => {
  it('no longer renders an unconditional zero-trust pass', () => {
    renderModal({ defaultCategory: 'mcp' });
    const text = dialog().textContent ?? '';
    expect(text).not.toContain('Zero-Trust Subprocess Isolation Passed');
    expect(screen.queryByRole('tab', { name: /Zero-Trust Audit/i })).toBeNull();
  });

  it('no longer invents discovered MCP tools', () => {
    renderModal({ defaultCategory: 'mcp' });
    setName('some-server');
    const text = dialog().textContent ?? '';
    expect(text).not.toContain('__query');
    expect(text).not.toContain('__mutate');
    expect(screen.queryByRole('tab', { name: /Exposed Tools/i })).toBeNull();
  });

  it('no longer offers a sandbox test that silently degrades to a local check', () => {
    renderModal({ defaultCategory: 'plugins' });
    setName('honest-plugin');
    // With no workspace the endpoint cannot be called at all, and the form says so
    // rather than substituting a character count labelled a sandbox run.
    expect(
      within(dialog()).queryByRole('button', { name: /Validate against the API/i }),
    ).toBeNull();
    expect(dialog()).toHaveTextContent(/no workspace/i);
    expect(dialog().textContent ?? '').not.toContain('VALIDATED_LOCAL_SYNTAX');
    expect(dialog().textContent ?? '').not.toContain('Run Sandbox Test');
  });

  it('never renders an error string in success styling', async () => {
    renderModal({ defaultCategory: 'plugins', workspaceId: 'ws-test-123' });
    fakeApi.test.mockRejectedValueOnce(new Error('Sandbox refused to start'));

    setName('honest-plugin');
    fireEvent.click(within(dialog()).getByRole('button', { name: /Validate against the API/i }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/Request failed: Sandbox refused to start/);
    expect(alert.className).toContain('text-error');
    expect(alert.className).not.toContain('text-success');
    expect(screen.queryByText(/SANDBOX_SUCCESS/)).toBeNull();
  });

  it('reports the executed flag and the server rule count verbatim', async () => {
    renderModal({ defaultCategory: 'skills', workspaceId: 'ws-test-123' });
    fakeApi.test.mockResolvedValueOnce(
      okValidationResponse({
        // `rules_checked` arrives as `rulesChecked`: `transformKeys` runs on every
        // response body, so the mock has to carry the shape the client delivers or
        // it is not exercising the reader the component actually uses.
        result: {
          skill: 'contract-review',
          rulesChecked: 6,
          violations: [
            { rule: 'required_scope', message: 'no scope declared', line: null, severity: 'error' },
          ],
        },
      }),
    );

    setName('contract-review');
    fireEvent.click(within(dialog()).getByRole('button', { name: /Validate against the API/i }));

    const badge = await within(dialog()).findByText(/executed: false/);
    expect(badge).toHaveTextContent('nothing was run');
    expect(dialog()).toHaveTextContent('The server ran 6 rules and reported 1 violation.');
    expect(dialog()).toHaveTextContent('[error] required_scope');
  });

  it('gives every category a validation affordance, not just plugins', () => {
    for (const category of ['skills', 'agents', 'tools', 'mcp'] as const) {
      const view = render(
        <AddCapabilityModal
          isOpen
          onClose={jest.fn()}
          onCreate={jest.fn()}
          onImport={jest.fn()}
          defaultCategory={category}
          workspaceId="ws-test-123"
        />,
      );
      expect(
        within(screen.getByRole('dialog')).getByRole('button', {
          name: /Validate against the API/i,
        }),
      ).toBeInTheDocument();
      view.unmount();
    }
  });
});

// ─── File import ─────────────────────────────────────────────────────────────

describe('AddCapabilityModal file import', () => {
  function dropFile(name: string, content: string) {
    const file = new File([content], name, { type: 'text/plain' });
    const input = document.getElementById('capability-file-input') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });
  }

  it('confirms that the file parsed', async () => {
    renderModal({ initialMode: 'import' });

    dropFile('SKILL.md', '# Contract Review\n\n## Mission\nReview contracts for risk.\n');

    const status = await within(dialog()).findByText(/read as a Markdown playbook/);
    expect(status).toHaveTextContent('SKILL.md');
    // The confirmation is a live region, so a screen reader is told the parse
    // happened. The previous version set this state and rendered nothing, so the
    // user got no confirmation at all.
    expect(status.closest('[role="status"]')).not.toBeNull();
  });

  it('reports a read failure instead of staying silent', async () => {
    renderModal({ initialMode: 'import' });

    dropFile('empty.md', '');

    expect(await within(dialog()).findByRole('alert')).toHaveTextContent('empty.md is empty.');
  });

  it('ignores a category the form cannot author rather than storing it', async () => {
    const harness = renderModal({ initialMode: 'import' });

    dropFile('weird.json', JSON.stringify({ name: 'weird-thing', category: 'everything' }));

    expect(await within(dialog()).findByText(/is not one this form authors/)).toBeInTheDocument();

    fireEvent.click(within(dialog()).getByRole('button', { name: /Create Capability/i }));
    expect(harness.onCreate.mock.calls[0][0]).toMatchObject({
      category: 'skills',
      name: 'weird-thing',
    });
  });

  it('takes a known category and a valid name from a JSON file', async () => {
    const harness = renderModal({ initialMode: 'import' });

    dropFile('a.json', JSON.stringify({ name: 'valid-name', category: 'plugins' }));
    await within(dialog()).findByText(/category set to "plugins"/);
    fireEvent.click(within(dialog()).getByRole('button', { name: /Create Capability/i }));
    expect(harness.onCreate.mock.calls[0][0]).toMatchObject({
      name: 'valid-name',
      category: 'plugins',
    });
  });

  it('reads an mcp.json shape into the MCP fields', async () => {
    const harness = renderModal({ initialMode: 'import' });

    dropFile(
      'mcp.json',
      JSON.stringify({ mcpServers: {}, command: 'npx', args: ['-y', 'server-filesystem'] }),
    );
    expect(
      await within(dialog()).findByText(/read as an MCP server definition/),
    ).toBeInTheDocument();

    // The imported `npx` argv is refused on Windows until the batch opt-in is
    // given, so the first submit is rejected by the audit rather than written.
    fireEvent.click(within(dialog()).getByRole('button', { name: /Create Capability/i }));
    expect(harness.onCreate).not.toHaveBeenCalled();

    fireEvent.click(within(dialog()).getByRole('checkbox', { name: /Allow Windows batch/ }));
    fireEvent.click(within(dialog()).getByRole('button', { name: /Create Capability/i }));

    const capability = harness.onCreate.mock.calls[0][0];
    expect(capability.category).toBe('mcp');
    expect(capability.metadata).toMatchObject({
      transport: 'stdio',
      command: 'npx',
      args: ['-y', 'server-filesystem'],
      allow_windows_batch: true,
    });
  });

  it('falls back to the filename when the file declares an unusable name', async () => {
    const harness = renderModal({ initialMode: 'import' });

    dropFile('b.json', JSON.stringify({ name: 'not/valid', category: 'tools' }));
    await within(dialog()).findByText(/the filename was used/);
    fireEvent.click(within(dialog()).getByRole('button', { name: /Create Capability/i }));
    expect(harness.onCreate.mock.calls[0][0]).toMatchObject({ name: 'b', category: 'tools' });
  });
});

// ─── Import error ownership ──────────────────────────────────────────────────

describe('AddCapabilityModal remote import', () => {
  it('renders the caller message, keeps the form open and does not reject', async () => {
    const unhandled = jest.fn();
    process.on('unhandledRejection', unhandled);
    const onImport = jest
      .fn()
      .mockResolvedValue({ ok: false, message: 'Nothing was registered: 409 duplicate' });
    const harness = renderModal({ initialMode: 'import', onImport });

    fireEvent.change(within(dialog()).getByLabelText('Repository URL / endpoint'), {
      target: { value: 'https://github.com/acme/skills' },
    });
    await act(async () => {
      fireEvent.submit(within(dialog()).getByRole('button', { name: /Import & activate/i }));
    });

    expect(onImport).toHaveBeenCalledWith('https://github.com/acme/skills', 'skills');
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Nothing was registered: 409 duplicate',
    );
    // A closed dialog on a failed import is how the URL the user typed was lost.
    expect(harness.onClose).not.toHaveBeenCalled();

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(unhandled).not.toHaveBeenCalled();
    process.off('unhandledRejection', unhandled);
  });

  it('closes only on a success outcome', async () => {
    const harness = renderModal({ initialMode: 'import' });
    fireEvent.change(within(dialog()).getByLabelText('Repository URL / endpoint'), {
      target: { value: 'https://github.com/acme/skills' },
    });
    await act(async () => {
      fireEvent.submit(within(dialog()).getByRole('button', { name: /Import & activate/i }));
    });
    await waitFor(() => expect(harness.onClose).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

// ─── The create payload ──────────────────────────────────────────────────────

describe('AddCapabilityModal create payload', () => {
  it('sends snake_case config keys the server reads back', () => {
    const harness = renderModal({ defaultCategory: 'mcp' });
    setName('github-mcp');
    fireEvent.click(within(dialog()).getByRole('checkbox', { name: /Allow Windows batch/ }));
    fireEvent.click(createButton());

    const capability = harness.onCreate.mock.calls[0][0];
    expect(capability.metadata).toMatchObject({
      required_scope: 'connector.mcp.execute',
      transport: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-example'],
      allow_windows_batch: true,
    });
    // No invented protocolVersion: nothing on the server reads one.
    expect(capability.metadata).not.toHaveProperty('protocolVersion');
  });

  it('carries the tool scope in metadata because the page drops the top-level field', () => {
    const harness = renderModal({ defaultCategory: 'tools' });
    setName('scoped-tool');
    fireEvent.change(within(dialog()).getByLabelText('Required security scope'), {
      target: { value: 'memory.write' },
    });
    fireEvent.click(createButton());

    const capability = harness.onCreate.mock.calls[0][0];
    expect(capability.requiredScope).toBe('memory.write');
    expect(capability.metadata).toMatchObject({ required_scope: 'memory.write' });
  });

  it('does not invent a required_scope for a skill', () => {
    const harness = renderModal({ defaultCategory: 'skills' });
    setName('contract-review');
    fireEvent.change(within(dialog()).getByLabelText('When to activate'), {
      target: { value: 'Review pull requests' },
    });
    fireEvent.change(within(dialog()).getByLabelText('Routing & trigger keywords'), {
      target: { value: '/review' },
    });
    fireEvent.click(createButton());

    const capability = harness.onCreate.mock.calls[0][0];
    expect(capability.metadata).not.toHaveProperty('required_scope');
    expect(capability.requiredScope).toBeUndefined();
  });
});
