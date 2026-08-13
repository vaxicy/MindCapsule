# MindCapsule - AI Video Notes Chrome Extension

## Product Overview

MindCapsule is an AI-powered Chrome Extension that transforms long-form YouTube videos into structured knowledge notes.

The extension integrates into YouTube pages and provides an AI-powered sidebar that helps users quickly understand video content.

Core features:
- AI Summary
- Key Insights
- Structured Notes
- Timeline
- Action Items

Product slogan:

Turn every video into a knowledge capsule.

---

## Design Direction

Inspired by:

- KERN AI
- Linear
- Raycast

Style:

- AI infrastructure
- Premium SaaS
- Minimal technology
- Futuristic
- Professional

Color system:

Black #000000
White #FFFFFF
Accent Red #FF0000

---

## MVP Features

### YouTube Sidebar

Inject an AI notes panel into YouTube watch pages.

Sections:

- Summary
- Key Insights
- Timeline
- Action Items

### AI Summary

Generate concise summaries from video transcripts.

### Key Insights

Extract important concepts and ideas.

### Timeline

Generate important timestamps.

### Action Items

Extract practical steps.

---

## Transcript Strategy

MVP:

1. User pasted transcript
2. Available YouTube transcript extraction

Future:

- Automatic subtitle detection
- Multi-language support

---

## Technical Stack

Chrome Extension:

- Manifest V3
- HTML
- CSS
- JavaScript

APIs:

- Content Scripts
- Background Service Worker
- Chrome Storage API

AI:

- OpenAI API
- Claude API
- Gemini API

---

## Project Structure

mindcapsule-extension/

manifest.json

background/
- service-worker.js

content/
- youtube-sidebar.js
- sidebar.css

popup/
- popup.html
- popup.js
- popup.css

ai/
- ai-service.js

assets/
- logo.png

README.md

---

## Development Roadmap

Phase 1:

- Chrome extension setup
- YouTube sidebar
- AI generation
- Notes display

Phase 2:

- Automatic transcript extraction
- Save history
- Export Markdown

Phase 3:

- Chat with video
- Flashcards
- Learning plans
- Multi-language support

---

## Chrome Store Description

MindCapsule is an AI-powered YouTube notes assistant.

Turn long videos into structured summaries, key insights, timestamps, and actionable knowledge.

Understand more. Remember more.
