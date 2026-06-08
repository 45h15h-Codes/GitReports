# Frontend Architecture Audit

## 1. Type Safety & Build Errors
* **Severity:** 🔴 Critical
* **Component:** `apps/web/src/lib/api.ts`, `apps/web/src/components/ProfileCard.jsx`
* **Problem:** 
  - `tsc -b` fails because `tsconfig.app.json` has `"erasableSyntaxOnly": true`, but `ApiError` uses constructor parameter properties (`public readonly status: number`) which emit JavaScript code.
  - `ProfileCard.jsx` is written in raw JavaScript, bypassing TypeScript entirely and taking untyped props.
* **Impact:** Broken build pipeline. High risk of runtime crashes due to missing type definitions in a core component.
* **Recommendation:** Remove `"erasableSyntaxOnly": true` from `tsconfig.app.json` or explicitly declare and assign properties in `ApiError`. Rename `ProfileCard.jsx` to `.tsx` and type its props using an interface.

## 2. React Anti-Patterns & Direct DOM Manipulation
* **Severity:** 🔴 High
* **Component:** `apps/web/src/pages/Dashboard.tsx`, `apps/web/src/App.tsx`
* **Problem:** Direct imperative DOM style manipulation inside React templates. Examples: 
  - `onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-overlay)'; }}`
  - Theme toggle manipulating `(e.currentTarget as HTMLButtonElement).style.borderColor`.
* **Impact:** Circumvents React's rendering lifecycle, creating brittle code that breaks during re-renders and ignores Tailwind conventions.
* **Recommendation:** Completely remove inline event handlers for styles. Use Tailwind group-hover, `hover:bg-overlay`, and `transition-all` utility classes.

## 3. Imperative Event Listeners & Memory Leaks
* **Severity:** 🔴 High
* **Component:** `apps/web/src/components/ProfileCard.jsx`
* **Problem:** Highly imperative `useEffect` attaching raw DOM listeners (`pointerenter`, `pointermove`, `deviceorientation`) to `shellRef.current`. Maintains complex physics state via raw `requestAnimationFrame`.
* **Impact:** High risk of memory leaks and zombie `requestAnimationFrame` loops if the component unmounts mid-animation or if device permission logic encounters race conditions.
* **Recommendation:** Use React's built-in synthetic events (`onPointerEnter`, `onPointerMove`). Re-implement the tilt logic using a battle-tested library.

## 4. Redundant Animation Libraries (Bundle Size)
* **Severity:** 🟡 Medium
* **Component:** `apps/web/package.json`, `apps/web/src/components/ProfileCard.jsx`
* **Problem:** The project bundles both `framer-motion` and `gsap`, yet the most complex animation (`ProfileCard.jsx`) uses a completely custom `requestAnimationFrame` physics engine.
* **Impact:** Severe bundle size bloat. Including both GSAP and Framer Motion needlessly expands the JS payload by >100KB gzipped.
* **Recommendation:** Standardize on a single animation library. Drop the custom RAF engine and `gsap`, and rebuild the `ProfileCard` 3D tilt effect using `framer-motion`'s highly optimized spring physics (`useSpring`, `useTransform`).

## 5. State Syncing Anti-Pattern (Re-renders)
* **Severity:** 🟡 Medium
* **Component:** `apps/web/src/pages/Dashboard.tsx`
* **Problem:** `selectedPeriod` state is synchronized with the fetched `months` array inside a `useEffect` dependency array.
* **Impact:** Triggers a cascading double-render: React paints the old state, the effect fires to update `selectedPeriod`, and React paints again.
* **Recommendation:** Derive the default selected period during initial state assignment or compute it dynamically during the render cycle without utilizing `useEffect`.

## 6. Component Monolith & Design
* **Severity:** 🟡 Medium
* **Component:** `apps/web/src/pages/Dashboard.tsx`
* **Problem:** The `Dashboard` is a ~400-line monolith responsible for data fetching logic, skeleton loaders, error boundaries, empty states, and deeply nested presentational markup.
* **Impact:** Extremely difficult to test, maintain, or reuse sub-sections of the UI.
* **Recommendation:** Extract `DashboardSkeleton`, `NoReportsState`, and `ErrorState` into separate files in `src/components/`. Extract the stats grid and insights panel into focused pure components.

## 7. Accessibility
* **Severity:** 🟡 Medium
* **Component:** `apps/web/src/pages/Dashboard.tsx`, `apps/web/src/components/ProfileCard.jsx`
* **Problem:** 
  - Interactive elements (like custom share buttons and the theme toggle) lack semantic keyboard focus indicators (`focus-visible`).
  - `ProfileCard.jsx` handles image load errors with `e.target.style.display = 'none'`, removing the element from the flow.
* **Impact:** Keyboard navigation is visually untraceable. Screen readers receive poor structural cues when images fail to load.
* **Recommendation:** Add Tailwind `focus-visible:ring-2` to all custom buttons/links. Instead of hiding broken images, fall back to a generic avatar SVG to maintain layout consistency.
