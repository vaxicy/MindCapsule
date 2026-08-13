import os
from PIL import Image, ImageOps
from collections import deque

SRC = os.path.join(os.path.dirname(__file__), "..", "generated-images",
                   "A_minimalist_mobile_app_icon_o_2026-08-13T07-54-11.png")
OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "store-assets")
SIZES = [16, 48, 128]

img = Image.open(SRC).convert("RGBA")
w, h = img.size
# square crop to largest centered square
side = min(w, h)
left = (w - side) // 2
top = (h - side) // 2
img = img.crop((left, top, left + side, top + side))

px = list(img.getdata())

# flood-fill only edge-connected background (white) -> transparent
corners = [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]
bg_r = sum(px[y * w + x][0] for x, y in corners) // 4
bg_g = sum(px[y * w + x][1] for x, y in corners) // 4
bg_b = sum(px[y * w + x][2] for x, y in corners) // 4
tol = 40

def is_bg(i):
    r, g, b, _ = px[i]
    return abs(r - bg_r) <= tol and abs(g - bg_g) <= tol and abs(b - bg_b) <= tol

mask = [False] * (w * h)
q = deque()
for y in range(h):
    for x in (0, w - 1):
        idx = y * w + x
        if not mask[idx] and is_bg(idx):
            mask[idx] = True; q.append(idx)
for x in range(1, w - 1):
    for y in (0, h - 1):
        idx = y * w + x
        if not mask[idx] and is_bg(idx):
            mask[idx] = True; q.append(idx)

while q:
    idx = q.popleft()
    x, y = idx % w, idx // w
    for dx in (-1, 0, 1):
        for dy in (-1, 0, 1):
            if dx == 0 and dy == 0:
                continue
            nx, ny = x + dx, y + dy
            if 0 <= nx < w and 0 <= ny < h:
                nidx = ny * w + nx
                if not mask[nidx] and is_bg(nidx):
                    mask[nidx] = True
                    q.append(nidx)

new = [(r, g, b, 0) if mask[i] else (r, g, b, a) for i, (r, g, b, a) in enumerate(px)]
img.putdata(new)

# verify corner transparency
print("corner(5,5)=", img.getpixel((5, 5)))

for s in SIZES:
    out = img.resize((s, s), Image.LANCZOS)
    # binary threshold alpha to kill semi-transparent edge bleed on dark toolbars
    od = list(out.getdata())
    od = [(r, g, b, 0) if a < 128 else (r, g, b, 255) for r, g, b, a in od]
    out.putdata(od)
    path = os.path.join(OUT_DIR, f"icon{s}.png")
    out.save(path, "PNG")
    print(f"saved {path} mode={out.mode} corner={out.getpixel((2, 2))}")
