# 08. Border Radius Scale

## 1. Geometric Consistency

Vaeloom uses controlled, subtle radii. Overly rounded "pill" surfaces are
restricted to badges, tags, and small status pills. Interactive inputs and
containers use disciplined geometric curvature.

| Token         | Value (px) | Application                                     |
| :------------ | :--------- | :---------------------------------------------- |
| `radius-none` | 0px        | Full-bleed elements, dividers, table headers    |
| `radius-xs`   | 2px        | Code snippets, status dots                      |
| `radius-sm`   | 4px        | Small badges, compact buttons, checkmarks       |
| `radius-md`   | 6px        | Standard buttons, input fields, select triggers |
| `radius-lg`   | 8px        | Standard cards, dialog headers, tabs            |
| `radius-xl`   | 12px       | Modals, large panels, floating toolbars         |
| `radius-2xl`  | 16px       | Onboarding cards, hero banners                  |
| `radius-full` | 9999px     | Avatars, pill badges, toggle switches           |

## 2. Nested Corner Rule

When nesting rounded containers, the inner container's radius must follow the
formula: $$R_{inner} = \max(0, R_{outer} - \text{padding})$$ This eliminates
visual dissonance and awkward gaps between concentric boundaries.
