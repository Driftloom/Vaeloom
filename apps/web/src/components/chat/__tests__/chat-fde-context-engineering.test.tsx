import '@testing-library/jest-dom';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

import { ChatModelSelector } from '../ChatModelSelector';
import { ContextWindowGauge } from '../ContextWindowGauge';
import { GroundingDossierModal } from '../GroundingDossierModal';
import { ParallelAgentStreamCard } from '../ParallelAgentStreamCard';
import type { ModelOption, ParallelAgentOutput, GroundingDossier } from '../types';

// Mock react-markdown and remark-gfm
jest.mock('react-markdown', () => {
  return function MockReactMarkdown({ children }: { children: React.ReactNode }) {
    return <div data-testid="markdown">{children}</div>;
  };
});
jest.mock('remark-gfm', () => () => {});

const FDE_TEST_MODELS: ModelOption[] = [
  {
    id: 'gemma4:31b',
    name: 'Ollama Cloud Gemma 4 31B',
    provider: 'ollama',
    tier: 'balanced',
    contextWindow: 32768,
    maxTokens: 32768,
    inputCostPer1m: 0.0,
    outputCostPer1m: 0.0,
    description: 'Enterprise generative synthesis with XML context fencing & citation grounding.',
    isDefault: true,
    isPlatformManaged: true,
    status: 'ready',
    cognitiveRole: 'system2',
    badge: '🟢 Platform Active (System 2)',
  },
  {
    id: 'typesafe-ai/jev',
    name: 'TypeSafe AI Jev',
    provider: 'typesafe',
    tier: 'fast',
    contextWindow: 8192,
    maxTokens: 8192,
    inputCostPer1m: 0.0,
    outputCostPer1m: 0.0,
    description: 'Sub-50ms deterministic action routing & semantic similarity scoring.',
    isPlatformManaged: true,
    status: 'ready',
    cognitiveRole: 'system1',
    badge: '⚡ System 1 Highway (<50ms)',
  },
  {
    id: 'openai/gpt-oss-120b',
    name: 'Groq GPT-OSS 120B',
    provider: 'groq',
    tier: 'fast',
    contextWindow: 131072,
    maxTokens: 131072,
    inputCostPer1m: 0.15,
    outputCostPer1m: 0.6,
    description: 'Ultra-low-latency LPU inference for high-speed agentic execution.',
    isPlatformManaged: true,
    status: 'ready',
    cognitiveRole: 'system2',
    badge: '🟢 Platform Active',
  },
  {
    id: 'gpt-4o',
    name: 'OpenAI GPT-4o',
    provider: 'openai',
    tier: 'powerful',
    contextWindow: 128000,
    maxTokens: 128000,
    inputCostPer1m: 2.5,
    outputCostPer1m: 10.0,
    description: 'Requires your OpenAI API Key. Configure in Workspace Settings > BYOK.',
    isPlatformManaged: false,
    status: 'byok_required',
    cognitiveRole: 'byok',
    badge: '🔑 BYOK Required',
  },
  {
    id: 'claude-3-5-sonnet-20241022',
    name: 'Claude 3.5 Sonnet',
    provider: 'anthropic',
    tier: 'powerful',
    contextWindow: 200000,
    maxTokens: 200000,
    inputCostPer1m: 3.0,
    outputCostPer1m: 15.0,
    description: 'Requires your Anthropic API Key. Configure in Workspace Settings > BYOK.',
    isPlatformManaged: false,
    status: 'byok_required',
    cognitiveRole: 'byok',
    badge: '🔑 BYOK Required',
  },
];

