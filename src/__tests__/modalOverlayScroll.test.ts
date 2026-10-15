import { describe, it, expect } from 'vitest';
import { readSource } from './helpers/readSource';

describe('ป๊อปอัปบนจอโทรศัพท์', () => {
  it('overlay ทุกตัว (fixed inset-0 items-center) เลื่อนได้และใช้ safe center กันกล่องสูงเกินถูกตัด', () => {
    const css = readSource('src/index.css');
    const rule = css.match(/\.fixed\.inset-0\.items-center\s*\{[^}]*\}/)?.[0] ?? '';
    expect(rule).toContain('overflow-y: auto');
    expect(rule).toContain('align-items: safe center');
    expect(rule).toContain('overscroll-behavior: contain');
  });
});
