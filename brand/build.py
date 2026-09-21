#!/usr/bin/env python3
"""Build every Vulcx brand asset from one mark.

The mark is direction B ("Lanes", picked 2026-09-22): a solid ember V with a
lane cut into each arm that closes before the point, the way a split route
merges back into one output. It is drawn once, below, on a 48-unit grid.
Everything else — favicons, app icons, avatars, the X header, the OG card, the
docs and portal logos — is generated from it, so no surface can drift again.

    python3 -m venv /tmp/vx && /tmp/vx/bin/pip install fonttools uharfbuzz pillow
    /tmp/vx/bin/python brand/build.py          # from landing_page/

Needs chromium (rasterising) and ImageMagick (the .ico). Writes into this repo
and, when the sibling checkouts exist, into the portal and the docs.
"""
import pathlib, shutil, subprocess, tempfile, urllib.request

import uharfbuzz as hb
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont

HERE = pathlib.Path(__file__).resolve().parent
SITE = HERE.parent
MONO = SITE.parent
DASHBOARD = MONO / "dashboard"
DOCS = MONO / "route-engine" / "dev-docs" / "mintlify-docs"

EMBER = "#ff4f1f"
INK = "#f5f4f2"          # text on black
INK_LIGHT = "#111111"    # text on white
BLACK = "#000000"

# The mark. Outer V plus two lane slits, filled even-odd so the slits are holes.
MARK = ("M4 7h11l9 16.2L33 7h11L24 43Z"
        "M8.4 7h2.6l11 19.8-1.4 2.4Z"
        "M39.6 7H37L26 26.8l1.4 2.4Z")
# Below ~24px the slits are sub-pixel smudges, so the small sizes use the bare
# silhouette. Same outline, so the two read as one mark.
MARK_SMALL = "M4 7h11l9 16.2L33 7h11L24 43Z"

FONTS = {
    "geist-600": "https://fonts.gstatic.com/s/geist/v5/gyBhhwUxId8gMGYQMKR3pzfaWI_RQuQ4nQ.ttf",
    "geist-500": "https://fonts.gstatic.com/s/geist/v5/gyBhhwUxId8gMGYQMKR3pzfaWI_RruM4nQ.ttf",
}


def font(name: str) -> pathlib.Path:
    cache = HERE / ".cache"
    cache.mkdir(exist_ok=True)
    p = cache / f"{name}.ttf"
    if not p.exists():
        urllib.request.urlretrieve(FONTS[name], p)
    return p


def text_path(text: str, size: float, x: float, baseline: float, tracking_em: float = -0.03):
    """Outline text as one SVG path, shaped by HarfBuzz so kerning is Geist's own.
    Returns (path d, advance width). Outlined because an SVG used as an <img> —
    Mintlify's logo, GitHub's README — never loads web fonts."""
    fp = font("geist-600")
    tt = TTFont(fp)
    upm = tt["head"].unitsPerEm
    face = hb.Face(fp.read_bytes())
    hbfont = hb.Font(face)
    buf = hb.Buffer()
    buf.add_str(text)
    buf.guess_segment_properties()
    hb.shape(hbfont, buf, {"kern": True, "liga": True})
    gs = tt.getGlyphSet()
    order = tt.getGlyphOrder()
    scale = size / upm
    track = tracking_em * upm
    pen = SVGPathPen(gs)
    cursor = 0.0
    for info, pos in zip(buf.glyph_infos, buf.glyph_positions):
        name = order[info.codepoint]
        t = TransformPen(pen, (scale, 0, 0, -scale, x + (cursor + pos.x_offset) * scale, baseline))
        gs[name].draw(t)
        cursor += pos.x_advance + track
    return pen.getCommands(), (cursor - track) * scale


def cap_height() -> float:
    tt = TTFont(font("geist-600"))
    return tt["OS/2"].sCapHeight / tt["head"].unitsPerEm


def mark_svg(color=EMBER, small=False, bg=None, size=48, pad=0.0, radius=0):
    """The mark alone. `pad` is the fraction of the canvas left empty on each side."""
    d = MARK_SMALL if small else MARK
    # The drawing spans x 4..44, y 7..43 (40 x 36); centre it optically.
    inner = size * (1 - 2 * pad)
    s = inner / 40
    tx = (size - 40 * s) / 2 - 4 * s
    ty = (size - 36 * s) / 2 - 7 * s
    rect = f'<rect width="{size}" height="{size}" rx="{radius}" fill="{bg}"/>' if bg else ""
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{size}" height="{size}" viewBox="0 0 {size} {size}">'
            f'{rect}<path fill="{color}" fill-rule="evenodd" transform="translate({tx:.3f} {ty:.3f}) scale({s:.4f})" d="{d}"/></svg>\n')


