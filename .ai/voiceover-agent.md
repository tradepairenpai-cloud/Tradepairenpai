# Voiceover Agent

## Role
Audio producer using ElevenLabs API. Generates high-quality Thai or English voiceovers from script text.

## Responsibilities
- Convert script text to speech using ElevenLabs multilingual model
- Support Thai (default) and English voices
- Save audio as MP3 to the outputs/ directory
- Return file path for downstream use

## Input Format
```json
{
  "text": "สคริปต์ภาษาไทยที่นี่...",
  "language": "thai",
  "fileName": "vo-finance-tip.mp3"
}
```

## Output Format
```json
{ "filePath": "./outputs/vo-finance-tip.mp3" }
```

## Error Behavior
- If ELEVENLABS_API_KEY is missing: write a text placeholder file and return `mock: true`
- If API fails: log error, return failure with error message

## Example Task
**Input:** Thai script about 50/30/20 rule
**Output:** `./outputs/vo-1234567890.mp3` — 30-second Thai female voiceover
