#!/usr/bin/env python3
"""Erzeugt Android-App-Symbole und Startbilder aus public/icon-512.png.

Aufruf: python3 scripts/android-icons.py
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
RES = ROOT / "android/app/src/main/res"
BG = (5, 15, 27, 255)  # #050f1b

src = Image.open(ROOT / "public/icon-512.png").convert("RGBA")

DENSITIES = {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}


def resized(size):
    return src.resize((size, size), Image.LANCZOS)


def soft_round(size):
    """Nur der Ring mit weich auslaufendem Rand, damit kein Quadrat auf dem dunklen Hintergrund sichtbar ist."""
    img = resized(size)
    n = size * 4
    mask = Image.new("L", (n, n), 0)
    pad = round(n * 0.04)
    ImageDraw.Draw(mask).ellipse((pad, pad, n - pad, n - pad), fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(n * 0.015)).resize((size, size), Image.LANCZOS)
    img.putalpha(mask)
    return img


def round_mask(img):
    # 4-fach überabgetastete Maske für glatte Kanten
    n = img.width
    mask = Image.new("L", (n * 4, n * 4), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, n * 4 - 1, n * 4 - 1), fill=255)
    out = img.copy()
    out.putalpha(mask.resize((n, n), Image.LANCZOS))
    return out


for name, px in DENSITIES.items():
    d = RES / f"mipmap-{name}"
    d.mkdir(parents=True, exist_ok=True)
    icon = resized(px)
    icon.save(d / "ic_launcher.png")
    round_mask(icon).save(d / "ic_launcher_round.png")
    # Adaptive Icon: 108 dp Fläche
    full = round(px * 108 / 48)
    inner = round(full * 0.72)  # Ring (84 % des Bildes) füllt so die 66-dp-Sicherheitszone
    fg = Image.new("RGBA", (full, full), (0, 0, 0, 0))
    ring = soft_round(inner)
    fg.paste(ring, ((full - inner) // 2, (full - inner) // 2), ring)
    fg.save(d / "ic_launcher_foreground.png")

# Startbilder: Grössen der vorhandenen Dateien beibehalten
for f in sorted(RES.glob("drawable*/splash.png")):
    w, h = Image.open(f).size
    img = Image.new("RGBA", (w, h), BG)
    s = round(min(w, h) * 0.28)
    ring = soft_round(s)
    img.paste(ring, ((w - s) // 2, (h - s) // 2), ring)
    img.convert("RGB").save(f)
    print(f.relative_to(RES), w, h)
