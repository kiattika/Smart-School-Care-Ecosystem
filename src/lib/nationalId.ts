/** เลขประจำตัวประชาชนไทย 13 หลัก — ตรวจ checksum (หลักที่ 13) */
export const normalizeNationalId = (raw: string): string => raw.replace(/[\s-]/g, '');

export function isValidThaiNationalId(raw: string): boolean {
  const id = normalizeNationalId(raw);
  if (!/^[0-9]{13}$/.test(id)) return false;
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(id[i]) * (13 - i);
  return (11 - (sum % 11)) % 10 === Number(id[12]);
}

/** แสดงเป็น x-xxxx-xxxxx-xx-x */
export function formatNationalId(raw: string): string {
  const id = normalizeNationalId(raw);
  if (id.length !== 13) return raw;
  return `${id[0]}-${id.slice(1, 5)}-${id.slice(5, 10)}-${id.slice(10, 12)}-${id[12]}`;
}