def lockup_svg(text_color: str, height=24):
    """Mark + wordmark, laid out like the site nav: 24px mark, 19px Geist 600, 9px gap."""
    k = height / 24
    mark_h = 24 * k
    s = mark_h / 48
    gap = 9 * k
    fs = 19 * k
    # Centre the cap height on the drawn part of the mark (y 7..43 of 48).
    centre = (7 + 43) / 2 * s
    baseline = centre + cap_height() * fs / 2
    d, w = text_path("Vulcx", fs, mark_h + gap, baseline)
    width = mark_h + gap + w + 1
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{width:.1f}" height="{mark_h:.0f}" '
            f'viewBox="0 0 {width:.1f} {mark_h:.0f}" role="img" aria-label="Vulcx">'
            f'<path fill="{EMBER}" fill-rule="evenodd" transform="scale({s:.4f})" d="{MARK}"/>'
            f'<path fill="{text_color}" d="{d}"/></svg>\n')


def chromium_png(html: str, out: pathlib.Path, w: int, h: int, transparent=False):
    with tempfile.TemporaryDirectory() as tmp:
        src = pathlib.Path(tmp) / "page.html"
        src.write_text(f"<!doctype html><meta charset=utf-8><style>html,body{{margin:0;width:{w}px;height:{h}px;overflow:hidden;"
                       f"background:{'transparent' if transparent else BLACK}}}</style>{html}")
        args = [shutil.which("chromium-browser") or shutil.which("chromium") or "google-chrome",
                "--headless", "--disable-gpu", "--hide-scrollbars", f"--window-size={w},{h}",
                "--virtual-time-budget=3000", f"--screenshot={out}", src.as_uri()]
        if transparent:
            args.insert(2, "--default-background-color=00000000")
        subprocess.run(args, check=True, capture_output=True)


def icon_png(out: pathlib.Path, size: int, small=False, pad=0.2, bg=BLACK, radius=0):
    svg = mark_svg(small=small, bg=bg, size=size, pad=pad, radius=radius)
    chromium_png(svg, out, size, size, transparent=bg is None)


FONT_CSS = ('<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500&'
            'family=Geist+Mono:wght@500&display=block">')

STREAKS = """<svg class="streaks" viewBox="0 0 1200 800" preserveAspectRatio="none">
<defs><linearGradient id="gs" x1="0" x2="1"><stop offset="0" stop-color="#ff4f1f" stop-opacity="0"/>
<stop offset=".55" stop-color="#ff6a3a" stop-opacity=".55"/><stop offset="1" stop-color="#ffd2b8" stop-opacity=".9"/></linearGradient>
<linearGradient id="gb" x1="0" x2="1"><stop offset="0" stop-color="#ff4f1f" stop-opacity="0"/><stop offset="1" stop-color="#ff4f1f" stop-opacity=".22"/></linearGradient>
<filter id="blur"><feGaussianBlur stdDeviation="2.2"/></filter></defs>
<g fill="none" stroke="url(#gb)"><path d="M0 520 C 300 420, 700 260, 1200 250" stroke-width="1.2"/><path d="M0 560 C 320 460, 720 310, 1200 305"/>
<path d="M0 600 C 340 500, 740 360, 1200 360" stroke-width="1.4"/><path d="M0 640 C 360 540, 760 410, 1200 415"/><path d="M0 690 C 380 590, 780 470, 1200 480" stroke-width="1.2"/></g>
<g fill="none" stroke="url(#gs)" filter="url(#blur)" stroke-linecap="round"><path d="M620 330 C 800 280, 1000 252, 1200 250" stroke-width="3"/>
<path d="M760 352 C 900 322, 1050 306, 1200 305" stroke-width="2"/><path d="M540 450 C 740 380, 960 360, 1200 360" stroke-width="3.5"/>
<path d="M820 438 C 960 420, 1080 414, 1200 415" stroke-width="2"/></g></svg>"""


def card_html(w, h, lockup, body, glow_x="85%"):
    return f"""{FONT_CSS}<style>
body{{position:relative;font-family:Geist,system-ui,sans-serif;color:{INK};-webkit-font-smoothing:antialiased;
 background:radial-gradient(60% 90% at {glow_x} 70%,rgba(255,79,31,.20),transparent 70%),{BLACK}}}
.streaks{{position:absolute;right:-8%;top:-10%;width:85%;height:120%;opacity:.95;
 -webkit-mask-image:linear-gradient(90deg,transparent,#000 35%,#000 85%,transparent)}}
.c{{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center}}
.eyebrow{{font-family:'Geist Mono',monospace;font-weight:500;color:{EMBER};letter-spacing:.14em;text-transform:uppercase}}
h1{{font-weight:500;letter-spacing:-.035em;line-height:1.04;margin:0}}
p{{margin:0;color:rgba(245,244,242,.64)}}
.pill{{display:inline-block;background:{EMBER};color:#000;border-radius:999px;font-weight:500}}
.url{{font-family:'Geist Mono',monospace;color:rgba(245,244,242,.55)}}
</style>{STREAKS}<div class="c">{lockup}{body}</div>"""


