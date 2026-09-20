# 06. Layout & Grid System

## 1. Grid Architecture

Vaeloom applications use a 12-column responsive fluid grid with fixed maximum
container widths and consistent token-based gutters.

- **Fluid Max-Widths**:
  - Narrow / Form: `max-w-xl` (576px)
  - Standard / Reading: `max-w-4xl` (896px)
  - Wide / Dashboard: `max-w-7xl` (1280px)
  - Full Bleed / Workbench: `max-w-full` (100% with padding)

## 2. Layout Primitives

To prevent ad-hoc flexbox and grid implementations, `@vaeloom/ui-kit` provides
canonical layout primitives:

- `<Box>`: Fundamental layout block accepting token props (`p`, `m`, `bg`,
  `border`).
- `<Stack>`: 1-dimensional flex container supporting `direction` (`vertical` |
  `horizontal`), `gap`, `align`, `justify`.
- `<Grid>`: 2-dimensional CSS grid container supporting `columns` (1-12), `gap`,
  `responsive`.
- `<Divider>`: Structural rule with semantic color and orientation (`horizontal`
  | `vertical`).

## 3. Structural Shell Dimensions

- **Sidebar**:
  - Expanded: `256px` (`16rem`)
  - Collapsed / Rail: `64px` (`4rem`)
- **TopNav**:
  - Height: `56px` (`3.5rem`)
- **Workbench Panel Splitters**:
  - Minimum pane width: `280px`
  - Splitter handle width: `4px`
