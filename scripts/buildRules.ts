// สร้าง firestore.rules (ไฟล์ที่ deploy — ไม่มีคอมเมนต์) จาก firestore.rules.comments (ฉบับเต็มพร้อมคำอธิบาย)
// ใช้: npm run rules:build — แก้ rules ที่ firestore.rules.comments เท่านั้น (เทสต์ rulesBuild.test.ts จับถ้าสองไฟล์ไม่ตรงกัน)
import { readFileSync, writeFileSync } from 'node:fs';
import { RULES_BYTE_LIMIT, stripRulesComments } from './lib/rulesStrip';

const built = stripRulesComments(readFileSync('firestore.rules.comments', 'utf8'));
writeFileSync('firestore.rules', built, 'utf8');
const bytes = Buffer.byteLength(built, 'utf8');
console.log(`firestore.rules: ${bytes} bytes (เพดาน ${RULES_BYTE_LIMIT}, เหลือ ${RULES_BYTE_LIMIT - bytes})`);
