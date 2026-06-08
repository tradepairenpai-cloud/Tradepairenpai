'use strict';
// YouTube OAuth Setup Script
// รัน: npm run youtube:auth   (หรือ node scripts/youtube-auth.js)
// ต้องมี server ทำงานอยู่ก่อน: npm run dev:dash

require('dotenv').config();

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const YOUTUBE_SCOPE   = 'https://www.googleapis.com/auth/youtube.upload';
const SEP  = '═'.repeat(65);
const LINE = '─'.repeat(65);

// ── Auto-detect redirect URI ────────────────────────────────────────────────
// Priority: YOUTUBE_REDIRECT_URI env → GitHub Codespace → localhost fallback
function resolveRedirectUri() {
  const explicit = process.env.YOUTUBE_REDIRECT_URI || '';
  if (explicit) return explicit;

  const codespaceName = process.env.CODESPACE_NAME || '';
  const forwardDomain = process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN || '';
  const port          = process.env.APP_PORT || '3000';

  if (codespaceName && forwardDomain) {
    return `https://${codespaceName}-${port}.${forwardDomain}/api/auth/youtube/callback`;
  }
  return `http://localhost:${port}/api/auth/youtube/callback`;
}

const clientId     = process.env.YOUTUBE_CLIENT_ID     || '';
const clientSecret = process.env.YOUTUBE_CLIENT_SECRET || '';
const channelId    = process.env.YOUTUBE_CHANNEL_ID    || 'UC1T5c2VEolzUDEEgA1fzQlg';
const redirectUri  = resolveRedirectUri();

// ── Detect environment ──────────────────────────────────────────────────────
const isCodespace  = !!(process.env.CODESPACE_NAME && process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN);

console.log('');
console.log(SEP);
console.log('   YouTube OAuth Setup — AI Agent Ops Control Center');
console.log(SEP);
console.log('');

if (isCodespace) {
  console.log('🖥️  Environment: GitHub Codespace');
  console.log('   Server URL  : https://' + process.env.CODESPACE_NAME + '-' + (process.env.APP_PORT || '3000') + '.' + process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN);
} else {
  console.log('🖥️  Environment: Local');
  console.log('   Server URL  : http://localhost:' + (process.env.APP_PORT || '3000'));
}
console.log('');

// ── ตรวจ prerequisites ────────────────────────────────────────────────────
let hasError = false;

if (!clientId) {
  console.error('❌  YOUTUBE_CLIENT_ID ยังไม่ได้ตั้งค่า');
  console.error('   ใส่ค่านี้ใน .env:');
  console.error('   YOUTUBE_CLIENT_ID=xxx.apps.googleusercontent.com');
  console.error('');
  hasError = true;
} else {
  console.log('✅  YOUTUBE_CLIENT_ID  : ' + clientId.slice(0, 24) + '...');
}

if (!clientSecret) {
  console.error('❌  YOUTUBE_CLIENT_SECRET ยังไม่ได้ตั้งค่า');
  console.error('');
  console.error('   กรุณาใส่ YOUTUBE_CLIENT_SECRET จาก Google Cloud Console ในไฟล์ .env');
  console.error('');
  console.error('   วิธีหา Client Secret:');
  console.error('   1. ไปที่ https://console.cloud.google.com/apis/credentials');
  console.error('   2. คลิก OAuth 2.0 Client ID ที่สร้างไว้');
  console.error('   3. คัดลอก "Client secret" → วางใน .env');
  console.error('      YOUTUBE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxxxxxxxxx');
  console.error('');
  hasError = true;
} else {
  console.log('✅  YOUTUBE_CLIENT_SECRET: [ตั้งค่าแล้ว — ไม่แสดงค่า]');
}

console.log('✅  YOUTUBE_CHANNEL_ID  : ' + channelId);
console.log('');
console.log('🔗  Redirect URI ที่ระบบใช้จริง:');
console.log('    ' + redirectUri);
console.log('');

// ── ตรวจสอบว่า redirect URI ตรงกับที่ตั้งใน env ──────────────────────────
if (process.env.YOUTUBE_REDIRECT_URI && process.env.YOUTUBE_REDIRECT_URI !== redirectUri) {
  console.warn('⚠️  YOUTUBE_REDIRECT_URI ใน .env ไม่ตรงกับ auto-detected URI');
  console.warn('   ใน .env  : ' + process.env.YOUTUBE_REDIRECT_URI);
  console.warn('   ที่ควรใช้: ' + redirectUri);
  console.warn('');
}

if (hasError) {
  console.log(LINE);
  console.log('⚠️  แก้ไขค่าที่ขาดใน .env แล้วรัน npm run youtube:auth ใหม่อีกครั้ง');
  console.log('');
  process.exit(1);
}

// ── สร้าง OAuth URL ───────────────────────────────────────────────────────
const params = new URLSearchParams({
  client_id:     clientId,
  redirect_uri:  redirectUri,
  response_type: 'code',
  scope:         YOUTUBE_SCOPE,
  access_type:   'offline',
  prompt:        'consent',
});
const authUrl = GOOGLE_AUTH_URL + '?' + params.toString();

// ── แสดงผล ────────────────────────────────────────────────────────────────
console.log('╔══ ต้องทำก่อน: Google Cloud Console ══════════════════════════╗');
console.log('║                                                               ║');
console.log('║  เพิ่ม URI นี้ใน Authorized redirect URIs:                   ║');
console.log('║                                                               ║');
console.log('  ' + redirectUri);
console.log('║                                                               ║');
console.log('║  1. ไปที่ console.cloud.google.com/apis/credentials          ║');
console.log('║  2. คลิก OAuth 2.0 Client ID ของคุณ                          ║');
console.log('║  3. Authorized redirect URIs → + ADD URI                     ║');
console.log('║  4. วาง URI ข้างบน → SAVE                                    ║');
console.log('║  5. รอ 1-5 นาทีก่อน login                                   ║');
console.log('╚═══════════════════════════════════════════════════════════════╝');
console.log('');
console.log('ขั้นตอนการ Login:');
console.log('');
console.log('  1. ตรวจสอบว่า server ทำงานอยู่: npm run dev:dash');
console.log('  2. เปิด URL ด้านล่างในเบราว์เซอร์:');
console.log('');
console.log(LINE);
console.log('');
console.log(authUrl);
console.log('');
console.log(LINE);
console.log('');
console.log('  3. เลือกบัญชี Google ของช่อง: ' + channelId);
console.log('  4. กด "Allow" อนุญาตสิทธิ์ youtube.upload');
console.log('  5. ระบบจะ redirect กลับมาที่: ' + redirectUri);
console.log('  6. YOUTUBE_OAUTH_TOKEN และ YOUTUBE_REFRESH_TOKEN บันทึกอัตโนมัติ');
console.log('');
console.log(LINE);
console.log('Scope      : ' + YOUTUBE_SCOPE);
console.log('access_type: offline (ได้ refresh_token ด้วย)');
console.log('prompt     : consent (รับ refresh_token ทุกครั้ง)');
console.log('Visibility : ' + (process.env.YOUTUBE_VISIBILITY || 'private') + ' (ค่า default)');
console.log('');

if (isCodespace) {
  console.log('💡 Codespace note:');
  console.log('   ถ้า port 3000 ยังไม่ได้ set เป็น Public → เปิดใน VS Code:');
  console.log('   PORTS tab → port 3000 → คลิกขวา → Port Visibility → Public');
  console.log('');
}
