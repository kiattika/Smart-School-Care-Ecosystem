import { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { TwoQuestionScreening, PHQ9Screening, SDQAssessment } from '../types';

/**
 * Live real-time listeners สำหรับข้อมูลคัดกรองสุขภาพจิตนักเรียนทั้ง 3 ชุด
 * (2Q / PHQ-9 / SDQ) — ใช้โดย GuidancePortal เพื่อให้ครูแนะแนวเห็นผลคัดกรองใหม่
 * "ทันที" ตามที่ระบบตั้งใจไว้ (มีคนกด "ส่งแบบประเมิน" ปุ๊บ ต้องขึ้นที่นี่ปั๊บ ไม่ใช่ fetch ครั้งเดียว)
 *
 * firestore.rules อนุญาตให้ GUIDANCE_COUNSELOR/HOMEROOM_TEACHER/SUPER_ADMIN อ่านได้ทั้ง
 * collection อยู่แล้ว (ดู match /student_screenings_2q, /student_screenings_phq9,
 * /student_assessments_sdq) จึง onSnapshot(collection(...)) ตรงๆ ได้โดยไม่ต้อง query filter
 */
export function useGuidanceScreenings() {
  const [twoQuestionScreenings, setTwoQuestionScreenings] = useState<TwoQuestionScreening[]>([]);
  const [phq9Screenings, setPhq9Screenings] = useState<PHQ9Screening[]>([]);
  const [sdqAssessments, setSdqAssessments] = useState<SDQAssessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadedFlags = { twoQ: false, phq9: false, sdq: false };
    const markLoaded = (key: keyof typeof loadedFlags) => {
      loadedFlags[key] = true;
      if (loadedFlags.twoQ && loadedFlags.phq9 && loadedFlags.sdq) setLoading(false);
    };

    const unsub2Q = onSnapshot(
      collection(db, 'student_screenings_2q'),
      (snap) => {
        setTwoQuestionScreenings(snap.docs.map(d => ({ id: d.id, ...d.data() } as TwoQuestionScreening)));
        setError(null);
        markLoaded('twoQ');
      },
      (err) => {
        console.error('[useGuidanceScreenings] 2Q listener error:', err);
        setError(err.message);
        markLoaded('twoQ');
      }
    );

    const unsubPHQ9 = onSnapshot(
      collection(db, 'student_screenings_phq9'),
      (snap) => {
        setPhq9Screenings(snap.docs.map(d => ({ id: d.id, ...d.data() } as PHQ9Screening)));
        setError(null);
        markLoaded('phq9');
      },
      (err) => {
        console.error('[useGuidanceScreenings] PHQ-9 listener error:', err);
        setError(err.message);
        markLoaded('phq9');
      }
    );

    const unsubSDQ = onSnapshot(
      collection(db, 'student_assessments_sdq'),
      (snap) => {
        setSdqAssessments(snap.docs.map(d => ({ id: d.id, ...d.data() } as SDQAssessment)));
        setError(null);
        markLoaded('sdq');
      },
      (err) => {
        console.error('[useGuidanceScreenings] SDQ listener error:', err);
        setError(err.message);
        markLoaded('sdq');
      }
    );

    return () => {
      unsub2Q();
      unsubPHQ9();
      unsubSDQ();
    };
  }, []);

  return { twoQuestionScreenings, phq9Screenings, sdqAssessments, loading, error };
}
