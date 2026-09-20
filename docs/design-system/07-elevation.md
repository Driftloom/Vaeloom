# 07. Elevation & Shadows

## 1. Elevation Philosophy

In dark mode, traditional drop shadows are nearly invisible. Vaeloom establishes
elevation through a dual mechanism:

1. **Luminance Stepping**: Higher elevated surfaces use slightly lighter
   background surface tokens:
   - Level 0 (Canvas): `#08080a`
   - Level 1 (Card / Panel): `#111114`
   - Level 2 (Popover / Dropdown): `#18181c`
   - Level 3 (Modal / Dialog): `#222228`
2. **Subtle Border Highlights**: Elevated surfaces feature a 1px border
   highlight (`color.border.subtle` or `color.border.elevated`) to delineate
   depth.

## 2. Shadow Tokens

| Token            | Shadow CSS                                                                | Purpose                      |
| :--------------- | :------------------------------------------------------------------------ | :--------------------------- |
| `elevation-none` | `none`                                                                    | Flat inline components       |
| `elevation-sm`   | `0 1px 2px 0 rgba(0, 0, 0, 0.25)`                                         | Subtle buttons, input fields |
| `elevation-md`   | `0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -2px rgba(0, 0, 0, 0.3)`    | Cards, hover states          |
| `elevation-lg`   | `0 10px 15px -3px rgba(0, 0, 0, 0.4), 0 4px 6px -4px rgba(0, 0, 0, 0.4)`  | Drawers, popovers, dropdowns |
| `elevation-xl`   | `0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)` | Modals, critical dialogs     |
