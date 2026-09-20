# 01 — Vaeloom Design Principles

**Status:** APPROVED | **Audience:** Design, Engineering, Product

---

## 1. Fundamental Philosophy

Vaeloom is an enterprise workspace for personal intelligence. The visual and
interaction design embodies:

> **Calm, intelligent, trustworthy enterprise workspace — not an AI dashboard
> overloaded with cards, gradients, and decorative AI visuals.**

---

## 2. Core Principles

### 1. Calm & Disciplined

- Controlled whitespace, quiet surfaces, and subtle borders over heavy drop
  shadows.
- Dense where necessary: enterprise tables and operational traces can be
  information-rich without being cluttered.
- No random gradients, excessive glassmorphism, or constant ambient motion.

### 2. Observable Intelligence

- Intelligence is made visible through **clarity of action, not decorative
  sparkle icons**.
- Every AI output answers:
  1. _What happened?_
  2. _Why?_
  3. _What evidence supports it?_
  4. _What confidence exists?_
  5. _What can the user do?_
  6. _Is this action reversible?_

### 3. Evidence & Provenance First

- Claims are always anchored to memory records:
  ```text
  Claim → Evidence → Source → Timestamp → Confidence → Memory Record
  ```
- No fake precision: avoid pseudo-scientific percentages (e.g. "87% fit").
  Display verified evidence counts and match dimensions instead.

### 4. Explicit Autonomy & Permissions

- Agents operate under strict permission boundaries (Read, Draft, Write,
  Execute).
- Consequential actions require explicit human approval with payload diffs and
  clear reversibility indicators.

### 5. Accessibility by Default (WCAG 2.2 AA)

- Accessibility is not a QA afterthought; it is built into tokens, layout
  primitives, and component state contracts.
- Minimum 4.5:1 contrast ratio for normal text, 3:1 for large text and UI
  components.
- Visible focus rings on all interactive elements:
  `focus-visible:ring-2 focus-visible:ring-accent`.
- Full keyboard operability and complete screen reader semantics (ARIA
  landmarks, labels, live regions).
