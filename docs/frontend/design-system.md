# Vaeloom Enterprise Design System

**Governing Package**: `@vaeloom/ui-kit`  
**Architecture**: 3-Layer Design Token Hierarchy (Primitive -> Semantic ->
Component)  
**Supported Themes**: Dark (Default), Light, High-Contrast  
**Grid & Breakpoints**: Fluid 8pt / 4pt sub-grid system

---

## 1. 3-Layer Design Token Architecture

The Vaeloom design system strictly decouples raw values from semantic usage to
guarantee deterministic theming without CSS cascade conflicts.

```mermaid
flowchart TD
    subgraph Layer 1: Primitive Tokens
        P1["Color Scales (Slate, Indigo, Violet, Emerald, Amber, Rose)"]
        P2["Spacing Scale (4px, 8px, 12px, 16px, 24px, 32px...)"]
        P3["Typography Scale (font-sans, font-mono, font-display, sizes)"]
    end

    subgraph Layer 2: Semantic Tokens
        S1["Backgrounds (bg-background, bg-surface, bg-surface-100, bg-surface-200)"]
        S2["Text & Hierarchy (text-text, text-text-secondary, text-text-muted)"]
        S3["Borders (border-subtle, border-default, border-strong)"]
        S4["Actions & Status (action, accent, success, warning, error, info)"]
    end

    subgraph Layer 3: Component Tokens
        C1["Button (btn-primary, btn-outline, btn-danger)"]
        C2["Card (card-surface, card-hover, card-border)"]
        C3["Badge & StatusDot (badge-success, badge-warning, badge-error)"]
        C4["Input & FormField (input-bg, input-border, input-focus)"]
    end

    Layer 1 --> Layer 2 --> Layer 3
```

---

## 2. Multi-Theme Token Mapping

Vaeloom CSS variables are defined at the root and overridden via class selectors
on the `<html>` or `<body>` elements:

- Dark (Default): `:root`, `.dark`
- Light: `.light`
- High-Contrast: `.high-contrast`

| Semantic Token     | Dark Theme (Default)        | Light Theme                | High-Contrast Theme              |
| ------------------ | --------------------------- | -------------------------- | -------------------------------- |
| `--background`     | `#090d16` (Deep Obsidian)   | `#f8fafc` (Cool Off-White) | `#000000` (Pure Black)           |
| `--surface`        | `#0f172a` (Slate 900)       | `#ffffff` (Pure White)     | `#0a0a0a` (Solid Dark)           |
| `--surface-100`    | `#1e293b` (Slate 800)       | `#f1f5f9` (Slate 100)      | `#141414` (Bordered Dark)        |
| `--surface-200`    | `#334155` (Slate 700)       | `#e2e8f0` (Slate 200)      | `#1f1f1f`                        |
| `--text`           | `#f8fafc` (Slate 50)        | `#0f172a` (Slate 900)      | `#ffffff` (100% White)           |
| `--text-secondary` | `#cbd5e1` (Slate 300)       | `#475569` (Slate 600)      | `#e5e5e5`                        |
| `--text-muted`     | `#94a3b8` (Slate 400)       | `#64748b` (Slate 500)      | `#a3a3a3`                        |
| `--border-subtle`  | `rgba(255, 255, 255, 0.08)` | `rgba(0, 0, 0, 0.08)`      | `#ffffff` (Solid 1px)            |
| `--border-strong`  | `rgba(255, 255, 255, 0.2)`  | `rgba(0, 0, 0, 0.2)`       | `#ffffff` (Solid 2px)            |
| `--action`         | `#3b82f6` (Primary Blue)    | `#2563eb` (Royal Blue)     | `#00a2ff` (High Lum Blue)        |
| `--accent`         | `#8b5cf6` (Electric Violet) | `#7c3aed` (Deep Violet)    | `#ffff00` (High Contrast Yellow) |
| `--success`        | `#10b981` (Emerald 500)     | `#059669` (Emerald 600)    | `#00ff66` (Neon Green)           |
| `--warning`        | `#f59e0b` (Amber 500)       | `#d97706` (Amber 600)      | `#ffcc00` (Bright Amber)         |
| `--error`          | `#ef4444` (Rose 500)        | `#dc2626` (Rose 600)       | `#ff3333` (Pure Red)             |

---

## 3. Typography Hierarchy

| Style Role                 | Font Family                       | Size / Line Height     | Tracking            | Usage                                              |
| -------------------------- | --------------------------------- | ---------------------- | ------------------- | -------------------------------------------------- |
| **Display / Hero**         | `font-display` (Cal Sans / Inter) | 32px - 48px / 1.15     | `-0.025em`          | Marketing headlines, top-level dashboard hero.     |
| **Page Title (H1)**        | `font-sans` (Inter)               | 24px / 32px (1.5rem)   | `-0.02em`           | Main page titles across workspace views.           |
| **Section Header (H2)**    | `font-sans` (Inter)               | 18px / 24px (1.125rem) | `-0.01em`           | Panel and card group titles.                       |
| **Component Title (H3)**   | `font-sans` (Inter)               | 14px / 20px (0.875rem) | `normal`            | Card headers, modal titles, table headings.        |
| **Body (Default)**         | `font-sans` (Inter)               | 14px / 20px (0.875rem) | `normal`            | Primary reading text and inputs.                   |
| **Body (Compact / Small)** | `font-sans` (Inter)               | 12px / 16px (0.75rem)  | `normal`            | Descriptions, metadata, table cells, buttons.      |
| **Caption / Micro (2xs)**  | `font-sans` (Inter)               | 10px / 14px (0.625rem) | `+0.05em` uppercase | Status badges, timestamps, tags, uppercase labels. |
| **Code / Telemetry**       | `font-mono` (JetBrains Mono)      | 11px - 13px            | `normal`            | IDs, tokens, JSON schemas, DAG durations.          |

---

## 4. Spacing, Elevation & Layout Grid

- **Base Unit**: 4px micro-grid, 8px layout rhythm (`space-1` = 4px, `space-2` =
  8px, `space-3` = 12px, `space-4` = 16px, `space-6` = 24px).
- **Responsive Breakpoints**:
  - `sm`: 640px (Mobile landscape / small tablets)
  - `md`: 768px (Tablets / collapsed sidebar threshold)
  - `lg`: 1024px (Laptops / multi-column master-detail layouts)
  - `xl`: 1280px (Standard desktop dashboards)
  - `2xl`: 1536px (Ultra-wide displays)
- **Container Max Width**:
  - Main Workspace Views: `max-w-6xl` to `max-w-7xl` centered with horizontal
    padding (`px-4 sm:px-6`).
  - Forms / Settings / Help: `max-w-5xl`.
  - Overlays / Modals: `max-w-md` (confirmation), `max-w-lg` (forms),
    `max-w-2xl` (large editors).
