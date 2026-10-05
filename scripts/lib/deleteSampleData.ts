/**
 * ตรรกะของ scripts/deleteSampleData.ts — ลบถาวร จึงแยกเป็น pure function / port ให้ unit test ได้
 * (src/__tests__/deleteSampleData.test.ts) โดยไม่ต้องแตะ Firestore/Auth จริง
 *
 * ความปลอดภัย (ห้ามผ่อน):
 * - ต้องระบุ --collections เอง และต้องอยู่ใน ALLOWED_COLLECTIONS เท่านั้น
 * - ต้องส่ง --execute ถึงจะลบจริง (ค่าเริ่มต้น = dry-run); production ต้องมี --confirm-production เพิ่มอีก
 * - staff/teachers: ไม่ลบเอกสาร/บัญชี Auth ของ PROTECTED_EMAIL ในทุกกรณี — เช็คซ้ำหลายชั้น
 *   (ตอนวางแผน, ตอนลงมือลบ, และที่ระดับ UID ของบัญชี Auth)
 */
import { normalizeEmail } from '../../src/lib/normalizeEmail';
import { parseScriptArgs, ScriptArgs } from './scriptTarget';

/** บัญชีจริงที่ห้ามลบเด็ดขาด (ประกาศแยกจาก auditSampleData โดยตั้งใจ — แก้ที่เดียวไม่ไปกระทบอีกที่เงียบๆ) */
export const PROTECTED_EMAIL = 'kiattika@utd.ac.th';

export const ALLOWED_COLLECTIONS = [
  'schedules',
  'staff',
  'teachers',
  'students',
  'attendance_records',
  'elective_activities_config',
  'gradebook_hidden_courses',
  'parent_verification_records',
  'seating_assignments',
  'seating_layouts',
  'student_assessments_sdq',
  'student_self_assessments',
] as const;

/** collection ที่มีอีเมลบุคลากร (ใช้หาบัญชี Auth + ตรรกะยกเว้น) */
export const STAFF_COLLECTIONS = ['staff', 'teachers'] as const;

export const BATCH_SIZE = 450;

// ─── args ───────────────────────────────────────────────────────────────────

export interface DeleteArgs extends ScriptArgs {
  collections: string[];
  execute: boolean;
  deleteAuthAccounts: boolean;
}

export function validateCollections(names: string[]): string[] {
  if (names.length === 0) throw new Error('--collections ต้องระบุอย่างน้อย 1 collection (ไม่มีค่าเริ่มต้น)');
  const allowed = new Set<string>(ALLOWED_COLLECTIONS);
  const rejected = names.filter((n) => !allowed.has(n));
  if (rejected.length) {
    throw new Error(
      `collection ไม่อยู่ในรายชื่อที่อนุญาต: ${rejected.join(', ')} — ปฏิเสธรันทันที. ` +
      `อนุญาตเฉพาะ: ${ALLOWED_COLLECTIONS.join(', ')}`,
    );
  }
  return names;
}

export function parseDeleteArgs(argv: string[]): DeleteArgs {
  let collectionsRaw: string | null = null;
  let execute = false;
  let deleteAuthAccounts = false;
  const rest: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--collections' || a.startsWith('--collections=')) {
      const eq = a.indexOf('=');
      const v = eq >= 0 ? a.slice(eq + 1) : argv[++i];
      if (!v || v.startsWith('--')) throw new Error('--collections ต้องมีค่าตามหลัง (comma list)');
      collectionsRaw = v;
    } else if (a === '--execute') execute = true;
    else if (a === '--delete-auth-accounts') deleteAuthAccounts = true;
    else if (a === '--keep' || a.startsWith('--keep=')) throw new Error('สคริปต์นี้ไม่รองรับ --keep');
    else {
      rest.push(a);
      // --confirm-production <value> : ส่งค่าต่อให้ parseScriptArgs (มันตรวจรูปแบบเอง)
      if (a === '--confirm-production' && argv[i + 1] !== undefined) rest.push(argv[++i]);
    }
  }

  const base = parseScriptArgs(rest); // ไม่รู้จัก argument อื่น = throw
  if (collectionsRaw === null) throw new Error('ต้องส่ง --collections <a,b,...> เสมอ (ไม่มีค่าเริ่มต้น)');
  if (base.dryRun && execute) throw new Error('--dry-run กับ --execute ขัดกัน — เลือกอย่างใดอย่างหนึ่ง');

  // ช่องว่างใน comma list (เช่น "staff,,x") ไม่ถูกกรองทิ้ง → ไม่อยู่ใน allowlist → ปฏิเสธ
  const collections = validateCollections([...new Set(collectionsRaw.split(',').map((s) => s.trim()))]);
  if (deleteAuthAccounts && !collections.some((c) => (STAFF_COLLECTIONS as readonly string[]).includes(c))) {
    throw new Error(
      '--delete-auth-accounts ต้องมี staff หรือ teachers ใน --collections — ไม่มี doc บุคลากรให้อ้างอิงอีเมล ' +
      'จึงไม่มีบัญชี Auth ให้ลบ (ไม่ทำอะไรเงียบๆ)',
    );
  }
  return { ...base, collections, execute, deleteAuthAccounts };
}

