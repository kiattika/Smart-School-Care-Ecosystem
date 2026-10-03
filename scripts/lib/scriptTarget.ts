/**
 * ตัวกันรันสคริปต์ maintenance (normalizeEmails / resetAuthClaims) ใส่ production โดยไม่ตั้งใจ
 *
 * - มี *_EMULATOR_HOST ที่สคริปต์ต้องใช้ → เป้าหมาย = emulator
 * - ไม่มี → ต้องส่ง `--confirm-production <projectId>` ให้ตรงกับ projectId จริงเท่านั้น
 *   (ลืม env ของ emulator แล้วเผลอยิงขึ้น production ด้วย ADC ไม่ได้)
 * - `--dry-run` แสดงรายการเฉยๆ ไม่เขียนอะไร (ใช้ได้ทั้งสองเป้าหมาย)
 */

export interface ScriptArgs {
  dryRun: boolean;
  confirmProduction: string | null;
  keep: string[];
}

export function parseScriptArgs(argv: string[]): ScriptArgs {
  const args: ScriptArgs = { dryRun: false, confirmProduction: null, keep: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const takeValue = (flag: string): string => {
      const eq = a.indexOf('=');
      const v = eq >= 0 ? a.slice(eq + 1) : argv[++i];
      if (!v || v.startsWith('--')) throw new Error(`${flag} ต้องมีค่าตามหลัง`);
      return v;
    };
    if (a === '--dry-run') args.dryRun = true;
    else if (a === '--confirm-production' || a.startsWith('--confirm-production=')) args.confirmProduction = takeValue('--confirm-production');
    else if (a === '--keep' || a.startsWith('--keep=')) args.keep.push(takeValue('--keep'));
    else throw new Error(`ไม่รู้จัก argument: ${a}`);
  }
  return args;
}

export type ScriptTarget = { kind: 'emulator'; host: string } | { kind: 'production'; projectId: string };

export function resolveScriptTarget(
  env: Record<string, string | undefined>,
  emulatorEnvVar: 'FIRESTORE_EMULATOR_HOST' | 'FIREBASE_AUTH_EMULATOR_HOST',
  args: ScriptArgs,
  projectId: string,
): ScriptTarget {
  const host = env[emulatorEnvVar];
  if (host) {
    if (args.confirmProduction) {
      throw new Error(`ตั้ง ${emulatorEnvVar}=${host} อยู่ แต่ส่ง --confirm-production มาด้วย — เลือกอย่างใดอย่างหนึ่ง`);
    }
    return { kind: 'emulator', host };
  }
  if (args.confirmProduction !== projectId) {
    throw new Error(
      `ไม่พบ ${emulatorEnvVar} — ปฏิเสธการรันกับ production. ` +
      `ถ้าตั้งใจรันกับ production จริง ให้ส่ง --confirm-production ${projectId} (ลอง --dry-run ก่อนเสมอ)`,
    );
  }
  return { kind: 'production', projectId };
}
