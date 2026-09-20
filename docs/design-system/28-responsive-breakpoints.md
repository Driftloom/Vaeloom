# 28. Responsive Breakpoints & Multi-Device

## 1. Breakpoint Grid

Vaeloom responsive design targets standard enterprise display environments:

| Breakpoint | Minimum Width | Typical Target                         | Layout Adjustments                                  |
| :--------- | :------------ | :------------------------------------- | :-------------------------------------------------- |
| `sm`       | 640px         | Mobile landscape / Small tablets       | Sidebar becomes overlay drawer; single column forms |
| `md`       | 768px         | Tablets / Small laptops                | 2-column grids; collapsible sidebar rail            |
| `lg`       | 1024px        | Laptops / Standard desktop             | 3-column grids; full expanded sidebar default       |
| `xl`       | 1280px        | Enterprise Desktop / External displays | 4-column metrics; dual-pane workbenches             |
| `2xl`      | 1536px        | Widescreen / Ultra-wide                | Max content container constraints (`max-w-7xl`)     |

## 2. Touch & Pointer Targets

- Minimum touch target size on touch devices: `44px x 44px`.
- Desktop pointer controls may use compact height (`28px` - `36px`) when
  mouse/trackpad pointer is detected (`@media (pointer: fine)`).
