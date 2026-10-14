import { useEffect, useState } from 'react';
import { subscribePlcLogs } from '../services/plcService';
import { subscribeReflections } from '../services/reflectionService';
import type { PlanQuery } from '../lib/lessonPlans';
import type { PlcLog } from '../lib/plc';
import type { Reflection } from '../lib/reflection';

type Live<T> = { data: T[]; loading: boolean; error: string | null };
function useLive<T>(subscribe: (sem: string, q: PlanQuery, cb: (l: T[]) => void, err: (e: Error) => void) => () => void, semesterId: string, q: PlanQuery | null): Live<T> {
  const [state, setState] = useState<Live<T>>({ data: [], loading: !!q, error: null });
  const key = q ? JSON.stringify(q) : '';
  useEffect(() => {
    if (!q) { setState({ data: [], loading: false, error: null }); return; }
    setState(s => ({ ...s, loading: true, error: null }));
    return subscribe(semesterId, q, (data) => setState({ data, loading: false, error: null }), (e) => setState({ data: [], loading: false, error: e.message }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [semesterId, key]);
  return state;
}
export const usePlcLogs = (semesterId: string, q: PlanQuery | null) => useLive<PlcLog>(subscribePlcLogs, semesterId, q);
export const useReflections = (semesterId: string, q: PlanQuery | null) => useLive<Reflection>(subscribeReflections, semesterId, q);
