import { describe, it, expect } from 'vitest';
import { readSource } from './helpers/readSource';

describe('guard: แบบประเมินตนเองต้องบันทึก/อ่านได้จริง และครูที่ปรึกษาเห็น', () => {
  it('store.saveSelfAssessment ไม่กลืน error (เขียน Firestore ก่อน แล้วค่อยอัปเดต state)', () => {
    const st = readSource('src/store.ts');
    const blk = st.match(/saveSelfAssessment: async[\s\S]*?\n {2}\},\n/)?.[0] || '';
    expect(blk).toMatch(/await saveSelfAssessmentRecord\(updated\)/);
    expect(blk).not.toMatch(/catch/);
    expect(blk.indexOf('await saveSelfAssessmentRecord')).toBeLessThan(blk.indexOf('set((state)'));
  });
  it('rules: นักเรียนเจ้าของเทียบผ่าน students.studentUid, ครูที่ปรึกษาอ่านตามห้อง, เขียนต้อง homeroomClass ตรง students.room', () => {
    const blk = readSource('firestore.rules').match(/match \/student_self_assessments\/\{studentId\} \{[\s\S]*?\n {4}\}/)?.[0] || '';
    expect(blk).toMatch(/isSelfStudent\(studentId\)/);
    expect(blk).toMatch(/isHomeroomTeacherOf\(resource\.data\.homeroomClass\)/);
    expect(blk).toMatch(/request\.resource\.data\.homeroomClass == studentField\(studentId, 'room'/);
    expect(blk).not.toMatch(/allow (write|create|update)[^;]*isSelf\(studentId\)/);
    expect(blk).not.toMatch(/allow (write|create|update)[^;]*isSignedIn\(\)\s*;/);
  });
  it('StudentPortal ส่ง homeroomClass/studentUid ตอนบันทึก, แจ้ง error ตอนอ่านไม่ได้ และเมนูประเมินตนเองอยู่ก่อนที่อยู่บ้าน', () => {
    const sp = readSource('src/StudentPortal.tsx');
    expect(sp).toMatch(/homeroomClass: student\.room/);
    expect(sp).toMatch(/assessmentLoadError/);
    expect(sp.indexOf("id: 'assessment'")).toBeLessThan(sp.indexOf("id: 'socio'"));
  });
  it('AdvisorPortal อ่านแบบประเมินของห้องจาก listener Firestore ไม่ใช่ store', () => {
    const ap = readSource('src/AdvisorPortal.tsx');
    expect(ap).toMatch(/subscribeSelfAssessmentsByRoom\(myRoom/);
    expect(ap).not.toMatch(/updateStudentProfile,\s*\n\s*selfAssessments/);
  });
  it('แชร์ค่าร่วมสองทาง: ฟอร์มไหนบันทึกก็เติมอีกฟอร์ม (เฉพาะช่องว่าง)', () => {
    expect(readSource('src/StudentPortal.tsx')).toMatch(/syncSharedToHomeVisitInfo\(/);
    expect(readSource('src/components/homevisit/StudentHomeVisitInfoForm.tsx')).toMatch(/syncSharedToSelfAssessment\(/);
  });
});

describe('guard: layout/ปฏิทิน', () => {
  it('App: wrapper ของ StudentPortal/ParentPortal ไม่ใช้ items-center ร่วมกับ flex-shrink (เนื้อหายาวล้นขึ้นบนเลื่อนไม่ได้)', () => {
    const app = readSource('src/App.tsx');
    for (const portal of ['StudentPortal', 'ParentPortal']) {
      const m = app.match(new RegExp(`<div className="([^"]*)">\\s*<${portal} />`));
      expect(m, portal).toBeTruthy();
      expect(m![1]).toMatch(/shrink-0/);
      expect(m![1]).toMatch(/items-start/);
      expect(m![1]).not.toMatch(/items-center/);
    }
  });
  it('DatePicker มีหน้าเลือกปี พ.ศ./เดือน และวันเกิดเปิดที่หน้าเลือกปีก่อน', () => {
    const dp = readSource('src/components/shared/DatePicker.tsx');
    expect(dp).toMatch(/yearFirst/);
    expect(dp).toMatch(/mode === 'years'/);
    expect(dp).toMatch(/mode === 'months'/);
    expect(readSource('src/components/homevisit/StudentHomeVisitInfoForm.tsx')).toMatch(/<DatePicker yearFirst/);
  });
});
