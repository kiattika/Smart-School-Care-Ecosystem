import type { Coordinates, SchoolGeofenceConfig } from '../utils/geoUtils';

/**
 * ตั้งค่าพิกัดโรงเรียนและประตู (school_settings/geofence_config) — ตรรกะบริสุทธิ์ที่ UI แอดมิน/เทสต์ใช้ร่วมกัน
 * แอดมินเป็นผู้กำหนดจำนวนประตู ชื่อ พิกัด และรัศมีเอง (โรงเรียนไม่จำเป็นต้องมี 3 ประตู) — ห้ามฝังประตู/พิกัดเริ่มต้นในโค้ด
 */
export interface GateDraft {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
}

export const MAX_GATES = 10;
export const GATE_NAME_MAX = 60;
export const CENTER_RADIUS_MIN = 25;
export const CENTER_RADIUS_MAX = 2000;
export const GATE_RADIUS_MIN = 10;
export const GATE_RADIUS_MAX = 500;
/** ค่าเริ่มต้นของรัศมีประตูที่เพิ่มใหม่ (ปรับได้) */
export const DEFAULT_GATE_RADIUS = 100;

const isNum = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
const validCoord = (lat: unknown, lng: unknown) =>
  isNum(lat) && isNum(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;

export function gatesToDrafts(gates: SchoolGeofenceConfig['gates'] | undefined): GateDraft[] {
  return (Array.isArray(gates) ? gates : [])
    .filter(g => g && validCoord(g.coordinates?.latitude, g.coordinates?.longitude))
    .map(g => ({
      id: String(g.id),
      name: String(g.name ?? ''),
      latitude: g.coordinates.latitude,
      longitude: g.coordinates.longitude,
      radiusMeters: isNum(g.radiusMeters) ? g.radiusMeters : DEFAULT_GATE_RADIUS,
    }));
}

export function draftsToGates(drafts: GateDraft[]): SchoolGeofenceConfig['gates'] {
  return drafts.map(d => ({
    id: d.id,
    name: d.name.trim(),
    coordinates: { latitude: d.latitude, longitude: d.longitude } as Coordinates,
    radiusMeters: d.radiusMeters,
  }));
}

/** id ใหม่ที่ไม่ซ้ำ เช่น gate-1, gate-2 (ไม่นำ id ของประตูที่ถูกลบกลับมาใช้ซ้ำในรอบเดียวกัน) */
export function newGateId(existing: { id: string }[]): string {
  const used = new Set(existing.map(g => g.id));
  let n = existing.length + 1;
  while (used.has(`gate-${n}`)) n += 1;
  return `gate-${n}`;
}

export function validateGeofenceSettings(input: {
  centerLat: number;
  centerLng: number;
  radiusMeters: number;
  gates: GateDraft[];
}): string[] {
  const errors: string[] = [];
  if (!validCoord(input.centerLat, input.centerLng)) errors.push('พิกัดศูนย์กลางโรงเรียนไม่ถูกต้อง (ละติจูด -90 ถึง 90, ลองจิจูด -180 ถึง 180)');
  if (!isNum(input.radiusMeters) || input.radiusMeters < CENTER_RADIUS_MIN || input.radiusMeters > CENTER_RADIUS_MAX) {
    errors.push(`รัศมีโรงเรียนต้องอยู่ระหว่าง ${CENTER_RADIUS_MIN}–${CENTER_RADIUS_MAX} เมตร`);
  }
  if (input.gates.length > MAX_GATES) errors.push(`เพิ่มประตูได้ไม่เกิน ${MAX_GATES} แห่ง`);
  const names = new Set<string>();
  const ids = new Set<string>();
  input.gates.forEach((g, i) => {
    const label = `ประตูที่ ${i + 1}`;
    const name = g.name.trim();
    if (!name) errors.push(`${label}: ต้องระบุชื่อ`);
    else if (name.length > GATE_NAME_MAX) errors.push(`${label}: ชื่อยาวเกิน ${GATE_NAME_MAX} ตัวอักษร`);
    else if (names.has(name)) errors.push(`${label}: ชื่อซ้ำกับประตูอื่น`);
    names.add(name);
    if (ids.has(g.id)) errors.push(`${label}: รหัสซ้ำ`);
    ids.add(g.id);
    if (!validCoord(g.latitude, g.longitude)) errors.push(`${label}: พิกัดไม่ถูกต้อง`);
    if (!isNum(g.radiusMeters) || g.radiusMeters < GATE_RADIUS_MIN || g.radiusMeters > GATE_RADIUS_MAX) {
      errors.push(`${label}: รัศมีต้องอยู่ระหว่าง ${GATE_RADIUS_MIN}–${GATE_RADIUS_MAX} เมตร`);
    }
  });
  return errors;
}
