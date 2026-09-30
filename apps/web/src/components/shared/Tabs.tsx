import React from 'react';
import {
  Tabs as UiKitTabs,
  TabPanel as UiKitTabPanel,
  type TabItem as UiKitTabItem,
  type TabsProps as UiKitTabsProps,
  type TabPanelProps as UiKitTabPanelProps,
} from '@vaeloom/ui-kit';

/**
 * Thin, COMPLETE pass-through to the ui-kit Tabs.
 *
 * This wrapper used to hardcode `variant="underline"` and drop `icon`, `badge`,
 * `size` and `ariaLabel`. That is not a harmless convenience layer: a wrapper
 * that silently narrows its component's API forces every caller that needs the
 * missing surface to import ui-kit directly, which is how the same tab bar
 * ended up rendering in two different visual variants across the app. Anything
 * ui-kit supports must be reachable here, or callers will route around it.
 *
 * The `default` variant is the ui-kit default, so omitting `variant` yields the
 * segmented control rather than the underline — callers that want the underline
 * ask for it explicitly.
 */

export interface Tab extends UiKitTabItem {}

export interface TabsProps extends Omit<UiKitTabsProps, 'onChange'> {
  onChange: (tabId: string) => void;
}

export function Tabs({ onChange, ...rest }: TabsProps) {
  return <UiKitTabs {...rest} onTabChange={onChange} />;
}

export interface TabPanelProps extends UiKitTabPanelProps {}

export function TabPanel(props: TabPanelProps) {
  return <UiKitTabPanel {...props} />;
}
