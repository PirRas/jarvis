#!/usr/bin/env python3
"""Erzeugt Android-App-Symbole und Startbilder aus public/icon-512.png.

Aufruf: python3 scripts/android-icons.py
"""
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
RES = ROOT / "android/app/src/main/res"
BG = (5, 15, 27, 255)  # #050f1b

src = Image.open(ROOT / "public/icon-512.png").convert("RGBA")

DENSITIES = {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}


def resized(size):
    return src.resize((size, size), Image.LANCZOS)


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
    # Adaptive Icon: 108 dp Fläche, Motiv ca. 61 % (Sicherheitszone 66 dp)
    full = round(px * 108 / 48)
    inner = round(full * 0.61)
    fg = Image.new("RGBA", (full, full), (0, 0, 0, 0))
    fg.paste(resized(inner), ((full - inner) // 2, (full - inner) // 2))
    fg.save(d / "ic_launcher_foreground.png")

# Startbilder: Grössen der vorhandenen Dateien beibehalten
for f in sorted(RES.glob("drawable*/splash.png")):
    w, h = Image.open(f).size
    img = Image.new("RGBA", (w, h), BG)
    s = round(min(w, h) * 0.28)
    img.paste(resized(s), ((w - s) // 2, (h - s) // 2))
    img.convert("RGB").save(f)
    print(f.relative_to(RES), w, h)
