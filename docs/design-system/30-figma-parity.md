# 30. Figma Parity & Component Mapping

## 1. Parity Contract

Every component in `@vaeloom/ui-kit` corresponds 1:1 with a component in the
Vaeloom Figma Design System:

- **Naming**: The Figma component set name matches the React component name
  (`Button`, `DataTable`, `MemoryCard`).
- **Variant Properties**: Component variants in Figma (`variant`, `size`,
  `state`) map directly to TypeScript prop enums.
- **Token Synchronization**: Figma Variables use the identical naming structure
  (`color/bg/canvas`, `space/4`, `radius/md`) exported by
  `@vaeloom/ui-kit/tokens`.

## 2. Component Mapping Table

| Figma Component      | Code Component (`@vaeloom/ui-kit`) | Props Contract                                                    |
| :------------------- | :--------------------------------- | :---------------------------------------------------------------- |
| `Action/Button`      | `<Button>`                         | `variant`, `size`, `disabled`, `loading`, `iconLeft`, `iconRight` |
| `Action/IconButton`  | `<IconButton>`                     | `variant`, `size`, `icon`, `aria-label`                           |
| `Form/Input`         | `<Input>`                          | `label`, `error`, `helperText`, `disabled`, `required`            |
| `Container/Card`     | `<Card>`                           | `variant`, `padding`, `interactive`                               |
| `AI/AgentStatus`     | `<AgentStatus>`                    | `status`, `duration`, `cost`                                      |
| `AI/AgentProposal`   | `<AgentProposal>`                  | `title`, `description`, `scope`, `onApprove`, `onReject`          |
| `Memory/MemoryCard`  | `<MemoryCard>`                     | `content`, `confidence`, `source`, `timestamp`                    |
| `Navigation/Sidebar` | `<Sidebar>`                        | `currentPath`, `workspaceId`, `isCollapsed`                       |
