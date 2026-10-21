import React from 'react';
import { Lightbulb } from 'lucide-react';
import {
  PLC_PER_MEETING_CONTENT, PLC_RECOMMENDED_CYCLES, PLC_STEP_FOCUS, REFLECTION_RECOMMENDED_PER_TERM,
  reflectionGuideItems, type PlcProgress,
} from '../../lib/teachingGuidance';
import { PLC_STEPS, PLC_STEP_LABEL } from '../../lib/plc';

const box = 'rounded-xl border border-indigo-500/30 bg-indigo-500/5 p-4 text-sm space-y-2';

/** กล่องคำแนะนำ (เปิด/ปิดได้) — ไม่บังคับ ไม่ตัดสินผล */
export function PlcGuidanceCard({ progress }: { progress: PlcProgress }) {
  return (
    <details className={box} data-testid="plc-guidance" open={progress.completedCycles < PLC_RECOMMENDED_CYCLES}>
      <summary className="cursor-pointer text-indigo-200 font-medium flex items-center gap-2"><Lightbulb className="w-4 h-4" /> คำแนะนำ: PLC ภาคเรียนนี้ควรทำกี่ครั้ง และบันทึกอะไรบ้าง</summary>
      <p className="text-white">{progress.summary}</p>
      <p className="text-slate-300">ข้อเสนอแนะ: อย่างน้อย {PLC_RECOMMENDED_CYCLES} วงจร PDCA ต่อภาคเรียน (พบกัน {PLC_STEPS.length} ครั้ง ครั้งละ 1 ขั้น) ทำได้ตลอดภาคเรียน ไม่มีช่วงเวลาปิดรับ</p>
      <ul className="list-disc pl-5 text-slate-300 space-y-0.5">
        {PLC_STEPS.map(s => <li key={s}><span className="text-slate-100">{PLC_STEP_LABEL[s]}</span> — {PLC_STEP_FOCUS[s]}</li>)}
      </ul>
      <p className="text-slate-200 pt-1">แต่ละครั้งที่พบกัน ควรบันทึก:</p>
      <ul className="list-disc pl-5 text-slate-300 space-y-0.5">
        {PLC_PER_MEETING_CONTENT.map(t => <li key={t}>{t}</li>)}
      </ul>
    </details>
  );
}

export function ReflectionGuidanceCard({ done }: { done: boolean }) {
  return (
    <details className={box} data-testid="reflection-guidance" open={!done}>
      <summary className="cursor-pointer text-indigo-200 font-medium flex items-center gap-2"><Lightbulb className="w-4 h-4" /> คำแนะนำ: สะท้อนคิดภาคเรียนนี้ต้องเขียนอะไรบ้าง</summary>
      <p className="text-slate-300">ข้อเสนอแนะ: {REFLECTION_RECOMMENDED_PER_TERM} ฉบับต่อภาคเรียน เขียนต่อเติมและแก้ไขได้ตลอดภาคเรียน ไม่มีช่วงเวลาปิดรับ — ควรเขียนให้ครบหัวข้อที่จำเป็นก่อนสิ้นภาคเรียน เพื่อใช้ประกอบแฟ้มสะสมงานและการนิเทศ</p>
      <ul className="list-disc pl-5 text-slate-300 space-y-0.5">
        {reflectionGuideItems().map(i => <li key={i.label}><span className="text-slate-100">{i.label}</span>{i.required ? ' (จำเป็น)' : ' (ไม่บังคับ)'} — {i.hint}</li>)}
      </ul>
    </details>
  );
}
