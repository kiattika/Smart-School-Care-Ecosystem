import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { readSource } from './helpers/readSource';
import {
  emptyBrief, needsAttention, hasSharedItems, sharedTeacherLines, screeningLines, buildTeacherNoticeText, type StudentHealthBrief,
} from '../lib/advisorHealthSummary';

const src = (p: string) => readSource(path.resolve(__dirname, '..', p));

const brief = (over: Partial<StudentHealthBrief> = {}): StudentHealthBrief => ({ ...emptyBrief('10001', 'ด.ช.ทดสอบ'), hasProfile: true, ...over });

describe('advisorHealthSummary', () => {
  it('ไม่มีข้อมูล ≠ ไม่มีโรค: brief ว่างไม่ต้องสนใจ และไม่มีข้อความแจ้งครู', () => {
    const b = emptyBrief('1', 'x');
    expect(b.hasProfile).toBe(false);
    expect(needsAttention(b)).toBe(false);
    expect(hasSharedItems(b)).toBe(false);
    expect(buildTeacherNoticeText('ม.2/2', [b], new Set(['1']))).toBe('');
  });

  it('แจ้งครูผู้สอนเฉพาะรายการที่ครอบครัวอนุญาต และไม่เปิดเผยชื่อโรค', () => {
    const b = brief({
      chronic: [
        { id: 'c1', name: 'โรคหัวใจ', severity: 'SEVERE', treatmentCare: 'ห้ามออกกำลังกายหนัก/โดนแดดแรง', shareWithTeachers: true },
        { id: 'c2', name: 'โรคลับ', severity: 'MILD', treatmentCare: 'ข้อความภายใน' },
      ],
      allergies: [{ id: 'a1', allergen: 'ถั่วลิสง', type: 'FOOD', reaction: 'ผื่นขึ้น', shareWithTeachers: true }, { id: 'a2', allergen: 'เพนิซิลลิน', type: 'DRUG', reaction: '' }],
      specialCare: [{ id: 's1', category: 'สายตา', description: 'สายตาสั้นมาก', actionPlan: 'จัดที่นั่งหน้า', shareWithTeachers: true }],
    });
    const lines = sharedTeacherLines(b);
    expect(lines).toHaveLength(3);
    const all = lines.join('\n');
    expect(all).toContain('ห้ามออกกำลังกายหนัก/โดนแดดแรง');
    expect(all).toContain('แพ้ถั่วลิสง (ผื่นขึ้น)');
    expect(all).toContain('จัดที่นั่งหน้า');
    expect(all).not.toContain('โรคหัวใจ');
    expect(all).not.toContain('โรคลับ');
    expect(all).not.toContain('เพนิซิลลิน');
    expect(all).not.toContain('ข้อความภายใน');
  });

  it('โรคที่อนุญาตแต่ไม่มีข้อควรระวัง → ข้อความกลางๆ ไม่ใช่ชื่อโรค', () => {
    const b = brief({ chronic: [{ id: 'c', name: 'โรคเฉพาะ', severity: 'MILD', treatmentCare: '  ', shareWithTeachers: true }] });
    const l = sharedTeacherLines(b);
    expect(l).toHaveLength(1);
    expect(l[0]).not.toContain('โรคเฉพาะ');
  });

  it('ข้อความแจ้งรวมเฉพาะนักเรียนที่ครูเลือก; คำแนะนำสายตา/หูรวมเมื่อเลือกเท่านั้น', () => {
    const a = brief({ studentId: '1', name: 'ก', allergies: [{ id: 'a', allergen: 'นม', type: 'FOOD', reaction: '', shareWithTeachers: true }], visionAbnormal: true });
    const c = brief({ studentId: '2', name: 'ข', allergies: [{ id: 'b', allergen: 'ไข่', type: 'FOOD', reaction: '', shareWithTeachers: true }] });
    expect(screeningLines(a)).toHaveLength(1);
    const t1 = buildTeacherNoticeText('ม.2/2', [a, c], new Set(['1']));
    expect(t1).toContain('ก');
    expect(t1).toContain('แพ้นม');
    expect(t1).not.toContain('ไข่');
    expect(t1).not.toContain('ที่นั่ง');
    const t2 = buildTeacherNoticeText('ม.2/2', [a, c], new Set(['1']), new Set(['1']));
    expect(t2).toContain('ที่นั่งใกล้กระดาน');
    expect(t2).toContain('ม.2/2');
  });

  it('wiring: แท็บสุขภาพในพอร์ทัลครูที่ปรึกษา + checkbox อนุญาตในฟอร์มครอบครัว + ไม่มีข้อมูลตัวอย่าง', () => {
    expect(src('AdvisorPortal.tsx')).toContain('<AdvisorHealthSummaryPanel');
    const form = src('components/health/HealthProfileSection.tsx');
    expect((form.match(/shareWithTeachers/g) || []).length).toBeGreaterThanOrEqual(6);
    const panel = src('components/advisor/AdvisorHealthSummaryPanel.tsx');
    expect(panel).toContain('ยังไม่ได้บันทึกข้อมูลสุขภาพ');
    expect(panel).not.toMatch(/โรคหอบหืด|เบาหวาน|แพ้ยา/);
  });
});
