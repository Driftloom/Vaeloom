'use client';

import React, { useRef } from 'react';

export interface TabItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  badge?: string | number;
  disabled?: boolean;
}

export interface TabsProps {
  tabs: TabItem[];
  activeTab: string;
  onTabChange?: (id: string) => void;
  onChange?: (id: string) => void;
  variant?: 'default' | 'pills' | 'underline';
  size?: 'sm' | 'md';
  className?: string;
  ariaLabel?: string;
}

export const Tabs: React.FC<TabsProps> = ({
  tabs,
  activeTab,
  onTabChange,
  onChange,
  variant = 'default',
  size = 'md',
  className = '',
  ariaLabel = 'Navigation Tabs',
}) => {
  const tabListRef = useRef<HTMLDivElement>(null);
  const handleTabChange = onTabChange || onChange || (() => {});

  const handleKeyDown = (e: React.KeyboardEvent, currentIndex: number) => {
    const enabledTabs = tabs.filter((t) => !t.disabled);
    const enabledCurrentIndex = enabledTabs.findIndex((t) => t.id === tabs[currentIndex]?.id);

    let nextIndex = -1;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      nextIndex = (enabledCurrentIndex + 1) % enabledTabs.length;
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      nextIndex = (enabledCurrentIndex - 1 + enabledTabs.length) % enabledTabs.length;
    } else if (e.key === 'Home') {
      nextIndex = 0;
    } else if (e.key === 'End') {
      nextIndex = enabledTabs.length - 1;
    }

    if (nextIndex >= 0 && enabledTabs[nextIndex]) {
      e.preventDefault();
      handleTabChange(enabledTabs[nextIndex]!.id);
      const nextButton = tabListRef.current?.querySelector<HTMLButtonElement>(
        `[data-tab-id="${enabledTabs[nextIndex]!.id}"]`,
      );
      nextButton?.focus();
    }
  };

  const sizeClasses = {
    sm: 'text-xs px-2.5 py-1.5 gap-1.5',
    md: 'text-sm px-3.5 py-2 gap-2',
  }[size];

  const getVariantClasses = (isActive: boolean, isDisabled?: boolean) => {
    if (isDisabled) {
      return 'opacity-40 cursor-not-allowed text-text-muted';
    }

    if (variant === 'pills') {
      return isActive
        ? 'bg-action text-action-fg font-medium shadow-sm'
        : 'text-text-muted hover:text-text hover:bg-surface-hover';
    }

    if (variant === 'underline') {
      return isActive
        ? 'text-action border-b-2 border-action font-semibold'
        : 'text-text-muted hover:text-text border-b-2 border-transparent hover:border-border';
    }

    // default variant
    return isActive
      ? 'bg-surface-elevated text-text font-medium border border-border/80 shadow-card'
      : 'text-text-muted hover:text-text hover:bg-surface-hover';
  };

  const containerClasses = {
    default: 'bg-surface p-1 rounded-lg border border-border inline-flex items-center gap-1',
    pills: 'bg-surface p-1 rounded-lg border border-border inline-flex items-center gap-1',
    underline: 'flex items-center border-b border-border gap-2 w-full',
  }[variant];

  return (
    <div
      ref={tabListRef}
      role="tablist"
      aria-label={ariaLabel}
      className={`${containerClasses} ${className}`}
    >
      {tabs.map((tab, idx) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            role="tab"
            type="button"
            data-tab-id={tab.id}
            id={`tab-${tab.id}`}
            aria-selected={isActive}
            aria-controls={`tabpanel-${tab.id}`}
            tabIndex={isActive ? 0 : -1}
            disabled={tab.disabled}
            onClick={() => !tab.disabled && handleTabChange(tab.id)}
            onKeyDown={(e) => handleKeyDown(e, idx)}
            className={`inline-flex items-center justify-center rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-1 focus:ring-offset-background ${sizeClasses} ${getVariantClasses(isActive, tab.disabled)}`}
          >
            {tab.icon && <span className="shrink-0">{tab.icon}</span>}
            <span>{tab.label}</span>
            {tab.badge !== undefined && (
              <span
                className={`ml-1.5 px-1.5 py-0.5 text-xs font-mono rounded-full ${
                  isActive ? 'bg-background/20 text-current' : 'bg-surface-200 text-text-secondary'
                }`}
              >
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};

export interface TabPanelProps {
  id: string;
  activeTab: string;
  children: React.ReactNode;
  className?: string;
}

export const TabPanel: React.FC<TabPanelProps> = ({ id, activeTab, children, className = '' }) => {
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
};
