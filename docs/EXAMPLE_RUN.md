# Example Run

## Task
"Create a 30-second Thai TikTok video about one finance tip for beginners."

## Step-by-Step Workflow

### 1. Gemini Research Agent
**Input:** "Research content angle for: Create a 30-second Thai TikTok video about one finance tip for beginners"

**Output:**
```
Best angle: The 50/30/20 savings rule
Hook: "คุณรู้ไหมว่าคนส่วนใหญ่ใช้เงินเดือนหมดก่อนสิ้นเดือน?"
Key stat: 68% of Thai millennials have no emergency fund
Recommended duration: 30 seconds
Risk: Avoid specific investment product recommendations
```

### 2. Claude Builder Agent
**Input:** Research context + task description

**Output (Thai Script):**
```
[Hook 0-3s]
"คุณรู้ไหมว่าคนส่วนใหญ่ใช้เงินเดือนหมดก่อนสิ้นเดือน?"

[Problem 3-10s]
เพราะไม่มีระบบจัดการเงิน ไม่ใช่เพราะได้เงินน้อย

[Solution 10-22s]
ลองกฎ 50/30/20 เลย
► 50% ค่าใช้จ่ายจำเป็น
► 30% ของที่อยากได้
► 20% ออมเลย!

[CTA 22-30s]
ลองทำตามดูสิ แล้ว comment บอก ตอนนี้ออมเงินเท่าไหร่?
```

### 3. Asset Finder Agent (Pexels)
**Input:** `{ "query": "saving money finance thai", "type": "video", "count": 5 }`

**Output:** 5 portrait (9:16) stock video clips with Pexels CDN URLs

### 4. Voiceover Agent (ElevenLabs) — runs in parallel with step 3
**Input:** Thai script text, language: thai

**Output:** `./outputs/vo-1749123456789.mp3` — 30-second Thai female voice

### 5. Video Render Agent (Creatomate)
**Input:** Template ID + script text + voiceover URL + asset clips

**Output:** `https://cdn.creatomate.com/renders/abc123.mp4`

### 6. Codex Reviewer Agent
**Input:** Script + render URL

**Output:**
```
✅ No factual errors found
✅ No copyright claims
⚠️  Suggest adding: "นี่ไม่ใช่คำแนะนำการเงิน" disclaimer
✅ Platform ready for TikTok
✅ No harmful content
```

### 7. QA Agent
**Checks:**
- ✅ Voiceover file exists: `./outputs/vo-1749123456789.mp3`
- ✅ Video URL provided
- ✅ No copyright text in script
- ✅ Script length OK (< 500 chars)
- ✅ Aspect ratio 9:16
- ✅ Duration ≤ 60s

**Result:** `✅ พร้อมเผยแพร่ — ผ่าน 6/6 การตรวจสอบ`

## Running This Example

```bash
# Copy env file and fill in your API keys
cp .env.example .env

# Install
npm install

# Start dashboard
npm run dev:dash
# Open http://localhost:3000
# Enter: "Create a 30-second Thai TikTok video about one finance tip for beginners"
# Press Enter

# OR via CLI:
npm run dev task "Create a 30-second Thai TikTok video about one finance tip for beginners"
```

## Mock Mode (No API Keys)

Without real API keys, all agents return mock output:
- Claude Builder → returns a sample Thai script
- Gemini Research → returns sample research brief
- Pexels → returns 2 mock asset objects
- ElevenLabs → writes a text placeholder `.mp3` file
- Creatomate → returns a mock render URL
- Codex Reviewer → returns a sample review

The full pipeline runs end-to-end and produces a final report — useful for testing the workflow without spending API credits.
