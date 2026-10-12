import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useStore } from '../store';
import { DEFAULT_SCHOOL_GEOFENCE, SchoolGeofenceConfig } from '../utils/geoUtils';
import { draftsToGates, gatesToDrafts } from '../lib/geofenceConfig';

const isNum = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);

/**
 * อ่านพิกัด/รัศมีโรงเรียนที่ admin ตั้งไว้จริงจาก school_settings/geofence_config
 * - configured = มีเอกสารนี้จริงและมีพิกัดศูนย์กลางที่ใช้ได้ (ไม่เดาจากค่า default ในโค้ด)
 * - sync เข้า store.schoolGeofenceConfig ด้วย เพื่อให้ GPS modal/จุดอื่นที่อ่านจาก store ใช้ค่าเดียวกัน
 */
export function useSchoolGeofence(): { config: SchoolGeofenceConfig; configured: boolean; loaded: boolean } {
  const storeConfig = useStore(s => s.schoolGeofenceConfig);
  const [state, setState] = useState<{ configured: boolean; loaded: boolean }>({ configured: false, loaded: false });

  useEffect(() => {
    try {
      return onSnapshot(doc(db, 'school_settings', 'geofence_config'), (snap) => {
        const d = snap.data() as Partial<SchoolGeofenceConfig> | undefined;
        const c = d?.centerCoordinates;
        if (snap.exists() && c && isNum(c.latitude) && isNum(c.longitude)) {
          useStore.setState({
            schoolGeofenceConfig: {
              ...DEFAULT_SCHOOL_GEOFENCE,
              ...(d as SchoolGeofenceConfig),
              radiusMeters: isNum(d?.radiusMeters) ? d!.radiusMeters! : DEFAULT_SCHOOL_GEOFENCE.radiusMeters,
              // ประตูมาจากที่แอดมินตั้งเท่านั้น (ไม่มี/ผิดรูปแบบ = ไม่มีประตู ไม่ย้อนไปใช้ค่าในโค้ด)
              gates: draftsToGates(gatesToDrafts(d?.gates)),
            },
          });
          setState({ configured: true, loaded: true });
        } else {
          setState({ configured: false, loaded: true });
        }
      }, (err) => {
        console.warn('[useSchoolGeofence] Listener error:', err.message);
        setState({ configured: false, loaded: true });
      });
    } catch (e) {
      console.warn('[useSchoolGeofence] Setup error:', e);
      setState({ configured: false, loaded: true });
    }
  }, []);

  return { config: storeConfig, ...state };
}
