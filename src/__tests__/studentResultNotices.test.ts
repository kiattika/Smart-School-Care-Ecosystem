import { describe, it, expect } from 'vitest';
import { internshipDecisionNotice, fundDecisionNotice, retakeResultNotice } from '../lib/studentNotices';
import { readSource } from './helpers/readSource';

describe('แจ้งผลถึงนักเรียน: ฝึกงาน / ทุน-กยศ. / แก้ตัว-เรียนซ้ำ', () => {
  it('ผลคำร้องฝึกงาน อนุมัติ/ไม่อนุมัติ พร้อมหมายเหตุ', () => {
    const r = { periodLabel: 'ปิดภาคเรียนที่ 1', companyName: 'บริษัท ก' };
    const a = internshipDecisionNotice(r, 'APPROVED');
    expect(a.title).toContain('ได้รับการอนุมัติ');
    expect(a.message).toContain('บริษัท ก');
    const x = internshipDecisionNotice(r, 'REJECTED', 'ช่วงเวลาไม่ตรง');
    expect(x.type).toBe('warning');
    expect(x.message).toContain('ช่วงเวลาไม่ตรง');
  });

  it('ผลคัดเลือกทุน: ได้รับ/ผ่านเบื้องต้น/ไม่ได้รับ และสถานะอื่นไม่แจ้ง', () => {
    expect(fundDecisionNotice('SCHOLARSHIP', 'ทุน A', 'AWARDED')?.title).toContain('ได้รับทุนการศึกษา');
    expect(fundDecisionNotice('STUDENT_LOAN', 'กยศ.', 'SHORTLISTED')?.title).toContain('กองทุนกู้ยืม');
    expect(fundDecisionNotice('SCHOLARSHIP', 'ทุน A', 'NOT_SELECTED', 'คุณสมบัติไม่ครบ')?.message).toContain('คุณสมบัติไม่ครบ');
    expect(fundDecisionNotice('SCHOLARSHIP', 'ทุน A', 'INTERESTED' as never)).toBeNull();
  });

  it('ผลแก้ตัว/เรียนซ้ำ: แสดงเกรดเดิม→ใหม่ และแยกบันทึกใหม่/แก้ไข', () => {
    const r = { courseCode: 'ค31101', courseName: 'คณิตศาสตร์', kind: 'MAKEUP' as const, originalGrade: '0', newGrade: '1' };
    expect(retakeResultNotice(r, false).title).toBe('📝 บันทึกผลแก้ตัว');
    expect(retakeResultNotice({ ...r, kind: 'REPEAT' }, true).title).toBe('📝 แก้ไขผลเรียนซ้ำ');
    expect(retakeResultNotice(r, false).message).toContain('0 → เกรดใหม่ 1');
  });

  it('ต่อสายในบริการหลังงานหลักสำเร็จ และผู้แจ้งไม่ throw ทับงานหลัก', () => {
    expect(readSource('src/services/internshipService.ts')).toContain('internshipDecisionNotice(');
    expect(readSource('src/services/fundService.ts')).toContain('fundDecisionNotice(');
    expect(readSource('src/services/gradeRetakeService.ts')).toContain('retakeResultNotice(');
    expect(readSource('src/services/studentNotify.ts')).toMatch(/catch \(err\)[\s\S]*console\.warn\('\[notifyStudentSide\] failed'/);
  });

  it('rules: บทบาทผู้แจ้งสร้าง parent_notifications ได้ครบ', () => {
    const rules = readSource('firestore.rules');
    const i = rules.indexOf('match /parent_notifications/');
    const block = rules.slice(i, i + 1800);
    for (const r of ['FUND_SCHOLARSHIP', 'REGISTRAR', 'REGISTRAR_ASSISTANT']) expect(block).toContain(`hasRole('${r}')`);
  });
});
