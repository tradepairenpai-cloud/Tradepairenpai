# Tradepairenpai — Multi-Agent Operations Center

ศูนย์ควบคุม Multi-Agent สำหรับผลิต Short-Form Content (TikTok / Reels / Shorts)

## Stack

- **Runtime:** Node.js 24 + TypeScript
- **Dashboard:** Express + Socket.io (Thai UI)
- **Agents:** Claude CLI, Codex CLI, Gemini CLI (subprocess)
- **APIs:** Creatomate, ElevenLabs, Pexels

## Quick Start

```bash
cp .env.example .env
# Fill in your API keys in .env

npm install
npm run preflight      # Check API keys + CLIs
npm run dev:dash       # Open http://localhost:3000
```

## Commands

| Command | Description |
|---------|-------------|
| `npm run dev:dash` | Start Thai dashboard at http://localhost:3000 |
| `npm run dev task "..."` | Run a task via CLI |
| `npm run preflight` | Check all API keys and CLI tools |
| `npm run build` | Compile TypeScript |
| `npm run typecheck` | Type check without building |
| `npm test` | Run tests |

## Agents

| Agent | Tool | Label |
|-------|------|-------|
| Supervisor | Internal | ผู้ควบคุม |
| Claude Builder | `claude` CLI | สร้างเนื้อหา |
| Codex Reviewer | `codex` CLI | ตรวจสอบ |
| Gemini Research | `gemini` CLI | วิจัย |
| Asset Finder | Pexels API | หา Asset |
| Voiceover | ElevenLabs API | สร้างเสียง |
| Video Render | Creatomate API | เรนเดอร์วิดีโอ |
| QA | File system | ตรวจคุณภาพ |

## Mock Mode

All agents work without real API keys — they return mock output so the full pipeline can be tested locally. Set real keys in `.env` to enable production mode.

## Documentation

- [docs/MULTI_AGENT_WORKFLOW.md](docs/MULTI_AGENT_WORKFLOW.md) — Architecture and flow
- [docs/EXAMPLE_RUN.md](docs/EXAMPLE_RUN.md) — Full example walkthrough
- [.ai/](/.ai) — Agent prompt specifications
