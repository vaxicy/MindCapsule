#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Generate Chrome Web Store promo tiles for MindCapsule (bilingual: Chinese + English
in the same image, per Chrome-extension promo rules).
  - 440x280  (small marquee)
  - 1400x560 (large marquee)
Color palette mirrors the extension UI: black/white graphite, white accent.

Run: python scripts/generate-store-promo.py
Outputs: store-assets/promo/440x280.png, store-assets/promo/1400x560.png
"""
import os
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
PROMO_DIR = ROOT / "store-assets" / "promo"
PROMO_DIR.mkdir(parents=True, exist_ok=True)

# Bilingual copy
TITLE_ZH = "知识胶囊"
TITLE_EN = "MindCapsule"
SUB_ZH = "用 AI 把 YouTube 视频变成结构化知识胶囊"
SUB_EN = "Turn YouTube videos into structured knowledge capsules with AI"
CTA = "立即体验 · Try It Now"
CHIP_1_ZH, CHIP_1_EN = "一键总结", "One-click summary"
CHIP_2_ZH, CHIP_2_EN = "双语导出", "Bilingual export"

BG = (15, 15, 15)
CARD = (28, 28, 30)
ACCENT = (245, 245, 247)
WHITE = (255, 255, 255)
SUB = (154, 160, 166)
CHIP_BG = (42, 42, 44)
FONT_DIR = r"C:\Windows\Fonts"

def get_font(size, bold=False):
    """Use Microsoft YaHei (msyh.ttc) which contains both CJK and Latin glyphs.
    This avoids square boxes when mixing Chinese and English in one string."""
    try:
        if bold:
            return ImageFont.truetype(os.path.join(FONT_DIR, "msyhbd.ttc"), size)
        return ImageFont.truetype(os.path.join(FONT_DIR, "msyh.ttc"), size)
    except Exception:
        return ImageFont.load_default()

def text_size(d, s, f):
    b = d.textbbox((0, 0), s, font=f)
    return b[2] - b[0], b[3] - b[1], b[0], b[1]

def text_center(d, cx, cy, s, f, fill):
    w, h, bx, by = text_size(d, s, f)
    d.text((cx - w / 2 - bx, cy - h / 2 - by), s, font=f, fill=fill)

def make(size):
    W, H = size
    scale = W / 1400.0  # 1400x560 is the design baseline
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)

    # ---- Font sizes: scale-aware with CJK readability floor ----
    if scale < 0.6:  # 440x280
        eyebrow_size = 11
        title_size = 16
        sub_zh_size = 10
        sub_en_size = 10
        chip_size = 9
        cta_size = 11
        btn_w = 150
        btn_h = 34
        btn_radius = 8
        chip_h = 22
        chip_pad_x = 8
        pad = 18
        bar_w = 4
        eyebrow_y = 22
        chip_y_offset = 18
        btn_bottom_margin = 18
    else:  # 1400x560
        eyebrow_size = 22
        title_size = 42
        sub_zh_size = 20
        sub_en_size = 18
        chip_size = 16
        cta_size = 20
        btn_w = 230
        btn_h = 52
        btn_radius = 12
        chip_h = 36
        chip_pad_x = 16
        pad = 56
        bar_w = 8
        eyebrow_y = 70
        chip_y_offset = 34
        btn_bottom_margin = 40

    f_title = get_font(title_size, bold=True)
    f_eyebrow = get_font(eyebrow_size)
    f_sub_zh = get_font(sub_zh_size)
    f_sub_en = get_font(sub_en_size)
    f_chip = get_font(chip_size)
    f_cta = get_font(cta_size, bold=True)

    # Accent vertical bar on the left.
    d.rectangle([0, 0, bar_w, H], fill=ACCENT)

    # ---- Title block (eyebrow EN + big title ZH) ----
    title_x = pad + bar_w
    d.text((title_x, eyebrow_y), TITLE_EN, font=f_eyebrow, fill=SUB)
    _, eh, _, _ = text_size(d, TITLE_EN, f_eyebrow)
    title_y = eyebrow_y + eh + 6
    d.text((title_x, title_y), TITLE_ZH, font=f_title, fill=WHITE)
    _, th, _, _ = text_size(d, TITLE_ZH, f_title)

    # ---- Subtitle (zh over en, with >=8px gap) ----
    sub_y = title_y + th + 14
    d.text((title_x, sub_y), SUB_ZH, font=f_sub_zh, fill=(210, 210, 212))
    _, szh, _, _ = text_size(d, SUB_ZH, f_sub_zh)
    sub_en_y = sub_y + szh + 6
    d.text((title_x, sub_en_y), SUB_EN, font=f_sub_en, fill=SUB)

    # ---- Feature chips (two, side by side) ----
    _, last_sub_h, _, _ = text_size(d, SUB_EN, f_sub_en)
    chip_y = sub_en_y + last_sub_h + chip_y_offset
    next_x = draw_chip(d, title_x, chip_y, chip_h, chip_pad_x, f_chip, CHIP_1_ZH, CHIP_1_EN)
    chip_gap = 10 if scale < 0.6 else 16
    draw_chip(d, next_x + chip_gap, chip_y, chip_h, chip_pad_x, f_chip, CHIP_2_ZH, CHIP_2_EN)

    # ---- CTA button (white bg + black text, high contrast) ----
    btn_x = title_x
    btn_y = H - btn_bottom_margin - btn_h
    # safety: keep button top below chips
    if btn_y < chip_y + chip_h + 12:
        btn_y = chip_y + chip_h + 12
    d.rounded_rectangle([btn_x, btn_y, btn_x + btn_w, btn_y + btn_h],
                        radius=btn_radius, fill=WHITE)
    bcx = btn_x + btn_w / 2
    bcy = btn_y + btn_h / 2
    text_center(d, bcx, bcy, CTA, f_cta, (0, 0, 0))

    return img

def draw_chip(d, x, y, h, pad_x, f, zh, en):
    label = f"{zh} · {en}"
    w, _, _, _ = text_size(d, label, f)
    total_w = w + pad_x * 2
    d.rounded_rectangle([x, y, x + total_w, y + h], radius=h // 2, fill=CHIP_BG)
    cx = x + total_w / 2
    cy = y + h / 2
    text_center(d, cx, cy, label, f, (220, 220, 222))
    return x + total_w

def main():
    small = make((440, 280))
    small.save(PROMO_DIR / "440x280.png")
    print("wrote", PROMO_DIR / "440x280.png", small.size, small.mode)
    large = make((1400, 560))
    large.save(PROMO_DIR / "1400x560.png")
    print("wrote", PROMO_DIR / "1400x560.png", large.size, large.mode)

if __name__ == "__main__":
    main()
