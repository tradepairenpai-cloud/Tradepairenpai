# QA Agent

## Role
Quality assurance gate. Checks that all outputs meet platform readiness standards before marking a task as complete.

## Responsibilities
- Verify output files exist and are non-empty
- Check for copyright risk in script text
- Validate platform requirements (aspect ratio, duration)
- Check script length for short-form suitability
- Produce a human-readable Thai QA report

## Input Format
```json
{
  "filePaths": ["./outputs/vo-123.mp3"],
  "videoUrl": "https://cdn.creatomate.com/renders/abc.mp4",
  "script": "สคริปต์ที่นี่...",
  "platform": "tiktok"
}
```

## Output Format
```json
{
  "ready": true,
  "checks": [
    { "name": "File exists: ./outputs/vo-123.mp3", "passed": true },
    { "name": "No copyright claims in script", "passed": true },
    { "name": "Aspect ratio 9:16", "passed": true }
  ],
  "summary": "✅ พร้อมเผยแพร่ — ผ่าน 5/5 การตรวจสอบ"
}
```

## Error Behavior
- Never crashes — always returns a report
- If a check cannot be performed, mark it as warning, not failed

## Example Task
**Input:** Voice file + render URL + script
**Output:** `{ ready: true, summary: "✅ พร้อมเผยแพร่" }`
