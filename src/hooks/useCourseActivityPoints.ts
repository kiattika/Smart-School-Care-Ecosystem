import { useEffect, useMemo, useState } from 'react';
import { subscribeActiveLearningLogsForTeacher } from '../services/firestoreService';
import { useStore } from '../store';
import { useCurrentSemester } from './useCurrentSemester';
import { pointsByStudentForCourse } from '../lib/courseRank';
import type { ActiveLearningRecord } from '../types';

/**
 * คะแนนกิจกรรมของนักเรียน "เฉพาะวิชา courseId" ในภาคเรียนปัจจุบัน (อ่านสดจาก active_learning_logs ที่ครูคนนี้ให้)
 * ห้ามใช้ store.activeLearningPoints ในจุดที่แสดงต่อวิชา — นั่นเป็นยอดรวมทุกวิชาในหน่วยความจำของเซสชัน
 */
export function useCourseActivityPoints(courseKey: string, legacyCourseId?: string): Record<string, number> {
  const myStaffId = useStore(s => s.user?.staffId) ?? '';
  const { academicYear, term } = useCurrentSemester();
  const [logs, setLogs] = useState<ActiveLearningRecord[]>([]);
  useEffect(() => subscribeActiveLearningLogsForTeacher(myStaffId, setLogs), [myStaffId]);
  return useMemo(() => pointsByStudentForCourse(logs, courseKey, { academicYear, term }, legacyCourseId), [logs, courseKey, legacyCourseId, academicYear, term]);
}
