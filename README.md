# MindCapsule for YouTube

MindCapsule for YouTube 是一个 Chrome 扩展，用 AI 帮你智能总结 YouTube 视频，变成结构化的知识胶囊。

## 功能

- 在 YouTube 观看页右侧注入侧边栏
- 粘贴视频字幕/文稿后，AI 自动生成四类笔记：
  - 内容摘要（Summary）
  - 关键洞察（Key Insights）
  - 时间线（Timeline）
  - 行动项（Action Items）
- 支持硅基流动（SiliconFlow）和 OpenAI 兼容接口
- API Key 仅保存在本地
- 中英双语界面

## 安装与使用

1. 下载并解压扩展
2. 打开 `chrome:///extensions`，开启「开发者模式」
3. 点击「加载已解压的扩展程序」，选择本项目文件夹
4. 在 YouTube 视频页面点击扩展图标，进入设置填写 API Key
5. 粘贴字幕，点击「生成笔记」

## 技术栈

- Chrome Manifest V3
- Content Script + Service Worker
- `chrome.storage.local` 本地存储
- OpenAI 兼容 Chat Completions API

## 许可证

Non-Commercial License
