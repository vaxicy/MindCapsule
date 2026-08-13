import os
from PIL import Image, ImageDraw, ImageFont
from collections import deque

HERE = os.path.dirname(__file__)
PREVIEW_DIR = os.path.join(HERE, "preview")
os.makedirs(PREVIEW_DIR, exist_ok=True)

CANDIDATES = [
    ("A", os.path.join(HERE, "A_minimalist_app_icon_of_a_rou_2026-08-13T09-03-48.png")),
    ("B", os.path.join(HERE, "A_minimalist_app_icon_of_a_rou_2026-08-13T09-03-55.png")),
    ("C", os.path.join(HERE, "A_minimalist_app_icon_of_a_rou_2026-08-13T09-07-24.png")),
]

def matte(src_path):
    img = Image.open(src_path).convert("RGBA")
    w, h = img.size
    side = min(w, h)
    left = (w - side) // 2
    top = (h - side) // 2
    img = img.crop((left, top, left + side, top + side))
    w = h = side
    px = list(img.getdata())

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
                mask[idx] = True
                q.append(idx)
    for x in range(1, w - 1):
        for y in (0, h - 1):
            idx = y * w + x
            if not mask[idx] and is_bg(idx):
                mask[idx] = True
                q.append(idx)

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
    return img

def make_icon_set(src_img):
    out = {}
    for s in [16, 48, 128]:
        small = src_img.resize((s, s), Image.LANCZOS)
        od = list(small.getdata())
        od = [(r, g, b, 0) if a < 128 else (r, g, b, 255) for r, g, b, a in od]
        small.putdata(od)
        out[s] = small
    return out

def draw_label(d, x, y, text, fill=(200, 200, 200)):
    try:
        font = ImageFont.truetype("arial.ttf", 18)
    except Exception:
        font = ImageFont.load_default()
    d.text((x, y), text, font=font, fill=fill)

for name, path in CANDIDATES:
    img = matte(path)
    icons = make_icon_set(img)

    # preview canvas 800x450
    canvas = Image.new("RGBA", (800, 450), (50, 50, 60, 255))
    d = ImageDraw.Draw(canvas)

    # scene 1: dark toolbar
    d.rectangle([20, 20, 380, 100], fill=(32, 33, 36, 255), outline=(80, 80, 90), width=1)
    canvas.paste(icons[16], (40, 52), icons[16])
    draw_label(d, 70, 54, "dark toolbar", fill=(200, 200, 200))

    # scene 2: light toolbar
    d.rectangle([420, 20, 780, 100], fill=(255, 255, 255, 255), outline=(200, 200, 200), width=1)
    canvas.paste(icons[16], (440, 52), icons[16])
    draw_label(d, 470, 54, "light toolbar", fill=(60, 60, 60))

    # scene 3: dark extension card (chrome://extensions dark)
    d.rounded_rectangle([20, 130, 380, 420], radius=12, fill=(41, 42, 45, 255), outline=(80, 80, 90), width=1)
    canvas.paste(icons[48], (50, 160), icons[48])
    draw_label(d, 120, 165, "MindCapsule 知识胶囊", fill=(230, 230, 230))
    draw_label(d, 120, 190, "1.0.0", fill=(160, 160, 160))

    # scene 4: light popup background
    d.rounded_rectangle([420, 130, 780, 420], radius=12, fill=(245, 245, 247, 255), outline=(200, 200, 200), width=1)
    canvas.paste(icons[48], (450, 160), icons[48])
    draw_label(d, 520, 165, "MindCapsule", fill=(30, 30, 30))
    draw_label(d, 520, 190, "v1.0.0", fill=(100, 100, 100))

    out_path = os.path.join(PREVIEW_DIR, f"candidate_{name}.png")
    canvas.convert("RGB").save(out_path, "PNG")
    print(f"saved {out_path}")

# also create a comparison of current icon
print("preview generated")
