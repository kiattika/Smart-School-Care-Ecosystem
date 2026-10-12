import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { crc16ccitt, buildPromptPayPayload, validatePromptPayId } from '../lib/promptPay';
import { sanitizeBillingPaymentInfo, validateBillingPaymentInfo, hasPaymentChannel, EMPTY_BILLING_PAYMENT_INFO } from '../lib/billingPaymentInfo';

const readSource = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf-8');

describe('promptPay payload', () => {
  it('CRC16/CCITT-FALSE matches the standard check value', () => {
    expect(crc16ccitt('123456789')).toBe(0x29b1);
  });

  it('payload CRC is self-consistent and has the expected structure (phone, with amount)', () => {
    const p = buildPromptPayPayload({ type: 'PHONE', id: '081-234-5678' }, 150.5);
    expect(p.startsWith('000201010212')).toBe(true);
    expect(p).toContain('0016A000000677010111');
    expect(p).toContain('01130066812345678');
    expect(p).toContain('5303764');
    expect(p).toContain('5406150.50');
    expect(p).toContain('5802TH');
    expect(p.slice(-8, -4)).toBe('6304');
    expect(crc16ccitt(p.slice(0, -4)).toString(16).toUpperCase().padStart(4, '0')).toBe(p.slice(-4));
  });

  it('static QR (no amount) uses 11 and omits tag 54', () => {
    const p = buildPromptPayPayload({ type: 'NATIONAL_ID', id: '1234567890123' });
    expect(p.startsWith('000201010211')).toBe(true);
    expect(p).toContain('02131234567890123');
    expect(p).not.toContain('54');
  });

  it('e-wallet uses sub-tag 03', () => {
    expect(buildPromptPayPayload({ type: 'EWALLET', id: '123456789012345' })).toContain('0315123456789012345');
  });

  it('rejects bad ids and amounts', () => {
    expect(() => buildPromptPayPayload({ type: 'PHONE', id: '12345' })).toThrow();
    expect(() => buildPromptPayPayload({ type: 'PHONE', id: '0812345678' }, -1)).toThrow();
    expect(() => buildPromptPayPayload({ type: 'PHONE', id: '0812345678' }, 0)).toThrow();
    expect(validatePromptPayId('PHONE', '0812345678')).toBeNull();
    expect(validatePromptPayId('NATIONAL_ID', '12')).not.toBeNull();
  });
});

describe('billingPaymentInfo', () => {
  it('sanitize falls back to empty for junk', () => {
    expect(sanitizeBillingPaymentInfo(null)).toEqual(EMPTY_BILLING_PAYMENT_INFO);
    expect(sanitizeBillingPaymentInfo({ promptPayType: 'X', accountName: 5 }).promptPayType).toBe('NONE');
  });

  it('validate normalises digits and flags bad ids', () => {
    const ok = validateBillingPaymentInfo({ ...EMPTY_BILLING_PAYMENT_INFO, accountName: 'โรงเรียน', promptPayType: 'PHONE', promptPayId: '081-234-5678' });
    expect('value' in ok && ok.value.promptPayId).toBe('0812345678');
    const bad = validateBillingPaymentInfo({ ...EMPTY_BILLING_PAYMENT_INFO, accountName: 'โรงเรียน', promptPayType: 'PHONE', promptPayId: '12' });
    expect('errors' in bad && !!bad.errors.promptPayId).toBe(true);
  });

  it('hasPaymentChannel', () => {
    expect(hasPaymentChannel(EMPTY_BILLING_PAYMENT_INFO)).toBe(false);
    expect(hasPaymentChannel({ ...EMPTY_BILLING_PAYMENT_INFO, bankAccountNo: '123' })).toBe(true);
  });
});

describe('guard: no mock QR', () => {
  it('has no external QR service or mock payload in src', () => {
    for (const f of ['../services/firestoreService.ts', '../components/student-parent/ParentEngagementServices.tsx', '../components/shared/PromptPayQr.tsx']) {
      const src = readSource(f);
      expect(src).not.toMatch(/qrserver\.com|PROMPTPAY-MOCK|buildPromptPayQrMock/);
    }
  });
  it('rules wildcard excludes billing_payment and has a dedicated block', () => {
    const rules = readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf-8');
    expect(rules).toMatch(/settingId != 'billing_payment'/);
    expect(rules).toMatch(/match \/school_settings\/billing_payment/);
  });
});
