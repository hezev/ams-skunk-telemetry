#!/usr/bin/env python3
"""Generate every Windows Store tile from the v6 native icon artwork.

This uses the already generated desktop/assets/ams-v6.png; binary assets are
never downloaded from the network during packaging.
"""
from pathlib import Path
from PIL import Image, ImageDraw

BASE = Path(__file__).resolve().parents[1]
source = BASE / "desktop" / "assets" / "ams-v6.png"
assets = BASE / "store" / "assets"
assets.mkdir(parents=True, exist_ok=True)

with Image.open(source) as img:
    logo = img.convert("RGBA")

tiles = {
    "StoreLogo.png": (50, 50),
    "Square44x44Logo.png": (44, 44),
    "Square150x150Logo.png": (150, 150),
    "Square71x71Logo.png": (71, 71),
    "Square310x310Logo.png": (310, 310),
    "Wide310x150Logo.png": (310, 150),
}

for name, (width, height) in tiles.items():
    tile = Image.new("RGBA", (width, height), (7, 13, 22, 255))
    icon_size = min(width, height)
    thumb = logo.resize((icon_size, icon_size), Image.Resampling.LANCZOS)
    tile.alpha_composite(thumb, ((width - icon_size)//2, (height - icon_size)//2))
    tile.convert("RGB").save(assets / name, "PNG", optimize=True)
    print(f"{name}: {width}x{height}")
