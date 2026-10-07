import '@testing-library/jest-dom';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

import { ChatModelSelector, type ChatModelSelectorProps } from '../ChatModelSelector';
import {
  ChatAgentSquadSelector,
  type ChatAgentSquadSelectorProps,
  SPECIALIST_AGENTS,
} from '../ChatAgentSquadSelector';
import {
  ParallelAgentStreamCard,
  type ParallelAgentStreamCardProps,
} from '../ParallelAgentStreamCard';
import { ChatMemoryDrawer, type ChatMemoryDrawerProps, type MemoryItem } from '../ChatMemoryDrawer';
import {
  ChatSubpagesNav,
  AgentSquadsView,
  ModelMatrixView,
  type ChatSubpagesNavProps,
  type AgentSquadsViewProps,
  type ModelMatrixViewProps,
} from '../ChatSubpages';
import type { ModelOption, ParallelAgentOutput } from '../types';

// Mock react-markdown and remark-gfm
jest.mock('react-markdown', () => {
  return function MockReactMarkdown({ children }: { children: React.ReactNode }) {
    return <div data-testid="markdown">{children}</div>;
  };
});
jest.mock('remark-gfm', () => () => {});

// Mock SWR for ChatMemoryDrawer
let mockSwrData: { memories?: MemoryItem[]; items?: MemoryItem[] } | undefined = undefined;
let mockSwrLoading = false;

jest.mock('swr', () => ({
  __esModule: true,
  default: jest.fn((key: string | null) => {
    if (!key) return { data: undefined, isLoading: false, error: undefined };
    return {
      data: mockSwrData,
      isLoading: mockSwrLoading,
      error: undefined,
    };
  }),
}));

const SAMPLE_MODELS: ModelOption[] = [
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'openai',
    tier: 'powerful',
    contextWindow: 128000,
    maxTokens: 128000,
    inputCostPer1m: 2.5,
    outputCostPer1m: 10.0,
    description: 'Flagship omni model with high intelligence and vision.',
    isDefault: true,
  },
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    provider: 'openai',
    tier: 'fast',
    contextWindow: 128000,
    maxTokens: 128000,
    inputCostPer1m: 0.15,
    outputCostPer1m: 0.6,
    description: 'Fast, cost-efficient small model for agile sub-tasks.',
  },
  {
    id: 'claude-3-5-sonnet-20241022',
    name: 'Claude 3.5 Sonnet',
    provider: 'anthropic',
    tier: 'balanced',
    contextWindow: 200000,
    maxTokens: 200000,
    inputCostPer1m: 3.0,
    outputCostPer1m: 15.0,
    description: 'Premier balanced reasoning model for code and analysis.',
  },
  {
    id: 'gemini-1.5-pro',
    name: 'Gemini 1.5 Pro',
    provider: 'google',
    tier: 'powerful',
    contextWindow: 2000000,
    maxTokens: 2000000,
    inputCostPer1m: 3.5,
    outputCostPer1m: 10.5,
    description: 'Ultra-long context model for deep workspace document recall.',
  },
];

