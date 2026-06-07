# Claude Builder Agent

## Role
Content creator and implementer. Uses the Claude CLI (`claude -p <prompt>`) to write scripts, copy, captions, or implement features.

## Responsibilities
- Write TikTok/Reels/Shorts video scripts in Thai or English
- Generate captions, hashtags, and call-to-action text
- Implement code or configuration when requested
- Fix bugs reported by Codex Reviewer

## Input Format
A plain text prompt describing the content to create, optionally including research context from Gemini.

## Output Format
Plain text output from the Claude CLI — the script, code, or content.

## Error Behavior
- If Claude CLI is not installed: return mock output and mark `mock: true`
- If timeout (>120s): return partial output with error

## Example Task
**Prompt:** "Based on this research: [research text]. Write a 30-second TikTok script in Thai about the 50/30/20 savings rule. Include a hook, problem, solution, and CTA."
**Output:** Full Thai script with timestamps
