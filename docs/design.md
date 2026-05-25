# GitReport — Design System & Competitive Positioning
**Version 1.0 · May 2026**

---

## 1. Strategic Context

### Why this moment matters

Developer tooling in 2026 has converged on a clear aesthetic language, led by products like Linear, Raycast, and Vercel. These tools share a set of design values: keyboard-first, information-dense, dark by default, and motion as a functional signal rather than a decorative flourish. The bar for "looks like a developer product" has never been higher — and the penalty for missing it is immediate credibility loss with the target audience.

At the same time, two technical shifts create a genuine competitive window for GitReport:

1. **GSAP + Framer Motion are now the standard pairing.** As of May 2026, Framer Motion leads with 35.6M weekly npm downloads and a 59 KB gzipped bundle, while GSAP (3.0M weekly downloads, 27 KB core) is the industry choice for timeline-heavy, scroll-triggered sequences. Using both is no longer unusual — Framer handles component-level UI transitions, GSAP owns the marketing canvas and data storytelling sequences. Products that use neither feel static and dated. Products that use both, well, feel premium.

2. **Scroll-driven animation is now an expectation, not a differentiator.** According to Ariel Digital's 2026 web design trend report, "scroll-triggered animations, page transitions, hover states, loading sequences, and interactive data visualizations are now *expected* on professional websites." The differentiator is *restraint* — purposeful motion that teaches rather than decorates.

GitReport's design must feel like it belongs in the same breath as Linear and Raycast: dark, precise, and alive in a way that earns the developer's trust.

---

## 2. Competitive Positioning

### The gap we occupy

| Product | Focus | Weakness vs GitReport |
|---|---|---|
| GitHub contribution graph | Native activity visualization | No monthly narrative, no sharing, no comparison |
| WakaTime | Time-tracking, language stats | Requires IDE plugin; no GitHub social layer |
| GitStats / GitInspector | CLI-based repo stats | No web UI, no cross-user comparison, no sharing |
| Polywork | Developer portfolio/timeline | Social-first, no technical depth, no data automation |
| Linear | Issue tracking with GitHub sync | Different category; no output-focused reporting |

GitReport's moat is the combination of: **automated monthly reports + privacy-safe sharing + public peer comparison**. No current product in the market does all three. The design system must make this combination *feel* obvious and trustworthy at a glance.

### Design positioning statement

> GitReport is the developer's monthly record — as precise as a terminal, as shareable as a portfolio, and as trustworthy as open source.

This statement should be visible in every design decision: the grid is tight, the data is dense, the motion is deliberate, and the privacy affordances are legible at a glance.

---

## 3. Visual Identity

### Color palette

The palette is anchored by a near-black background that signals seriousness without being oppressive, a single accent blue for interactive elements, green for positive deltas and public-safe data, and purple for private/personal surfaces.

```
Background
  Primary:     #0D1117   (GitHub-familiar near-black — trust signal for developers)
  Secondary:   #161B22   (card surfaces, sidebar)
  Tertiary:    #21262D   (borders, dividers)

Accent
  Blue:        #58A6FF   (interactive, links, CTAs — Framer Motion entrance targets)
  Blue dim:    #1F3450   (blue tint fills for active states)

Semantic
  Green:       #3FB950   (positive delta, public badge, verified)
  Green dim:   #0E4429   (heatmap base, low-density commits)
  Purple:      #BC8CFF   (private badge, owner-only data — distinct from interactive blue)
  Amber:       #E3B341   (warning, staleness indicator)
  Red:         #F85149   (negative delta, error)

Text
  Primary:     #E6EDF3
  Secondary:   #8B949E
  Muted:       #484F58
```

**Rationale:** This palette is directly derived from GitHub's own dark mode tokens, which means developers arriving from GitHub see a familiar visual language. The key addition is the purple/blue split for private vs interactive: at a glance, purple means "only you can see this," blue means "click here." This is a privacy affordance baked into the color system.

### Typography

```
Display:     Fraunces (serif, variable optical size)
             — Used for: hero heading, report title, month selector label
             — Sizes: 48px (hero), 32px (section title), 22px (stat value)
             — Weight: 700

Interface:   DM Mono (monospaced)
             — Used for: all UI labels, commit hashes, nav items, badges, body copy
             — Sizes: 14px (body/label), 12px (caption/meta), 10px (badge/pill)
             — Weight: 400 regular, 500 medium

Code:        DM Mono (same family)
             — Used for: commit hashes, file names, branch names
             — Color: #58A6FF on #0D1117
```