// ─── ตรรกะยกเว้น (ชั้น Firestore) ───────────────────────────────────────────

export const isProtectedEmail = (email: unknown): boolean => normalizeEmail(email) === PROTECTED_EMAIL;

export interface RawDoc {
  id: string;
  email?: unknown;
}

/** doc id ของบุคลากรที่ได้รับการคุ้มครอง — รวมจากทั้ง staff และ teachers (mirror ใช้ id เดียวกัน) */
export function collectProtectedIds(docsByCollection: Record<string, RawDoc[]>): Set<string> {
  const ids = new Set<string>();
  for (const c of STAFF_COLLECTIONS) {
    for (const d of docsByCollection[c] ?? []) if (isProtectedEmail(d.email)) ids.add(d.id);
  }
  return ids;
}

export function isProtectedDoc(collection: string, doc: RawDoc, protectedIds: Set<string>): boolean {
  if (!(STAFF_COLLECTIONS as readonly string[]).includes(collection)) return false;
  return isProtectedEmail(doc.email) || isProtectedEmail(doc.id) || protectedIds.has(doc.id);
}

export interface FirestorePlan {
  /** collection → id ที่จะลบ */
  toDelete: Record<string, string[]>;
  /** collection → id ที่ถูกยกเว้น */
  protectedSkipped: Record<string, string[]>;
  /** อีเมล (normalize แล้ว) จาก staff/teachers doc ที่จะถูกลบ — ใช้หาบัญชี Auth */
  staffEmails: string[];
  total: number;
}

export function planFirestoreDeletion(
  collections: string[],
  docsByCollection: Record<string, RawDoc[]>,
): FirestorePlan {
  const protectedIds = collectProtectedIds(docsByCollection);
  const toDelete: Record<string, string[]> = {};
  const protectedSkipped: Record<string, string[]> = {};
  const emails = new Set<string>();
  let total = 0;

  for (const c of collections) {
    toDelete[c] = [];
    protectedSkipped[c] = [];
    for (const d of docsByCollection[c] ?? []) {
      if (isProtectedDoc(c, d, protectedIds)) {
        protectedSkipped[c].push(d.id);
        continue;
      }
      toDelete[c].push(d.id);
      total++;
      if ((STAFF_COLLECTIONS as readonly string[]).includes(c)) {
        const e = normalizeEmail(d.email);
        if (e) emails.add(e);
      }
    }
  }
  return { toDelete, protectedSkipped, staffEmails: [...emails].sort(), total };
}

export function chunk<T>(items: T[], size = BATCH_SIZE): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export interface DeleteStore {
  /** ลบทั้ง batch แบบ atomic; throw ถ้าล้ม */
  deleteBatch(collection: string, ids: string[]): Promise<void>;
}

export interface CollectionResult {
  collection: string;
  deleted: number;
  failed: number;
  error?: string;
}

