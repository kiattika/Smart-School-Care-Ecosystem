/**
 * ล้าง custom claims + revokeRefreshTokens ของทุกบัญชีใน Firebase Auth
 * — ใช้ตอนย้ายมาใช้ blocking functions: claims เก่า (เช่น default SUBJECT_TEACHER จาก onUserCreated เดิม
 * หรือ claims ที่ไม่มี staffId/studentId) ถูกล้าง แล้ว beforeUserSignedIn ออกชุดใหม่ที่ถูกต้องตอน login ครั้งถัดไป
 *
 * ใช้:
 *   npx tsx scripts/resetAuthClaims.ts --dry-run                          # emulator (ต้องตั้ง FIREBASE_AUTH_EMULATOR_HOST)
 *   npx tsx scripts/resetAuthClaims.ts --keep admin@utd.ac.th             # emulator — เขียนจริง, ข้ามบัญชีนี้
 *   npx tsx scripts/resetAuthClaims.ts --dry-run --confirm-production kiattisak-project-001
 *
 * --keep <email> ใส่ได้หลายครั้ง (เช่น เก็บ SUPER_ADMIN ที่กำลังใช้งานไว้ ไม่ให้หลุดระหว่างย้ายระบบ)
 * ไม่มี FIREBASE_AUTH_EMULATOR_HOST และไม่ส่ง --confirm-production <projectId> = ปฏิเสธ (scripts/lib/scriptTarget.ts)
 * ⚠️ เขียนจริงกับ production = ทุกคน (ยกเว้น --keep) หลุดจากระบบเมื่อ token หมดอายุ/รีเฟรช ≤ 1 ชม.
 */
import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth, UserRecord } from 'firebase-admin/auth';
import firebaseConfig from '../firebase-applet-config.json';
import { normalizeEmail } from '../src/lib/normalizeEmail';
import { parseScriptArgs, resolveScriptTarget } from './lib/scriptTarget';

const PROJECT_ID = firebaseConfig.projectId;

async function main() {
  const args = parseScriptArgs(process.argv.slice(2));
  const target = resolveScriptTarget(process.env, 'FIREBASE_AUTH_EMULATOR_HOST', args, PROJECT_ID);
  const keep = new Set(args.keep.map(normalizeEmail));

  const app = getApps()[0] ?? initializeApp({ projectId: PROJECT_ID });
  const auth = getAuth(app);

  console.log(`🎯 เป้าหมาย: ${target.kind === 'emulator' ? `Auth emulator ${target.host}` : `PRODUCTION ${target.projectId}`}`);
  console.log(`   โหมด: ${args.dryRun ? 'DRY RUN (ไม่เขียนอะไร)' : 'เขียนจริง'}`);
  console.log(`   --keep: ${keep.size ? [...keep].join(', ') : '(ไม่มี)'}\n`);

  const users: UserRecord[] = [];
  let pageToken: string | undefined;
  do {
    const page = await auth.listUsers(1000, pageToken);
    users.push(...page.users);
    pageToken = page.pageToken;
  } while (pageToken);

  const kept: UserRecord[] = [];
  const toReset: UserRecord[] = [];
  for (const u of users) (keep.has(normalizeEmail(u.email)) ? kept : toReset).push(u);

  const missingKeep = [...keep].filter((e) => !users.some((u) => normalizeEmail(u.email) === e));
  if (missingKeep.length) {
    // --keep สะกดผิด = บัญชีที่ตั้งใจเก็บจะโดนล้าง — หยุดก่อนแทนที่จะทำต่อเงียบๆ
    throw new Error(`ไม่พบบัญชี --keep: ${missingKeep.join(', ')} (ตรวจการสะกด) — ไม่ได้ทำอะไร`);
  }

  console.log(`👥 บัญชีทั้งหมด ${users.length} — ล้าง ${toReset.length}, ข้าม ${kept.length}`);
  for (const u of kept) console.log(`   ⏭️  ข้าม ${u.email} (${u.uid})`);
  for (const u of toReset) {
    console.log(`   🧹 ${u.email ?? '(no email)'} (${u.uid}) claims=${JSON.stringify(u.customClaims ?? {})}`);
  }

  if (args.dryRun) {
    console.log('\n(dry run — ไม่ได้เขียนอะไร)');
    return;
  }

  for (const u of toReset) {
    await auth.setCustomUserClaims(u.uid, null);
    await auth.revokeRefreshTokens(u.uid);
  }
  console.log(`\n✅ ล้าง claims + revoke refresh tokens แล้ว ${toReset.length} บัญชี`);
}

main().then(() => process.exit(0)).catch((err) => {
  console.error(`❌ ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});
