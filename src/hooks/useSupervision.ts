import { useEffect, useState } from 'react';
import {
  subscribeSupervisionAssignments, subscribeSupervisionObservations, subscribeSupervisionRounds,
  type AssignmentQuery, type ObservationQuery,
} from '../services/supervisionService';
import type { SupervisionAssignment, SupervisionObservation, SupervisionRound } from '../lib/supervision';

interface Live<T> { data: T; loading: boolean; error: string | null }

/** รอบนิเทศทั้งหมด (ล่าสุดก่อน) — อ่านได้ทุกบุคลากร */
export function useSupervisionRounds(): Live<SupervisionRound[]> {
  const [state, setState] = useState<Live<SupervisionRound[]>>({ data: [], loading: true, error: null });
  useEffect(() => subscribeSupervisionRounds(
    (data) => setState({ data, loading: false, error: null }),
    (e) => setState({ data: [], loading: false, error: e.message }),
  ), []);
  return state;
}

/** ผลสังเกตการสอนของรอบ — q ต้องตรงสิทธิ์ของผู้ใช้ (ดู ObservationQuery); q = null ยังไม่ subscribe */
export function useRoundObservations(roundId: string | null, q: ObservationQuery | null): Live<SupervisionObservation[]> {
  const [state, setState] = useState<Live<SupervisionObservation[]>>({ data: [], loading: !!roundId && !!q, error: null });
  const key = q ? JSON.stringify(q) : '';
  useEffect(() => {
    if (!roundId || !q) { setState({ data: [], loading: false, error: null }); return; }
    setState(s => ({ ...s, loading: true, error: null }));
    return subscribeSupervisionObservations(
      roundId, q,
      (data) => setState({ data, loading: false, error: null }),
      (e) => setState({ data: [], loading: false, error: e.message }),
    );
  }, [roundId, key]); // eslint-disable-line react-hooks/exhaustive-deps
  return state;
}

export function useRoundAssignments(roundId: string | null, q: AssignmentQuery | null): Live<SupervisionAssignment[]> {
  const [state, setState] = useState<Live<SupervisionAssignment[]>>({ data: [], loading: !!roundId && !!q, error: null });
  const key = q ? JSON.stringify(q) : '';
  useEffect(() => {
    if (!roundId || !q) { setState({ data: [], loading: false, error: null }); return; }
    setState(s => ({ ...s, loading: true, error: null }));
    return subscribeSupervisionAssignments(
      roundId, q,
      (data) => setState({ data, loading: false, error: null }),
      (e) => setState({ data: [], loading: false, error: e.message }),
    );
  }, [roundId, key]); // eslint-disable-line react-hooks/exhaustive-deps
  return state;
}
