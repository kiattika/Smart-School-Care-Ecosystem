/**
 * ลบ "ข้อมูลตัวอย่าง" ถาวร: เอกสาร Firestore ตาม --collections (+ บัญชี Firebase Auth ของบุคลากรที่ถูกลบ ถ้าส่ง --delete-auth-accounts)
 * ⚠️ ลบถาวร กู้คืนไม่ได้ — ค่าเริ่มต้นเป็น DRY RUN เสมอ ต้องส่ง --execute ถึงจะลบจริง
 *
 * ใช้ (ลอง dry-run ก่อนเสมอ):
 *   # emulator (ต้องตั้ง FIRESTORE_EMULATOR_HOST และถ้ามี --delete-auth-accounts ต้องตั้ง FIREBASE_AUTH_EMULATOR_HOST ด้วย)
 *   npx tsx scripts/deleteSampleData.ts --collections staff,teachers,students
 *   npx tsx scripts/deleteSampleData.ts --collections staff,teachers --delete-auth-accounts
 *   npx tsx scripts/deleteSampleData.ts --collections staff,teachers --delete-auth-accounts --execute
 *   # production (ADC) — dry-run:
 *   npx tsx scripts/deleteSampleData.ts --collections staff,teachers,students --confirm-production kiattisak-project-001
 *   npx tsx scripts/deleteSampleData.ts --collections staff,teachers --delete-auth-accounts --confirm-production kiattisak-project-001
 *   # production — ลบจริง (ต้องมีทั้งสองแฟล็ก; Claude ห้ามรันเอง):
 *   npx tsx scripts/deleteSampleData.ts --collections ... --confirm-production kiattisak-project-001 --execute
 *
 * - --collections บังคับ ไม่มีค่าเริ่มต้น และต้องอยู่ใน ALLOWED_COLLECTIONS (scripts/lib/deleteSampleData.ts)
 * - kiattika@utd.ac.th ไม่ถูกลบเด็ดขาด ทั้งเอกสาร staff/teachers และบัญชี Auth
 * - ลำดับ: ลบเอกสาร Firestore ก่อน แล้วค่อยลบบัญชี Auth (ถ้าลบเอกสารล้มเหลวบางส่วน จะไม่ลบ Auth เลย)
 * - ไม่ลบ subcollection ใต้เอกสาร (Firestore ไม่ลบให้อัตโนมัติ)
 */
import firebaseConfig from '../firebase-applet-config.json';
import { resolveScriptTarget } from './lib/scriptTarget';
import {
  AuthPort,
  AuthUser,
  collectProtectedIds,
  DeleteStore,
  parseDeleteArgs,
  planAuthDeletion,
  planFirestoreDeletion,
  PROTECTED_EMAIL,
  RawDoc,
  runAuthDeletion,
  runFirestoreDeletion,
  STAFF_COLLECTIONS,
} from './lib/deleteSampleData';

const PROJECT_ID = firebaseConfig.projectId;
const DATABASE_ID = firebaseConfig.firestoreDatabaseId;

interface FirestoreIo extends DeleteStore {
  /** อ่านเฉพาะ id + email */
  list(collection: string): Promise<RawDoc[]>;
}

/** Emulator: REST เท่านั้น (firebase-admin เขียน named DB บน emulator แล้ว lock ค้าง — ดู seedEmulatorAuth.ts) */
function emulatorIo(host: string): FirestoreIo {
  const resource = `projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents`;
  const base = `http://${host}/v1/${resource}`;
  const headers = { Authorization: 'Bearer owner', 'Content-Type': 'application/json' };
  return {
    async list(collection) {
      const out: RawDoc[] = [];
      let pageToken = '';
      do {
        const res = await fetch(`${base}/${collection}?pageSize=300&mask.fieldPaths=email${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`, { headers });
        if (!res.ok) throw new Error(`list ${collection}: ${res.status} ${(await res.text()).slice(0, 200)}`);
        const json = await res.json() as { documents?: Array<{ name: string; fields?: { email?: { stringValue?: string } } }>; nextPageToken?: string };
        for (const d of json.documents ?? []) out.push({ id: decodeURIComponent(d.name.split('/').pop()!), email: d.fields?.email?.stringValue });
        pageToken = json.nextPageToken ?? '';
      } while (pageToken);
      return out;
    },
    async deleteBatch(collection, ids) {
      const writes = ids.map((id) => ({ delete: `${resource}/${collection}/${id}` }));
      const res = await fetch(`${base}:commit`, { method: 'POST', headers, body: JSON.stringify({ writes }) });
      if (!res.ok) throw new Error(`commit ${collection}: ${res.status} ${(await res.text()).slice(0, 200)}`);
    },
  };
}

/** Production: firebase-admin + ADC, named DB เดียวกับ client */
async function productionIo(): Promise<FirestoreIo> {
  const { initializeApp, getApps } = await import('firebase-admin/app');
  const { getFirestore } = await import('firebase-admin/firestore');
  const app = getApps()[0] ?? initializeApp({ projectId: PROJECT_ID });
  const db = getFirestore(app, DATABASE_ID);
  return {
    async list(collection) {
      const snap = await db.collection(collection).select('email').get();
      return snap.docs.map((d) => ({ id: d.id, email: d.get('email') }));
    },
    async deleteBatch(collection, ids) {
      const batch = db.batch();
      for (const id of ids) batch.delete(db.collection(collection).doc(id));
      await batch.commit();
    },
  };
}

