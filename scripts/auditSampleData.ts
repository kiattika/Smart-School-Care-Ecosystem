/**
 * ตรวจหา "ข้อมูลตัวอย่าง" ทุก collection ใน Firestore — **อ่านอย่างเดียว** รายงานให้มนุษย์ตัดสินใจ (ไม่ลบ/ไม่เขียนอะไร)
 * ผลลัพธ์: docs/sample-data-audit-{YYYY-MM-DD}.md (ไฟล์ในเครื่อง ไม่ใช่ Firestore)
 *
 * ใช้:
 *   npx tsx scripts/auditSampleData.ts                                    # emulator (ต้องตั้ง FIRESTORE_EMULATOR_HOST)
 *   npx tsx scripts/auditSampleData.ts --confirm-production kiattisak-project-001   # production (ADC)
 *   (--dry-run รับไว้เพื่อให้ตรงกับสคริปต์อื่น — สคริปต์นี้ไม่เขียน Firestore อยู่แล้วทุกโหมด)
 *
 * รายชื่อ collection มาจาก listCollections() จริง ไม่ hardcode; กติกาจัดกลุ่มอยู่ที่ scripts/lib/sampleDataAudit.ts
 * ไม่มี FIRESTORE_EMULATOR_HOST และไม่ส่ง --confirm-production <projectId> = ปฏิเสธ (scripts/lib/scriptTarget.ts)
 */
import { mkdirSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import firebaseConfig from '../firebase-applet-config.json';
import { parseScriptArgs, resolveScriptTarget } from './lib/scriptTarget';
import { AuditStore, renderReport, runAudit } from './lib/sampleDataAudit';

const PROJECT_ID = firebaseConfig.projectId;
const DATABASE_ID = firebaseConfig.firestoreDatabaseId;

type RestValue = Record<string, any>;

/** แปลง Firestore REST value → ค่า JS ธรรมดา */
function decodeValue(v: RestValue): unknown {
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('timestampValue' in v) return v.timestampValue;
  if ('nullValue' in v) return null;
  if ('referenceValue' in v) return v.referenceValue;
  if ('arrayValue' in v) return (v.arrayValue.values ?? []).map(decodeValue);
  if ('mapValue' in v) return decodeFields(v.mapValue.fields);
  return JSON.stringify(v);
}
const decodeFields = (fields?: Record<string, RestValue>): Record<string, unknown> =>
  Object.fromEntries(Object.entries(fields ?? {}).map(([k, v]) => [k, decodeValue(v)]));

/**
 * Emulator: REST (GET + listCollectionIds เท่านั้น) — firebase-admin กับ named DB บน emulator ทำ lock ค้าง (ดู seedEmulatorAuth.ts)
 * ⚠️ listCollectionIds เป็น POST แต่เป็น RPC อ่านรายชื่อ collection อย่างเดียว ไม่แก้ข้อมูล
 */
function emulatorStore(host: string): AuditStore {
  const base = `http://${host}/v1/projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents`;
  const headers = { Authorization: 'Bearer owner' };
  async function page(collection: string, fields: string[] | null, pageSize: number, max: number) {
    const out: Array<{ id: string; data: Record<string, unknown> }> = [];
    // mask ว่าง = ได้เฉพาะ id (ใช้ path ที่ไม่มีอยู่จริง)
    const maskFields = fields === null ? [] : fields.length ? fields : ['auditNone'];
    const mask = maskFields.map((f) => `mask.fieldPaths=${encodeURIComponent(f)}`).join('&');
    let token = '';
    do {
      const url = `${base}/${encodeURIComponent(collection)}?pageSize=${pageSize}${mask ? `&${mask}` : ''}${token ? `&pageToken=${encodeURIComponent(token)}` : ''}`;
      const res = await fetch(url, { headers });
      if (!res.ok) throw new Error(`read ${collection}: ${res.status} ${(await res.text()).slice(0, 200)}`);
      const json = await res.json() as { documents?: Array<{ name: string; fields?: Record<string, RestValue> }>; nextPageToken?: string };
      for (const d of json.documents ?? []) out.push({ id: decodeURIComponent(d.name.split('/').pop()!), data: decodeFields(d.fields) });
      token = out.length >= max ? '' : (json.nextPageToken ?? '');
    } while (token);
    return out.slice(0, max);
  }
  return {
    async listCollections() {
      const ids: string[] = [];
      let token = '';
      do {
        const res = await fetch(`${base}:listCollectionIds`, {
          method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ pageSize: 100, ...(token ? { pageToken: token } : {}) }),
        });
        if (!res.ok) throw new Error(`listCollectionIds: ${res.status} ${(await res.text()).slice(0, 200)}`);
        const json = await res.json() as { collectionIds?: string[]; nextPageToken?: string };
        ids.push(...(json.collectionIds ?? []));
        token = json.nextPageToken ?? '';
      } while (token);
      return ids;
    },
    readAll: (c, fields) => page(c, fields, 300, Infinity),
    readFirst: (c, n) => page(c, null, n, n),
  };
}

/** Production: firebase-admin + ADC, named DB เดียวกับ client — ใช้เฉพาะ listCollections / get / select / limit */
async function productionStore(): Promise<AuditStore> {
  const { initializeApp, getApps } = await import('firebase-admin/app');
  const { getFirestore } = await import('firebase-admin/firestore');
  const app = getApps()[0] ?? initializeApp({ projectId: PROJECT_ID });
  const db = getFirestore(app, DATABASE_ID);
  return {
    async listCollections() {
      return (await db.listCollections()).map((c) => c.id);
    },
    async readAll(collection, fields) {
      const snap = await db.collection(collection).select(...fields).get();
      return snap.docs.map((d) => ({ id: d.id, data: d.data() }));
    },
    async readFirst(collection, n) {
      const snap = await db.collection(collection).limit(n).get();
      return snap.docs.map((d) => ({ id: d.id, data: d.data() }));
    },
  };
}

const localDate = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

async function main() {
  const args = parseScriptArgs(process.argv.slice(2));
  if (args.keep.length) throw new Error('--keep ใช้กับ resetAuthClaims.ts เท่านั้น');
  const target = resolveScriptTarget(process.env, 'FIRESTORE_EMULATOR_HOST', args, PROJECT_ID);
  const store = target.kind === 'emulator' ? emulatorStore(target.host) : await productionStore();
  const targetLabel = target.kind === 'emulator' ? `Firestore emulator ${target.host}` : `PRODUCTION ${target.projectId}`;

  console.log(`🎯 เป้าหมาย: ${targetLabel} / database ${DATABASE_ID}`);
  console.log('   โหมด: READ-ONLY (ไม่เขียน/ลบอะไรใน Firestore)\n');

  const audits = await runAudit(store);
  for (const a of audits) console.log(`📄 ${a.name}: ${a.total} docs`);

  const date = localDate();
  const outPath = resolve(process.cwd(), 'docs', `sample-data-audit-${date}.md`);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, renderReport(audits, { date, targetLabel, databaseId: DATABASE_ID }), 'utf8');
  console.log(`\n✅ เขียนรายงานแล้ว: ${outPath}`);
}

main().then(() => process.exit(0)).catch((err) => {
  console.error(`❌ ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});
