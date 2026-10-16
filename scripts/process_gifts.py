"""Crop + clean + enhance user gift photos and composite onto tier backdrops.
Usage: python3 scripts/process_gifts.py
Reads incoming/1..4.png -> writes public/gifts/g{15,25,50,100}.jpg
"""
from PIL import Image, ImageDraw, ImageFilter, ImageEnhance, ImageStat, ImageChops
import os

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IN = os.path.join(BASE, "incoming")
OUT = os.path.join(BASE, "public", "gifts")
SIZE = 768

# src file -> (gift id, backdrop top color, backdrop bottom color, glow color)
JOBS = [
    ("1.png", "g15", (6, 60, 48), (2, 14, 11), (52, 211, 153), {"patch_corner": (70, 70), "thresh": 45, "extra_seeds": [], "flat": True}),
    ("2.png", "g25", (8, 40, 90), (3, 10, 26), (56, 189, 248), {"thresh": 110, "extra_seeds": [], "flat": True}),
    ("3.png", "g50", (46, 22, 86), (12, 6, 24), (167, 139, 250), {"thresh": 70, "extra_seeds": [], "flat": True}),
    ("4.png", "g100", (70, 44, 8), (20, 12, 4), (251, 191, 36), {"thresh": 45, "extra_seeds": [(0.5, 0.62)], "flat": True}),
]
CANVAS = 640


def border_color(img):
    w, h = img.size
    px = img.load()
    samples = []
    for x in range(0, w, 7):
        samples += [px[x, 0], px[x, h - 1]]
    for y in range(0, h, 7):
        samples += [px[0, y], px[w - 1, y]]
    r = sum(c[0] for c in samples) // len(samples)
    g = sum(c[1] for c in samples) // len(samples)
    b = sum(c[2] for c in samples) // len(samples)
    return (r, g, b)


def remove_bg(img, thresh=45, extra_seeds=()):
    """True connected-region background removal: flood-fill the RGB copy
    from all corners (+ optional interior seeds for enclosed holes)."""
    rgb = img.convert("RGB")
    w, h = rgb.size
    filled = rgb.copy()
    mark = (255, 0, 255)
    seeds = [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]
    seeds += [(int(fx * w), int(fy * h)) for fx, fy in extra_seeds]
    for seed in seeds:
        try:
            ImageDraw.floodfill(filled, seed, mark, thresh=thresh)
        except Exception:
            pass
    src = filled.load()
    m = Image.new("L", (w, h), 0)
    mp = m.load()
    for y in range(h):
        row = [src[x, y] == mark for x in range(w)]
        for x, hit in enumerate(row):
            if hit:
                mp[x, y] = 255
    fg_alpha = Image.eval(m, lambda v: 255 - v).filter(ImageFilter.GaussianBlur(1.6))
    rgba = rgb.convert("RGBA")
    rgba.putalpha(fg_alpha)
    return rgba


