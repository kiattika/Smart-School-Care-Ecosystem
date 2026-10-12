import { describe, it, expect } from 'vitest';
import { readSource } from './helpers/readSource';

describe('เมนูย่อยนักเรียน/ผู้ปกครองใช้ PortalSidebarLayout', () => {
  it.each([
    ['src/StudentPortal.tsx', ['overview', 'gate', 'health', 'socio', 'behavior', 'electives', 'portfolio', 'academic', 'parent', 'assessment']],
    ['src/ParentPortal.tsx', ['timeline', 'gate', 'health', 'behavior', 'portfolio', 'academic', 'services']],
  ])('%s', (file, ids) => {
    const src = readSource(file);
    expect(src).toMatch(/<PortalSidebarLayout/);
    expect(src).not.toMatch(/Core Module Navigation Bar/);
    for (const id of ids) expect(src).toMatch(new RegExp(`id: '${id}'`));
  });
});
