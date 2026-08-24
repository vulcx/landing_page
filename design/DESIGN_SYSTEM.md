# Vulcx Landing — Design System

Extracted 2026-08-20 from computed styles (not screenshots) of three references.

---

## 1. Reference audit

### phantom.com — "soft consumer fintech"

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

### metamask.io — "brutalist high-contrast"

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

### fogo.io/start — "the chain you deploy on"

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

---

## 2. Synthesis for Vulcx

Vulcx deploys on Fogo, so **Fogo is the parent brand** — inherit its ground and ember, don't compete with it. Borrow the other two for craft, not colour:

- **From Fogo:** `#080420` ground, `#FF3D01` ember, the radial horizon gradient, mono for machine values.
- **From MetaMask:** fluid `vw` root font-size so the whole page scales as one system. Uppercase mono micro-labels.
- **From Phantom:** the 0.4s expo-out easing, the glow-instead-of-shadow rule, generous radii, and display type at a *lower* weight with heavy negative tracking.

**What an aggregator needs that none of the three references have:** a tabular-numeral mono for quotes, prices, slippage, and route splits. `font-variant-numeric: tabular-nums` on every number, always. Digits must not reflow while a quote refreshes.

### Type scale (fluid, root = `clamp(0.75rem, 0.787vw, 1rem)`)

| Role | rem | @1512px | Weight | Tracking |
|---|---|---|---|---|
| Display | 6.5rem | 77px | 600 | -0.02em |
| H1 | 4.4rem | 52px | 600 | -0.02em |
| H2 | 3.2rem | 38px | 600 | -0.015em |
| H3 | 1.6rem | 19px | 500 | -0.01em |
| Body | 1.35rem | 16px | 400 | 0 |
| Label (mono) | 1rem | 12px | 400 | 0.08em, uppercase |
| Numeric | 1.2rem | 14px | 500 | tabular-nums |

### Spacing rhythm

`96px` between sections, `128px` around the hero (Phantom's rhythm — it reads calm at scale). Gap scale: 8 / 12 / 16 / 24 / 32 / 48 / 64.

### Radii

Pill `999px` (nav, CTA) · Card `24px` · Panel `12px` · Chip `8px`.

### Motion

One easing everywhere: `cubic-bezier(0.22, 1, 0.36, 1)` at `0.4s`. Hover state changes `background-color` and `color` only — never transform-scale a CTA.

### Elevation

No drop shadows. Ember glow (`0 0 32px rgba(255,61,1,0.28)`) on the primary CTA and on the active route node. Everything else is flat.
