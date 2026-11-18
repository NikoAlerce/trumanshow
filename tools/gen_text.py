"""
Bakes the lettering of the finale into one texture atlas:
  src/content/tex/text_atlas.png   (R = crisp mask, G = soft mask for smoke / glow)
  src/content/tex/text_atlas.json  (horizontal extent of every line)

Rows 0-3: Truman's farewell, hand written (skywriting smoke)
Rows 4-7: Christof's words from the sky (engraved serif capitals)

Only the rendered lettering ships with the piece, not the fonts.
python tools/gen_text.py
"""
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy import ndimage

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "src" / "content" / "tex"
W, ROW_H, ROWS = 2048, 256, 8
FONTS = Path("C:/Windows/Fonts")

LINES = [
    ("good morning,", "segoescb.ttf", 150, 0),
    ("and in case I don't see ya,", "segoescb.ttf", 128, 0),
    ("good afternoon, good evening,", "segoescb.ttf", 124, 0),
    ("and good night!", "segoescb.ttf", 150, 0),
    ("TRUMAN.", "georgia.ttf", 128, 26),
    ("I PAINTED THIS SKY FOR YOU.", "georgia.ttf", 96, 10),
    ("OUT THERE, NOTHING IS TRUE.", "georgia.ttf", 96, 10),
    ("STAY.", "georgia.ttf", 128, 26),
]


def draw_line(text, font_file, size, tracking):
    font = ImageFont.truetype(str(FONTS / font_file), size)
    img = Image.new("L", (W, ROW_H), 0)
    d = ImageDraw.Draw(img)
    # total width with tracking
    widths = [d.textlength(ch, font=font) for ch in text]
    total = sum(widths) + tracking * (len(text) - 1)
    if total > W - 80:
        raise SystemExit(f"line too long: {text!r} ({total:.0f}px)")
    x = (W - total) / 2
    asc, desc = font.getmetrics()
    y = (ROW_H - (asc + desc)) / 2 + 6
    for ch, w in zip(text, widths):
        d.text((x, y), ch, font=font, fill=255)
        x += w + tracking
    a = np.asarray(img, dtype=np.float32) / 255.0
    cols = np.where(a.max(axis=0) > 0.05)[0]
    x0, x1 = (cols.min() - 24) / W, (cols.max() + 24) / W
    return a, (max(0.0, x0), min(1.0, x1))


atlas = np.zeros((ROWS * ROW_H, W, 3), np.float32)
extents = []
for i, (text, font_file, size, tracking) in enumerate(LINES):
    a, ext = draw_line(text, font_file, size, tracking)
    soft = ndimage.gaussian_filter(a, 7.0 if i < 4 else 11.0)
    soft = soft / max(soft.max(), 1e-6)
    atlas[i * ROW_H:(i + 1) * ROW_H, :, 0] = a
    atlas[i * ROW_H:(i + 1) * ROW_H, :, 1] = soft
    extents.append({"text": text, "x0": round(ext[0], 4), "x1": round(ext[1], 4)})
    print(f"row {i}: {text!r:34s} extent {ext[0]:.3f}..{ext[1]:.3f}")

OUT.mkdir(parents=True, exist_ok=True)
Image.fromarray((atlas * 255 + 0.5).astype(np.uint8), "RGB").save(OUT / "text_atlas.png", optimize=True)
(OUT / "text_atlas.json").write_text(json.dumps({"rows": ROWS, "rowHeight": ROW_H, "width": W, "lines": extents}, indent=1))
print("wrote", OUT / "text_atlas.png", (OUT / "text_atlas.png").stat().st_size // 1024, "KB")
