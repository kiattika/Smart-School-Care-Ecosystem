import { describe, it, expect } from 'vitest';
import { readSource } from './helpers/readSource';
import { DEFAULT_SCHOOL_GEOFENCE, isWithinSchoolGeofence } from '../utils/geoUtils';
import {
  validateGeofenceSettings, gatesToDrafts, draftsToGates, newGateId, MAX_GATES, type GateDraft,
} from '../lib/geofenceConfig';

const gate = (o: Partial<GateDraft> = {}): GateDraft => ({ id: 'gate-1', name: 'ประตูหน้า', latitude: 17.6, longitude: 100.1, radiusMeters: 100, ...o });
const ok = { centerLat: 17.6, centerLng: 100.1, radiusMeters: 350 };

describe('validateGeofenceSettings', () => {
  it('ผ่านเมื่อมี 2 ประตูถูกต้อง และผ่านเมื่อไม่มีประตู', () => {
    expect(validateGeofenceSettings({ ...ok, gates: [gate(), gate({ id: 'gate-2', name: 'ประตูหลัง' })] })).toEqual([]);
    expect(validateGeofenceSettings({ ...ok, gates: [] })).toEqual([]);
  });
  it('ปฏิเสธพิกัด/รัศมี/ชื่อผิด', () => {
    expect(validateGeofenceSettings({ ...ok, centerLat: 91, gates: [] })).not.toEqual([]);
    expect(validateGeofenceSettings({ ...ok, centerLng: NaN, gates: [] })).not.toEqual([]);
    expect(validateGeofenceSettings({ ...ok, radiusMeters: 5, gates: [] })).not.toEqual([]);
    expect(validateGeofenceSettings({ ...ok, gates: [gate({ name: '  ' })] })).not.toEqual([]);
    expect(validateGeofenceSettings({ ...ok, gates: [gate({ radiusMeters: 9999 })] })).not.toEqual([]);
    expect(validateGeofenceSettings({ ...ok, gates: [gate({ latitude: 200 })] })).not.toEqual([]);
  });
  it('ปฏิเสธชื่อ/รหัสซ้ำ และเกินจำนวนสูงสุด', () => {
    expect(validateGeofenceSettings({ ...ok, gates: [gate(), gate()] })).not.toEqual([]);
    const many = Array.from({ length: MAX_GATES + 1 }, (_, i) => gate({ id: `g${i}`, name: `ประตู ${i}` }));
    expect(validateGeofenceSettings({ ...ok, gates: many })).not.toEqual([]);
  });
});

describe('gates helpers', () => {
  it('แปลง draft <-> gates ไปกลับได้ และตัดค่าผิดรูปแบบ', () => {
    const gates = draftsToGates([gate({ name: ' ประตูหน้า ' })]);
    expect(gates[0].name).toBe('ประตูหน้า');
    expect(gatesToDrafts(gates)[0]).toMatchObject({ id: 'gate-1', latitude: 17.6, longitude: 100.1, radiusMeters: 100 });
    expect(gatesToDrafts(undefined)).toEqual([]);
    expect(gatesToDrafts([{ id: 'x', name: 'x', coordinates: { latitude: NaN, longitude: 1 }, radiusMeters: 1 }])).toEqual([]);
  });
  it('newGateId ไม่ซ้ำ', () => {

    const id = newGateId([{ id: 'gate-1' }, { id: 'gate-3' }]);
    expect(['gate-1', 'gate-3']).not.toContain(id);
  });
});

describe('ค่าเริ่มต้นไม่มีประตูสมมติ', () => {
  it('DEFAULT มี gates ว่าง และตรวจพิกัดได้โดยไม่มีประตู', () => {
    expect(DEFAULT_SCHOOL_GEOFENCE.gates).toEqual([]);
    const c = DEFAULT_SCHOOL_GEOFENCE.centerCoordinates;
    const r = isWithinSchoolGeofence(c, DEFAULT_SCHOOL_GEOFENCE);
    expect(r.isInside).toBe(true);
  });
  it('hook ไม่ย้อนใช้ gates ในโค้ด และหน้าครูไม่ฝังพิกัดประตู', () => {
    expect(readSource('src/hooks/useSchoolGeofence.ts')).toMatch(/gates: draftsToGates\(gatesToDrafts\(d\?\.gates\)\)/);
    const tp = readSource('src/TeacherPortal.tsx');
    expect(tp).not.toMatch(/17\.62(5620|4890|5800)|ซอยแปดวา|ประตู 3 \(ศูนย์กีฬา/);
    expect(tp).toMatch(/schoolGeofenceConfig\.gates/);
  });
  it('โมดัลตั้งค่าบันทึก gates และตรวจ validate ก่อนบันทึก', () => {
    const m = readSource('src/components/GPSGeofenceCheckinModal.tsx');
    expect(m).toMatch(/validateGeofenceSettings\(/);
    expect(m).toMatch(/gates,\n/);
    expect(m).toMatch(/useMyLocationFor/);
  });
});