async function authPort(): Promise<AuthPort> {
  const { initializeApp, getApps } = await import('firebase-admin/app');
  const { getAuth } = await import('firebase-admin/auth');
  const auth = getAuth(getApps()[0] ?? initializeApp({ projectId: PROJECT_ID }));
  return {
    async getUserByEmail(email): Promise<AuthUser | null> {
      try {
        const u = await auth.getUserByEmail(email);
        return { uid: u.uid, email: u.email };
      } catch (err) {
        if ((err as { code?: string }).code === 'auth/user-not-found') return null;
        throw err;
      }
    },
    deleteUser: (uid) => auth.deleteUser(uid),
  };
}

async function main() {
  const args = parseDeleteArgs(process.argv.slice(2));
  const target = resolveScriptTarget(process.env, 'FIRESTORE_EMULATOR_HOST', args, PROJECT_ID);
  if (args.deleteAuthAccounts) {
    // Firestore กับ Auth ต้องเป็นเป้าหมายเดียวกัน (ไม่ให้ Firestore emulator คู่กับ Auth production หรือกลับกัน)
    const authTarget = resolveScriptTarget(process.env, 'FIREBASE_AUTH_EMULATOR_HOST', args, PROJECT_ID);
    if (authTarget.kind !== target.kind) throw new Error('Firestore กับ Auth ชี้คนละเป้าหมาย (emulator/production) — ปฏิเสธ');
  }
  const io = target.kind === 'emulator' ? emulatorIo(target.host) : await productionIo();

  console.log(`🎯 เป้าหมาย: ${target.kind === 'emulator' ? `Firestore emulator ${target.host}` : `PRODUCTION ${target.projectId}`} / database ${DATABASE_ID}`);
  console.log(`   โหมด: ${args.execute ? '⚠️  EXECUTE — ลบจริง ถาวร' : 'DRY RUN (ไม่ลบอะไร) — ส่ง --execute เพื่อลบจริง'}`);
  console.log(`   collections: ${args.collections.join(', ')}`);
  console.log(`   ลบบัญชี Auth: ${args.deleteAuthAccounts ? 'ใช่' : 'ไม่'}`);
  console.log(`   ยกเว้นเสมอ: ${PROTECTED_EMAIL}\n`);

  // อ่านเอกสาร — อ่าน staff/teachers เสมอเพื่อหา id ที่ต้องคุ้มครอง แม้ไม่ได้เลือกลบ
  const toRead = new Set<string>([...args.collections, ...STAFF_COLLECTIONS]);
  const docs: Record<string, RawDoc[]> = {};
  for (const c of toRead) docs[c] = await io.list(c);

  const plan = planFirestoreDeletion(args.collections, docs);
  const protectedIds = collectProtectedIds(docs);

  console.log('📄 เอกสาร Firestore ที่จะลบ:');
  for (const c of args.collections) {
    console.log(`  ${c}: ${plan.toDelete[c].length} docs`);
    for (const id of plan.toDelete[c]) console.log(`     - ${id}`);
    if (plan.protectedSkipped[c].length) console.log(`     🛡️  ข้าม (คุ้มครอง): ${plan.protectedSkipped[c].join(', ')}`);
  }
  console.log(`  รวม ${plan.total} docs\n`);

  const port = args.deleteAuthAccounts ? await authPort() : null;
  const authPlan = port ? await planAuthDeletion(port, plan.staffEmails) : null;
  if (authPlan) {
    console.log('👤 บัญชี Firebase Auth ที่จะลบ:');
    for (const u of authPlan.toDelete) console.log(`     - ${u.email} (${u.uid})`);
    console.log(`  รวม ${authPlan.toDelete.length} บัญชี`);
    for (const s of authPlan.skippedProtected) console.log(`     🛡️  ข้าม (คุ้มครอง): ${s.email}${s.uid ? ` (${s.uid})` : ''} — ${s.reason}`);
    if (authPlan.notFound.length) console.log(`     ℹ️  ไม่มีบัญชี Auth ตรงอีเมล: ${authPlan.notFound.join(', ')}`);
    console.log('');
  }

  if (!args.execute) {
    console.log('(dry run — ไม่ได้ลบอะไร)');
    return;
  }

  // 1) Firestore ก่อน
  const results = await runFirestoreDeletion(io, plan, protectedIds);
  console.log('📊 ผลลบเอกสาร Firestore:');
  for (const r of results) console.log(`  ${r.failed ? '❌' : '✅'} ${r.collection}: ลบแล้ว ${r.deleted}, ล้มเหลว ${r.failed}${r.error ? ` (${r.error})` : ''}`);
  const firestoreFailed = results.some((r) => r.failed > 0);

  // 2) Auth ทีหลัง — ข้ามทั้งหมดถ้า Firestore ล้มเหลวบางส่วน
  let authFailed = false;
  if (port && authPlan) {
    if (firestoreFailed) {
      console.log('\n⏭️  ข้ามการลบบัญชี Auth เพราะลบเอกสาร Firestore ไม่สำเร็จครบ (บัญชียังอยู่ครบ) — แก้แล้วรันซ้ำได้');
    } else {
      const ar = await runAuthDeletion(port, authPlan);
      console.log('\n📊 ผลลบบัญชี Auth:');
      for (const u of ar.deleted) console.log(`  ✅ ${u.email} (${u.uid})`);
      for (const u of ar.failed) console.log(`  ❌ ${u.email} (${u.uid}): ${u.error}`);
      authFailed = ar.failed.length > 0;
    }
  }
  if (firestoreFailed || authFailed) process.exitCode = 1;
}

main().then(() => process.exit(process.exitCode ?? 0)).catch((err) => {
  console.error(`❌ ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});
