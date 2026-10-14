import { useStore } from '../store';
import type { Actor } from '../services/conductService';

/** ผู้บันทึกคะแนนความประพฤติ: staffId จาก claim, isAffairs = มีบทบาทงานกิจการนักเรียน/SUPER_ADMIN (rules ตรวจบทบาทจริงซ้ำ) */
export function useConductActor(): Actor {
  const user = useStore(s => s.user);
  const roles = (user?.profile?.roles || []) as string[];
  return { staffId: user?.staffId || '', name: user?.displayName || '', isAffairs: roles.includes('STUDENT_AFFAIRS') || roles.includes('SUPER_ADMIN') };
}