**Why Fraunces + DM Mono:** This pairing follows the 2026 trend of "editorial serif + technical mono" — seen in Vercel's blog, Linear's changelog, and Raycast's marketing. The serif adds warmth and narrative weight (you're reading your *story*), while the mono grounds the product in technical precision. The combination is distinctive without being eccentric.

### Spacing & grid

```
Base unit:   8px
Grid:        12-column, 24px gutter
Max width:   1280px (dashboard), 720px (public report page)

Spacing scale:
  xs:   4px   — icon padding, pill inner gap
  sm:   8px   — between related items
  md:   16px  — card padding, between cards
  lg:   24px  — section padding
  xl:   48px  — section separation
  2xl:  80px  — hero breathing room
```

### Border radius

```
pill:   9999px  — badges, status indicators
sm:     4px     — inputs, code blocks, commit hashes
md:     8px     — cards, nav items, buttons
lg:     12px    — modal dialogs
xl:     20px    — full-page containers
```

### Iconography

Use **Phosphor Icons** (thin weight, 16–20px). Thin icons at this scale complement DM Mono's strokes without competing. No filled icons except for active/selected states. No emoji in the product UI.

---

## 4. Animation System

### Philosophy

> Motion is data. Every animation in GitReport teaches the user something about their data or system state.

This is the ruling principle for both GSAP and Framer Motion usage. An animation that is purely decorative gets cut. An animation that makes the *direction of a change* legible, confirms an action, or reveals structure stays.

### Tool allocation

| Use case | Tool | Why |
|---|---|---|
| Page entry / route transitions | Framer Motion | Declarative, React lifecycle-integrated |
| Component mount / unmount | Framer Motion | `AnimatePresence` handles exit cleanly |
| Scroll-triggered sequences (landing) | GSAP ScrollTrigger | Fine-grained timeline control, better for multi-step reveals |
| Counter/number roll-ups (stat cards) | GSAP | `gsap.to()` with custom ease on number properties |
| Commit bar chart reveal | GSAP timeline | Staggered bar-by-bar entrance with ease |
| Heatmap cell population | GSAP stagger | Row-by-row reveal, 0.01s stagger, left-to-right |
| Hover states (nav, cards) | CSS `transition` | Simpler, lower overhead for ubiquitous micro-interactions |
| Compare bars animating to final value | GSAP | `gsap.to(width)` with elastic ease — communicates the "verdict" |
| Data loading skeleton shimmer | CSS animation | No JS needed |
| Shared report link reveal | Framer Motion | Subtle scale+fade with spring physics |

### Core motion tokens

```js
// Eases
const ease = {
  standard:   'power2.out',       // most UI transitions
  enter:      'power3.out',       // elements arriving
  exit:       'power2.in',        // elements leaving
  spring:     { type: 'spring', stiffness: 260, damping: 20 },  // Framer
  counter:    'expo.out',         // number roll-ups
  chart:      'power4.out',       // bar chart reveal
}

// Durations (ms)
const duration = {
  instant:    100,   // hover feedback
  fast:       200,   // micro-interactions
  standard:   300,   // page transitions, modal open
  deliberate: 500,   // stat card entrance, chart reveal
  narrative:  800,   // landing hero sequence
}

// Stagger
const stagger = {
  tight:   0.03,   // commit list items
  normal:  0.06,   // stat cards, repo list rows
  loose:   0.10,   // heatmap rows
}
```

### Key animation sequences

#### Landing hero (GSAP ScrollTrigger)

```
0ms     Logo and badge fade in (opacity 0→1, y 16→0, 300ms, power3.out)
150ms   Headline word-by-word reveal (SplitText, stagger 0.04s, power4.out)
400ms   Subheading fade in (opacity 0→1, y 8→0, 300ms)
600ms   CTA buttons scale in (scale 0.92→1, 200ms, spring)
800ms   Background grid lines draw in (strokeDashoffset, 600ms, power2.out)
1200ms  Demo dashboard thumbnail slides up (y 40→0, opacity 0→1, 500ms)
```

#### Dashboard stat cards (GSAP, triggers on first render)

```
Stagger 0.06s between cards
Each card: opacity 0→1, y 12→0, 300ms, power3.out
After all cards: number roll-up (0 → final value), 800ms, expo.out
Delta indicator: color crossfade (neutral → green/red), 200ms
```

#### Commit bar chart (GSAP timeline)

