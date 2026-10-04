import { describe, it, expect, vi, beforeEach } from 'vitest';

const callable = vi.fn();
const httpsCallable = vi.fn((..._args: unknown[]) => callable);
vi.mock('firebase/functions', () => ({ httpsCallable: (...args: unknown[]) => httpsCallable(...args) }));
vi.mock('../lib/firebase', () => ({ functions: { name: 'fake-functions' } }));

import { refreshGuidanceStatus } from '../services/guidanceStatusService';

describe('refreshGuidanceStatus (client → callable)', () => {
  beforeEach(() => { callable.mockReset(); httpsCallable.mockClear(); });

  it('calls the refreshGuidanceStatus callable with no payload and returns the server result', async () => {
    callable.mockResolvedValue({ data: { success: true, hasActiveCounselor: false, count: 0 } });
    await expect(refreshGuidanceStatus()).resolves.toEqual({ hasActiveCounselor: false, count: 0 });
    expect(httpsCallable.mock.calls[0][1]).toBe('refreshGuidanceStatus');
    expect(callable).toHaveBeenCalledWith();
  });

  it('returns true with the counselor count', async () => {
    callable.mockResolvedValue({ data: { success: true, hasActiveCounselor: true, count: 2 } });
    await expect(refreshGuidanceStatus()).resolves.toEqual({ hasActiveCounselor: true, count: 2 });
  });

  it('throws (never guesses) on a malformed response', async () => {
    callable.mockResolvedValue({ data: {} });
    await expect(refreshGuidanceStatus()).rejects.toThrow();
  });

  it('propagates callable errors (e.g. permission-denied)', async () => {
    callable.mockRejectedValue(Object.assign(new Error('denied'), { code: 'functions/permission-denied' }));
    await expect(refreshGuidanceStatus()).rejects.toThrow('denied');
  });
});
