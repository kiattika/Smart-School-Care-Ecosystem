import { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { TwoQuestionScreening, SDQAssessment } from '../types';

/**
 * Live real-time listeners สำหรับผลคัดกรองสุขภาพจิต 2Q และ SDQ — ใช้โดย GuidancePortal เพื่อให้ครูแนะแนวเห็นผลใหม่ "ทันที"
 * (มีคนกด "ส่งแบบประเมิน" ปุ๊บ ต้องขึ้นที่นี่ปั๊บ ไม่ใช่ fetch ครั้งเดียว)
 *
 * 9Q/8Q (คัดกรองซึมเศร้า/ฆ่าตัวตาย) ย้ายไปที่ useGuidanceScreeningRecords() ใน hooks/useDepressionScreening.ts — เอกสารแยกตามระดับ
 * การมองเห็น (ดู firestore.rules); PHQ-9 สากลเดิมเลิกใช้แล้ว (แทนด้วย 9Q ไทย)
 * firestore.rules อนุญาตให้ GUIDANCE_COUNSELOR อ่านทั้ง collection ของ 2Q/SDQ อยู่แล้ว จึง onSnapshot(collection(...)) ตรงๆ ได้
 */
export function useGuidanceScreenings() {
  const [twoQuestionScreenings, setTwoQuestionScreenings] = useState<TwoQuestionScreening[]>([]);
  const [sdqAssessments, setSdqAssessments] = useState<SDQAssessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadedFlags = { twoQ: false, sdq: false };
    const markLoaded = (key: keyof typeof loadedFlags) => {
      loadedFlags[key] = true;
      if (loadedFlags.twoQ && loadedFlags.sdq) setLoading(false);
    };

    const unsub2Q = onSnapshot(
      collection(db, 'student_screenings_2q'),
      (snap) => {
        setTwoQuestionScreenings(snap.docs.map(d => ({ id: d.id, ...d.data(), studentId: d.id } as TwoQuestionScreening)));
        setError(null);
        markLoaded('twoQ');
      },
      (err) => {
        console.error('[useGuidanceScreenings] 2Q listener error:', err);
        setError(err.message);
        markLoaded('twoQ');
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
      unsubSDQ();
    };
  }, []);

  return { twoQuestionScreenings, sdqAssessments, loading, error };
}
