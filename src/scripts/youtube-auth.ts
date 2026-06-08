import * as dotenv from 'dotenv';
import { getYouTubeAuthUrl } from '../lib/youtube-oauth';

dotenv.config();

const redirectUri = process.env['YOUTUBE_REDIRECT_URI'] || 'http://localhost:3000/api/auth/youtube/callback';
const url = getYouTubeAuthUrl();

console.log('');
console.log('═══════════════════════════════════════════════════════════════');
console.log('   YouTube OAuth Setup — AI Agent Ops Control Center');
console.log('═══════════════════════════════════════════════════════════════');
console.log('');

if (!process.env['YOUTUBE_CLIENT_ID']) {
  console.error('❌  YOUTUBE_CLIENT_ID ยังไม่ได้ตั้งค่า');
  console.error('');
  console.error('   วิธีตั้งค่า:');
  console.error('   1. ไปที่ https://console.cloud.google.com/apis/credentials');
  console.error('   2. สร้าง OAuth 2.0 Client ID (Web application)');
  console.error('   3. เพิ่ม Authorized redirect URI:');
  console.error(`      ${redirectUri}`);
  console.error('   4. ใส่ค่าใน .env:');
  console.error('      YOUTUBE_CLIENT_ID=your-client-id.apps.googleusercontent.com');
  console.error('      YOUTUBE_CLIENT_SECRET=your-client-secret');
  console.error('');
  process.exit(1);
}

if (!process.env['YOUTUBE_CLIENT_SECRET']) {
  console.error('❌  YOUTUBE_CLIENT_SECRET ยังไม่ได้ตั้งค่า');
  console.error('   ใส่ YOUTUBE_CLIENT_SECRET=your-client-secret ใน .env');
  console.error('');
  process.exit(1);
}

console.log('✅  YOUTUBE_CLIENT_ID พร้อมแล้ว');
console.log('✅  YOUTUBE_CLIENT_SECRET พร้อมแล้ว');
console.log('');
console.log('ขั้นตอน:');
console.log('  1. ตรวจสอบว่า server กำลังทำงานอยู่ (npm run dev:dash)');
console.log('  2. เปิด URL ด้านล่างในเบราว์เซอร์');
console.log('  3. เลือกบัญชี Google ของช่อง UC1T5c2VEolzUDEEgA1fzQlg');
console.log('  4. กด Allow (อนุญาต)');
console.log('  5. ระบบจะบันทึก YOUTUBE_OAUTH_TOKEN และ YOUTUBE_REFRESH_TOKEN ใน .env โดยอัตโนมัติ');
console.log('');
console.log('─────────────────────────────────────────────────────────────');
console.log('Authorization URL:');
console.log('');
console.log(url);
console.log('');
console.log('─────────────────────────────────────────────────────────────');
console.log(`Redirect URI: ${redirectUri}`);
console.log('');
console.log('Scope: https://www.googleapis.com/auth/youtube.upload');
console.log('Access Type: offline (ได้ refresh_token ด้วย)');
console.log('');
