import React from 'react';

/** แสดงเมื่อยังไม่มีข้อมูลนักเรียนจริง (ยังโหลดไม่เสร็จ/ไม่พบ) — ห้ามเติมนักเรียนปลอมหรือนักเรียนคนแรกในรายการแทน */
export function NoStudentNotice() {
  return (
    <div role="status" className="p-6 rounded-3xl border border-slate-800 bg-slate-900/60 text-center text-xs text-slate-400">
      ยังไม่พบข้อมูลนักเรียน
    </div>
  );
}
