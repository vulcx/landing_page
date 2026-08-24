# Vulcx — Leonardo AI prompt sheet

> **Do not paste this file into Leonardo.** It is notes for you. The text that goes
> in the prompt box is `brand/prompt-avatar.txt` and `brand/prompt-banner.txt` —
> plain sentences, nothing else. Pasting this document is how two batches got spent
> feeding the model its own instructions: the box truncated everything before the
> real prompt ever appeared.
>
> **Lucid Origin has no negative-prompt field.** `Advanced Settings` on this model
> holds only `Use Fixed Seed`. Every exclusion therefore has to be phrased as
> something the image *is* — "a completely flat matte unlit background" rather than
> "no texture" — which is what the two prompt files do. The negative prompt below is
> only usable on a model that exposes one.

Brand colours, from `design/tokens.css` — keep these exact, Leonardo honours hex:

| token | hex | role |
|---|---|---|
| `--vx-bg` | `#080420` | near-black indigo background |
| `--vx-ember` | `#FF3D01` | primary accent |
| `--vx-mint` | `#C3FBA5` | secondary accent, highlights |

The form is the mark in `brand/mark-1024.png`: a **chevron (V)** built as a stack
of thin plates, seen from three-quarters. The layers stand for the hops a route is
searched across; the V is two paths converging. Keep the V readable — that is the
one thing that must survive every render.

---

## Read this before generating

**Attach `brand/mark-1024.png` as a reference, never prompt alone.** In this build
the control is called **Image Ref** (some models call it Content Ref). Only models
tagged `Image Ref` accept one — that tag is the first thing to check when picking a
model. Text alone gives you a handsome object that is not your logo; the reference
pins the V geometry and lets the model supply the material and lighting, which is
the entire reason to run this over the programmatic render.

**Generate the mark, never the wordmark.** Diffusion models cannot spell reliably.
Render the symbol on a clean background, then set "VULCX" beside it in a vector
tool with the real brand face. Any lettering the model produces will be subtly
wrong and you will not notice until it is printed.

**This gives you a hero image, not a logo file.** Each generation is a one-off; you
cannot regenerate it at 32 px for a favicon, or recolour it later, or hand it to a
printer as vector. Use Leonardo for the banner and social art, and keep a vector
version of the mark as the actual logo. `brand/render.py` stays the reproducible
source.

---

## 1 — Hero mark (banner art, 3/4 view)

**Model:** Nano Banana Pro, or GPT Image 2 · **Style:** Dynamic
**Dimensions:** Custom 1536 × 640, crop to 1500 × 500 · **Image Ref:** `mark-1024.png`

**Prompt**

```
A single bold chevron symbol shaped like the letter V, constructed from many thin
stacked plates layered one on top of another like a deck of laminated sheets,
viewed from a three-quarter angle so the individual layer edges are clearly
visible receding into depth. The top face is a smooth gradient from soft mint
green #C3FBA5 into vivid ember orange #FF3D01. The stacked side faces are dark
warm charcoal fading to deep indigo #080420. Frosted glass and brushed anodised
metal material, soft studio rim lighting from the upper left, gentle specular
highlights along each plate edge, subtle ambient occlusion between layers.
Isolated on a seamless near-black indigo #080420 background with a very soft
radial falloff. The background must be dark; never white, never light grey, no
grid, no blueprint paper, no drop shadow onto a surface. Premium fintech product render, centred composition, generous
negative space, shallow depth of field, octane render, 8k, crisp.
```

**Negative prompt**

```
text, letters, words, typography, watermark, signature, logo lockup, ui, interface,
person, hands, multiple objects, cluttered, busy background, white background,
light background, grid paper, blueprint, graph paper, marble, granite, stone
texture, fabric, woven, canvas, paper grain, speckled, noise texture, painterly,
impasto, brush strokes, rainbow, pink, salmon, teal palette, green palette,
cartoon, clip art, low contrast, blurry, jpeg artifacts, distorted geometry,
broken symmetry
```

---

## 2 — Avatar (square, tighter crop)

**Dimensions:** 1:1, 1024 × 1024 · everything else as above

Same prompt, with this appended:

```
Tight square crop, the chevron filling most of the frame, symmetrical, shot
straight on with only a slight downward tilt so the stack reads without the shape
skewing. Rounded-square icon composition.
```

Same negative prompt.

---

## 3 — Alternate direction, if the stack reads too heavy

Swap the material sentence for:

