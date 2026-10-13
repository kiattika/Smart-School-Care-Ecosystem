/**
 * Firestore setDoc() ปฏิเสธค่า undefined ใน field ("Unsupported field value: undefined") — ตัด key ที่เป็น undefined ออกก่อนเขียน
 * (ชั้นตื้นพอ: ใช้กับ payload ที่ field ระดับบนเป็น optional เช่น selfieUrl / nearestGate)
 */
export function omitUndefined<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v;
  }
  return out as T;
}