/** ลบทีละ collection ทีละ batch ≤ 450; ล้มแล้วหยุด collection นั้น (collection ถัดไปทำต่อ) */
export async function runFirestoreDeletion(
  store: DeleteStore,
  plan: FirestorePlan,
  protectedIds: Set<string>,
): Promise<CollectionResult[]> {
  const results: CollectionResult[] = [];
  for (const [collection, ids] of Object.entries(plan.toDelete)) {
    const r: CollectionResult = { collection, deleted: 0, failed: 0 };
    const batches = chunk(ids);
    for (let b = 0; b < batches.length; b++) {
      const batch = batches[b];
      // ด่านสุดท้ายก่อนลบจริง — ไม่พึ่งแค่ผลของ planFirestoreDeletion
      if (
        (STAFF_COLLECTIONS as readonly string[]).includes(collection) &&
        batch.some((id) => isProtectedEmail(id) || protectedIds.has(id))
      ) {
        throw new Error(`ABORT: พบ doc ที่ได้รับการคุ้มครองใน batch ลบของ ${collection} — ไม่ลบอะไรเพิ่ม`);
      }
      try {
        await store.deleteBatch(collection, batch);
        r.deleted += batch.length;
      } catch (err) {
        r.error = err instanceof Error ? err.message : String(err);
        r.failed += batches.slice(b).reduce((n, x) => n + x.length, 0);
        break;
      }
    }
    results.push(r);
  }
  return results;
}

// ─── ตรรกะยกเว้น (ชั้น Firebase Auth) ───────────────────────────────────────

export interface AuthUser {
  uid: string;
  email?: string | null;
}

export interface AuthPort {
  /** คืน null ถ้าไม่พบ (auth/user-not-found) ; throw สำหรับ error อื่น */
  getUserByEmail(email: string): Promise<AuthUser | null>;
  deleteUser(uid: string): Promise<void>;
}

export interface AuthPlan {
  toDelete: Array<{ uid: string; email: string }>;
  notFound: string[];
  skippedProtected: Array<{ email: string; uid?: string; reason: string }>;
  /** UID ของบัญชีที่ได้รับการคุ้มครอง (ถ้ามี) — ใช้เช็คซ้ำตอนลบ */
  protectedUid: string | null;
}

export async function planAuthDeletion(port: AuthPort, emails: string[]): Promise<AuthPlan> {
  const plan: AuthPlan = { toDelete: [], notFound: [], skippedProtected: [], protectedUid: null };
  plan.protectedUid = (await port.getUserByEmail(PROTECTED_EMAIL))?.uid ?? null;

  const seenUid = new Set<string>();
  for (const raw of emails) {
    const email = normalizeEmail(raw);
    if (!email) continue;
    if (isProtectedEmail(email)) {
      plan.skippedProtected.push({ email, reason: 'อีเมลที่ได้รับการคุ้มครอง' });
      continue;
    }
    const user = await port.getUserByEmail(email);
    if (!user) {
      plan.notFound.push(email);
      continue;
    }
    if (isProtectedEmail(user.email) || (plan.protectedUid !== null && user.uid === plan.protectedUid)) {
      plan.skippedProtected.push({ email, uid: user.uid, reason: 'บัญชีที่ได้รับการคุ้มครอง (ตรงอีเมล/UID)' });
      continue;
    }
    if (seenUid.has(user.uid)) continue;
    seenUid.add(user.uid);
    plan.toDelete.push({ uid: user.uid, email: normalizeEmail(user.email) || email });
  }
  return plan;
}

export interface AuthResult {
  deleted: Array<{ uid: string; email: string }>;
  failed: Array<{ uid: string; email: string; error: string }>;
}

export async function runAuthDeletion(port: AuthPort, plan: AuthPlan): Promise<AuthResult> {
  const result: AuthResult = { deleted: [], failed: [] };
  for (const u of plan.toDelete) {
    // เช็คแยกต่างหากทุกบัญชีก่อนลบจริง
    if (isProtectedEmail(u.email) || (plan.protectedUid !== null && u.uid === plan.protectedUid)) {
      throw new Error(`ABORT: บัญชีที่ได้รับการคุ้มครองอยู่ในรายการลบ (${u.email} / ${u.uid}) — หยุดทันที`);
    }
    try {
      await port.deleteUser(u.uid);
      result.deleted.push(u);
    } catch (err) {
      result.failed.push({ ...u, error: err instanceof Error ? err.message : String(err) });
    }
  }
  return result;
}
