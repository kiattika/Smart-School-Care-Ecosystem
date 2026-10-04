import React, { useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2, Smile } from 'lucide-react';
import { useStudentNineQGate } from '../../hooks/useDepressionScreening';
import { scoreNineQ, NineQAnswers } from '../../lib/depressionScreening';
import { submitNineQByStudent } from '../../services/screeningService';
import { EMPTY_NINE_Q_ANSWERS, NineQuestionForm } from '../shared/NineQuestionForm';

/**
 * 9Q (แบบประเมินภาวะซึมเศร้าฉบับไทย) ฝั่งนักเรียน — ไม่มีปุ่ม/ฟอร์มให้กดทำเองลอยๆ:
 * แสดงเฉพาะเมื่อ (ก) 2Q ล่าสุดของตัวเองเป็นบวก หรือ (ข) ครูแนะแนว/ครูที่ปรึกษาเปิดให้ — และเป็นฐานที่ยังไม่เคยใช้
 * (firestore.rules บังคับเงื่อนไขเดียวกัน: ต่อให้เข้าถึงฟอร์มได้ก็เขียนไม่ผ่านถ้าไม่มีฐาน)
 * ปิด = ไม่แสดงอะไรเลย (ไม่บอกว่ามีแบบประเมินนี้อยู่)
 * ⚠ นักเรียนห้ามเห็นคะแนนดิบ/ระดับ/ธงแดงของ 9Q — หลังส่งแสดงข้อความกลางๆ เท่านั้น (ผลไปที่ครู; rules ไม่ให้นักเรียนอ่าน 9Q)
 */
export function StudentNineQSection({ studentId }: { studentId: string }) {
  const gate = useStudentNineQGate(studentId, true);
  const [answers, setAnswers] = useState<NineQAnswers>(EMPTY_NINE_Q_ANSWERS);
  const [showErrors, setShowErrors] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (gate.error && !gate.basis && !submitted) {
    // อ่านสถานะไม่ได้ = ไม่แสดงแบบประเมิน (ไม่เดาว่าเปิดอยู่) แต่ log ไว้
    console.warn('[StudentNineQSection] gate unavailable — 9Q stays closed:', gate.error);
    return null;
  }

  if (submitted) {
    return (
      <div className="bg-slate-900/70 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl" data-testid="nineq-submitted">
        <div className="flex items-start gap-3 text-sm text-emerald-300">
          <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">ส่งแบบประเมินเรียบร้อยแล้ว ขอบคุณที่ตอบ</p>
            <p className="text-xs text-slate-400 mt-1">ผลจะถูกส่งให้ครูที่ดูแล หากรู้สึกไม่สบายใจ สามารถบอกครูแนะแนวหรือครูที่ปรึกษาที่ไว้ใจได้ทุกเมื่อ</p>
          </div>
        </div>
      </div>
    );
  }

  if (gate.loading || !gate.basis) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setShowErrors(true);
    setError(null);
    const scored = scoreNineQ(answers);
    if (!('totalScore' in scored)) return;
    setSaving(true);
    try {
      // ส่งแค่คำตอบดิบ — เซิร์ฟเวอร์คำนวณระดับ/ธงแดง ตรวจฐาน และเขียนเอง (ไม่คืนผลให้นักเรียน)
      await submitNineQByStudent({ studentId, answers: scored.answers });
      setSubmitted(true);
      setAnswers(EMPTY_NINE_Q_ANSWERS);
    } catch (err) {
      console.error('[StudentNineQSection] submit failed:', err);
      // ข้อความกลางๆ: ไม่เปิดเผยเงื่อนไข/ผลใดๆ
      setError('ส่งแบบประเมินไม่สำเร็จ กรุณาลองใหม่อีกครั้ง หรือแจ้งครู');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-slate-900/70 border border-slate-800 rounded-3xl p-5 sm:p-6 backdrop-blur-md shadow-xl space-y-4" data-testid="nineq-section">
      <div>
        <h3 className="text-sm font-bold text-white flex items-center gap-2"><Smile className="w-4 h-4 text-indigo-400" /> แบบประเมินภาวะซึมเศร้า 9 คำถาม (9Q)</h3>
        <p className="text-[11px] text-slate-400">เลือกคำตอบที่ตรงกับตัวเองมากที่สุดในแต่ละข้อ (ทุกข้อต้องตอบ) · แบบประเมินนี้ทำได้ 1 ครั้งต่อการเปิดให้ทำ</p>
      </div>
      {error && (
        <div role="alert" className="p-3 rounded-xl border border-rose-500/30 bg-rose-500/10 text-xs text-rose-300 flex items-start gap-2"><AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /><span>{error}</span></div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <NineQuestionForm answers={answers} onChange={setAnswers} disabled={saving} showErrors={showErrors} idPrefix="student-nineq" />
        <button type="submit" disabled={saving} className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-bold text-xs rounded-xl shadow transition-all inline-flex items-center justify-center gap-2">
          {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />} ส่งแบบประเมิน 9Q
        </button>
      </form>
    </div>
  );
}
