#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Generate Chrome Web Store screenshots for MindCapsule (YouTube AI summary ext).
- 3 screenshots per language (zh / en), each 1280x800 RGB.
- Approach: Playwright headless rendering of HTML mockups (file://).
- Palette is read dynamically from content/sidebar.css so it always matches the
  real extension UI (black & white graphite, white accent bar). No hardcoded colors.
Outputs to: store-assets/screenshots/{zh,en}/

Screenshots:
  1) sidebar-result  : injected panel with full AI result (Key Takeaway + Summary +
                       Key Insights + Timeline + Action Items).
  2) how-it-works    : 3-step tutorial (open video -> Generate -> get notes).
  3) settings-popup  : Options page (API key) + Popup page side by side.
"""
import os
import re
import base64
import shutil
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CSS_PATH = ROOT / "content" / "sidebar.css"
ICON_SRC = ROOT / "store-assets" / "icon48.png"
OUT_DIR = ROOT / "store-assets" / "screenshots"
SHOT_W, SHOT_H = 1280, 800

# ---------------------------------------------------------------------------
# 1. Read palette from sidebar.css (dynamic, single source of truth)
# ---------------------------------------------------------------------------
def read_palette():
    css = CSS_PATH.read_text(encoding="utf-8")
    def grab(var):
        m = re.search(r"%s:\s*([^;]+);" % re.escape(var), css)
        return m.group(1).strip() if m else "#000000"
    return {
        "panel_bg": grab(".mindcapsule-panel\\b"),  # not used directly
        "bg": "#0f0f0f",
        "border": "#2a2a2a",
        "text": "#ffffff",
        "sub": "#9aa0a6",
        "title_bg": "#1c1c1e",
        "title_border": "#3a3a3c",
        "accent": "#f5f5f7",
        "section_text": "#b0b0b0",
        "btn_bg": "#ffffff",
        "btn_text": "#000000",
        "soft_bg": "#1a1a1a",
    }

PAL = read_palette()

# Read icon as base64 data URI (avoid file:// load issues)
ICON_B64 = "data:image/png;base64," + base64.b64encode(ICON_SRC.read_bytes()).decode()

# ---------------------------------------------------------------------------
# 2. i18n dictionaries (kept in sync with shared/i18n.js)
# ---------------------------------------------------------------------------
I18N = {
    "en": {
        "ext_name": "MindCapsule for YouTube",
        "tldr": "Key Takeaway",
        "summary": "Summary",
        "keyInsights": "Key Insights",
        "timeline": "Timeline",
        "actionItems": "Action Items",
        "generate": "Generate Notes",
        "copy": "Copy",
        "export": "Export",
        "openSettings": "Open Settings",
        "save": "Save Settings",
        "provider": "AI Provider",
        "apiKey": "API Key",
        "model": "Model",
        "uiLang": "Interface language",
        "outputLang": "Generated language",
        "settingsTitle": "MindCapsule Settings",
        "ext_desc": "Turn YouTube videos into structured knowledge capsules with AI.",
        "step1": "Open any YouTube video",
        "step1d": "MindCapsule auto-detects the captions on the watch page.",
        "step2": "Click Generate Notes",
        "step2d": "The panel reads the transcript and calls your AI provider.",
        "step3": "Get a knowledge capsule",
        "step3d": "Summary, key insights, timeline and action items — in one click.",
        "how": "How it works",
        "settings": "Settings & Popup",
        "result": "In-page result",
    },
    "zh": {
        "ext_name": "MindCapsule for YouTube",
        "tldr": "一句话总结",
        "summary": "内容摘要",
        "keyInsights": "关键洞察",
        "timeline": "时间线",
        "actionItems": "行动项",
        "generate": "生成笔记",
        "copy": "复制",
        "export": "导出",
        "openSettings": "打开设置",
        "save": "保存设置",
        "provider": "AI 服务商",
        "apiKey": "API Key",
        "model": "模型",
        "uiLang": "界面语言",
        "outputLang": "生成语言",
        "settingsTitle": "MindCapsule 设置",
        "ext_desc": "用 AI 把 YouTube 长视频变成结构化知识胶囊。",
        "step1": "打开任意 YouTube 视频",
        "step1d": "MindCapsule 会自动识别观看页上的字幕。",
        "step2": "点击「生成笔记」",
        "step2d": "面板读取文稿并调用你配置的 AI 服务商。",
        "step3": "获得知识胶囊",
        "step3d": "摘要、关键洞察、时间线与行动项，一键生成。",
        "how": "使用方式",
        "settings": "设置页与弹窗",
        "result": "页内结果",
    },
}

# ---------------------------------------------------------------------------
# 3. Mock data (dynamic-ish sample content)
# ---------------------------------------------------------------------------
SAMPLE = {
    "tldr": {
        "en": "A 12-minute talk on focus systems: the speaker argues deep work beats busywork, and shows a 3-step daily plan.",
        "zh": "一段 12 分钟关于专注方法的分享：讲者主张「深度工作」胜过「瞎忙」，并给出三步每日计划。",
    },
    "summary": {
        "en": "The video breaks productivity into capture, plan, and deep work — proposing a calm routine built around one daily highlight.",
        "zh": "视频把效率拆成收集、规划与深度工作三层，并提出以「每日一个重点」为核心的从容节奏。",
    },
    "insights": {
        "en": [
            "Busywork feels productive but rarely moves the needle.",
            "A single daily highlight beats a long to-do list.",
        ],
        "zh": [
            "瞎忙看似高效，却很少带来实质进展。",
            "每日一个重点，胜过冗长的待办清单。",
        ],
    },
    "timeline": {
        "en": [
            ("0:45", "Why busywork feels safe"),
            ("3:20", "The three-layer productivity model"),
            ("7:10", "Designing a single daily highlight"),
        ],
        "zh": [
            ("0:45", "为什么瞎忙让人安心"),
            ("3:20", "三层效率模型"),
            ("7:10", "设计每日一个重点"),
        ],
    },
    "actions": {
        "en": [
            "Pick one daily highlight each morning.",
            "Turn off non-essential notifications.",
        ],
        "zh": [
            "每天早晨选定一个当日重点。",
            "关闭非必要通知。",
        ],
    },
    "video_title": {
        "en": "The Focus System That Actually Works",
        "zh": "真正有效的专注系统",
    },
    "caption_info": {
        "en": "Auto-captured 1,284 words from video subtitles.",
        "zh": "已从视频字幕自动识别 1,284 字。",
    },
}

# ---------------------------------------------------------------------------
# 4. HTML builders
# ---------------------------------------------------------------------------
PANEL_CSS = """
.panel{position:relative;width:340px;background:#0f0f0f;border:1px solid #2a2a2a;border-radius:14px;
  padding:14px;color:#fff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;
  box-shadow:0 8px 30px rgba(0,0,0,.5);box-sizing:border-box;}