def backdrop(top, bottom, glow, size=SIZE):
    bg = Image.new("RGB", (size, size))
    px = bg.load()
    for y in range(size):
        t = y / (size - 1)
        px_line = tuple(int(top[i] + (bottom[i] - top[i]) * t) for i in range(3))
        for x in range(size):
            px[x, y] = px_line
    # radial glow
    glow_layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow_layer)
    cx, cy, r = size // 2, int(size * 0.46), int(size * 0.42)
    for i in range(r, 0, -6):
        a = int(90 * (1 - i / r))
        gd.ellipse([cx - i, cy - i, cx + i, cy + i], fill=glow + (a,))
    bg = Image.alpha_composite(bg.convert("RGBA"), glow_layer.filter(ImageFilter.GaussianBlur(30)))
    # vignette
    vig = Image.new("L", (size, size), 0)
    vd = ImageDraw.Draw(vig)
    vd.ellipse([-size // 4, -size // 4, size * 5 // 4, size * 5 // 4], fill=255)
    vig = vig.filter(ImageFilter.GaussianBlur(120))
    black = Image.new("RGBA", (size, size), (0, 0, 0, 255))
    bg = Image.composite(bg, Image.composite(bg, black, Image.eval(vig, lambda v: 255 - v * 0 + (255 - v) // 3)), Image.new("L", (size, size), 255))
    return bg.convert("RGB")


def process(src, gid, top, bottom, glow, opts):
    img = Image.open(os.path.join(IN, src)).convert("RGB")
    # paint over corner artifacts (e.g. viewer icons) with bg color
    if opts.get("patch_corner"):
        pw, ph = opts["patch_corner"]
        bc = border_color(img)
        d = ImageDraw.Draw(img)
        w, h = img.size
        d.rectangle([w - pw, h - ph, w, h], fill=bc)
    fg = remove_bg(img, thresh=opts.get("thresh", 45), extra_seeds=opts.get("extra_seeds", []))
    w0, h0 = img.size
    pad = int(max(w0, h0) * 0.06)
    bbox = fg.split()[3].getbbox()
    if bbox:
        l, t, r, b = bbox
        crop = (max(0, l - pad), max(0, t - pad), min(w0, r + pad), min(h0, b + pad))
    else:
        crop = (0, 0, w0, h0)
    fg = fg.crop(crop)
    # enhance subject (keep feathered alpha)
    alpha = fg.split()[3]
    fg_rgb = fg.convert("RGB")
    fg_rgb = ImageEnhance.Color(fg_rgb).enhance(1.16)
    fg_rgb = ImageEnhance.Contrast(fg_rgb).enhance(1.10)
    fg_rgb = ImageEnhance.Brightness(fg_rgb).enhance(1.04)
    fg_rgb = ImageEnhance.Sharpness(fg_rgb).enhance(1.5)
    fg = fg_rgb.convert("RGBA")
    fg.putalpha(alpha)
    if opts.get("flat"):
        # transparent subject on transparent canvas, uniform size (no backdrop)
        canvas = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
        scale = (CANVAS * 0.88) / max(fg.size)
        fg = fg.resize((int(fg.width * scale), int(fg.height * scale)), Image.LANCZOS)
        # despill: kill green-screen fringe (green dominant -> clamp to max(R,B))
        r, g, b, a = fg.split()
        px = fg.load()
        w, h = fg.size
        for y in range(h):
            for x in range(w):
                pr, pg, pb, pa = px[x, y]
                if pa > 8 and pg > pr + 12 and pg > pb + 12:
                    m = pr if pr > pb else pb
                    px[x, y] = (pr, m, pb, pa)
        # trim 1px halo: erode alpha slightly
        a2 = fg.split()[3].filter(ImageFilter.MinFilter(3))
        fg.putalpha(ImageChops.darker(fg.split()[3], a2))
        canvas.alpha_composite(fg, ((CANVAS - fg.width) // 2, (CANVAS - fg.height) // 2))
        out = os.path.join(OUT, f"{gid}.png")
        canvas.save(out)
        print("saved", out)
        return
    # scale subject to backdrop
    bg = backdrop(top, bottom, glow).convert("RGBA")
    scale = (SIZE * 0.74) / max(fg.size)
    fg = fg.resize((int(fg.width * scale), int(fg.height * scale)), Image.LANCZOS)
    # soft shadow
    sh = Image.new("RGBA", bg.size, (0, 0, 0, 0))
    sd = ImageDraw.Draw(sh)
    ex, ey = (SIZE - fg.width) // 2, (SIZE - fg.height) // 2 + int(SIZE * 0.04)
    sd.ellipse([ex + 20, ey + fg.height - 60, ex + fg.width - 20, ey + fg.height - 10], fill=(0, 0, 0, 130))
    bg = Image.alpha_composite(bg, sh.filter(ImageFilter.GaussianBlur(24)))
    bg.alpha_composite(fg, (ex, ey))
    out = os.path.join(OUT, f"{gid}.jpg")
    bg.convert("RGB").save(out, quality=90)
    print("saved", out)


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    for src, gid, top, bottom, glow, opts in JOBS:
        process(src, gid, top, bottom, glow, opts)
