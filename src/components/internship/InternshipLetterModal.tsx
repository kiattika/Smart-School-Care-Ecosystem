import React from 'react';
import { Printer, X } from 'lucide-react';
import { buildLetter, type InternshipRequest, type InternshipSettings } from '../../lib/internship';

/** หนังสือขอความอนุเคราะห์ + แบบหนังสือตอบรับ — พิมพ์/บันทึก PDF ผ่านหน้าต่างพิมพ์ของเบราว์เซอร์ (ช่องที่ยังไม่มีข้อมูลเป็นเส้นประ ไม่เติมเอง) */
export function InternshipLetterModal({ req, settings, schoolName = 'โรงเรียนอุตรดิตถ์', onClose }: { req: InternshipRequest; settings: InternshipSettings; schoolName?: string; onClose: () => void }) {
  const L = buildLetter({ schoolName, req, settings });
  const dots = (v: string, w = 'min-w-[90px]') => <span className={`inline-block ${w} border-b border-dotted border-black px-1`}>{v || ' '}</span>;
  return (
    <div className="fixed inset-0 bg-black/70 z-[70] overflow-y-auto p-2 sm:p-6" id="internship-overlay">
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #internship-sheet, #internship-sheet * { visibility: visible !important; }
          #internship-overlay { position: static !important; background: none !important; overflow: visible !important; padding: 0 !important; }
          #internship-sheet { position: absolute; left: 0; top: 0; width: 100%; box-shadow: none !important; margin: 0 !important; }
          .internship-no-print { display: none !important; }
          .internship-page { break-after: page; }
          @page { size: A4; margin: 20mm; }
        }
      `}</style>
      <div className="max-w-[820px] mx-auto">
        <div className="internship-no-print flex justify-end gap-2 mb-2">
          <button className="px-3 py-1.5 rounded-lg text-xs bg-cyan-600 text-white flex items-center gap-1 cursor-pointer" onClick={() => window.print()}><Printer size={14} /> พิมพ์ / บันทึก PDF</button>
          <button aria-label="ปิด" className="px-3 py-1.5 rounded-lg text-xs bg-slate-700 text-white cursor-pointer" onClick={onClose}><X size={14} /></button>
        </div>
        <div id="internship-sheet" className="bg-white text-black text-[15px] leading-7 p-10 shadow-xl" style={{ fontFamily: '"TH Sarabun New", "Sarabun", sans-serif' }}>
          <section className="internship-page">
            <div className="flex justify-between"><div>ที่ {dots(L.number)}</div><div className="text-right">{schoolName}<br />วันที่ {dots(L.dateText, 'min-w-[140px]')}</div></div>
            <p className="mt-4"><b>เรื่อง</b>&nbsp; {L.subject}</p>
            <p><b>เรียน</b>&nbsp; {L.to}</p>
            <p className="mt-3 indent-12 text-justify">{L.intro} {L.purpose} {L.period}</p>
            <p className="mt-2 indent-12 text-justify">{L.closing}</p>
            <div className="mt-8 text-center">
              <p>ขอแสดงความนับถือ</p>
              <p className="mt-12">{L.signerName ? `(${L.signerName})` : '(........................................)'}</p>
              <p>{L.signerPosition || ' '}</p>
            </div>
            <p className="mt-6 text-sm">งานแนะแนว {schoolName}</p>
          </section>
          <section className="mt-8">
            <div className="text-center font-bold">แบบหนังสือตอบรับการฝึกงานของนักเรียน</div>
            <p className="mt-2 text-sm">นักเรียน: {req.studentName} ชั้น {req.room || '-'} · สถานประกอบการ: {req.companyName}</p>
            <div className="mt-3 whitespace-pre-line text-justify">{L.acceptance || '(งานแนะแนวยังไม่ได้ตั้งค่าแบบหนังสือตอบรับ)'}</div>
          </section>
        </div>
      </div>
    </div>
  );
}
