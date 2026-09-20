import React from 'react';
import {
  Tabs as UiKitTabs,
  TabPanel as UiKitTabPanel,
  TabItem,
  TabsProps as UiKitTabsProps,
  TabPanelProps as UiKitTabPanelProps,
} from '@vaeloom/ui-kit';

export interface Tab {
  id: string;
  label: string;
  disabled?: boolean;
}

export interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onChange: (tabId: string) => void;
  className?: string;
}

export function Tabs({ tabs, activeTab, onChange, className = '' }: TabsProps) {
  return (
    <UiKitTabs
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={onChange}
      variant="underline"
      className={className}
    />
  );
}

export interface TabPanelProps {
  id: string;
  activeTab: string;
  children: React.ReactNode;
  className?: string;
}

export function TabPanel(props: TabPanelProps) {
  return <UiKitTabPanel {...props} />;
}
