# YouTube Publisher Package

## Target Channel

| Field | Value |
|-------|-------|
| Channel ID | `UC1T5c2VEolzUDEEgA1fzQlg` |
| Channel URL | https://www.youtube.com/channel/UC1T5c2VEolzUDEEgA1fzQlg |
| Category | Education |
| Made for Kids | false |

## Upload Visibility Setting

**Upload visibility setting: `private`**

Every video uploaded by the Publisher Agent will have `privacyStatus: "private"` in the YouTube Data API v3 request payload.

This is enforced at two levels:
1. **`getYoutubeVisibility()`** in `src/lib/config.ts` — always returns `'private'` unless `YOUTUBE_VISIBILITY` is explicitly set to `public` or `unlisted`.
2. **`uploadToYouTube()`** in `src/lib/youtube-publisher.ts` — passes the resolved visibility directly into the `status.privacyStatus` field.

### To change visibility later

Edit `.env`:
```
YOUTUBE_VISIBILITY=public     # makes uploaded videos public
YOUTUBE_VISIBILITY=unlisted   # makes uploaded videos unlisted
YOUTUBE_VISIBILITY=private    # (default) private — only visible to channel owner
```

Restart the server after changing:
```bash
npm run dev:dash
```

## Auto Publish Config

```
YOUTUBE_AUTO_PUBLISH=true
YOUTUBE_REQUIRE_OWNER_APPROVAL=false
YOUTUBE_PUBLISH_MODE=AUTO_PUBLISH
YOUTUBE_CHANNEL_ID=UC1T5c2VEolzUDEEgA1fzQlg
YOUTUBE_CATEGORY=Education
YOUTUBE_MADE_FOR_KIDS=false
```

## Platform Access Control

Only `youtube` is allowed. All other platforms are permanently blocked:

```
PUBLISH_ALLOWED_PLATFORMS=youtube
PUBLISH_BLOCKED_PLATFORMS=tiktok,facebook,instagram,meta,buffer,metricool,later,zapier,make,n8n
NON_YOUTUBE_PUBLISHER_LOCKED=true
REQUIRE_OWNER_APPROVAL_FOR_NON_YOUTUBE=true
APPROVE_NON_YOUTUBE_PUBLISH=false
```

## OAuth Requirements

YouTube Data API v3 requires OAuth 2.0 for uploads. An API Key alone is read-only.

Set `YOUTUBE_OAUTH_TOKEN` in `.env` after completing the Google OAuth consent flow:
- Go to: https://developers.google.com/youtube/v3/guides/uploading_a_video
- Complete OAuth 2.0 flow for the channel `UC1T5c2VEolzUDEEgA1fzQlg`
- Set the access token in `.env`: `YOUTUBE_OAUTH_TOKEN=ya29.xxx...`

## Security Rules

- OAuth token is **never** logged to console, logs, or frontend
- All log output passes through `sanitize()` before transmission
- `YOUTUBE_VISIBILITY` defaults to `private` — never inferred from `NODE_ENV`
- Non-YouTube platforms are blocked at the agent level before any API call is made
