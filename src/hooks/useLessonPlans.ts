import { useEffect, useState } from 'react';
import { subscribeLessonPlans } from '../services/lessonPlanService';
import type { LessonPlan, PlanQuery } from '../lib/lessonPlans';

/** แผน/โครงการสอนของภาคเรียน — q ต้องตรงสิทธิ์ (planOverviewQuery หรือ SELF); q = null ยังไม่ subscribe */
export function useLessonPlans(semesterId: string, q: PlanQuery | null) {
  const [state, setState] = useState<{ data: LessonPlan[]; loading: boolean; error: string | null }>({ data: [], loading: !!q, error: null });
  const key = q ? JSON.stringify(q) : '';
  useEffect(() => {
    if (!q) { setState({ data: [], loading: false, error: null }); return; }
    setState(s => ({ ...s, loading: true, error: null }));
    return subscribeLessonPlans(
      semesterId, q,
      (data) => setState({ data, loading: false, error: null }),
      (e) => setState({ data: [], loading: false, error: e.message }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [semesterId, key]);
  return state;
}
