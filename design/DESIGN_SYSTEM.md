# Vulcx Landing — Design System

Extracted from computed styles — not from screenshots, not from vibes.

**Three systems have shipped from this file.** Section 1 audits every
reference behind them. Section 2 is a post-mortem on the light editorial pass,
kept because the failure is instructive. **Section 3 is the system in force.**

| | System | Ground | Display | Status |
|---|---|---|---|---|
| 1 | Fogo-derived | `#080420` indigo | Clash Display 600 | retired |
| 2 | Light editorial (x402) | `#FFFFFF` | Instrument Serif 400 | **reverted same day** |
| 3 | Dark terminal | `#0B0B0F` near-black | Archivo 600 condensed | **in force** |

Constant across all three: the fluid `vw` root, `tabular-nums` on every number,
one easing curve, and the token *names* — so `swap-panel.js` never had to
change when the system did.

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

## 2. The light editorial pass — post-mortem

Shipped and reverted on 2026-08-29. It is documented rather than deleted
because the diagnosis generalises.

**What it was:** `#222222` ink on white, `#F1F1F1` bands, Instrument Serif 400
at 56px, Inter for UI, ember darkened to `#D93900` as the single accent.

**Why it failed:**

- **No mass.** Every surface was white, separated by 13%-opacity hairlines. The
  three API cards were white-on-white with a thin outline and barely registered.
  Light editorial only works when *something* on the page is heavy; the only
  dark object was the closing band, four screens down.
- **The face argued the wrong case.** A 400-weight serif reads "neutral
  standard, foundation, whitepaper" — correct for x402, which *is* a neutral
  standard, and wrong for a router competing on execution quality.
- **It demoted the one real asset.** The live panel shows a split route
  updating against mainnet. On a dark ground that reads as a running system; on
  white it reads as a contact form.

**What was worth keeping**, and did carry forward: the stat row, code-as-proof,
flat surfaces over glass, and the `<code>` consolidation.

**The wider lesson:** x402's *structure* was the borrowable part. Its palette
and type were load-bearing for a different argument than ours.

---

## 3. The Vulcx system (in force)

Near-black, ember, mono-forward, dense. A router is judged on numbers, so the
page is built to carry them. Source of truth is `design/tokens.css`.

**This is not a return to system 1.** That indigo (`#080420`) was soft and
inherited from Fogo; this ground is harder and the page is far denser.

**Role remap.** Token names are unchanged; two carry different values per
system:

| Token | System 1 | System 2 | System 3 | Role |
|---|---|---|---|---|
| `--vx-mint` | `#C3FBA5` | `#222222` | `#FF3D01` | the "strong fill" — whatever the execute colour is |
| `--vx-ember` | `#FF3D01` | `#D93900` | `#FF3D01` | accent + brand heat |

In this system those two coincide, because on near-black the execute colour
*is* the ember. They are kept as separate names because they diverge again in
any light system — as system 2 demonstrated.

`--vx-accent-1..4` (`#3D8BFF` · `#00E28A` · `#C77DFF` · `#FFB800`) deliberately
**excludes the ember**: a route leg tinted like the primary CTA competes with
it. Warnings are amber for the same reason — an ember warning on this page
looks like a call to action.

### Type

| Role | Family | Width | rem | @1512px | Weight |
|---|---|---|---|---|---|
| Hero | Archivo | 82% | clamp → 7.4rem | ≤88px | 600, uppercase |
| H2 | Archivo | 88% | 3.0rem | 36px | 600, sentence case |
| H3 | Archivo | 100% | 1.55rem | 18px | 600 |
| Body | Archivo | 100% | 1.3rem | 15px | 400 |
| Label / nav / buttons | JetBrains Mono | — | 0.9rem | 11px | 500, uppercase, `0.12em` |
| Numeric / code | JetBrains Mono | — | 1.25rem | 15px | 400–500, tabular |

Archivo carries a `wdth` axis, so the condensed display face and the UI face
are one family. Mono is the *interface* voice here, not just the code voice —
nav, buttons, labels and every number are mono. That is the register the
audience reads in.

### The split diagram

The signature, and the reason this direction was chosen. `.route-body` lays out
input token → fan-out bus → one channel per venue → fan-in bus → output token.
The buses are `.legs::before/::after` and the branch stubs are
`.leg::before/::after`, so **no extra markup is required and the diagram
survives however many legs the router returns**. The bus sits at
`--vx-hairline-firm`, the stubs a step dimmer — equal weight reads as a grid
rather than a graph.

Bars are weight-proportional and therefore static; a light sweep
(`.leg-fill::after`, staggered per channel) travels each channel in the
direction of the swap, which is what says the route is carrying something *now*.
It is removed entirely under `prefers-reduced-motion`.

Below 1000px the buses have nowhere to go, so the connectors are dropped and
the diagram degrades to the bar list it came from. Drawing them wrong is worse
than not drawing them.

### Section numbering

`section { counter-increment: sec }` with the index rendered by
`.sec-head .eyebrow::before`. No markup carries a number, so **reordering the
page cannot desync the numbering** — which matters, because the fee section was
moved from sixth to second.

### Spacing, radii, motion, elevation

Sections `6.4rem` (~76px), hero `7.5rem`. Tighter than either previous system:
the editorial pass left ~190px between sections of three-sentence copy and read
as thin.

Radii are near-square (card/panel `0.35rem`, chip `0.25rem`); the pill is for
dots, tracks and status chips only. Motion is `0.18s` on the shared easing —
this register should feel like a tool.

Elevation is one object: the live panel in the hero, which carries an ember
ring and bloom. Everything else is a flat fill plus a hairline. Code wells use
`--vx-bg-inset` (*below* the interface surface) while cards use
`--vx-bg-raised` — output the machine produced sits under the surface you
operate.

### Rules that outlive any restyle

- `font-variant-numeric: tabular-nums` on every number, always. Digits must not
  reflow while a quote refreshes.
- **Never signal disabled with `opacity` on a filled button.** On a light ground
  it blends toward white and leaves white label text on light grey; on a dark
  one it mutes the label past legibility. State the disabled colours explicitly
  (see `.btn-primary.sp-go:disabled`).
- Ink is `#E8E8EA`, never `#FFF`. Pure white on near-black vibrates.
