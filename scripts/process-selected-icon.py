from PIL import Image
from collections import deque
import os

SRC = r"d:\迅雷下载\vibe coding\Chrome Extensions\MindCapsule\generated-images\icon (2).png"
OUT_DIR = r"d:\迅雷下载\vibe coding\Chrome Extensions\MindCapsule\store-assets"
SIZES = [(16, "icon16.png"), (48, "icon48.png"), (128, "icon128.png")]

def remove_edge_background(img, tolerance=35):
    w, h = img.size
    px = list(img.getdata())

    corners = [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]
    bg = [sum(px[y * w + x][c] for x, y in corners) // 4 for c in range(3)]

    def is_bg(idx):
        return all(abs(px[idx][c] - bg[c]) <= tolerance for c in range(3))

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

    new = [(r, g, b, 0) if mask[i] else (r, g, b, a)
           for i, (r, g, b, a) in enumerate(px)]
    img.putdata(new)
    return img

def crop_to_content(img):
    w, h = img.size
    px = list(img.getdata())
    opaque = [i for i, (_, _, _, a) in enumerate(px) if a > 0]
    if not opaque:
        raise ValueError("no opaque content found")
    xs = [i % w for i in opaque]
    ys = [i // w for i in opaque]
    return img.crop((min(xs), min(ys), max(xs) + 1, max(ys) + 1))

def pad_to_square(img, fill=(0, 0, 0, 0)):
    w, h = img.size
    if w == h:
        return img
    size = max(w, h)
    out = Image.new("RGBA", (size, size), fill)
    out.paste(img, ((size - w) // 2, (size - h) // 2), img)
    return out

def main():
    img = Image.open(SRC).convert("RGBA")
    print(f"source size: {img.size}")

    img = remove_edge_background(img, tolerance=35)
    img = crop_to_content(img)
    print(f"cropped size: {img.size}")

    img = pad_to_square(img)
    print(f"square size: {img.size}")

    for size, filename in SIZES:
        out = img.resize((size, size), Image.LANCZOS)
        out.save(os.path.join(OUT_DIR, filename), "PNG")
        # verify corner alpha
        print(f"saved {filename}: size={out.size}, corner={out.getpixel((0, 0))}")

if __name__ == "__main__":
    main()
