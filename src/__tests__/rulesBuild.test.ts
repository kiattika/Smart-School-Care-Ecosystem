import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { RULES_BYTE_LIMIT, stripRulesComments } from '../../scripts/lib/rulesStrip';

const root = path.resolve(__dirname, '../..');
const read = (f: string) => readFileSync(path.join(root, f), 'utf8').replace(/\r\n/g, '\n');

describe('firestore.rules build (ฉบับเต็มมีคอมเมนต์ → ฉบับ deploy)', () => {
  it('firestore.rules ตรงกับผลตัดคอมเมนต์ของ firestore.rules.comments (แก้ที่ .comments แล้วรัน npm run rules:build)', () => {
    expect(read('firestore.rules')).toBe(stripRulesComments(read('firestore.rules.comments')));
  });

  it('ไฟล์ที่ deploy ไม่เกินเพดาน 262,144 ไบต์ (เหลือที่ให้เพิ่มกฎอย่างน้อย 20 KB)', () => {
    const bytes = Buffer.byteLength(read('firestore.rules'), 'utf8');
    expect(bytes).toBeLessThan(RULES_BYTE_LIMIT - 20_000);
  });

  it('stripRulesComments ไม่ตัด // ที่อยู่ในสตริง (URL ใน regex) และตัดคอมเมนต์ท้ายบรรทัด', () => {
    const src = "rules_version = '2';\n// ทั้งบรรทัด\nx.matches('^https://a/b') && y // ท้ายบรรทัด\n";
    const out = stripRulesComments(src);
    expect(out).toContain("x.matches('^https://a/b') && y");
    expect(out).not.toContain('ท้ายบรรทัด');
    expect(out).not.toContain('ทั้งบรรทัด');
    expect(out.split('\n')[0]).toBe("rules_version = '2';");
  });
});
