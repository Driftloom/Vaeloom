import * as uiKit from '../index';

describe('Vaeloom Canonical UI Components Suite', () => {
  it('should export all essential design system components', () => {
    // Core
    expect(uiKit.Button).toBeDefined();
    expect(uiKit.Card).toBeDefined();
    expect(uiKit.Badge).toBeDefined();
    expect(uiKit.Modal).toBeDefined();
    expect(uiKit.Tooltip).toBeDefined();
    expect(uiKit.DataTable).toBeDefined();

    // Navigation & Data
    expect(uiKit.Breadcrumb).toBeDefined();
    expect(uiKit.Pagination).toBeDefined();
    expect(uiKit.StatCard).toBeDefined();
    expect(uiKit.FilterBar).toBeDefined();

    // Forms
    expect(uiKit.FormField).toBeDefined();
    expect(uiKit.SearchField).toBeDefined();
    expect(uiKit.Input).toBeDefined();
    expect(uiKit.Switch).toBeDefined();

    // Feedback
    expect(uiKit.ErrorState).toBeDefined();
    expect(uiKit.EmptyState).toBeDefined();
    expect(uiKit.Spinner).toBeDefined();
    expect(uiKit.Skeleton).toBeDefined();

    // AI & Memory
    expect(uiKit.AIMessage).toBeDefined();
    expect(uiKit.ChatComposer).toBeDefined();
    expect(uiKit.AIInsight).toBeDefined();
    expect(uiKit.AgentStatus).toBeDefined();
    expect(uiKit.AgentProposal).toBeDefined();
    expect(uiKit.AgentRun).toBeDefined();
    expect(uiKit.ConfidenceIndicator).toBeDefined();
    expect(uiKit.SourceCitation).toBeDefined();
  });
});
