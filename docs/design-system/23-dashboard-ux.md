# 23. Dashboard & Overview UX

## 1. Overview Philosophy

The Vaeloom Dashboard (`/workspace/[id]`) provides a unified operational command
center for personal intelligence. It avoids decorative graphs in favor of
actionable intelligence telemetry:

- Active agent runs requiring human intervention.
- Recent memory synthesis updates.
- Connected data sources health status.
- Upcoming scheduled autonomous tasks.

## 2. Standard Grid Layout

- **Top Metric Bar**: 4 `<StatCard>` components (Total Memories, Active Agents,
  Connected Sources, Pending Approvals).
- **Main Left Panel (60%)**: Active Proposals & Immediate Approvals queue,
  followed by Recent Memory Insights.
- **Main Right Panel (40%)**: Agent Activity Feed and Connected Integrations
  Health status.