describe('FDE Context Engineering & Foundation Model Matrix UI Suite', () => {
  // ── 1. ChatModelSelector: Honest Multi-Model Tier Architecture ───────────
  describe('ChatModelSelector', () => {
    it('renders platform-managed default model gemma4:31b with System 2 badge', () => {
      render(
        <ChatModelSelector
          selectedModel="gemma4:31b"
          onSelectModel={jest.fn()}
          temperature={0.7}
          onTemperatureChange={jest.fn()}
          availableModels={FDE_TEST_MODELS}
        />,
      );

      // Verify trigger button shows Gemma 4
      const trigger = screen.getByTestId('chat-model-selector-trigger');
      expect(trigger).toBeInTheDocument();
      expect(trigger).toHaveTextContent(/gemma 4 31b/i);

      // Open selector popover
      fireEvent.click(trigger);

      // Verify Platform Active section contains Gemma 4 and TypeSafe Jev
      expect(screen.getByTestId('model-option-gemma4:31b')).toBeInTheDocument();
      expect(screen.getByText(/TypeSafe AI Jev/i)).toBeInTheDocument();

      // Verify BYOK section is rendered and contains unprovisioned models
      expect(screen.getByText(/Bring Your Own Key \(BYOK\)/i)).toBeInTheDocument();
      expect(screen.getByText(/OpenAI GPT-4o/i)).toBeInTheDocument();
      expect(screen.getByText(/Claude 3.5 Sonnet/i)).toBeInTheDocument();
    });

    it('handles model selection and temperature adjustment', () => {
      const handleSelectModel = jest.fn();
      const handleTempChange = jest.fn();

      render(
        <ChatModelSelector
          selectedModel="gemma4:31b"
          onSelectModel={handleSelectModel}
          temperature={0.7}
          onTemperatureChange={handleTempChange}
          availableModels={FDE_TEST_MODELS}
        />,
      );

      fireEvent.click(screen.getByTestId('chat-model-selector-trigger'));

      // Click on Groq GPT-OSS
      const groqOption = screen.getByTestId('model-option-openai/gpt-oss-120b');
      fireEvent.click(groqOption);
      expect(handleSelectModel).toHaveBeenCalledWith('openai/gpt-oss-120b');

      // Re-open for temperature slider
      fireEvent.click(screen.getByTestId('chat-model-selector-trigger'));

      const tempSlider = screen.getByRole('slider');
      fireEvent.change(tempSlider, { target: { value: '0.2' } });
      expect(handleTempChange).toHaveBeenCalledWith(0.2);

      // Click preset button
      const creativeBtn = screen.getByRole('button', { name: /creative \(0\.9\)/i });
      fireEvent.click(creativeBtn);
      expect(handleTempChange).toHaveBeenCalledWith(0.9);
    });
  });

  // ── 2. ContextWindowGauge: Token Budget Ceiling & Compaction Trigger ──────
  describe('ContextWindowGauge', () => {
    it('displays normal capacity when token usage is under 60%', () => {
      const { container } = render(
        <ContextWindowGauge totalTokens={4500} maxTokens={32768} modelId="gemma4:31b" />,
      );

      // 4,500 / 32,768 = 14%
      expect(
        container.querySelector('.text-emerald-400') || container.querySelector('.bg-emerald-500'),
      ).toBeTruthy();
      expect(screen.getByText(/14%/i)).toBeInTheDocument();
      expect(screen.getByText(/4\.5k/i)).toBeInTheDocument();
      expect(screen.getByText(/\/32\.8k/i)).toBeInTheDocument();
    });

    it('displays warning state and compaction trigger when token usage exceeds 75%', () => {
      const handleCompact = jest.fn();

      render(
        <ContextWindowGauge
          totalTokens={27000}
          maxTokens={32768}
          modelId="gemma4:31b"
          onCompact={handleCompact}
        />,
      );

      // 27,000 / 32,768 = ~82%
      expect(screen.getByText(/82%/i)).toBeInTheDocument();

      const compactBtn = screen.getByRole('button', { name: /compact conversation history/i });
      expect(compactBtn).toBeInTheDocument();

      fireEvent.click(compactBtn);
      expect(handleCompact).toHaveBeenCalledTimes(1);
    });

    it('renders spinning loader state when isCompacting is true', () => {
      render(
        <ContextWindowGauge
          totalTokens={28000}
          maxTokens={32768}
          modelId="gemma4:31b"
          onCompact={jest.fn()}
          isCompacting={true}
        />,
      );

      const compactBtn = screen.getByRole('button', { name: /compact conversation history/i });
      expect(compactBtn).toBeDisabled();
      expect(compactBtn).toHaveTextContent(/compacting…/i);
    });
  });

  // ── 3. GroundingDossierModal: Provenance & Cognitive Precedence ─────────
  describe('GroundingDossierModal', () => {
    const mockDossier: GroundingDossier = {
      contextTokenEstimate: 840,
      memories: [
        {
          id: 'doc-1',
          title: 'Staff_Engineer_Resume.pdf',
          snippet: 'Led migration of distributed consensus cluster processing 450k req/s.',
          source: 'vault',
          score: 0.95,
          updatedAt: '2026-10-06T12:00:00Z',
        },
        {
          id: 'mem-1',
          title: 'Preferred Target Salary',
          snippet: 'Prefers remote Staff / Principal roles targeting \$260k+ TC.',
          source: 'memory',
          score: 0.82,
          updatedAt: '2026-10-05T09:00:00Z',
        },
      ],
    };

    it('renders modal dialog with authoritative document before dynamic memory', () => {
      const handleClose = jest.fn();

      render(<GroundingDossierModal isOpen={true} onClose={handleClose} dossier={mockDossier} />);

      const dialog = screen.getByRole('dialog', { name: /grounding provenance dossier/i });
      expect(dialog).toBeInTheDocument();

      // Check Zero-Trust Precedence directive banner
      expect(
        screen.getByText(/Zero-Trust Precedence: Active Vault Docs > Dynamic Memories/i),
      ).toBeInTheDocument();

      // Check Authoritative Vault Document item
      expect(screen.getByText('Vault Document')).toBeInTheDocument();
      expect(screen.getByText('Staff_Engineer_Resume.pdf')).toBeInTheDocument();
      expect(screen.getByText(/Led migration of distributed consensus/i)).toBeInTheDocument();
      expect(screen.getByText(/95% match/i)).toBeInTheDocument();

      // Check Dynamic Memory item
      expect(screen.getByText('Memory Vault')).toBeInTheDocument();
      expect(screen.getByText('Preferred Target Salary')).toBeInTheDocument();
      expect(screen.getByText(/82% match/i)).toBeInTheDocument();

      // Verify estimated tokens
      expect(screen.getByText(/~840 tokens/i)).toBeInTheDocument();
    });

    it('dismisses modal on close button click and on Escape key press', () => {
      const handleClose = jest.fn();

      render(<GroundingDossierModal isOpen={true} onClose={handleClose} dossier={mockDossier} />);

      // Close via header button
      const closeBtn = screen.getByRole('button', { name: /close dossier dialog/i });
      fireEvent.click(closeBtn);
      expect(handleClose).toHaveBeenCalledTimes(1);

      // Close via Escape key
      fireEvent.keyDown(window, { key: 'Escape' });
      expect(handleClose).toHaveBeenCalledTimes(2);
    });

    it('returns null when isOpen is false', () => {
      const { container } = render(
        <GroundingDossierModal isOpen={false} onClose={jest.fn()} dossier={mockDossier} />,
      );

      expect(container.firstChild).toBeNull();
    });
  });

  // ── 4. ParallelAgentStreamCard: Specialist Handoff ────────────────────────
  describe('ParallelAgentStreamCard', () => {
    const mockParallelOutputs: Record<string, ParallelAgentOutput> = {
      ats: {
        agentName: 'ats',
        tokens:
          'ATS Compatibility Score: 94/100. Keywords detected: distributed systems, raft, grpc.',
        status: 'completed',
        latencyMs: 340,
      },
    };

    it('renders specialist output and invokes onSelectAgent on handoff click', () => {
      const handleSelectAgent = jest.fn();

      render(
        <ParallelAgentStreamCard
          parallelOutputs={mockParallelOutputs}
          onSelectAgent={handleSelectAgent}
        />,
      );

      expect(screen.getAllByText('ATS Auditor').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Score & Keywords')).toBeInTheDocument();
      expect(screen.getByText('✓ Done')).toBeInTheDocument();

      const handoffBtn = screen.getByRole('button', { name: /continue with @ats/i });
      expect(handoffBtn).toBeInTheDocument();

      fireEvent.click(handoffBtn);
      expect(handleSelectAgent).toHaveBeenCalledWith('ats');
    });
  });
});
