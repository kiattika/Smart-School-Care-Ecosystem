import { useEffect, useState } from 'react';
import { HouseConfig } from '../types';
import { subscribeHouseConfigs } from '../services/firestoreService';

/** รายชื่อคณะสี (house_config) แบบ real-time — รากฐานสำหรับระบบคะแนนถ้วยในอนาคต */
export function useHouseConfig() {
  const [houses, setHouses] = useState<HouseConfig[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return subscribeHouseConfigs((list) => {
      setHouses(list.sort((a, b) => a.name.localeCompare(b.name, 'th')));
      setLoading(false);
    });
  }, []);

  const nameOf = (id?: string | null) => (id && houses.find(h => h.id === id)?.name) || 'ยังไม่ระบุคณะสี';

  return { houses, loading, nameOf };
}
