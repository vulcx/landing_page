# Vulcx Landing — Design System

Extracted from computed styles — not from screenshots, not from vibes.

**2026-08-29 — the system was inverted.** The page moved from the dark
Fogo-derived ground to a light editorial system modelled on **x402.org**.
Sections 1a–1c below are the *previous* system's references; they are kept for
provenance and because the craft rules (fluid root, tabular numerals, one
easing) survived the change. Section 1d is the reference now in force, and
section 2 describes what is actually in `tokens.css` today.

---

## 1. Reference audit

### 1a. phantom.com — "soft consumer fintech"

| Token | Value |
|---|---|
| Page bg | `#FDFCFE` (near-white, lavender-tinted) |
| Ink | `#3C315B` (desaturated indigo, **not** black) |
| Accent | `#AB9FF2` (lavender) |
| Accent surface | `#E2DFFE` |
| Contrast surface | `#1C1C1C` |
| Cream | `#FFFDF8` |
| Semantic | mint `#2EC08B`, blue `#4A87F2`, pink `#FFDADC`, butter `#FFFFC4` |
| Display | 96px / 105.6px, **weight 400**, `ls -2.4px` |
| Eyebrow + H3 | 24px / 32.4px, `ls -0.6px` |
| Body | 16px, 15px small |
| Radii | cards **24px / 32px**, pills **100px**, avatars 50% |
| Section rhythm | `96px` vertical, hero block `128px` |
| Motion | `0.4s cubic-bezier(0.22, 1, 0.36, 1)` (expo-out) |
| Shadow | one only: `0 0 4px #E2DFFE` — a glow, not a drop shadow |

**The move:** giant type at weight 400 with heavy negative tracking. Rounded-everything. Zero gradients — flat pastel surfaces do the work. Colour carries hierarchy instead of weight.

### 1b. metamask.io — "brutalist high-contrast"

| Token | Value |
|---|---|
| Page bg | `#FFFFFF`, hero `#013330` (deep teal) |
| Ink | `#0A0A0A` |
| Accent | `#BAF24A` (acid lime) |
| Pastels | blue `#CCE7FF`, lime-tint `#E5FFC3`, lilac `#EAC2FF`, indigo `#190066` |
| Neutrals | `#E9EDF6`, `#393D46`, `#252525`, `#121416` |
| Fonts | `MMSansVariable` (display), `MMEuclidCircularB` (UI), `MMSansMono` |
| **Root font-size** | **`11.90px` @ 1512px viewport** |
| Display | 142.75px (= 12rem), H2 38px (= 3.2rem) |
| Weights | 400 / 500 only |
| Radii | 4.76px (0.4rem), 14.3px (1.2rem), 118.96px (pill) |

**The move:** the whole page is **fluid rem** — root font-size is a `vw` function, so every size, radius, and pad scales as one unit. `11.9 / 1512 ≈ 0.787vw`. This is why every computed value is a fraction. Massive condensed display type in a pastel on a saturated dark ground; buttons are uppercase, tight, pill-shaped.

### 1c. fogo.io/start — "the chain you deploy on"

| Token | Value |
|---|---|
| Page bg | `#080420` (indigo-black) |
| Ember | `#FF3D01` |
| Mint | `#D5EBD5` (text), `#C3FBA5` (CTA fill) |
| Ink on mint | `#080420` |
| Glass | `rgba(255,255,255,0.05)` |
| Accents | `#00AAFF`, `#00FF9D`, `#EE00FF`, `#FFD000` |
| Display | `Clash Display` 600 — 82px / `ls -1.64px`, section 52px / `ls -1.04px` |
| Mono | `Martian Mono` — nav + button labels, uppercase, 12px |
| Radii | 40px (pill), 12px, 10px, 8px |

**Signature gradient** (the ember horizon under the hero):
```css
radial-gradient(109.5% 75% at 50% 100%,
  #FF3D01 0%, #FF3D01 23%, #080420 70.6%, #080420 100%)
```

**The move:** dark ground + one hot accent burning up from the bottom edge. Geometric display font paired with a mono for anything machine-ish. Small uppercase mono labels are the entire nav/CTA voice.

### 1d. x402.org — "editorial infrastructure" *(current reference)*

Linux Foundation site on a Salient child theme. Computed from
`salient-dynamic-styles-multi-id-10.css` and the theme's `fonts.css`.

| Token | Value |
|---|---|
| Page bg | `#FFFFFF`, band `#F1F1F1` |
| Ink | `#222222` (never pure black for text) |
| Accent | `#3452FF` — used sparingly, essentially one hue on the page |
| Semantic green | `#0A7739` |
| Display | `Instrument Serif` **weight 400** — h1 56px/64px, h2 40px/45px |
| Body/UI | `Inter` 400/500/600 |
| Shadows | effectively none |
| Gradients | none |

