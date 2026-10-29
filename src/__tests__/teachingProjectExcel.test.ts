import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { buildProjectWorkbook, parseProjectFile, parseProjectWorkbook, reuseUnitIds, workbookToArrayBuffer, safeFileName, type ExcelContent } from '../lib/teachingProjectExcel';
import { SUPERVISION_GROUP_TABS, sidebarIdForTab } from '../lib/supervisionMenu';
import { validateProject, type ProjectUnit } from '../lib/teachingProject';

const unit = (o: Partial<ProjectUnit>): ProjectUnit => ({ id: 'x', type: 'LESSON', weeks: '1', title: 'บทที่ 1', detail: '', hours: 2, activities: '', media: '', ...o });
const sample: ExcelContent = {
  courseType: 'สาระการเรียนรู้พื้นฐาน', levelLabel: 'ม.5', credits: '1', hoursPerWeek: '2',
  description: 'ศึกษาจำนวนเชิงซ้อน', indicators: ['รท.1 บอกความหมาย', 'รท.2 อธิบาย'],
  units: [unit({ id: 'a', weeks: '1-2', title: 'บทที่ 1 หัวข้อ 1.1', detail: 'บรรทัด 1\nบรรทัด 2', hours: 2, activities: 'สืบเสาะ (5E)', media: 'Desmos\nGoogle Slides' }),
    unit({ id: 'b', type: 'EXAM', weeks: '10', title: 'สอบกลางภาค', hours: 2 })],
  assessment: [{ label: 'ระหว่างภาค', percent: 80 }, { label: 'ปลายภาค', percent: 20 }], assessmentNote: '80:20',
};

describe('โครงการสอน ⇄ Excel', () => {
  it('ส่งออกแล้วนำเข้ากลับได้ข้อมูลเท่าเดิม (สัปดาห์ "1-2" ไม่ถูกแปลงเป็นวันที่, ขึ้นบรรทัดใหม่คงอยู่)', () => {
    const r = parseProjectFile(workbookToArrayBuffer(buildProjectWorkbook(sample, { title: 't' })));
    expect(r.errors).toEqual([]); expect(r.warnings).toEqual([]);
    const c = r.content!;
    expect(c.units.map(u => [u.type, u.weeks, u.title, u.hours])).toEqual([['LESSON', '1-2', 'บทที่ 1 หัวข้อ 1.1', 2], ['EXAM', '10', 'สอบกลางภาค', 2]]);
    expect(c.units[0].detail).toBe('บรรทัด 1\nบรรทัด 2'); expect(c.units[0].media).toBe('Desmos\nGoogle Slides');
    expect(c.indicators).toEqual(sample.indicators); expect(c.assessment).toEqual(sample.assessment);
    expect(c.courseType).toBe('สาระการเรียนรู้พื้นฐาน'); expect(c.credits).toBe('1'); expect(c.description).toBe('ศึกษาจำนวนเชิงซ้อน');
    expect(validateProject(c)).toEqual([]);
  });
  it('เทมเพลตเปล่ามีตัวอย่างและมีชีตครบ', () => {
    const wb = buildProjectWorkbook({ ...sample, description: '', indicators: [], units: [], assessment: [], assessmentNote: '' }, { title: 't', example: true });
    expect(wb.SheetNames).toEqual(['ข้อมูลทั่วไป', 'ตัวชี้วัด', 'เนื้อหา', 'การวัดผล', 'คำแนะนำ']);
    expect(parseProjectWorkbook(wb).content?.assessment.reduce((a, b) => a + b.percent, 0)).toBe(100);
  });
  it('แถวที่ผิดรูปแบบ → คำเตือนรายแถว ไม่ทำให้ทั้งไฟล์พัง', () => {
    const wb = buildProjectWorkbook(sample, { title: 't' });
    wb.Sheets['เนื้อหา'] = XLSX.utils.aoa_to_sheet([
      ['ประเภท (บท/สอบ)', 'สัปดาห์', 'บท/หัวข้อ', 'ชั่วโมง', 'หัวข้อย่อย/เนื้อหาสาระ', 'กิจกรรมการเรียนการสอน', 'สื่อ/แหล่งเรียนรู้'],
      ['บท', 'abc', 'หัวข้อ ก', 'x', '', '', ''],
      ['', '', '', '', '', '', ''],
      ['สอบ', 5, 'ทดสอบย่อย', 1, '', '', ''],
    ]);
    const r = parseProjectWorkbook(wb);
    expect(r.content!.units).toHaveLength(2);
    expect(r.content!.units[0]).toMatchObject({ weeks: '', hours: null });
    expect(r.content!.units[1]).toMatchObject({ type: 'EXAM', weeks: '5' });
    expect(r.warnings.filter(w => w.includes('แถว 2'))).toHaveLength(2);
  });
  it('ไม่ใช่เทมเพลต/ไฟล์เสีย → errors, content=null', () => {
    const other = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(other, XLSX.utils.aoa_to_sheet([['a']]), 'Sheet1');
    expect(parseProjectWorkbook(other).content).toBeNull();
    expect(parseProjectFile(new TextEncoder().encode('not excel').buffer as ArrayBuffer).errors.length).toBeGreaterThan(0);
  });
  it('รวมร้อยละไม่ 100 → เตือน; คำอธิบายเกิน 2000 → เตือน', () => {
    const r = parseProjectWorkbook(buildProjectWorkbook({ ...sample, assessment: [{ label: 'x', percent: 50 }], description: 'ก'.repeat(2001) }, { title: 't' }));
    expect(r.warnings.some(w => w.includes('ควรเท่ากับ 100'))).toBe(true);
    expect(r.warnings.some(w => w.includes('2,000'))).toBe(true);
  });
  it('reuseUnitIds ใช้ id เดิมเมื่อชื่อ+ประเภทตรงกัน (บันทึกหลังสอนไม่ขาดลิงก์)', () => {
    const out = reuseUnitIds([unit({ id: 'n1', title: 'บทที่ 1 หัวข้อ 1.1' }), unit({ id: 'n2', title: 'ใหม่' }), unit({ id: 'n3', type: 'EXAM', title: 'สอบกลางภาค' })], sample.units);
    expect(out.map(u => u.id)).toEqual(['a', 'n2', 'b']);
  });
  it('safeFileName ตัดอักขระต้องห้าม', () => { expect(safeFileName('ค32102 คณิต/พื้นฐาน: 2/2569')).toBe('ค32102_คณิต_พื้นฐาน_2_2569'); });
});

describe('เมนู ผลการนิเทศ รวม 4 แท็บ', () => {
  it('ทุกแท็บในกลุ่มไฮไลต์เมนู my-supervision; แท็บอื่นไม่เปลี่ยน', () => {
    SUPERVISION_GROUP_TABS.forEach(t => expect(sidebarIdForTab(t.id)).toBe('my-supervision'));
    expect(sidebarIdForTab('courses')).toBe('courses'); expect(sidebarIdForTab('my-portfolio')).toBe('my-portfolio');
  });
  it('id แท็บที่กระดิ่งอ้าง (my-lesson-plans) ยังอยู่ในกลุ่ม', () => { expect(SUPERVISION_GROUP_TABS.map(t => t.id)).toContain('my-lesson-plans'); });
});
