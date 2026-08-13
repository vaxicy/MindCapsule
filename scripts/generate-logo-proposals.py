from PIL import Image, ImageDraw
import os

OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "generated-images")
os.makedirs(OUT_DIR, exist_ok=True)

W = 128
H = 128
MARGIN = 12

# 品牌色调：深色知识胶囊 + 一点强调色
DARK   = (18, 18, 22)      # 近黑背景
INK    = (30, 30, 38)      # 深蓝灰
PANEL  = (245, 245, 247)   # 白
ACCENT = (255, 196, 46)    # 暖金
LINE   = (120, 120, 135)   # 中灰

def new_canvas(bg=DARK):
    color = bg if len(bg) == 4 else bg + (255,)
    img = Image.new("RGBA", (W, H), color)
    return img, ImageDraw.Draw(img)

def rounded_capsule(d, bbox, fill=None, outline=None, width=0, radius=999):
    """画一个两端半圆的胶囊"""
    x1, y1, x2, y2 = bbox
    h = y2 - y1
    r = h // 2
    d.rounded_rectangle(bbox, radius=r, fill=fill, outline=outline, width=width)

def clip_to_capsule(draw, bbox, color):
    """用胶囊蒙版裁剪：先画胶囊实心，再用 XOR/and 较麻烦；这里直接绘制裁剪区域"""
    pass