```
Polished obsidian glass with a thin luminous ember edge on every layer, the plates
slightly separated with light passing between them.
```

and drop `brushed anodised metal` from the prompt. Lighter, more optical, less
industrial.

---

## Lucid Origin will not give you a flat background — stop asking it to

Four batches, twelve images, three different prompt strategies. Every single output
put the chevron on a textured physical surface: marble, concrete, plaster, terrazzo,
woven fabric, stone. The prompt asked for a flat solid `#080420` field every time,
and in the last attempt named the exclusions explicitly — no wall, no floor, no
surface, no room, no stone, no texture, no photograph. It produced sage plaster,
rust terrazzo, blue marble and pink stone.

Two prompt-side theories were tested and both failed:

- **Style preset.** Moving `Dynamic` to `None` changed the palette and nothing else.
- **Photographic vocabulary.** Removing `product render`, `studio rim light`,
  `anodised metal` and `specular` — and reframing as `flat digital vector logo icon,
  app icon style` — still returned a physical object on plaster.

The bias is in the model, not the wording. Lucid Origin renders things as
photographed objects; that is what it is for. Switch to a model tagged `Image Ref`
whose job is flat graphics: **Nano Banana Pro** (sold on "consistency &
infographics") or **GPT Image 2**. Keep the same prompt file and the same reference.

What Lucid Origin *did* solve is the geometry. Once the reference was on Content Ref
and `Prompt Enhance` was off, every output was a clean, symmetrical, layered V. That
part is done and does not need re-testing on the new model — but do check it survived.

## Settings, corrected against a real run

A 4-image Lucid Origin batch cost **46 credits** on the free plan. The `Unlimited`
badge in the model picker is a paid-plan entitlement, not a free one — do not treat
any model here as free to iterate on.

**Two settings decide whether you get your logo or a nice unrelated object:**

- **`Prompt Enhance` → Off.** On `Auto` it rewrites the brief to make it more
  evocative, which is the opposite of what a logo spec needs. A run with it on
  produced a military rank chevron and a green generic logo — neither of which
  appeared anywhere in the prompt.
- **Attach the reference as `Content Ref`, not `Style Ref`.** Style Ref copies
  palette, material and lighting only; it does **not** carry geometry. Every
  output of the first run drifted off the V because the reference was on Style.
  Lucid Origin exposes both. On a model tagged `Image Ref`, that control is the
  equivalent.

Use `Style Ref` **as well**, pointed at the same file, only once the shape is
locked — the two do different jobs and can be stacked.

| Model | Reference control | Use it for |
|---|---|---|
| **Lucid Origin** | Style Ref + Content Ref | Shape work, once Content Ref is set |
| **Nano Banana Pro** | Image Ref (Gemini 3 Pro) | Final render — sold on consistency |
| **GPT Image 2** | Image Ref | Second opinion on the final |
| **Seedream 5.0 Pro** | Image Ref | Only if you ever want type inside the image |

**Spending what is left.** Drop `Number of generations` to **1** while any wording
or setting is still moving — a 4-batch is for choosing between candidates, not for
searching for one. Keep `Generation Mode: Fast` until a composition is worth an
`Ultra` pass; Ultra costs more and cannot rescue a wrong shape.

**`Style` is the texture culprit — set it to None or Minimalistic.** `Dynamic` is an
aesthetic preset: it pushes contrast and a painterly surface. On a product object
sitting on a flat field it fights the brief, and it is what put marble, speckled
paper, woven fabric and a pink ground under four otherwise-correct chevrons. The
prompt did not ask for any of them.

**The negative prompt lives under `Advanced Settings`, which is collapsed by
default.** If it was never pasted in, none of the exclusions in this sheet have run
yet — which is the simplest explanation for the white background that came back
with the grid paper. Open it and check before blaming the wording.

**Content Ref is what carries the shape, and it works.** With it attached and
`Prompt Enhance` off, every output held the layered chevron. That part is solved;
what remains is material and ground, which is a smaller problem.

**Private Mode** is on. Keep it there while the brand is unshipped.

## Checks before you ship one

- Does it still read as a **V** at 64 px? Shrink it and look. This is the failure
  mode — the layers survive, the letter does not.
- Are the layer edges **distinct**, or have they merged into a smear?
- Is the background **flat enough** to sit behind a profile picture without a
  visible seam?
- Any accidental **lettering or symbols** in the plates? Diffusion hallucinates
  glyphs into repeated structures.