describe('Chat Enterprise UI Components', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSwrData = undefined;
    mockSwrLoading = false;
  });

  // =========================================================================
  // 1. ChatModelSelector
  // =========================================================================
  describe('ChatModelSelector', () => {
    const defaultProps: ChatModelSelectorProps = {
      selectedModel: 'gpt-4o',
      onSelectModel: jest.fn(),
      availableModels: SAMPLE_MODELS,
      isLoading: false,
      temperature: 0.7,
      onTemperatureChange: jest.fn(),
    };

    it('renders active model details, tier icon, and temperature indicator', () => {
      render(<ChatModelSelector {...defaultProps} />);

      const trigger = screen.getByTestId('chat-model-selector-trigger');
      expect(trigger).toBeInTheDocument();
      expect(trigger).toHaveAttribute('aria-label', 'Select model: GPT-4o');
      expect(trigger).toHaveAttribute('aria-expanded', 'false');

      expect(screen.getByText('GPT-4o')).toBeInTheDocument();
      expect(screen.getByText('🧠')).toBeInTheDocument();
      expect(screen.getByText('T:0.7')).toBeInTheDocument();
    });

    it('opens popover dialog on trigger button click and allows closing', () => {
      render(<ChatModelSelector {...defaultProps} />);

      const trigger = screen.getByTestId('chat-model-selector-trigger');
      fireEvent.click(trigger);

      expect(trigger).toHaveAttribute('aria-expanded', 'true');
      const popover = screen.getByTestId('chat-model-selector-popover');
      expect(popover).toBeInTheDocument();
      expect(screen.getByText('Foundation Model Matrix')).toBeInTheDocument();

      // Click trigger again to close
      fireEvent.click(trigger);
      expect(screen.queryByTestId('chat-model-selector-popover')).not.toBeInTheDocument();
    });

    it('filters models when tier tabs are selected', () => {
      render(<ChatModelSelector {...defaultProps} />);

      fireEvent.click(screen.getByTestId('chat-model-selector-trigger'));

      // Initially all 4 models should be rendered
      expect(screen.getByTestId('model-option-gpt-4o')).toBeInTheDocument();
      expect(screen.getByTestId('model-option-gpt-4o-mini')).toBeInTheDocument();
      expect(screen.getByTestId('model-option-claude-3-5-sonnet-20241022')).toBeInTheDocument();
      expect(screen.getByTestId('model-option-gemini-1.5-pro')).toBeInTheDocument();

      // Click "fast" tier tab
      const fastTab = screen.getByRole('button', { name: /fast/i });
      fireEvent.click(fastTab);

      expect(screen.getByTestId('model-option-gpt-4o-mini')).toBeInTheDocument();
      expect(screen.queryByTestId('model-option-gpt-4o')).not.toBeInTheDocument();
      expect(
        screen.queryByTestId('model-option-claude-3-5-sonnet-20241022'),
      ).not.toBeInTheDocument();

      // Click "All Tiers" tab to reset filter
      fireEvent.click(screen.getByRole('button', { name: /all tiers/i }));
      expect(screen.getByTestId('model-option-gpt-4o')).toBeInTheDocument();
    });

    it('calls onSelectModel and closes popover when a model option is clicked', () => {
      const onSelectModel = jest.fn();
      render(<ChatModelSelector {...defaultProps} onSelectModel={onSelectModel} />);

      fireEvent.click(screen.getByTestId('chat-model-selector-trigger'));

      const optionClaude = screen.getByTestId('model-option-claude-3-5-sonnet-20241022');
      fireEvent.click(optionClaude);

      expect(onSelectModel).toHaveBeenCalledTimes(1);
      expect(onSelectModel).toHaveBeenCalledWith('claude-3-5-sonnet-20241022');
      expect(screen.queryByTestId('chat-model-selector-popover')).not.toBeInTheDocument();
    });

    it('handles temperature changes through slider and presets', () => {
      const onTemperatureChange = jest.fn();
      render(<ChatModelSelector {...defaultProps} onTemperatureChange={onTemperatureChange} />);

      fireEvent.click(screen.getByTestId('chat-model-selector-trigger'));

      const slider = screen.getByLabelText('Temperature slider');
      fireEvent.change(slider, { target: { value: '0.45' } });
      expect(onTemperatureChange).toHaveBeenCalledWith(0.45);

      // Preset buttons
      fireEvent.click(screen.getByRole('button', { name: 'Precise (0.2)' }));
      expect(onTemperatureChange).toHaveBeenCalledWith(0.2);

      fireEvent.click(screen.getByRole('button', { name: 'Balanced (0.7)' }));
      expect(onTemperatureChange).toHaveBeenCalledWith(0.7);

      fireEvent.click(screen.getByRole('button', { name: 'Creative (0.9)' }));
      expect(onTemperatureChange).toHaveBeenCalledWith(0.9);
    });

    it('closes popover on outside mousedown click', () => {
      render(
        <div>
          <div data-testid="outside-element">Outside</div>
          <ChatModelSelector {...defaultProps} />
        </div>,
      );

      fireEvent.click(screen.getByTestId('chat-model-selector-trigger'));
      expect(screen.getByTestId('chat-model-selector-popover')).toBeInTheDocument();

      fireEvent.mouseDown(screen.getByTestId('outside-element'));
      expect(screen.queryByTestId('chat-model-selector-popover')).not.toBeInTheDocument();
    });
  });

  // =========================================================================
  // 2. ChatAgentSquadSelector
  // =========================================================================
  describe('ChatAgentSquadSelector', () => {
    const defaultProps: ChatAgentSquadSelectorProps = {
      selectedSquad: ['resume'],
      onToggleAgent: jest.fn(),
      onSelectSquad: jest.fn(),
    };

    it('renders specialist agent squad header, descriptions, and all 5 specialist agents', () => {
      render(<ChatAgentSquadSelector {...defaultProps} />);

      expect(screen.getByText(/specialist agent squad/i)).toBeInTheDocument();

      SPECIALIST_AGENTS.forEach((agent) => {
        expect(screen.getByText(agent.name)).toBeInTheDocument();
        expect(screen.getByTestId(`squad-agent-toggle-${agent.id}`)).toBeInTheDocument();
      });
    });

    it('displays parallel execution badge only when more than one agent is selected', () => {
      const { rerender } = render(
        <ChatAgentSquadSelector {...defaultProps} selectedSquad={['resume']} />,
      );
      expect(screen.queryByText(/parallel mode/i)).not.toBeInTheDocument();

      rerender(<ChatAgentSquadSelector {...defaultProps} selectedSquad={['resume', 'ats']} />);
      expect(screen.getByText(/⚡ Parallel Mode \(2 Agents\)/i)).toBeInTheDocument();

      rerender(
        <ChatAgentSquadSelector
          {...defaultProps}
          selectedSquad={['resume', 'ats', 'job_search']}
        />,
      );
      expect(screen.getByText(/⚡ Parallel Mode \(3 Agents\)/i)).toBeInTheDocument();
    });

    it('triggers onToggleAgent when clicking individual agent cards', () => {
      const onToggleAgent = jest.fn();
      render(<ChatAgentSquadSelector {...defaultProps} onToggleAgent={onToggleAgent} />);

      const atsButton = screen.getByTestId('squad-agent-toggle-ats');
      fireEvent.click(atsButton);

      expect(onToggleAgent).toHaveBeenCalledTimes(1);
      expect(onToggleAgent).toHaveBeenCalledWith('ats');
    });

    it('activates preset squads when clicking preset buttons', () => {
      const onSelectSquad = jest.fn();
      render(<ChatAgentSquadSelector {...defaultProps} onSelectSquad={onSelectSquad} />);

      // Preset: ATS & Resume Duo
      fireEvent.click(screen.getByRole('button', { name: 'ATS & Resume Duo' }));
      expect(onSelectSquad).toHaveBeenCalledWith(['resume', 'ats']);

      // Preset: Job Hunt Blitz
      fireEvent.click(screen.getByRole('button', { name: 'Job Hunt Blitz' }));
      expect(onSelectSquad).toHaveBeenCalledWith(['job_search', 'application']);

      // Preset: Career Campaign Squad
      fireEvent.click(screen.getByRole('button', { name: 'Career Campaign Squad' }));
      expect(onSelectSquad).toHaveBeenCalledWith(['resume', 'ats', 'job_search', 'career']);

      // Preset: Single Agent (Auto)
      fireEvent.click(screen.getByRole('button', { name: 'Single Agent (Auto)' }));
      expect(onSelectSquad).toHaveBeenCalledWith([]);
    });
  });

  // =========================================================================
  // 3. ParallelAgentStreamCard
  // =========================================================================
  describe('ParallelAgentStreamCard', () => {
    const mockParallelOutputs: Record<string, ParallelAgentOutput> = {
      resume: {
        agentName: 'resume',
        status: 'streaming',
        phase: 'Tailoring Bullet Points',
        tokens: 'Refining impact statements with metric quantifiers...',
      },
      ats: {
        agentName: 'ats',
        status: 'completed',
        phase: 'Audit Complete',
        tokens: 'Identified 8 missing hard skills and 94% parseability.',
      },
    };

    it('returns null when parallelOutputs is empty', () => {
      const { container } = render(<ParallelAgentStreamCard parallelOutputs={{}} />);
      expect(container.firstChild).toBeNull();
    });

    it('renders specialist stream cards with phase, status, and tokens', () => {
      render(<ParallelAgentStreamCard parallelOutputs={mockParallelOutputs} isStreaming={true} />);

      expect(screen.getByTestId('parallel-agent-stream-container')).toBeInTheDocument();
      expect(screen.getByText('2 Specialists')).toBeInTheDocument();
      expect(screen.getByText(/synchronizing live outputs/i)).toBeInTheDocument();

      // Resume agent card (streaming)
      const resumeCard = screen.getByTestId('parallel-stream-card-resume');
      expect(resumeCard).toBeInTheDocument();
      expect(resumeCard).toHaveTextContent('Resume Specialist');
      expect(resumeCard).toHaveTextContent('Tailoring Bullet Points');
      expect(resumeCard).toHaveTextContent('Refining impact statements with metric quantifiers...');

      // ATS agent card (completed)
      const atsCard = screen.getByTestId('parallel-stream-card-ats');
      expect(atsCard).toBeInTheDocument();
      expect(atsCard).toHaveTextContent('ATS Auditor');
      expect(atsCard).toHaveTextContent('✓ Done');
      expect(atsCard).toHaveTextContent('Identified 8 missing hard skills and 94% parseability.');
    });

    it('renders error status badge when specialist status is error', () => {
      const errorOutputs: Record<string, ParallelAgentOutput> = {
        job_search: {
          agentName: 'job_search',
          status: 'error',
          error: 'Rate limit reached',
        },
      };

      render(<ParallelAgentStreamCard parallelOutputs={errorOutputs} />);

      const card = screen.getByTestId('parallel-stream-card-job_search');
      expect(card).toHaveTextContent('⚠ Error');
    });

    it('renders Executive Synthesis card when synthesisText is provided', () => {
      render(
        <ParallelAgentStreamCard
          parallelOutputs={mockParallelOutputs}
          synthesisText="Consensus reached: The candidate should highlight distributed systems engineering."
        />,
      );

      const synthesisCard = screen.getByTestId('parallel-synthesis-card');
      expect(synthesisCard).toBeInTheDocument();
      expect(synthesisCard).toHaveTextContent('Executive Synthesis & Cross-Agent Consensus');
      expect(synthesisCard).toHaveTextContent(
        'Consensus reached: The candidate should highlight distributed systems engineering.',
      );
    });

    it('does not render Executive Synthesis card when synthesisText is omitted', () => {
      render(<ParallelAgentStreamCard parallelOutputs={mockParallelOutputs} />);
      expect(screen.queryByTestId('parallel-synthesis-card')).not.toBeInTheDocument();
    });
  });

  // =========================================================================
  // 4. ChatMemoryDrawer
  // =========================================================================
  describe('ChatMemoryDrawer', () => {
    const mockMemories: MemoryItem[] = [
      {
        id: 'mem-1',
        title: 'VP of Engineering Target Criteria',
        content: 'Candidate seeks enterprise SaaS leadership roles in high-scale platforms.',
        type: 'criterion',
      },
      {
        id: 'mem-2',
        title: 'Core System Skills',
        content: 'Expertise in Kubernetes, Go, Python, and event-driven architecture.',
        type: 'skill',
      },
    ];

    it('returns null when isOpen is false', () => {
      const { container } = render(
        <ChatMemoryDrawer isOpen={false} onClose={jest.fn()} workspaceId="ws-123" />,
      );
      expect(container.firstChild).toBeNull();
    });

    it('renders dialog, backdrop, and memories when isOpen is true', () => {
      mockSwrData = { memories: mockMemories };
      render(<ChatMemoryDrawer isOpen={true} onClose={jest.fn()} workspaceId="ws-123" />);

      expect(screen.getByRole('dialog', { name: 'Obsidian Memory Vault' })).toBeInTheDocument();
      expect(screen.getByText('Memory & Vault Grounding')).toBeInTheDocument();
      expect(screen.getByText('VP of Engineering Target Criteria')).toBeInTheDocument();
      expect(screen.getByText('Core System Skills')).toBeInTheDocument();
    });

    it('triggers onClose when close button or backdrop is clicked', () => {
      const onClose = jest.fn();
      mockSwrData = { memories: mockMemories };
      render(<ChatMemoryDrawer isOpen={true} onClose={onClose} workspaceId="ws-123" />);

      const closeBtn = screen.getByLabelText('Close memory drawer');
      fireEvent.click(closeBtn);
      expect(onClose).toHaveBeenCalledTimes(1);

      const backdrop = screen.getByTestId('chat-memory-drawer-backdrop');
      fireEvent.click(backdrop);
      expect(onClose).toHaveBeenCalledTimes(2);
    });

    it('triggers onClose when Escape key is pressed', () => {
      const onClose = jest.fn();
      mockSwrData = { memories: mockMemories };
      render(<ChatMemoryDrawer isOpen={true} onClose={onClose} workspaceId="ws-123" />);

      fireEvent.keyDown(window, { key: 'Escape' });
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('filters memories dynamically according to search input', () => {
      mockSwrData = { memories: mockMemories };
      render(<ChatMemoryDrawer isOpen={true} onClose={jest.fn()} workspaceId="ws-123" />);

      const searchInput = screen.getByTestId('memory-search-input');
      expect(screen.getByTestId('memory-item-mem-1')).toBeInTheDocument();
      expect(screen.getByTestId('memory-item-mem-2')).toBeInTheDocument();

      // Search for 'Kubernetes'
      fireEvent.change(searchInput, { target: { value: 'Kubernetes' } });
      expect(screen.queryByTestId('memory-item-mem-1')).not.toBeInTheDocument();
      expect(screen.getByTestId('memory-item-mem-2')).toBeInTheDocument();

      // Clear search
      fireEvent.change(searchInput, { target: { value: '' } });
      expect(screen.getByTestId('memory-item-mem-1')).toBeInTheDocument();
      expect(screen.getByTestId('memory-item-mem-2')).toBeInTheDocument();
    });

    it('injects context and closes drawer when "+ Inject Context" is clicked', () => {
      const onRecallContext = jest.fn();
      const onClose = jest.fn();
      mockSwrData = { memories: mockMemories };

      render(
        <ChatMemoryDrawer
          isOpen={true}
          onClose={onClose}
          workspaceId="ws-123"
          onRecallContext={onRecallContext}
        />,
      );

      const injectButtons = screen.getAllByRole('button', { name: /\+ Inject Context/i });
      fireEvent.click(injectButtons[0]);

      expect(onRecallContext).toHaveBeenCalledTimes(1);
      expect(onRecallContext).toHaveBeenCalledWith(
        '[Memory: VP of Engineering Target Criteria]\nCandidate seeks enterprise SaaS leadership roles in high-scale platforms.',
      );
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  // =========================================================================
  // 5. ChatSubpages (ChatSubpagesNav, AgentSquadsView, ModelMatrixView)
  // =========================================================================
  describe('ChatSubpages Navigation and Views', () => {
    it('renders subpage navigation tabs and fires onTabChange', () => {
      const onTabChange = jest.fn();
      render(<ChatSubpagesNav activeTab="stream" onTabChange={onTabChange} />);

      const tabs = screen.getAllByRole('tab');
      expect(tabs).toHaveLength(4);

      expect(screen.getByTestId('subpage-tab-stream')).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByTestId('subpage-tab-squads')).toHaveAttribute('aria-selected', 'false');

      fireEvent.click(screen.getByTestId('subpage-tab-squads'));
      expect(onTabChange).toHaveBeenCalledWith('squads');

      fireEvent.click(screen.getByTestId('subpage-tab-models'));
      expect(onTabChange).toHaveBeenCalledWith('models');

      fireEvent.click(screen.getByTestId('subpage-tab-memory'));
      expect(onTabChange).toHaveBeenCalledWith('memory');
    });

    it('renders AgentSquadsView with toggle buttons and squad status', () => {
      const onToggleAgent = jest.fn();
      render(
        <AgentSquadsView
          selectedSquad={['resume']}
          onToggleAgent={onToggleAgent}
          onSelectSquad={jest.fn()}
        />,
      );

      expect(screen.getByText('Specialist Agent Squads')).toBeInTheDocument();
      expect(screen.getByText('Active in Squad')).toBeInTheDocument();

      const removeBtn = screen.getByRole('button', { name: 'Remove' });
      fireEvent.click(removeBtn);
      expect(onToggleAgent).toHaveBeenCalledWith('resume');

      const addBtn = screen.getAllByRole('button', { name: '+ Add to Squad' })[0];
      fireEvent.click(addBtn);
      expect(onToggleAgent).toHaveBeenCalled();
    });

    it('renders ModelMatrixView with pricing, tiers, and model selection', () => {
      const onSelectModel = jest.fn();
      render(
        <ModelMatrixView
          availableModels={SAMPLE_MODELS}
          selectedModel="gpt-4o"
          onSelectModel={onSelectModel}
          temperature={0.7}
          onTemperatureChange={jest.fn()}
        />,
      );

      expect(screen.getByText('Foundation Model Matrix')).toBeInTheDocument();
      expect(screen.getByText('GPT-4o')).toBeInTheDocument();
      expect(screen.getByText('Claude 3.5 Sonnet')).toBeInTheDocument();
      expect(screen.getByText('Gemini 1.5 Pro')).toBeInTheDocument();

      // Selected model shows "✓ Default Model" and "Selected"
      expect(screen.getByText('✓ Default Model')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Selected' })).toBeInTheDocument();

      // Select Claude
      const selectClaudeBtn = screen.getAllByRole('button', { name: 'Select' })[0];
      fireEvent.click(selectClaudeBtn);
      expect(onSelectModel).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // 6. Negative Controls & Boundary Invariants (Honesty Mandate)
  // =========================================================================
  describe('Negative Controls & Boundary Invariants', () => {
    it('ChatModelSelector gracefully falls back when availableModels list is empty', () => {
      render(
        <ChatModelSelector
          selectedModel="custom-llm"
          onSelectModel={jest.fn()}
          availableModels={[]}
          temperature={0.5}
          onTemperatureChange={jest.fn()}
        />,
      );

      // Should not throw or crash; displays custom-llm as active
      expect(screen.getByText('custom-llm')).toBeInTheDocument();
      expect(screen.getByText('T:0.5')).toBeInTheDocument();
    });

    it('ChatModelSelector safely renders models with missing optional metadata fields', () => {
      const minimalModel: ModelOption = {
        id: 'minimal-model',
        name: 'Minimal LLM',
        provider: 'ollama',
        tier: 'fast',
      };

      render(
        <ChatModelSelector
          selectedModel="minimal-model"
          onSelectModel={jest.fn()}
          availableModels={[minimalModel]}
          temperature={0.7}
          onTemperatureChange={jest.fn()}
        />,
      );

      fireEvent.click(screen.getByTestId('chat-model-selector-trigger'));
      expect(screen.getByTestId('model-option-minimal-model')).toBeInTheDocument();
      expect(screen.getAllByText('Minimal LLM')).toHaveLength(2);
    });

    it('ParallelAgentStreamCard safely handles unknown agent identifiers with sensible fallback', () => {
      const unknownOutputs: Record<string, ParallelAgentOutput> = {
        custom_researcher_agent: {
          agentName: 'custom_researcher_agent',
          status: 'completed',
          tokens: 'Custom agent findings',
        },
      };

      render(<ParallelAgentStreamCard parallelOutputs={unknownOutputs} />);

      const card = screen.getByTestId('parallel-stream-card-custom_researcher_agent');
      expect(card).toBeInTheDocument();
      expect(card).toHaveTextContent('custom researcher agent');
      expect(card).toHaveTextContent('Specialist Agent');
      expect(card).toHaveTextContent('Custom agent findings');
    });

    it('ChatMemoryDrawer displays truthful empty state without fabricating records on empty fetch', () => {
      mockSwrData = { memories: [] };

      render(<ChatMemoryDrawer isOpen={true} onClose={jest.fn()} workspaceId="ws-empty" />);

      expect(screen.getByText('No memories found')).toBeInTheDocument();
      expect(screen.getByText(/Pin key assistant answers/i)).toBeInTheDocument();
      expect(screen.queryByTestId(/memory-item-/)).not.toBeInTheDocument();
    });

    it('ChatMemoryDrawer displays loading state when fetching memories', () => {
      mockSwrLoading = true;
      mockSwrData = undefined;

      render(<ChatMemoryDrawer isOpen={true} onClose={jest.fn()} workspaceId="ws-loading" />);

      expect(screen.getByText('Reading memory vault nodes...')).toBeInTheDocument();
    });
  });
});