```
Bars start at height 0
Stagger 0.02s left-to-right
Height tweens to final value, 400ms, power4.out
Peak bar gets a brief scale(1.04) pulse at the end (150ms, elastic.out)
```

#### Compare progress bars (GSAP)

```
Both bars start at 0%
Tween simultaneously to final values, 600ms, expo.out
Winner bar: slight scale(1.02) at completion + color brightens for 200ms
```

#### Route transitions (Framer Motion)

```jsx
// Shared layout config
const pageVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.25, ease: [0.4, 0, 0.2, 1] } },
  exit:    { opacity: 0, y: -4, transition: { duration: 0.15 } }
}
```

### Accessibility

All GSAP animations must respect `prefers-reduced-motion`:

```js
const mm = gsap.matchMedia();
mm.add('(prefers-reduced-motion: no-preference)', () => {
  // all animation timelines defined here
});
// Outside: instant/zero-duration fallback behavior
```

Framer Motion checks `prefers-reduced-motion` automatically when `useReducedMotion()` is used. Apply to all `transition` props.

---

## 5. Component Patterns

### Navigation sidebar

- Fixed left, 260px wide, `#161B22` background
- Nav items: 40px tall, 8px border-radius, DM Mono 13px
- Active state: `#1C2128` fill + `#1F3450` border (1px) + `#58A6FF` text
- Hover: `#21262D` fill, 150ms transition
- Badges: `#21262D` pill, 10px DM Mono
- Framer Motion: `layout` prop on active indicator for smooth sliding

### Stat cards

- `#161B22` background, `#21262D` border, 10px radius
- Stat value: Fraunces 28–32px, `#E6EDF3`
- Label: DM Mono 11px, `#8B949E`, uppercase, 1px letter-spacing
- Delta: 11px, `#3FB950` (up) or `#F85149` (down) with directional arrow glyph
- GSAP number roll-up on mount (see animation system)

### Commit hash pill

```
font-family: DM Mono
font-size: 11px
color: #58A6FF
background: #1C2128
border: 1px solid #1F3450
border-radius: 4px
padding: 2px 8px
```

Clicking a hash opens an `href` to GitHub's commit page in a new tab.

### Privacy badge

```
Public:   color #58A6FF, bg #1C2128, border #1F3450
Private:  color #BC8CFF, bg #1F1B2E, border #2D1F47
```

Private badge appears on all repo rows visible only to the authenticated owner. It is never rendered in the public report page DOM — not hidden with CSS, actually absent from the server render.

### Data loading states

Skeleton shimmer replaces all data-bearing UI during fetch:

```css
@keyframes shimmer {
  0%   { background-position: -200% 0; }
  100% { background-position:  200% 0; }
}
.skeleton {
  background: linear-gradient(90deg, #21262D 25%, #2D333B 50%, #21262D 75%);
  background-size: 200% 100%;
  animation: shimmer 1.4s ease-in-out infinite;
  border-radius: 4px;
}
```

No spinners in the dashboard. Skeletons preserve spatial layout so the page doesn't jump when data arrives.

### Empty states

Each tab has a distinct empty state illustration (SVG, DM Mono label):

- Repositories: "No repos touched this month. Push some code."
- Commits: "Quiet month. It happens."
- Compare: "Search for a GitHub username to compare."

Empty states use the same grid as populated states. No centering within the full viewport height — keeps spatial consistency.

---

## 6. Page-level Design Notes

### Landing page

The landing page runs a single continuous GSAP ScrollTrigger sequence. Structure:

1. **Hero** — Fraunces headline, DM Mono subhead, two CTAs. Grid background draws in on load.
2. **Social proof strip** — "247 commits · 12 repos · April 2025" animated counter, implying a live feed.
3. **Feature trio** — three bento cards (Fraunces title, DM Mono body): Monthly reports / Peer comparison / Privacy-first. Each card enters on scroll via ScrollTrigger with staggered timing.
4. **Report preview** — full-width screenshot of the dashboard with a "Try it" overlay. On hover, the screenshot scales to 1.02 (CSS transition).
5. **Privacy section** — lock icon (Phosphor, thin), two-column layout: "Private repos stay private" with a visual showing the badge system.
6. **CTA section** — repeat of primary CTA. Background shifts to `#161B22`.

### Dashboard — Overview

Month selector sits at the top as a horizontal pill group. Selected month uses `#1C2128` + `#1F3450` border + `#58A6FF` text. Framer Motion `layout` animates the active pill sliding between months.