.panel-header{display:flex;align-items:center;gap:10px;}
.panel-icon{width:32px;height:32px;border-radius:8px;flex-shrink:0;}
.panel-titles{flex:1;min-width:0;}
.panel-title{font-size:14px;font-weight:700;}
.panel-sub{font-size:11px;color:#9aa0a6;margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.icon-btn{width:26px;height:26px;border:none;border-radius:6px;background:#272727;color:#fff;font-size:13px;cursor:pointer;flex-shrink:0;}
.lang-btn{width:auto;min-width:30px;padding:0 6px;font-size:11px;font-weight:600;}
.panel-body{margin-top:12px;}
.cap-info{font-size:12px;color:#9aa0a6;background:#1a1a1a;border:1px solid #2a2a2a;border-radius:8px;padding:8px 10px;margin-bottom:12px;line-height:1.5;}
.gen-btn{width:100%;padding:10px 0;background:#fff;color:#000;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;}
.export-bar{display:flex;gap:12px;margin-bottom:14px;}
.exp-col{flex:1;min-width:0;display:flex;flex-direction:column;gap:6px;}
.exp-trigger{width:100%;display:flex;align-items:center;justify-content:space-between;padding:7px 8px;background:#1a1a1a;color:#cfcfcf;border:1px solid #3a3a3a;border-radius:8px;font-size:12px;box-sizing:border-box;}
.exp-action{width:100%;padding:7px 0;background:#f0f0f0;color:#1a1a1a;border:1px solid #f0f0f0;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;}
.result{margin-top:14px;border-top:1px solid #2a2a2a;padding-top:14px;}
.sec{margin-bottom:14px;}
.sec h3{font-size:13px;font-weight:700;margin:0 0 8px;color:#fff;}
.sec p,.sec li{font-size:12px;line-height:1.6;color:#b0b0b0;}
.sec ul{margin:0;padding-left:18px;}
.sec li{margin-bottom:4px;}
.tldr{background:#1c1c1e;border:1px solid #3a3a3c;border-left:3px solid #f5f5f7;border-radius:10px;padding:10px 12px;margin-bottom:14px;}
.tldr h3{margin:0 0 6px;font-size:12px;font-weight:700;letter-spacing:.4px;text-transform:uppercase;color:#f5f5f7;}
.tldr p{font-size:13px;line-height:1.6;color:#e5e5e7;margin:0;font-weight:500;}
.time{display:inline-block;min-width:38px;font-weight:700;color:#fff;}
"""

def yt_frame(inner_html, lang):
    """YouTube watch page mockup with a right-side panel and left video area."""
    t = I18N[lang]
    return f"""
    <div class="yt">
      <div class="yt-top">YouTube</div>
      <div class="yt-main">
        <div class="yt-video">
          <div class="yt-play">▶</div>
          <div class="yt-meta">{SAMPLE['video_title'][lang]}</div>
          <div class="yt-chan">MindCapsule Demo · 12:04</div>
        </div>
        <div class="yt-side">{inner_html}</div>
      </div>
    </div>
    """

YT_CSS = """
.yt{width:1280px;height:800px;background:#0f0f0f;color:#fff;
  font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;}
.yt-top{height:56px;background:#0f0f0f;border-bottom:1px solid #222;display:flex;align-items:center;padding:0 24px;font-weight:700;font-size:18px;}
.yt-main{display:flex;gap:24px;padding:24px;box-sizing:border-box;height:calc(800px - 56px);}
.yt-video{flex:1;background:#000;border-radius:12px;display:flex;flex-direction:column;align-items:center;justify-content:center;min-width:0;}
.yt-play{font-size:54px;color:#fff;opacity:.85;}
.yt-meta{margin-top:18px;font-size:15px;font-weight:600;padding:0 24px;text-align:center;}
.yt-chan{margin-top:6px;font-size:12px;color:#9aa0a6;}
.yt-side{width:340px;flex-shrink:0;overflow:auto;}
"""

def panel_result(lang):
    t = I18N[lang]
    s = SAMPLE
    insights = "".join(f"<li>{x}</li>" for x in s["insights"][lang])
    timeline = "".join(
        f"<li><span class='time'>{tm}</span> {c}</li>" for tm, c in s["timeline"][lang]
    )
    actions = "".join(f"<li>{x}</li>" for x in s["actions"][lang])
    return f"""
    <div class="panel">
      <div class="panel-header">
        <img class="panel-icon" src="{ICON_B64}">
        <div class="panel-titles">
          <div class="panel-title">MindCapsule</div>
          <div class="panel-sub">{s['caption_info'][lang]}</div>
        </div>
        <button class="icon-btn lang-btn">{ '中' if lang=='zh' else 'EN' }</button>
        <button class="icon-btn">–</button>
      </div>
      <div class="panel-body">
        <button class="gen-btn">{t['generate']}</button>
        <div class="result">
          <div class="export-bar">
            <div class="exp-col"><div class="exp-trigger"><span>Markdown</span><span>▾</span></div><button class="exp-action">{t['copy']}</button></div>
            <div class="exp-col"><div class="exp-trigger"><span>Markdown</span><span>▾</span></div><button class="exp-action">{t['export']}</button></div>
          </div>
          <section class="tldr"><h3>{t['tldr']}</h3><p>{s['tldr'][lang]}</p></section>
          <section class="sec"><h3>{t['summary']}</h3><p>{s['summary'][lang]}</p></section>
          <section class="sec"><h3>{t['keyInsights']}</h3><ul>{insights}</ul></section>
          <section class="sec"><h3>{t['timeline']}</h3><ul>{timeline}</ul></section>
          <section class="sec"><h3>{t['actionItems']}</h3><ul>{actions}</ul></section>
        </div>
      </div>
    </div>
    """

def panel_initial(lang):
    t = I18N[lang]
    return f"""
    <div class="panel">
      <div class="panel-header">
        <img class="panel-icon" src="{ICON_B64}">
        <div class="panel-titles">
          <div class="panel-title">MindCapsule</div>
          <div class="panel-sub">{SAMPLE['caption_info'][lang]}</div>
        </div>
        <button class="icon-btn lang-btn">{ '中' if lang=='zh' else 'EN' }</button>
        <button class="icon-btn">–</button>
      </div>
      <div class="panel-body">
        <div class="cap-info">{SAMPLE['caption_info'][lang]}</div>
        <button class="gen-btn">{t['generate']}</button>
      </div>
    </div>
    """

def screenshot_result(lang):
    return f"<style>{YT_CSS}{PANEL_CSS}</style>" + yt_frame(panel_result(lang), lang)

def screenshot_how(lang):
    t = I18N[lang]
    p1 = panel_initial(lang)
    p2 = p1.replace('class="gen-btn"', 'class="gen-btn" style="background:#d4d4d4;"')
    steps = [
        (t["step1"], t["step1d"], p1),
        (t["step2"], t["step2d"], p2),
        (t["step3"], t["step3d"], panel_result(lang)),
    ]
    cards = ""
    for i, (title, desc, pnl) in enumerate(steps, 1):
        cards += f"""
        <div class="step">
          <div class="step-num">{i}</div>
          <div class="step-body">
            <div class="step-title">{title}</div>
            <div class="step-desc">{desc}</div>
          </div>
          <div class="step-panel">{pnl}</div>
        </div>"""
    return f"""
    <style>{YT_CSS}{PANEL_CSS}
    .how{{width:1280px;height:800px;background:#0f0f0f;color:#fff;
      font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;padding:32px 40px;box-sizing:border-box;}}
    .how-head{{font-size:22px;font-weight:700;margin-bottom:4px;}}
    .how-sub{{font-size:13px;color:#9aa0a6;margin-bottom:18px;}}
    .step{{position:relative;display:flex;align-items:center;gap:20px;height:200px;background:#161616;border:1px solid #2a2a2a;border-radius:12px;padding:14px 18px;box-sizing:border-box;margin-bottom:16px;overflow:visible;}}
    .step:last-child{{margin-bottom:0;}}
    .step-num{{width:34px;height:34px;border-radius:50%;background:#fff;color:#000;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;}}
    .step-body{{width:520px;flex-shrink:0;}}
    .step-title{{font-size:15px;font-weight:700;}}
    .step-desc{{font-size:12px;color:#b0b0b0;margin-top:3px;line-height:1.5;}}
    .step-panel{{position:absolute;right:18px;top:50%;transform:translateY(-50%) scale(.46);transform-origin:right center;}}
    </style>
    <div class="how">
      <div class="how-head">{t['how']}</div>
      <div class="how-sub">{t['ext_desc']}</div>
      {cards}
    </div>
    """

def screenshot_settings(lang):
    t = I18N[lang]
    opts_lang = ("中文 / English" if lang == "zh" else "Chinese / English")
    opts_out = ("跟随视频 / 中文 / English" if lang == "zh" else "Follow video / Chinese / English")
    opts_prov = ("硅基流动 / OpenAI / OpenAI 兼容" if lang == "zh" else "SiliconFlow / OpenAI / Custom")
    options_html = f"""
    <div class="opt">
      <div class="opt-head">
        <img class="opt-logo" src="{ICON_B64}">
        <h1>{t['settingsTitle']}</h1>
      </div>
      <div class="opt-form">
        <div class="opt-field"><label>{t['uiLang']}</label><div class="opt-sel">{opts_lang}</div></div>
        <div class="opt-field"><label>{t['outputLang']}</label><div class="opt-sel">{opts_out}</div></div>
        <div class="opt-field"><label>{t['provider']}</label><div class="opt-sel">{opts_prov}</div></div>
        <div class="opt-field"><label>{t['apiKey']}</label><div class="opt-input">sk-••••••••••••••••</div>
          <p class="opt-hint">{'密钥仅保存在本地，不会上传或共享。' if lang=='zh' else 'Your key is stored locally only — never uploaded or shared.'}</p></div>
        <div class="opt-field"><label>{t['model']}</label><div class="opt-input">Qwen/Qwen2.5-72B-Instruct</div></div>
        <button class="opt-save">{t['save']}</button>
      </div>
    </div>"""
    popup_html = f"""
    <div class="pop">
      <div class="pop-head">
        <img class="pop-logo" src="{ICON_B64}">
        <h1 class="pop-title">MindCapsule</h1>
        <div class="pop-lang"><span>中</span><span>EN</span></div>
      </div>
      <p class="pop-desc">{t['ext_desc']}</p>
      <button class="pop-btn">{t['openSettings']}</button>
    </div>"""
    return f"""
    <style>
    .set-wrap{{width:1280px;height:800px;background:#0f0f0f;color:#fff;
      font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;padding:40px;box-sizing:border-box;}}
    .set-head{{font-size:22px;font-weight:700;margin-bottom:24px;}}
    .set-cols{{display:flex;gap:40px;align-items:flex-start;}}
    .opt,.pop{{background:#161616;border:1px solid #2a2a2a;border-radius:14px;padding:20px;}}
    .opt{{width:560px;box-sizing:border-box;}}
    .opt-head{{display:flex;align-items:center;gap:10px;margin-bottom:18px;}}
    .opt-logo,.pop-logo{{width:30px;height:30px;border-radius:7px;}}
    .opt-head h1{{font-size:18px;margin:0;}}
    .opt-field{{margin-bottom:14px;}}
    .opt-field label{{display:block;font-size:12px;color:#9aa0a6;margin-bottom:5px;}}
    .opt-sel,.opt-input{{background:#0f0f0f;border:1px solid #3a3a3c;border-radius:8px;padding:9px 10px;font-size:13px;color:#e5e5e7;}}
    .opt-hint{{font-size:11px;color:#777;margin:6px 0 0;}}
    .opt-save{{width:100%;padding:10px 0;background:#fff;color:#000;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;margin-top:6px;}}
    .pop{{width:320px;box-sizing:border-box;}}
    .pop-head{{display:flex;align-items:center;gap:10px;margin-bottom:16px;}}
    .pop-title{{font-size:16px;margin:0;flex:1;}}
    .pop-lang span{{font-size:11px;color:#9aa0a6;margin-left:6px;}}
    .pop-desc{{font-size:13px;color:#b0b0b0;line-height:1.6;margin-bottom:18px;}}
    .pop-btn{{width:100%;padding:10px 0;background:#fff;color:#000;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;}}
    </style>
    <div class="set-wrap">
      <div class="set-head">{t['settings']}</div>
      <div class="set-cols">
        {options_html}
        {popup_html}
      </div>
    </div>
    """

BUILDERS = {
    "sidebar-result": screenshot_result,
    "how-it-works": screenshot_how,
    "settings-popup": screenshot_settings,
}

# ---------------------------------------------------------------------------
# 5. Render with Playwright
# ---------------------------------------------------------------------------
def render_all():
    from playwright.sync_api import sync_playwright
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for lang in ("zh", "en"):
        ldir = OUT_DIR / lang
        ldir.mkdir(parents=True, exist_ok=True)
        with sync_playwright() as p:
            browser = p.chromium.launch()
            page = browser.new_page(viewport={"width": SHOT_W, "height": SHOT_H})
            for name, builder in BUILDERS.items():
                html = (
                    "<!doctype html><html><head><meta charset='utf-8'></head><body style='margin:0'>"
                    + builder(lang)
                    + "</body></html>"
                )
                page.set_content(html, wait_until="networkidle")
                out = ldir / f"screenshot-{name}.png"
                page.screenshot(path=str(out), clip={"x": 0, "y": 0, "width": SHOT_W, "height": SHOT_H})
                # Ensure RGB (no alpha) for Chrome Web Store.
                from PIL import Image
                im = Image.open(out).convert("RGB")
                im.save(out)
                print(f"  wrote {out} ({im.size}, {im.mode})")
            browser.close()

if __name__ == "__main__":
    render_all()
    print("Screenshots generated.")
