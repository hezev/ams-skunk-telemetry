#!/usr/bin/env python3
"""Build the AMS Skunk Telemetry v6 Windows icon. Uses Pillow."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "desktop" / "assets"
OUT.mkdir(exist_ok=True, parents=True)
S = 512

def font(size, bold=True):
    paths = [
        Path("C:/Windows/Fonts/seguisb.ttf") if bold else Path("C:/Windows/Fonts/segoeui.ttf"),
        Path("C:/Windows/Fonts/arialbd.ttf"),
        Path("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"),
    ]
    for p in paths:
        if p.exists():
            return ImageFont.truetype(str(p), size)
    return ImageFont.load_default()

im = Image.new("RGBA", (S, S), (5, 8, 15, 255))
d = ImageDraw.Draw(im)
d.rounded_rectangle((14, 14, 498, 498), radius=84, fill=(8, 13, 22, 255), outline=(238, 31, 58, 255), width=11)
# Graduated motorsport RPM arc. Red reaches the redline in the upper right.
d.arc((94, 83, 424, 407), start=190, end=273, fill=(232, 240, 252, 255), width=23)
d.arc((94, 83, 424, 407), start=276, end=342, fill=(238, 31, 58, 255), width=27)
for ang in [195, 215, 235, 255, 275, 295, 315, 335]:
    import math
    theta = math.radians(ang)
    cx, cy, radius = 259, 246, 151
    px = cx + radius*math.cos(theta)
    py = cy + radius*math.sin(theta)
    x2 = cx + (radius-22)*math.cos(theta)
    y2 = cy + (radius-22)*math.sin(theta)
    d.line((px,py,x2,y2), fill=(240, 244, 251, 255) if ang < 275 else (245, 87, 108, 255), width=7)
# Checker finish flag, inspired by the generated v6 visual.
for i in range(3):
    for j in range(3):
        if (i+j)%2==0:
            d.polygon([(362+i*18+j*3,242+j*16),(378+i*18+j*3,242+j*16),
                       (381+i*18+j*3,257+j*16),(365+i*18+j*3,257+j*16)],fill=(245,246,250,255))
def center(text, y, size, fill):
    f = font(size)
    bbox=d.textbbox((0,0),text,font=f,stroke_width=0)
    w=bbox[2]-bbox[0]
    d.text(((512-w)/2,y),text,font=f,fill=fill)

center("AMS", 253, 99, (247,248,251,255))
center("SKUNK", 351, 68, (250,40,68,255))
center("TELEMETRY", 431, 19, (201,213,234,255))
im.save(OUT/"ams-v6.png", optimize=True)
im.save(OUT/"ams-v6.ico", format="ICO",
        sizes=[(16,16),(24,24),(32,32),(48,48),(64,64),(128,128),(256,256)])
print("Created", OUT/"ams-v6.ico")
