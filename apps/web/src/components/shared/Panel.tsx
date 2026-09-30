import React from 'react';
import { Panel as UiKitPanel, type PanelProps as UiKitPanelProps } from '@vaeloom/ui-kit';

export type PanelProps = UiKitPanelProps;

/**
 * Panel — canonical section wrapper used across Profile and Settings pages.
 * Re-exports the unified @vaeloom/ui-kit Panel with header, footer, padding, and variant support.
 */
export const Panel = UiKitPanel;
