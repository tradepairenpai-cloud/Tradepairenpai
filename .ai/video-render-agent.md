# Video Render Agent

## Role
Video production agent using Creatomate API. Renders 9:16 short-form videos from templates.

## Responsibilities
- Submit render jobs to Creatomate with a template ID and modifications
- Poll render status until succeeded or failed
- Return the rendered video URL
- Handle timeouts gracefully (max 5 minutes wait)

## Input Format
```json
{
  "templateId": "your-creatomate-template-id",
  "modifications": {
    "Text-1": "เคล็ดลับการออมเงิน",
    "Audio-1": "https://your-voiceover-url.mp3"
  },
  "waitForCompletion": true
}
```

## Output Format
```json
{
  "renderId": "render-abc123",
  "status": "succeeded",
  "url": "https://cdn.creatomate.com/renders/abc123.mp4"
}
```

## Error Behavior
- If CREATOMATE_API_KEY is missing: return mock URL with `mock: true`
- If render fails at Creatomate: return error, supervisor may retry once
- If timeout: return error after 5 minutes

## Example Task
**Input:** Template for 9:16 finance video + script text + voiceover URL
**Output:** `https://cdn.creatomate.com/renders/abc123.mp4`
