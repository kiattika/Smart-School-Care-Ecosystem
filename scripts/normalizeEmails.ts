/**
 * แก้อีเมลใน staff / teachers / students ที่มีอยู่แล้วให้เป็นรูปแบบมาตรฐาน (ตัดอักขระล่องหน + trim + lowercase)
 * — blocking functions ค้นด้วย `where('email', '==', <lowercase>)` แบบตรงตัว อีเมลเก่าที่ไม่ normalize
 * ทำให้คนในทะเบียนถูกปฏิเสธการ login
 *
 * ใช้:
 *   npx tsx scripts/normalizeEmails.ts --dry-run                 # emulator (ต้องตั้ง FIRESTORE_EMULATOR_HOST)
 *   npx tsx scripts/normalizeEmails.ts                           # emulator — เขียนจริง
 *   npx tsx scripts/normalizeEmails.ts --dry-run --confirm-production kiattisak-project-001
 *   npx tsx scripts/normalizeEmails.ts --confirm-production kiattisak-project-001   # production (ADC)
 *
 * แสดงรายการแก้ทั้งหมด + อีเมลที่ซ้ำกันหลัง normalize (ต้องให้ admin แก้เอง ไม่แก้ให้อัตโนมัติ)
 * ไม่มี FIRESTORE_EMULATOR_HOST และไม่ส่ง --confirm-production <projectId> = ปฏิเสธ (scripts/lib/scriptTarget.ts)
 */
import firebaseConfig from '../firebase-applet-config.json';
import { EMAIL_FIELDS, EmailDocSnapshot, EmailFix, planEmailFixes } from '../src/lib/normalizeEmail';
import { parseScriptArgs, resolveScriptTarget } from './lib/scriptTarget';

const PROJECT_ID = firebaseConfig.projectId;
const DATABASE_ID = firebaseConfig.firestoreDatabaseId;
const COLLECTIONS = Object.keys(EMAIL_FIELDS) as Array<keyof typeof EMAIL_FIELDS>;

interface EmailStore {
  list(collection: string): Promise<EmailDocSnapshot[]>;
  apply(fixes: EmailFix[]): Promise<void>;
}

/**
 * Emulator: ใช้ REST เท่านั้น — firebase-admin SDK เขียน named DB บน Firestore emulator แล้ว transaction lock ค้าง
 * จนต้อง restart emulator (เหตุผลเดียวกับ seedEmulatorAuth.ts)
 */
function emulatorStore(host: string): EmailStore {
  const base = `http://${host}/v1/projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents`;
  const headers = { Authorization: 'Bearer owner', 'Content-Type': 'application/json' };
  return {
    async list(collection) {
      const out: EmailDocSnapshot[] = [];
      const mask = EMAIL_FIELDS[collection as keyof typeof EMAIL_FIELDS].map((f) => `mask.fieldPaths=${f}`).join('&');
      let pageToken = '';
      do {
        const res = await fetch(`${base}/${collection}?pageSize=300&${mask}${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`, { headers });
        if (!res.ok) throw new Error(`list ${collection}: ${res.status} ${(await res.text()).slice(0, 200)}`);
        const json = await res.json() as { documents?: Array<{ name: string; fields?: Record<string, { stringValue?: string }> }>; nextPageToken?: string };
        for (const d of json.documents ?? []) {
          const fields: Record<string, unknown> = {};
          for (const [k, v] of Object.entries(d.fields ?? {})) fields[k] = v.stringValue;
          out.push({ collection, id: decodeURIComponent(d.name.split('/').pop()!), fields });
        }
        pageToken = json.nextPageToken ?? '';
      } while (pageToken);
      return out;
    },
    async apply(fixes) {
      for (const f of fixes) {
        const url = `${base}/${f.collection}/${encodeURIComponent(f.id)}?updateMask.fieldPaths=${f.field}&currentDocument.exists=true`;
        const res = await fetch(url, { method: 'PATCH', headers, body: JSON.stringify({ fields: { [f.field]: { stringValue: f.after } } }) });
        if (!res.ok) throw new Error(`update ${f.collection}/${f.id}.${f.field}: ${res.status} ${(await res.text()).slice(0, 200)}`);
      }
    },
  };
}

/** Production: firebase-admin + Application Default Credentials, named DB เดียวกับ client */
async function productionStore(): Promise<EmailStore> {
  const { initializeApp, getApps } = await import('firebase-admin/app');
  const { getFirestore } = await import('firebase-admin/firestore');
  const app = getApps()[0] ?? initializeApp({ projectId: PROJECT_ID });
  const db = getFirestore(app, DATABASE_ID);
  return {
    async list(collection) {
      const snap = await db.collection(collection).select(...EMAIL_FIELDS[collection as keyof typeof EMAIL_FIELDS]).get();
      return snap.docs.map((d) => ({ collection, id: d.id, fields: d.data() }));
    },
    async apply(fixes) {
      // update ทีละ doc (ไม่ใช่ batch 500) — ล้มกลางทางแล้วรันซ้ำได้ เพราะ doc ที่แก้แล้วจะไม่อยู่ในแผนรอบถัดไป
      for (const f of fixes) await db.collection(f.collection).doc(f.id).update({ [f.field]: f.after });
    },
  };
}

async function main() {
  const args = parseScriptArgs(process.argv.slice(2));
  if (args.keep.length) throw new Error('--keep ใช้กับ resetAuthClaims.ts เท่านั้น');
  const target = resolveScriptTarget(process.env, 'FIRESTORE_EMULATOR_HOST', args, PROJECT_ID);
  const store = target.kind === 'emulator' ? emulatorStore(target.host) : await productionStore();

  console.log(`🎯 เป้าหมาย: ${target.kind === 'emulator' ? `Firestore emulator ${target.host}` : `PRODUCTION ${target.projectId}`} / database ${DATABASE_ID}`);
  console.log(`   โหมด: ${args.dryRun ? 'DRY RUN (ไม่เขียนอะไร)' : 'เขียนจริง'}\n`);

  const docs: EmailDocSnapshot[] = [];
  for (const c of COLLECTIONS) {
    const list = await store.list(c);
    console.log(`📄 ${c}: ${list.length} docs`);
    docs.push(...list);
  }

  const { fixes, duplicates } = planEmailFixes(docs);

  console.log(`\n✏️  ต้องแก้ ${fixes.length} รายการ`);
  for (const f of fixes) console.log(`   ${f.collection}/${f.id}.${f.field}: ${JSON.stringify(f.before)} → ${JSON.stringify(f.after)}`);

  if (duplicates.length) {
    console.log(`\n⚠️  อีเมลซ้ำหลัง normalize ${duplicates.length} รายการ — blocking function จะปฏิเสธการ login (AMBIGUOUS_RECORD) ต้องแก้ข้อมูลเอง:`);
    for (const d of duplicates) console.log(`   ${d.collection}: ${d.email} ← ${d.ids.join(', ')}`);
  }

  if (args.dryRun || fixes.length === 0) {
    console.log(args.dryRun ? '\n(dry run — ไม่ได้เขียนอะไร)' : '\nไม่มีอะไรต้องแก้');
    return;
  }
  await store.apply(fixes);
  console.log(`\n✅ แก้แล้ว ${fixes.length} รายการ`);
}

main().then(() => process.exit(0)).catch((err) => {
  console.error(`❌ ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});
