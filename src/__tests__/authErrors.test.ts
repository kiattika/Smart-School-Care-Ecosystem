import { describe, it, expect } from 'vitest';
import { describeAuthError, extractBlockingFunctionMessage } from '../lib/authErrors';

// ข้อความจาก blocking function รูปแบบจริงถูกทดสอบบน emulator แล้วใน authBlocking.e2e.test.ts
describe('describeAuthError', () => {
  it('maps AUTH_NO_ROLE / AUTH_NO_PROFILE thrown by buildAppUser to Thai messages', () => {
    expect(describeAuthError(new Error('AUTH_NO_ROLE: x'))).toContain('ติดต่อผู้ดูแลระบบ');
    expect(describeAuthError(new Error('AUTH_NO_PROFILE: staff/t-1 ไม่พบ'))).toContain('staff');
  });

  it('unescapes a \\u-escaped Thai message nested in the server JSON', () => {
    const err = { code: 'auth/internal-error', message: 'Firebase: BLOCKING_FUNCTION_ERROR_RESPONSE : ((HTTP 403: {"error":{"message":"\\u0e44\\u0e21\\u0e48","status":"PERMISSION_DENIED"}})) (auth/internal-error).' };
    expect(extractBlockingFunctionMessage(err)).toBe('ไม่');
  });

  it('falls back to known auth codes, then the raw message', () => {
    expect(describeAuthError({ code: 'auth/invalid-credential', message: 'x' })).toBe('อีเมลหรือรหัสผ่านไม่ถูกต้อง');
    expect(describeAuthError({ code: 'auth/other', message: 'raw' })).toBe('raw');
    expect(extractBlockingFunctionMessage(new Error('plain error'))).toBeNull();
  });
});
