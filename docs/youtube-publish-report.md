# YouTube Publish Report Template

Each upload attempt by the Publisher Agent generates a report with the following fields.

---

## Report Fields

| Field | Description | Example |
|-------|-------------|---------|
| `targetChannelId` | YouTube channel ID from `YOUTUBE_CHANNEL_ID` | `UC1T5c2VEolzUDEEgA1fzQlg` |
| `visibilityUsed` | Privacy status sent to YouTube API | `private` |
| `uploadAttempted` | Whether an upload was attempted | `true` / `false` |
| `uploadedAsPrivate` | Whether the video was successfully uploaded as private | `true` / `false` |
| `videoId` | YouTube video ID (if successful) | `dQw4w9WgXcQ` |
| `youtubeUrl` | Full YouTube watch URL (if successful) | `https://www.youtube.com/watch?v=...` |
| `error` | Error message if upload failed | `YOUTUBE_OAUTH_TOKEN ยังไม่ได้ตั้งค่า` |
| `timestamp` | ISO timestamp of the upload attempt | `2026-06-08T00:00:00.000Z` |
| `demoMode` | Whether the upload was a mock (demo mode) | `false` |

---

## Example: Successful Private Upload

```json
{
  "targetChannelId": "UC1T5c2VEolzUDEEgA1fzQlg",
  "visibilityUsed": "private",
  "uploadAttempted": true,
  "uploadedAsPrivate": true,
  "videoId": "dQw4w9WgXcQ",
  "youtubeUrl": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  "error": null,
  "timestamp": "2026-06-08T00:00:00.000Z",
  "demoMode": false
}
```

## Example: Failed (No OAuth Token)

```json
{
  "targetChannelId": "UC1T5c2VEolzUDEEgA1fzQlg",
  "visibilityUsed": "private",
  "uploadAttempted": false,
  "uploadedAsPrivate": false,
  "videoId": null,
  "youtubeUrl": null,
  "error": "YOUTUBE_OAUTH_TOKEN ยังไม่ได้ตั้งค่า — ต้องผ่าน OAuth 2.0 consent flow ก่อน",
  "timestamp": "2026-06-08T00:00:00.000Z",
  "demoMode": false
}
```

## Example: Demo Mode (Mock Upload)

```json
{
  "targetChannelId": "UC1T5c2VEolzUDEEgA1fzQlg",
  "visibilityUsed": "private",
  "uploadAttempted": true,
  "uploadedAsPrivate": true,
  "videoId": "demo_private",
  "youtubeUrl": "https://www.youtube.com/watch?v=demo_private",
  "error": null,
  "timestamp": "2026-06-08T00:00:00.000Z",
  "demoMode": true
}
```

---

## Privacy Guarantee

The `visibilityUsed` field in every report will reflect the value from `YOUTUBE_VISIBILITY` env var.

- If `YOUTUBE_VISIBILITY` is missing → `"private"`
- If `YOUTUBE_VISIBILITY=private` → `"private"`
- If `YOUTUBE_VISIBILITY=unlisted` → `"unlisted"`
- If `YOUTUBE_VISIBILITY=public` → `"public"` *(only when explicitly set)*

A video will **never** be uploaded as `"public"` unless `YOUTUBE_VISIBILITY=public` is set in `.env`.

---

## Non-YouTube Platform Block Report

If a blocked platform is attempted:

```json
{
  "platform": "tiktok",
  "status": "skipped",
  "message": "[PLATFORM GUARD] tiktok ถูกบล็อก — ระบบอนุญาตเฉพาะ [youtube]"
}
```
