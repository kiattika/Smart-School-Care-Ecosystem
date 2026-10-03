import { describe, it, expect } from 'vitest';
import { HOURS, composeTimeValue, minuteOptions, parseTimeValue } from '../components/shared/timePickerValue';

/** TimePicker (24 ชั่วโมง) — ค่าที่เก็บเป็น 'HH:mm' เหมือน <input type="time"> เดิม, '' = ยังไม่เลือก */
describe('TimePicker value conversion', () => {
  it('parses HH:mm into hour/minute parts and composes it back unchanged', () => {
    expect(parseTimeValue('08:30')).toEqual({ hour: '08', minute: '30' });
    expect(composeTimeValue(parseTimeValue('08:30'))).toBe('08:30');
    expect(composeTimeValue({ hour: '16', minute: '05' })).toBe('16:05');
  });

  it('normalises a single-digit hour (H:mm) to HH:mm', () => {
    expect(parseTimeValue('7:05')).toEqual({ hour: '07', minute: '05' });
    expect(composeTimeValue(parseTimeValue(' 7:05 '))).toBe('07:05');
  });

  it('empty value ↔ empty parts; an incomplete selection emits ""', () => {
    expect(parseTimeValue('')).toEqual({ hour: '', minute: '' });
    expect(parseTimeValue(null)).toEqual({ hour: '', minute: '' });
    expect(parseTimeValue(undefined)).toEqual({ hour: '', minute: '' });
    expect(composeTimeValue({ hour: '', minute: '' })).toBe('');
    expect(composeTimeValue({ hour: '09', minute: '' })).toBe('');
    expect(composeTimeValue({ hour: '', minute: '15' })).toBe('');
  });

  it('edges: 00:00 and 23:59 round-trip (00 is a real hour, not falsy)', () => {
    expect(parseTimeValue('00:00')).toEqual({ hour: '00', minute: '00' });
    expect(composeTimeValue(parseTimeValue('00:00'))).toBe('00:00');
    expect(parseTimeValue('23:59')).toEqual({ hour: '23', minute: '59' });
    expect(composeTimeValue(parseTimeValue('23:59'))).toBe('23:59');
  });

  it('rejects out-of-range or malformed values (treated as empty, never coerced)', () => {
    for (const bad of ['24:00', '23:60', '12:5', '1230', 'ab:cd', '08:30:00', '-1:00']) {
      expect(parseTimeValue(bad), bad).toEqual({ hour: '', minute: '' });
    }
  });

  it('offers hours 00-23 (24-hour clock, no AM/PM)', () => {
    expect(HOURS).toHaveLength(24);
    expect(HOURS[0]).toBe('00');
    expect(HOURS[23]).toBe('23');
  });

  it('minute options: every minute by default; a step keeps the current value even off-step', () => {
    expect(minuteOptions()).toHaveLength(60);
    expect(minuteOptions()[59]).toBe('59');
    expect(minuteOptions(5)).toEqual(['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55']);
    expect(minuteOptions(15, '07')).toEqual(['00', '07', '15', '30', '45']);
    expect(minuteOptions(0)).toHaveLength(60); // step ผิดรูป → 1 นาที
  });
});
