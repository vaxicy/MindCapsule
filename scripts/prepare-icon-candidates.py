import os
import glob
from PIL import Image
from collections import deque

SRC_DIR = os.path.join(os.path.dirname(__file__), "icon_candidates")
OUT_DIR = os.path.join(os.path.dirname(__file__), "icon_candidates", "preview")

def remove_background(img, tolerance=35):
    img = img.convert("RGBA")
    w, h = img.size
    px = list(img.getdata())

    corners = [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]
    bg_r = sum(px[y * w + x][0] for x, y in corners) // 4
    bg_g = sum(px[y * w + x][1] for x, y in corners) // 4
    bg_b = sum(px[y * w + x][2] for x, y in corners) // 4

    def is_bg(idx):
        r, g, b, _ = px[idx]
        return (abs(r - bg_r) <= tolerance and
                abs(g - bg_g) <= tolerance and
                abs(b - bg_b) <= tolerance)

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


def center_crop_square(img):
    w, h = img.size
    side = min(w, h)
    left = (w - side) // 2
    top = (h - side) // 2
    return img.crop((left, top, left + side, top + side))


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    files = sorted(glob.glob(os.path.join(SRC_DIR, "*.png")))
    for i, path in enumerate(files, start=1):
        if "preview" in path:
            continue
        img = Image.open(path)
        img = center_crop_square(img)
        img = img.resize((128, 128), Image.LANCZOS)
        img = remove_background(img)
        out_path = os.path.join(OUT_DIR, f"candidate-{i}-128.png")
        img.save(out_path)
        corner = img.getpixel((5, 5))
        print(f"Saved {out_path} size={img.size} corner={corner}")


if __name__ == "__main__":
    main()
