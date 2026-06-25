"""Generate Awqāt PWA icons: navy field, gold crescent + star + sun-path arc.

Drawn at 4x supersample for crisp edges, then downscaled. Produces:
  icons/icon-192.png, icon-512.png, icon-maskable-512.png, apple-touch-icon.png
"""
import math
from PIL import Image, ImageDraw

NAVY_TOP = (10, 14, 36)      # #0A0E24
NAVY_BOT = (19, 26, 58)      # #131A3A
GOLD = (232, 184, 106)       # #E8B86A
GOLD_BRIGHT = (244, 214, 150)  # #F4D696

SS = 4  # supersample factor


def vgradient(size, top, bot):
    img = Image.new("RGB", (size, size), top)
    px = img.load()
    for y in range(size):
        t = y / max(1, size - 1)
        r = round(top[0] + (bot[0] - top[0]) * t)
        g = round(top[1] + (bot[1] - top[1]) * t)
        b = round(top[2] + (bot[2] - top[2]) * t)
        for x in range(size):
            px[x, y] = (r, g, b)
    return img


def five_point_star(cx, cy, outer, inner, rot=-math.pi / 2):
    pts = []
    for i in range(10):
        ang = rot + i * math.pi / 5
        rad = outer if i % 2 == 0 else inner
        pts.append((cx + rad * math.cos(ang), cy + rad * math.sin(ang)))
    return pts


def draw_motif(base_size, scale=1.0):
    """Render the crescent+star+arc motif on a transparent layer (base_size px)."""
    S = base_size * SS
    layer = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    c = S / 2

    def sc(v):  # scale a 0..1 fraction of the canvas, honoring `scale`
        return v * S

    # --- sun-path arc (behind crescent) ---
    arc_w = int(sc(0.018) * scale)
    # tall ellipse; only its top (a shallow dome) shows across the lower third
    ew = sc(0.78) * scale
    eh = sc(0.62) * scale
    ecx = c
    ecy = c + sc(0.16) * scale
    bbox = [ecx - ew / 2, ecy - eh / 2, ecx + ew / 2, ecy + eh / 2]
    d.arc(bbox, start=200, end=340, fill=GOLD + (180,), width=max(1, arc_w))
    # a small sun sitting on the arc's peak
    sun_r = sc(0.026) * scale
    sun_cx = ecx
    sun_cy = ecy - eh / 2
    d.ellipse(
        [sun_cx - sun_r, sun_cy - sun_r, sun_cx + sun_r, sun_cy + sun_r],
        fill=GOLD_BRIGHT + (235,),
    )

    # --- crescent (gold disk minus offset navy disk) ---
    cres = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    cd = ImageDraw.Draw(cres)
    main_r = sc(0.255) * scale
    main_cx = c - sc(0.022) * scale
    main_cy = c - sc(0.045) * scale
    cd.ellipse(
        [main_cx - main_r, main_cy - main_r, main_cx + main_r, main_cy + main_r],
        fill=GOLD + (255,),
    )
    cut_r = sc(0.232) * scale
    cut_cx = main_cx + sc(0.092) * scale
    cut_cy = main_cy - sc(0.028) * scale
    cd.ellipse(
        [cut_cx - cut_r, cut_cy - cut_r, cut_cx + cut_r, cut_cy + cut_r],
        fill=(0, 0, 0, 0),
    )
    # carve by compositing transparency: redraw cut as erase
    cut_mask = Image.new("L", (S, S), 0)
    ImageDraw.Draw(cut_mask).ellipse(
        [cut_cx - cut_r, cut_cy - cut_r, cut_cx + cut_r, cut_cy + cut_r], fill=255
    )
    cres.putalpha(
        Image.composite(Image.new("L", (S, S), 0), cres.getchannel("A"), cut_mask)
    )
    layer = Image.alpha_composite(layer, cres)

    # --- star (upper right, in the crescent's opening) ---
    d2 = ImageDraw.Draw(layer)
    star_cx = c + sc(0.165) * scale
    star_cy = c - sc(0.145) * scale
    d2.polygon(
        five_point_star(star_cx, star_cy, sc(0.072) * scale, sc(0.03) * scale),
        fill=GOLD_BRIGHT + (255,),
    )

    return layer.resize((base_size, base_size), Image.LANCZOS)


def compose(size, motif_scale=1.0):
    bg = vgradient(size, NAVY_TOP, NAVY_BOT).convert("RGBA")
    motif = draw_motif(size, scale=motif_scale)
    return Image.alpha_composite(bg, motif).convert("RGB")


# Standard icons (motif fills most of the tile)
compose(512, 1.0).save("public/icons/icon-512.png")
compose(192, 1.0).save("public/icons/icon-192.png")
compose(180, 1.0).save("public/icons/apple-touch-icon.png")
# Maskable: keep the motif inside the central safe zone (~62%)
compose(512, 0.62).save("public/icons/icon-maskable-512.png")

print("icons written")
