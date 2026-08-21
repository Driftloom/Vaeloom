import React from 'react';

interface Tab {
  id: string;
  label: string;
  disabled?: boolean;
}

interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onChange: (tabId: string) => void;
  className?: string;
}

export function Tabs({ tabs, activeTab, onChange, className = '' }: TabsProps) {
  const tabRefs = React.useRef<(HTMLButtonElement | null)[]>([]);

  function handleKeyDown(e: React.KeyboardEvent, _index: number) {
    const enabledTabs = tabs.filter((t) => !t.disabled);
    if (enabledTabs.length === 0) return;
    const currentEnabledIndex = enabledTabs.findIndex((t) => t.id === activeTab);
    let nextId: string | undefined;

    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        e.preventDefault();
        nextId = enabledTabs[(currentEnabledIndex + 1) % enabledTabs.length]!.id;
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        e.preventDefault();
        nextId =
          enabledTabs[(currentEnabledIndex - 1 + enabledTabs.length) % enabledTabs.length]!.id;
        break;
      case 'Home':
        e.preventDefault();
        nextId = enabledTabs[0]!.id;
        break;
      case 'End':
        e.preventDefault();
        nextId = enabledTabs[enabledTabs.length - 1]!.id;
        break;
      default:
        return;
    }
    if (nextId) {
      onChange(nextId);
      // Focus the newly active tab after state updates
      const nextIndex = tabs.findIndex((t) => t.id === nextId);
      requestAnimationFrame(() => tabRefs.current[nextIndex]?.focus());
    }
  }

  return (
    <div className={className}>
      <div role="tablist" className="flex border-b border-border">
        {tabs.map((tab, i) => (
          <button
            key={tab.id}
            ref={(el) => {
              tabRefs.current[i] = el;
            }}
            role="tab"
            id={`tab-${tab.id}`}
            aria-selected={activeTab === tab.id}
            aria-controls={`tabpanel-${tab.id}`}
            tabIndex={activeTab === tab.id ? 0 : -1}
            disabled={tab.disabled}
            onClick={() => onChange(tab.id)}
            onKeyDown={(e) => handleKeyDown(e, i)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-background disabled:opacity-50 disabled:cursor-not-allowed ${
              activeTab === tab.id
                ? 'border-primary text-text'
                : 'border-transparent text-text-muted hover:text-text hover:border-border'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
}

interface TabPanelProps {
  id: string;
  activeTab: string;
  children: React.ReactNode;
  className?: string;
}

export function TabPanel({ id, activeTab, children, className = '' }: TabPanelProps) {
  if (activeTab !== id) return null;

  return (
    <div
      role="tabpanel"
      id={`tabpanel-${id}`}
      aria-labelledby={`tab-${id}`}
      tabIndex={0}
      className={`focus:outline-none ${className}`}
    >
      {children}
    </div>
  );
}