# ========== 方案 A：经典胶囊（左黑右白）==========
def proposal_a():
    img, d = new_canvas((255,255,255,255))
    bbox = (MARGIN, 34, W-MARGIN, H-34)
    r = (bbox[3]-bbox[1])//2
    # 左黑
    d.pieslice((bbox[0], bbox[1], bbox[0]+2*r, bbox[3]), 90, 270, fill=DARK)
    d.rectangle((bbox[0]+r, bbox[1], bbox[0]+(W-2*MARGIN)//2, bbox[3]), fill=DARK)
    # 右白（用浅灰描边）
    cx = (bbox[0]+bbox[2])//2
    d.rectangle((cx, bbox[1], bbox[2]-r, bbox[3]), fill=(245,245,247), outline=LINE, width=2)
    d.pieslice((bbox[2]-2*r, bbox[1], bbox[2], bbox[3]), 270, 90, fill=(245,245,247), outline=LINE, width=2)
    # 小圆点
    d.ellipse((cx+28, bbox[1]+16, cx+42, bbox[1]+30), fill=DARK)
    return img

# ========== 方案 B：深色胶囊 + 金色高光 ==========
def proposal_b():
    img, d = new_canvas(INK)
    bbox = (MARGIN+4, 34, W-MARGIN-4, H-34)
    r = (bbox[3]-bbox[1])//2
    cx = (bbox[0]+bbox[2])//2
    # 胶囊主体深色
    rounded_capsule(d, bbox, fill=(45,45,58), outline=(80,80,95), width=2)
    # 左半区微亮
    d.pieslice((bbox[0]+2, bbox[1]+2, bbox[0]+2*r-2, bbox[3]-2), 90, 270, fill=(60,60,75))
    d.rectangle((bbox[0]+r, bbox[1]+2, cx-2, bbox[3]-2), fill=(60,60,75))
    # 金色高光条
    d.rounded_rectangle((cx+6, bbox[1]+10, cx+14, bbox[3]-10), radius=4, fill=ACCENT)
    # 小圆点
    d.ellipse((cx+26, bbox[1]+18, cx+38, bbox[1]+30), fill=PANEL)
    return img

# ========== 方案 C：脑内网络胶囊 ==========
def proposal_c():
    img, d = new_canvas(DARK)
    bbox = (MARGIN, 34, W-MARGIN, H-34)
    r = (bbox[3]-bbox[1])//2
    cx = (bbox[0]+bbox[2])//2
    rounded_capsule(d, bbox, fill=INK, outline=(90,90,105), width=2)
    # 左侧实心深色
    d.pieslice((bbox[0]+2, bbox[1]+2, bbox[0]+2*r-2, bbox[3]-2), 90, 270, fill=(35,35,45))
    d.rectangle((bbox[0]+r, bbox[1]+2, cx, bbox[3]-2), fill=(35,35,45))
    # 右侧内部画神经网络节点
    nodes = [(cx+18, bbox[1]+22), (cx+42, bbox[1]+18), (cx+28, bbox[1]+40),
             (cx+14, bbox[1]+52), (cx+44, bbox[1]+50)]
    for (x,y) in nodes:
        d.ellipse((x-3, y-3, x+3, y+3), fill=ACCENT)
    # 连接线
    for i in range(len(nodes)):
        for j in range(i+1, len(nodes)):
            x1,y1 = nodes[i]; x2,y2 = nodes[j]
            if abs(x1-x2)+abs(y1-y2) < 35:
                d.line((x1,y1,x2,y2), fill=(255,196,46,160), width=1)
    return img

# ========== 方案 D：播放胶囊（视频+知识）==========
def proposal_d():
    img, d = new_canvas(DARK)
    bbox = (MARGIN, 34, W-MARGIN, H-34)
    r = (bbox[3]-bbox[1])//2
    cx = (bbox[0]+bbox[2])//2
    rounded_capsule(d, bbox, fill=(40,40,50), outline=(100,100,115), width=2)
    # 左半深色
    d.pieslice((bbox[0]+2, bbox[1]+2, bbox[0]+2*r-2, bbox[3]-2), 90, 270, fill=(28,28,36))
    d.rectangle((bbox[0]+r, bbox[1]+2, cx, bbox[3]-2), fill=(28,28,36))
    # 右侧播放三角形
    tri = [(cx+16, bbox[1]+26), (cx+16, bbox[3]-26), (cx+44, (bbox[1]+bbox[3])//2)]
    d.polygon(tri, fill=ACCENT)
    return img

# ========== 方案 E：胶囊 + 书签/标签页 ==========
def proposal_e():
    img, d = new_canvas(DARK)
    # 圆角背景板
    d.rounded_rectangle((14, 24, W-14, H-24), radius=18, fill=(35,35,45), outline=(75,75,90), width=2)
    # 胶囊形状
    bbox = (MARGIN+8, 40, W-MARGIN-8, H-40)
    r = (bbox[3]-bbox[1])//2
    cx = (bbox[0]+bbox[2])//2
    rounded_capsule(d, bbox, fill=(50,50,62), outline=(110,110,125), width=2)
    # 左半
    d.pieslice((bbox[0]+2, bbox[1]+2, bbox[0]+2*r-2, bbox[3]-2), 90, 270, fill=(40,40,50))
    d.rectangle((bbox[0]+r, bbox[1]+2, cx, bbox[3]-2), fill=(40,40,50))
    # 右上角小标签
    d.rounded_rectangle((W-42, 28, W-20, 48), radius=4, fill=ACCENT)
    # 胶囊内小点
    d.ellipse((cx+22, bbox[1]+18, cx+34, bbox[1]+30), fill=PANEL)
    return img

# ========== 方案 F：极简描边胶囊 ==========
def proposal_f():
    img, d = new_canvas((255,255,255,255))
    bbox = (MARGIN, 34, W-MARGIN, H-34)
    r = (bbox[3]-bbox[1])//2
    cx = (bbox[0]+bbox[2])//2
    # 细线胶囊轮廓
    rounded_capsule(d, bbox, outline=DARK, width=4)
    # 左半填充
    d.pieslice((bbox[0]+4, bbox[1]+4, bbox[0]+2*r-4, bbox[3]-4), 90, 270, fill=DARK)
    d.rectangle((bbox[0]+r, bbox[1]+4, cx-2, bbox[3]-4), fill=DARK)
    # 右侧小圆点
    d.ellipse((cx+24, bbox[1]+20, cx+38, bbox[1]+34), outline=DARK, width=3)
    return img

proposals = [
    ("A Classic", proposal_a),
    ("B Dark", proposal_b),
    ("C Neural", proposal_c),
    ("D Play", proposal_d),
    ("E Tag", proposal_e),
    ("F Outline", proposal_f),
]

def render_preview():
    cols = 3
    rows = (len(proposals) + cols - 1) // cols
    pad = 16
    label_h = 22
    cell_w = W + pad*2
    cell_h = H + pad + label_h
    preview = Image.new("RGBA", (cell_w*cols, cell_h*rows), (245,245,247,255))
    draw = ImageDraw.Draw(preview)
    
    for idx, (name, fn) in enumerate(proposals):
        col = idx % cols
        row = idx // cols
        x = col * cell_w + pad
        y = row * cell_h + pad
        icon = fn()
        preview.paste(icon, (x, y), icon)
        # 标签
        tx = col * cell_w + cell_w//2
        ty = y + H + 6
        bbox = draw.textbbox((0,0), name)
        tw = bbox[2]-bbox[0]
        draw.text((tx - tw//2, ty), name, fill=(40,40,45))
    return preview

if __name__ == "__main__":
    preview = render_preview()
    out_path = os.path.join(OUT_DIR, "logo-proposals.png")
    preview.save(out_path, "PNG")
    print(f"saved: {out_path}")
    
    # 同时保存每个单独方案
    for name, fn in proposals:
        icon = fn()
        letter = name.split()[0]
        icon.save(os.path.join(OUT_DIR, f"logo-proposal-{letter}.png"), "PNG")
    print("individual icons saved")
