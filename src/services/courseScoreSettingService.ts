import { collection, doc, onSnapshot, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { CourseScoreSetting } from '../types';
import { isValidScoreSetting, scoreSettingDocId } from '../lib/scoreSettings';

const COL = 'course_score_settings';

/** ฟังสัดส่วนคะแนนที่ครูคนนี้ตั้งไว้ทุกวิชา (เก็บต่อครู+วิชา — ไม่ปนกับครูที่สอนวิชาเดียวกันคนละห้อง) */
export function subscribeCourseScoreSettings(staffId: string, cb: (list: CourseScoreSetting[]) => void, onError?: (e: Error) => void): () => void {
  return onSnapshot(query(collection(db, COL), where('ownerStaffId', '==', staffId)), snap => {
    cb(snap.docs.map(d => {
      const x = d.data();
      return { courseId: x.courseId, maxPreMidterm: x.maxPreMidterm, maxMidterm: x.maxMidterm, maxPostMidterm: x.maxPostMidterm, maxFinal: x.maxFinal } as CourseScoreSetting;
    }));
  }, e => onError?.(e));
}

export async function saveCourseScoreSetting(staffId: string, s: CourseScoreSetting): Promise<void> {
  if (!isValidScoreSetting(s)) throw new Error('สัดส่วนคะแนนรวมต้องเท่ากับ 100 พอดี');
  await setDoc(doc(db, COL, scoreSettingDocId(staffId, s.courseId)), {
    ownerStaffId: staffId, courseId: s.courseId,
    maxPreMidterm: s.maxPreMidterm, maxMidterm: s.maxMidterm, maxPostMidterm: s.maxPostMidterm, maxFinal: s.maxFinal,
    updatedAt: serverTimestamp(),
  });
}