Stat cards are in a 4-column grid at `≥1024px`, 2-column at `768px`, 1-column below. Cards animate in on mount (see animation system).

Commit bar chart uses a `<canvas>` element driven by GSAP for better performance than SVG at 31 bars. Hover tooltip is a `<div>` positioned with JS, not a native `title` attribute.

Heatmap is a CSS grid of 31 `<div>` cells. Cells populate row-by-row with GSAP stagger after data loads.

### Dashboard — Compare

User search uses a debounced input (300ms) that queries registered GitReport users by GitHub username. Results drop down in a Framer Motion `AnimatePresence` list. No results state: "No GitReport account found for @{handle}. Share your link to invite them."

Side-by-side cards use a two-column layout. The winner metric value gets a `#3FB950` color. Head-to-head progress bars animate simultaneously on mount (GSAP, 600ms, expo.out). Both bars start at 0% regardless of which user loaded first — the simultaneous reveal creates a "race" moment.

### Public report page

Maximum width: 720px, centered. No sidebar. No nav. Only:

- GitReport logo (links to landing page)
- Username + avatar (from GitHub API, public)
- Month badge
- Stat cards (public-only: commits on public repos, public repos touched, public PRs merged)
- Commit graph (public commits only)
- Public repo list (no private names, no private commit counts)
- "Sign up to create your own report" CTA (viral growth loop)

The public page is served from Cloudflare edge cache with a 60s TTL. It contains zero references to private data in HTML, JS, or meta tags. Server rendering only — no client-side data fetching that could be intercepted.

---

## 7. Responsive Strategy

### Breakpoints

```
mobile:   < 640px   — single column, no sidebar (hamburger drawer)
tablet:   640–1023px — sidebar collapses to icon rail, 2-col stat cards
desktop:  ≥ 1024px  — full 260px sidebar, 4-col stat cards
wide:     ≥ 1440px  — max-width cap, centered
```

### Mobile dashboard

On mobile, the sidebar becomes a bottom navigation bar with 5 icon-only items (Phosphor icons). Tapping an icon navigates with a Framer Motion slide transition (`x: ±24px`). The commit bar chart switches to a 14-day view (last 2 weeks of the selected month) to prevent crowding.

---

## 8. Framer (Design Tool) Usage

The project uses **Framer** (the design and prototyping tool) as the source of truth for:

- Component library (all interactive states defined)
- Responsive layouts
- Prototype flows for user testing (landing → login → dashboard → share)
- Motion specs exported as GSAP/Framer Motion implementation notes

Handoff convention: Framer components are annotated with GSAP timeline names and Framer Motion variant names. Developers reference these annotations; they do not rely on Framer's auto-generated code output for production animation code.

---

## 9. Performance Constraints

Animation must not degrade Core Web Vitals. Rules:

- **No layout-affecting animations** — only `transform` and `opacity` in GSAP tweens. Never animate `width`, `height`, `top`, `left`, `margin`, or `padding`.
- **GSAP ScrollTrigger** must use `scrub: false` in the dashboard (data-heavy DOM). `scrub: true` is acceptable on the landing page only.
- **Framer Motion** tree must be scoped — do not wrap the entire app in a single `<AnimatePresence>`. Scope to the route level and individual component groups.
- **Heatmap**: render cells with `will-change: opacity` only during the entrance animation; remove the property after completion via `onComplete`.
- **Target**: Lighthouse performance score ≥ 90 on desktop, ≥ 75 on mobile. All animation code tree-shaken in production (GSAP plugins imported individually, not the full bundle).

---

## 10. Design Principles (Priority Order)

1. **Data first.** Every design decision defers to the legibility of the data. Decorative elements that compete with data readability are cut.
2. **Motion teaches.** An animation is justified only if it communicates state, direction, or hierarchy. Duration is a function of the information carried.
3. **Privacy is visible.** The public/private distinction must be legible without reading — color (blue vs purple), spatial separation (private data never appears in shared surfaces), and explicit labels.
4. **Developer trust.** The product must feel like it was built by someone who uses GitHub daily. Commit hashes are real hashes. Timestamps use relative format ("2h ago"). No marketing language in the product UI.
5. **Fast by default.** Skeleton states, edge caching, and `transform`-only animation keep the product feeling instant. Speed is a design feature.

---

*GitReport Design System v1.0 — May 2026*
*Stack: React + TypeScript · Framer (design) · Framer Motion (UI animation) · GSAP + ScrollTrigger (marketing & data animation) · DM Mono + Fraunces (type) · Phosphor Icons (thin)*
