import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import firebaseConfig from '../../firebase-applet-config.json';
import firebaseJson from '../../firebase.json';
import { FIRESTORE_DATABASE_ID } from '../../functions/src/config';
import { readSource } from './helpers/readSource';

/**
 * Cloud Functions ต้องเขียน/อ่าน named database เดียวกับ client — ถ้าใช้ admin.firestore() เฉย ๆ
 * จะได้ (default) ซึ่งไม่มีใครอ่าน (onUserCreated หา staff ไม่เจอ, assignUserRole เขียนผิดที่)
 */
describe('functions Firestore database id', () => {
  it('matches the client firestoreDatabaseId in firebase-applet-config.json', () => {
    expect(FIRESTORE_DATABASE_ID).toBe(firebaseConfig.firestoreDatabaseId);
    expect(FIRESTORE_DATABASE_ID).not.toBe('(default)');
  });

  it('every functions source file opens Firestore only via getFirestore(app, FIRESTORE_DATABASE_ID)', () => {
    const dir = path.resolve(__dirname, '../../functions/src');
    for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.ts'))) {
      // ตัด comment ออกก่อน (config.ts อธิบายข้อห้ามนี้ไว้ใน comment)
      const code = readSource(path.join(dir, file))
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*$/gm, '');
      expect(code, `${file}: admin.firestore()`).not.toMatch(/admin\s*\.\s*firestore\s*\(/);
      // ทุกการเรียก getFirestore( ... ) (ไม่นับ import) ต้องมี FIRESTORE_DATABASE_ID เป็น argument ที่ 2
      const calls = code.match(/getFirestore\s*\(.*$/gm) ?? [];
      for (const call of calls) {
        expect(call, `${file}: ${call}`).toMatch(/getFirestore\s*\(\s*[\w.]+(\(\))?\s*,\s*FIRESTORE_DATABASE_ID\s*\)/);
      }
    }
  });
});

/** firebase.json → firestore.database ต้องชี้ named DB เดียวกัน ไม่งั้น rules/indexes deploy ไปที่ (default) */
describe('firebase.json firestore target', () => {
  it('deploys rules and indexes to the client firestoreDatabaseId', () => {
    const fsBlock = (firebaseJson as { firestore: { database?: string; rules?: string; indexes?: string } }).firestore;
    expect(fsBlock.database).toBe(firebaseConfig.firestoreDatabaseId);
    expect(fsBlock.rules).toBe('firestore.rules');
    expect(fsBlock.indexes).toBe('firestore.indexes.json');
  });
});
