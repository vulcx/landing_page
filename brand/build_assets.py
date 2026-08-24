#!/usr/bin/env python3
"""Turn the generated mark into the full asset set.

Source is brand/mark-source.jpg (Nano Banana Pro, 1024x1024). Everything below is
derived from it so the avatar, favicon, banner and OG card are provably the same
artwork rather than four things that merely resemble each other.

    python3 brand/build_assets.py
"""
from PIL import Image, ImageDraw, ImageFilter, ImageFont
import glob, os

BG    = (8, 4, 32)          # --vx-bg  #080420
MINT  = (195, 251, 165)
EMBER = (255, 61, 1)
S = 4

src = Image.open('brand/mark-source.jpg').convert('RGB')
W, H = src.size
field = src.getpixel((4, 4))                      # the flat ground the model produced

def dist(p, q):
    return sum((p[i] - q[i]) ** 2 for i in range(3)) ** 0.5

# --- 1. flatten the ground to the exact brand value --------------------------
flat = src.copy()
px = flat.load()
for y in range(H):
    for x in range(W):
        if dist(px[x, y], field) < 14:            # only the ground, never the mark
            px[x, y] = BG
flat.save('brand/mark-1024.png', optimize=True)

# --- 2. the same mark on transparency, for compositing -----------------------
cut = flat.convert('RGBA')
p2 = cut.load()
for y in range(H):
    for x in range(W):
        r, g, b, _ = p2[x, y]
        if dist((r, g, b), BG) < 10:
            p2[x, y] = (r, g, b, 0)
cut.save('brand/mark-1024-transparent.png', optimize=True)

# --- 3. avatars --------------------------------------------------------------
def rounded(img, radius_frac=0.22):
    n = img.size[0]
    m = Image.new('L', (n * S, n * S), 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, n * S - 1, n * S - 1],
                                        radius=int(n * S * radius_frac), fill=255)
    out = img.convert('RGBA')
    out.putalpha(m.resize((n, n), Image.LANCZOS))
    return out

for size in (400, 128):
    rounded(flat.resize((size, size), Image.LANCZOS)).save(
        f'brand/avatar-{size}.png', optimize=True)
rounded(flat.resize((180, 180), Image.LANCZOS)).save(
    'assets/apple-touch-icon.png', optimize=True)
flat.resize((512, 512), Image.LANCZOS).save('assets/icon-512.png', optimize=True)

# --- 4. favicon: the lit face only ------------------------------------------
# At 32 px the individual plates collapse into a grey smear, so the small mark
# drops the stack and keeps the chevron. A logo needs a simplified cut for small
# sizes; shipping the detailed one is how a favicon turns to mush.
face = Image.new('RGBA', (W, H), (0, 0, 0, 0))
pf, ps = face.load(), flat.load()
for y in range(H):
    for x in range(W):
        r, g, b = ps[x, y]
        if (r + g + b) / 3 > 90:                  # the mint->ember face, not the slate stack
            pf[x, y] = (r, g, b, 255)
small = Image.new('RGB', (W, H), BG)
small.paste(face, (0, 0), face)
small.resize((64, 64), Image.LANCZOS).save('brand/favicon-source-64.png', optimize=True)
small.resize((48, 48), Image.LANCZOS).save('favicon.ico',
                                           sizes=[(16, 16), (32, 32), (48, 48)])

def font(size, bold=True):
    pat = '**/LiberationSans-Bold.ttf' if bold else '**/LiberationSans-Regular.ttf'
    m = glob.glob(os.path.join('/usr/share/fonts', pat), recursive=True)
    return ImageFont.truetype(sorted(m)[0], size) if m else ImageFont.load_default()

def lockup(canvas_size, mark_px, mark_xy, title_xy, title_px, sub_xy, sub_px, rule=True):
    cw, ch = canvas_size
    c = Image.new('RGB', canvas_size, BG)
    d = ImageDraw.Draw(c)
    if rule:
        d.rectangle([0, 0, cw, 5], fill=EMBER)
    m = cut.resize((mark_px, mark_px), Image.LANCZOS)
    c.paste(m, mark_xy, m)
    d.text(title_xy, 'VULCX', font=font(title_px), fill=MINT)
    d.text(sub_xy, 'Swap routing for Fogo', font=font(sub_px), fill=(213, 235, 213))
    return c

# --- 5. X header. The avatar overlaps the lower left, so the copy sits clear.
lockup((1500, 500), 430, (980, 35), (196, 176), 96, (200, 292), 38).save(
    'brand/x-header-1500x500.png', optimize=True)

# --- 6. OG card, same lockup at share proportions ---------------------------
lockup((1200, 630), 430, (740, 100), (110, 230), 92, (114, 344), 36).save(
    'assets/og.png', optimize=True)

for f in sorted(glob.glob('brand/*.png') + glob.glob('assets/*.png') + ['favicon.ico']):
    print('  %-38s %8d bytes' % (f, os.path.getsize(f)))