**The move:** a 400-weight *serif* display face doing all the hierarchy on a
near-monochrome page. No glass, no glow, no gradient — contrast and size carry
everything. Structurally: a bare oversized stat row under the hero, a code block
as the hero's proof, and an old-way/new-way column comparison.

**What was deliberately not taken:** x402's blue. Vulcx keeps the Fogo ember as
its single accent (darkened to `#D93900` so it holds on white), which preserves
brand lineage while the rest of the system inverts.

---

## 2. The Vulcx system (in force)

Ink on white, one warm accent, a serif that does the talking. Source of truth is
`design/tokens.css`; this section explains the intent behind it.

**Role remap from the dark system.** Token *names* were kept so `swap-panel.js`
(which reads `--vx-accent-1..4`) and the page CSS keep resolving. Two names now
mean something different:

| Token | Was | Is | Why |
|---|---|---|---|
| `--vx-mint` | `#C3FBA5` — the strong fill / positive | `#222222` | On a light ground the "strong fill" role is ink. Every `--vx-mint` rule (primary button, selected slippage chip, output-token badge, focus borders) resolves correctly with no rule changes. |
| `--vx-ember` | `#FF3D01` — warn + brand heat | `#D93900` | The same hue, darkened to hold contrast on white. Now the page's *only* chromatic accent: eyebrows, endpoint labels, rate-limit costs, errors. |
| `--vx-horizon` | radial ember gradient | `#222222` | The closing section is a flat inverted band, not a glow. |

The route/chart accents were replaced outright — the old neon set (`#00FF9D`,
`#EE00FF`, `#FFD000`) is invisible on white:

`--vx-accent-1..4` = `#3452FF` · `#0A7739` · `#7A00DF` · `#B25A00`

### Type

| Role | Family | rem | @1512px | Weight | Tracking |
|---|---|---|---|---|---|
| Hero | Instrument Serif | clamp → 6.1rem | ≤72px | 400 | -0.008em |
| H1 | Instrument Serif | 4.7rem | 56px | 400 | -0.008em |
| H2 | Instrument Serif | 3.4rem | 40px | 400 | -0.008em |
| H3 | Instrument Serif | 1.85rem | 22px | 400 | -0.008em |
| Body | Inter | 1.4rem | 17px | 400 | 0 |
| Label | Inter | 0.95rem | 11px | **600** | 0.1em, uppercase |
| Numeric / code | IBM Plex Mono | 1.3rem | 15px | 400–500 | tabular-nums |

Two things to keep straight:

- **Nothing is bold except the micro-labels.** A 400-weight serif at 56px
  already outranks everything; adding weight makes it look like a different,
  worse typeface. Hierarchy comes from size and the ink/muted split.
- **Mono retreated.** In the dark system, uppercase mono was the entire
  nav/CTA/label voice. Here mono is only for things the machine said — code,
  endpoints, amounts, token symbols. The label voice moved to tracked-out
  semibold Inter (`.vx-label`). Buttons and nav are sentence-case sans.

The fluid root (`clamp(0.75rem, 0.787vw, 1rem)`, ≈11.9px @1512) is unchanged —
the whole page still scales as one unit, and the spacing rhythm is tuned to it.

### Spacing rhythm

`96px` between sections, `112px` around the hero and the closing band.
Gap scale unchanged: 8 / 12 / 16 / 24 / 32 / 48 / 64.

### Radii

Squared off. Card / panel / button `6px` · Chip `4px` · Pill `999px` — and the
pill is now **only** for dots, progress tracks, and status chips. Rounded
everything reads as consumer fintech, which is what the serif is arguing
against.

### Motion

Same easing, shorter: `cubic-bezier(0.22, 1, 0.36, 1)` at `0.22s`. Editorial
pages settle fast. Hover changes `background-color`, `color`, `border-color`
only — never transform-scale a CTA.

### Elevation

Borders, not shadows. One hairline (`rgba(34,34,34,0.13)`) separates every
surface; a firmer one (`0.26`) marks anything interactive. **Exactly one object
on the page carries real elevation** — the live swap panel in the hero — so it
reads as running rather than as one more bordered card. Glows are gone;
`--vx-mint-glow` and `--vx-ember-glow` resolve to `transparent` so any surviving
`box-shadow: var(--vx-*-glow)` is a no-op rather than a mistake.

### Two rules that outlive any restyle

- `font-variant-numeric: tabular-nums` on every number, always. Digits must not
  reflow while a quote refreshes.
- **Never fade an ink fill with `opacity` to signal disabled.** On a light
  ground it blends toward white and leaves white label text on light grey. State
  the disabled colours explicitly (see `.btn-primary.sp-go:disabled`).
