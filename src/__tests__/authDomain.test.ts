import { describe, it, expect } from 'vitest';
import { resolveAuthDomain } from '../lib/authDomain';
import { readSource } from './helpers/readSource';

const cfg = { projectId: 'kiattisak-project-001', authDomain: 'kiattisak-project-001.firebaseapp.com' };

describe('resolveAuthDomain', () => {
  it('เปิดที่ web.app → ใช้โดเมนเดียวกับแอป (กัน missing initial state บน Chrome Android)', () => {
    expect(resolveAuthDomain(cfg, 'kiattisak-project-001.web.app')).toBe('kiattisak-project-001.web.app');
  });
  it('โดเมนอื่น/localhost/ไม่มี window → ใช้ค่าใน config เดิม', () => {
    expect(resolveAuthDomain(cfg, 'kiattisak-project-001.firebaseapp.com')).toBe(cfg.authDomain);
    expect(resolveAuthDomain(cfg, 'localhost')).toBe(cfg.authDomain);
    expect(resolveAuthDomain(cfg, 'evil.web.app')).toBe(cfg.authDomain);
    expect(resolveAuthDomain(cfg, undefined)).toBe(cfg.authDomain);
  });
  it('firebase.ts ใช้ resolveAuthDomain', () => {
    expect(readSource('src/lib/firebase.ts')).toMatch(/authDomain: resolveAuthDomain\(/);
  });
});
