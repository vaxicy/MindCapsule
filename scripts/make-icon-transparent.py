import os
from PIL import Image

SRC = os.path.join(os.path.dirname(__file__), "..", "generated-images", "icon.png")
OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "store-assets")
MASTER = os.path.join(os.path.dirname(__file__), "..", "generated-images", "icon-transparent.png")
SIZES = [16, 48, 128]

img = Image.open(SRC).convert("RGBA")
w, h = img.size
side = min(w, h)
left = (w - side) // 2
top = (h - side) // 2
img = img.crop((left, top, left + side, top + side))

px = list(img.getdata())


def is_whiteish(r, g, b, threshold=200):
    return r >= threshold and g >= threshold and b >= threshold


# Make near-white pixels (background + right-half fill) transparent while keeping black outline.
new = [(r, g, b, 0) if is_whiteish(r, g, b) else (r, g, b, a) for r, g, b, a in px]
img.putdata(new)

img.save(MASTER, "PNG")
print("saved master", MASTER, "corner=", img.getpixel((5, 5)))

for s in SIZES:
    out = img.resize((s, s), Image.LANCZOS)
    od = list(out.getdata())
    # Binarize alpha to avoid grey translucent fringe on dark/bright toolbars.
    od = [(r, g, b, 0) if a < 128 else (r, g, b, 255) for r, g, b, a in od]
    out.putdata(od)
    path = os.path.join(OUT_DIR, f"icon{s}.png")
    out.save(path, "PNG")
    print(f"saved {path} mode={out.mode} corner={out.getpixel((2, 2))}")
