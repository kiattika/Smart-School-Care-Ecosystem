import { useEffect, useState } from 'react';
import { subscribeTeachingProjects } from '../services/teachingProjectService';
import type { PlanQuery } from '../lib/lessonPlans';
import type { TeachingProject } from '../lib/teachingProject';

/** โครงการสอนของภาคเรียน — q ต้องตรงสิทธิ์; q = null ยังไม่ subscribe */
export function useTeachingProjects(semesterId: string, q: PlanQuery | null) {
  const [state, setState] = useState<{ data: TeachingProject[]; loading: boolean; error: string | null }>({ data: [], loading: !!q, error: null });
  const key = q ? JSON.stringify(q) : '';
  useEffect(() => {
    if (!q) { setState({ data: [], loading: false, error: null }); return; }
    setState(s => ({ ...s, loading: true, error: null }));
    return subscribeTeachingProjects(
      semesterId, q,
      (data) => setState({ data, loading: false, error: null }),
      (e) => setState({ data: [], loading: false, error: e.message }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [semesterId, key]);
  return state;
}