def main():
    written = []

    def put(path: pathlib.Path, data):
        path.parent.mkdir(parents=True, exist_ok=True)
        (path.write_text if isinstance(data, str) else path.write_bytes)(data)
        written.append(path)

    # ---- vector sources -----------------------------------------------------
    put(HERE / "mark.svg", mark_svg())
    put(HERE / "mark-small.svg", mark_svg(small=True))
    put(HERE / "lockup-on-dark.svg", lockup_svg(INK))
    put(HERE / "lockup-on-light.svg", lockup_svg(INK_LIGHT))
    put(SITE / "favicon.svg", mark_svg(small=True, pad=0.04))

    # ---- raster icons -------------------------------------------------------
    with tempfile.TemporaryDirectory() as tmp:
        tmp = pathlib.Path(tmp)
        for s in (16, 32, 48):
            icon_png(tmp / f"f{s}.png", s, small=s < 48, pad=0.06, bg=None)
        subprocess.run(["magick", *(str(tmp / f"f{s}.png") for s in (16, 32, 48)), str(SITE / "favicon.ico")], check=True)
        written.append(SITE / "favicon.ico")
    icon_png(SITE / "assets/icon-512.png", 512, pad=0.2); written.append(SITE / "assets/icon-512.png")
    icon_png(SITE / "assets/apple-touch-icon.png", 180, pad=0.2); written.append(SITE / "assets/apple-touch-icon.png")
    # Avatars are cropped to a circle by GitHub and X, so the mark keeps clear of the corners.
    icon_png(HERE / "avatar-400.png", 400, pad=0.24); written.append(HERE / "avatar-400.png")

    # ---- cards --------------------------------------------------------------
    og_lock = f'<div style="position:absolute;left:72px;top:64px">{lockup_svg(INK, 34)}</div>'
    og_body = f"""<div style="padding-left:72px;padding-top:40px;display:grid;gap:22px;max-width:780px">
<div class="eyebrow" style="font-size:17px">Swap routing API · Fogo mainnet</div>
<h1 style="font-size:66px">The swap router for every app, bot and wallet on Fogo.</h1>
<p style="font-size:24px;max-width:600px">Every pool on the chain, up to five hops, split when it wins — one call.</p>
<div style="display:flex;align-items:center;gap:22px;margin-top:6px"><span class="pill" style="font-size:20px;padding:12px 24px">Start for free</span><span class="url" style="font-size:18px">vulcx.xyz</span></div></div>"""
    chromium_png(card_html(1200, 630, og_lock, og_body), SITE / "assets/og.png", 1200, 630)
    written.append(SITE / "assets/og.png")

    # X header: the avatar covers the bottom-left, so the copy sits right of centre.
    xh_body = f"""<div style="margin-left:560px;display:grid;gap:18px">{lockup_svg(INK, 40)}
<p style="font-size:26px;color:rgba(245,244,242,.72)">The swap router for every app, bot and wallet on Fogo.</p>
<div class="url" style="font-size:18px">vulcx.xyz · docs.vulcx.xyz</div></div>"""
    chromium_png(card_html(1500, 500, "", xh_body, glow_x="90%"), HERE / "x-header-1500x500.png", 1500, 500)
    written.append(HERE / "x-header-1500x500.png")

    # ---- portal (dashboard/) ------------------------------------------------
    if DASHBOARD.exists():
        put(DASHBOARD / "app/icon.svg", mark_svg(small=True, pad=0.04))
        shutil.copy(SITE / "favicon.ico", DASHBOARD / "app/favicon.ico"); written.append(DASHBOARD / "app/favicon.ico")
        icon_png(DASHBOARD / "app/apple-icon.png", 180, pad=0.2); written.append(DASHBOARD / "app/apple-icon.png")

    # ---- docs (Mintlify) ----------------------------------------------------
    if DOCS.exists():
        put(DOCS / "logo/dark.svg", lockup_svg(INK))        # shown on the dark theme
        put(DOCS / "logo/light.svg", lockup_svg(INK_LIGHT))
        put(DOCS / "favicon.svg", mark_svg(small=True, pad=0.04))

    for p in written:
        print(p.relative_to(MONO))


if __name__ == "__main__":
    main()
