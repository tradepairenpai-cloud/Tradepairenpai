# Multi-Agent Workflow

## Architecture

```
User
 │
 ▼
Supervisor Agent
 ├── Gemini Research Agent      (Google Gemini CLI)
 ├── Claude Builder Agent       (Claude CLI)
 ├── Asset Finder Agent         (Pexels API)
 ├── Voiceover Agent            (ElevenLabs API)
 ├── Video Render Agent         (Creatomate API)
 ├── Codex Reviewer Agent       (OpenAI Codex CLI)
 └── QA Agent                   (File system + heuristics)
```

## Agent Roles

| Agent | Tool | Thai Label | Role |
|-------|------|-----------|------|
| Supervisor | Internal | ผู้ควบคุม | Orchestrates all agents |
| Claude Builder | `claude` CLI | สร้างเนื้อหา | Writes scripts and content |
| Codex Reviewer | `codex` CLI | ตรวจสอบ | Reviews quality and safety |
| Gemini Research | `gemini` CLI | วิจัย | Research and ideation |
| Asset Finder | Pexels API | หา Asset | Finds stock media |
| Voiceover | ElevenLabs API | สร้างเสียง | Generates audio |
| Video Render | Creatomate API | เรนเดอร์วิดีโอ | Renders final video |
| QA | File system | ตรวจคุณภาพ | Final quality gate |

## Command Flow

```
1. User submits task via dashboard or CLI
2. Supervisor parses task and creates step plan
3. Gemini researches the topic and angle
4. Claude writes the script based on research
5. Asset Finder (Pexels) + Voiceover (ElevenLabs) run in parallel
6. Video Render (Creatomate) combines assets into 9:16 video
7. Codex reviews the content for quality/safety
8. QA checks all outputs for platform readiness
9. Supervisor compiles the final report
10. Dashboard updates in real-time via WebSocket
```

## API Flow

```
Pexels:      GET /videos/search?query=...&orientation=portrait
ElevenLabs:  POST /v1/text-to-speech/{voice_id}
Creatomate:  POST /v1/renders → GET /v1/renders/{id} (polling)
```

## Error Handling

- **Missing API key**: Agent runs in mock mode, returns placeholder output
- **CLI not installed**: Agent returns mock output with `mock: true` flag
- **API error**: Logged, returned as failed step; Supervisor continues
- **Step failure**: Logged in final report; other steps continue
- **Render timeout**: After 5 minutes, marked as failed

## Fix Loop

If a step fails:
1. Supervisor logs the error
2. Retries the step once
3. If still fails: marks step as `failed`, continues pipeline
4. QA will flag missing outputs
5. Final report includes all errors

## Commands

```bash
# Install dependencies
npm install

# Check API keys and CLIs
npm run preflight

# Start dashboard (Thai UI at http://localhost:3000)
npm run dev:dash

# Run a task via CLI
npm run dev task "สร้างวิดีโอ TikTok เกี่ยวกับการออมเงิน"

# Build for production
npm run build

# Run production dashboard
npm run start:dash
```
