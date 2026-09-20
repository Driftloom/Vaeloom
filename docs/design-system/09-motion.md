# 09. Motion & Transitions

## 1. Motion Philosophy

Motion in Vaeloom communicates state changes, spatial hierarchy, and causal
feedback. It is never decorative or playful. Animations are fast, precise, and
immediately interruptible.

## 2. Timing & Easing Tokens

| Token               | Duration | Easing Curve                    | Purpose                                         |
| :------------------ | :------- | :------------------------------ | :---------------------------------------------- |
| `motion-fast`       | 100ms    | `cubic-bezier(0.4, 0, 0.2, 1)`  | Micro-interactions: button hover, toggle switch |
| `motion-normal`     | 150ms    | `cubic-bezier(0.4, 0, 0.2, 1)`  | Standard transitions: menu open, tab switch     |
| `motion-slow`       | 250ms    | `cubic-bezier(0.16, 1, 0.3, 1)` | Large surfaces: modal enter, drawer slide       |
| `motion-deliberate` | 350ms    | `cubic-bezier(0.16, 1, 0.3, 1)` | Layout transitions: panel collapse/expand       |

## 3. Reduced Motion Compliance

All animations and transitions must strictly respect
`@media (prefers-reduced-motion: reduce)`. When reduced motion is active:

- All duration tokens collapse to `0ms`.
- Opacity cross-fades replace sliding and scaling transitions.
- Infinite animations (e.g. skeleton shimmer) halt on their static neutral
  representation.
