import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { TermIndicatorBadge } from '../components/TermIndicatorBadge';

const html = (p: Partial<React.ComponentProps<typeof TermIndicatorBadge>>) =>
  renderToStaticMarkup(<TermIndicatorBadge academicYear="2569" term="2" isConfigured {...p} />);

describe('TermIndicatorBadge', () => {
  it('ตั้งค่าแล้ว → แสดง "ภาคเรียนที่ 2/2569" ไม่มีป้ายเตือน', () => {
    const out = html({});
    expect(out).toContain('ภาคเรียนที่ 2/2569');
    expect(out).toContain('data-testid="term-indicator"');
    expect(out).not.toContain('ยังไม่ได้ตั้งค่า');
    expect(out).not.toContain('term-indicator-warning');
  });
  it('ยังไม่ตั้งค่า → ป้ายเตือน และไม่แสดงปี/ภาคที่เดามาจากวันที่', () => {
    const out = html({ isConfigured: false });
    expect(out).toContain('ยังไม่ได้ตั้งค่าภาคเรียน');
    expect(out).toContain('data-testid="term-indicator-warning"');
    expect(out).not.toContain('2/2569');
    expect(out).toContain('amber');
  });
  it('กำลังโหลด → ไม่แสดงอะไร (กันป้ายเตือนวาบก่อนอ่านค่าจริง)', () => {
    expect(html({ loading: true, isConfigured: false })).toBe('');
    expect(html({ loading: true })).toBe('');
  });
});
