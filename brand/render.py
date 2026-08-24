#!/usr/bin/env python3
"""Render the Vulcx brand marks.

The mark is a chevron extruded as a stack of thin plates: the layers read as the
hops a route is searched across, converging to one point. Everything is computed,
so re-running after a token change regenerates every asset.

    python3 brand/render.py
"""
from PIL import Image, ImageDraw, ImageFilter
import glob, os

BG      = (8, 4, 32)        # --vx-bg      #080420
EMBER   = (255, 61, 1)      # --vx-ember   #FF3D01
MINT    = (195, 251, 165)   # --vx-mint    #C3FBA5
AMBER   = (255, 176, 64)

S = 4  # supersample

# Thick chevron, in a 0..1 box. Outline walked once, outer edge then inner edge.
CHEVRON = [(0.10, 0.16), (0.50, 0.88), (0.90, 0.16),
           (0.70, 0.16), (0.50, 0.52), (0.30, 0.16)]

def lerp(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))

def poly(box, dx=0.0, dy=0.0):
    x, y, w, h = box
    return [(x + px * w + dx, y + py * h + dy) for px, py in CHEVRON]

def gradient(size, top, bottom):
    w, h = size
    g = Image.new('RGB', (1, h))
    for y in range(h):
        g.putpixel((0, y), lerp(top, bottom, y / max(h - 1, 1)))
    return g.resize((w, h), Image.BILINEAR)

def mark(px, layers=15, thickness=0.0105, glow=True):
    """The extruded chevron on transparency, px wide.

    Axonometric, not a face with an offset shadow: the chevron is a plate lying
    in a ground plane, projected at 30 degrees, and the stack is that plate
    repeated upward. That is what makes the layers read as one solid object seen
    from three-quarters rather than as striping behind a flat logo — which is the
    whole point of the form, since the layers stand for the hops a route is
    searched across.
    """
    import math
    W = px * S
    img = Image.new('RGBA', (W, W), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    c30, s30 = math.cos(math.radians(30)), math.sin(math.radians(30))

    # Pre-rotate 45 degrees in the ground plane. The projection maps the ground
    # direction (1,1) onto a vertical screen line, so without this the chevron's
    # axis of symmetry comes out skewed and the V stops reading as a V — it looks
    # like an L. Rotating first puts that axis on (1,1), and the mark lands
    # upright with the stack still seen from three-quarters.
    r = math.radians(-45)
    cr, sr = math.cos(r), math.sin(r)

    def project(pt, h):
        px, py = pt[0] - 0.5, pt[1] - 0.5
        x, y = px * cr - py * sr, px * sr + py * cr
        return ((x - y) * c30, (x + y) * s30 - h)

    def plate(h):
        return [project(pt, h) for pt in CHEVRON]

    # Normalise the whole stack into the canvas once, so layer count and
    # thickness can change without the mark drifting or clipping.
    total = thickness * layers
    pts = plate(0.0) + plate(total)
    xs, ys = [p[0] for p in pts], [p[1] for p in pts]
    span = max(max(xs) - min(xs), max(ys) - min(ys))
    scale = W * 0.86 / span
    ox = (W - (max(xs) - min(xs)) * scale) / 2 - min(xs) * scale
    oy = (W - (max(ys) - min(ys)) * scale) / 2 - min(ys) * scale

    def screen(h):
        return [(x * scale + ox, y * scale + oy) for x, y in plate(h)]

    edge = max(int(W * 0.0035), 1)
    for i in range(layers + 1):
        h = thickness * i
        t = i / layers                                   # 0 = bottom, 1 = top
        shade = lerp((28, 15, 64), (120, 44, 26), t)     # cold at the base, warm at the lit end
        d.polygon(screen(h), fill=shade + (255,),
                  outline=lerp(shade, (6, 3, 24), 0.5) + (255,), width=edge)

    # The top plate carries the ember ramp and a mint rim.
    face = screen(total)
    mask = Image.new('L', (W, W), 0)
    ImageDraw.Draw(mask).polygon(face, fill=255)
    img.paste(gradient((W, W), MINT, EMBER), (0, 0), mask)

    rim = Image.new('L', (W, W), 0)
    ImageDraw.Draw(rim).polygon(face, outline=255, width=int(W * 0.006))
    img.paste(Image.new('RGB', (W, W), MINT), (0, 0),
              rim.filter(ImageFilter.GaussianBlur(W * 0.0015)))

    if glow:
        aura = img.filter(ImageFilter.GaussianBlur(W * 0.03))
        img = Image.alpha_composite(Image.alpha_composite(
            Image.new('RGBA', (W, W), (0, 0, 0, 0)), aura), img)

    return img.resize((px, px), Image.LANCZOS)

def rounded(size, radius, colour):
    m = Image.new('L', (size[0] * S, size[1] * S), 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, size[0] * S - 1, size[1] * S - 1],
                                        radius=radius * S, fill=255)
    m = m.resize(size, Image.LANCZOS)
    bg = Image.new('RGBA', size, colour + (255,))
    bg.putalpha(m)
    return bg

def font(size, bold=True):
    pat = '**/LiberationSans-Bold.ttf' if bold else '**/LiberationSans-Regular.ttf'
    m = glob.glob(os.path.join('/usr/share/fonts', pat), recursive=True)
    from PIL import ImageFont
    return ImageFont.truetype(sorted(m)[0], size) if m else ImageFont.load_default()

os.makedirs('brand', exist_ok=True)

# 1. the mark alone, transparent
mark(1024).save('brand/mark-1024.png', optimize=True)

# 2. X / GitHub avatar — rounded square, mark centred
AV = 400
av = rounded((AV, AV), int(AV * 0.22), BG)
grad = gradient((AV, AV), (18, 10, 54), BG).convert('RGBA')
grad.putalpha(av.getchannel('A'))
av = Image.alpha_composite(av, grad)
m = mark(int(AV * 0.88))
av.alpha_composite(m, ((AV - m.width) // 2, (AV - m.height) // 2))
av.save('brand/avatar-400.png', optimize=True)
av.resize((128, 128), Image.LANCZOS).save('brand/avatar-128.png', optimize=True)

# 3. X header, 1500x500
BW, BH = 1500, 500
ban = Image.new('RGBA', (BW, BH), BG + (255,))
ban.alpha_composite(gradient((BW, BH), (16, 8, 48), BG).convert('RGBA'))
d = ImageDraw.Draw(ban)
d.rectangle([0, 0, BW, 5], fill=EMBER)
bm = mark(470)
ban.alpha_composite(bm, (int(BW * 0.62), (BH - bm.height) // 2 - 10))
# X overlaps the avatar onto the lower-left of the header, so the copy sits
# above and right of that corner rather than starting at the true margin.
# Two lines only. The third said "free, keyless, permissionless" — a claim about
# the business model, which has already reversed once. Anything baked into a
# banner should still be true a year from now; what the engine does is, how it is
# priced is not.
d.text((196, 176), 'VULCX', font=font(96), fill=MINT)
d.text((200, 292), 'Swap routing for Fogo', font=font(38), fill=(213, 235, 213))
ban.convert('RGB').save('brand/x-header-1500x500.png', optimize=True)

for f in sorted(glob.glob('brand/*.png')):
    print('  %-34s %7d bytes' % (f, os.path.getsize(f)))
