# 31. Storybook Structure & Documentation

## 1. Storybook Hierarchy

Stories in `@vaeloom/ui-kit` are organized into logical sections:

- `Foundations/Tokens` (Color, Typography, Spacing, Elevation, Motion)
- `Layout/` (Box, Stack, Grid, Divider)
- `Actions/` (Button, IconButton, ButtonGroup)
- `Forms/` (Input, Textarea, Select, Checkbox, Radio, Switch, SearchField)
- `Data Display/` (DataTable, Badge, StatusDot, Avatar, StatCard)
- `Feedback/` (Alert, Banner, Toast, Progress, Skeleton)
- `Overlays/` (Modal, Drawer, Tooltip, Popover)
- `AI & Agents/` (AgentStatus, AgentProposal, AgentRun, ConfidenceIndicator)
- `Memory/` (MemoryCard, MemoryEntity, MemoryRelationship, MemoryEvidence)

## 2. Story Contract Requirements

Every component story must include:

1. **Default**: Canonical usage with recommended props.
2. **All Variants**: Matrix displaying all variants side-by-side.
3. **All States**: Default, Hover, Focus, Disabled, and Loading states.
4. **Theme Switcher**: Ability to toggle between Dark, Light, and High-Contrast
   themes.
5. **A11y Addon**: Zero automated accessibility violations reported by
   `@storybook/addon-a11y`.
