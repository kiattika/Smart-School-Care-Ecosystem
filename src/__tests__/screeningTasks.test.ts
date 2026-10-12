import { describe, it, expect } from 'vitest';
import { isOpenTwoQ, isOpenRedFlag, countScreeningTasks, redFlagStudentIds, type ScreeningTaskRecord } from '../lib/screeningTasks';
import { buildStaffTasks, staffTaskSources } from '../lib/staffTasks';
import { readSource } from './helpers/readSource';

const rec = (over: Partial<ScreeningTaskRecord> = {}): ScreeningTaskRecord => over;
const twoQ = (over = {}) => ({ id: 'q2-1', isPositive: true, conductedAt: '2026-10-10', ...over });
const nine = (over = {}) => ({ id: 'q9-1', redFlagItem9: true, conductedAt: '2026-10-12', ...over });

describe('2Q positive → open until the student submits 9Q', () => {
  it('open when positive and no 9Q yet', () => {
    expect(isOpenTwoQ(rec({ twoQ: twoQ() }))).toBe(true);
  });
  it('negative 2Q is never a task', () => {
    expect(isOpenTwoQ(rec({ twoQ: twoQ({ isPositive: false }) }))).toBe(false);
    expect(isOpenTwoQ(rec({}))).toBe(false);
  });
  it('closed once a 9Q was submitted on/after that 2Q', () => {
    expect(isOpenTwoQ(rec({ twoQ: twoQ(), nineSummary: nine({ redFlagItem9: false, conductedAt: '2026-10-10' }) }))).toBe(false);
    expect(isOpenTwoQ(rec({ twoQ: twoQ(), nineSummary: nine({ conductedAt: '2026-10-15' }) }))).toBe(false);
  });
  it('closed once the 9Q basis used this 2Q', () => {
    expect(isOpenTwoQ(rec({ twoQ: twoQ(), progress: { usedBasisIds: ['q2-1'] } }))).toBe(false);
  });
  it('a 9Q older than a newer positive 2Q does not close it', () => {
    expect(isOpenTwoQ(rec({ twoQ: twoQ({ conductedAt: '2026-10-20' }), nineSummary: nine({ conductedAt: '2026-10-12' }) }))).toBe(true);
  });
});

describe('9Q red flag → open until parent notified or student met', () => {
  it('open with a red flag and nothing handled', () => {
    expect(isOpenRedFlag(rec({ nineSummary: nine() }), new Set())).toBe(true);
  });
  it('no red flag = no task', () => {
    expect(isOpenRedFlag(rec({ nineSummary: nine({ redFlagItem9: false }) }), new Set())).toBe(false);
  });
  it('closed when this 9Q id is handled; a handled OLDER 9Q does not close a newer one', () => {
    expect(isOpenRedFlag(rec({ nineSummary: nine() }), new Set(['q9-1']))).toBe(false);
    expect(isOpenRedFlag(rec({ nineSummary: nine({ id: 'q9-2' }) }), new Set(['q9-1']))).toBe(true);
  });
});

describe('countScreeningTasks / redFlagStudentIds', () => {
  const records = new Map<string, ScreeningTaskRecord>([
    ['a', rec({ twoQ: twoQ() })],
    ['b', rec({ twoQ: twoQ({ id: 'q2-b' }), nineSummary: nine({ id: 'q9-b', redFlagItem9: false }) })],
    ['c', rec({ nineSummary: nine({ id: 'q9-c' }) })],
    ['d', rec({ nineSummary: nine({ id: 'q9-d' }) })],
  ]);
  it('counts open tasks and honors handled ids per student', () => {
    expect(countScreeningTasks(records, new Map([['d', new Set(['q9-d'])]]))).toEqual({ twoQ: 1, redFlag: 1 });
  });
  it('lists red-flag students (to know whom to look up handled logs for)', () => {
    expect(redFlagStudentIds(records).sort()).toEqual(['c', 'd']);
  });
});

describe('bell integration', () => {
  it('only guidance counselors and homeroom teachers get the screening source', () => {
    expect(staffTaskSources('GUIDANCE_COUNSELOR').screening).toBe(true);
    expect(staffTaskSources('HOMEROOM_TEACHER').screening).toBe(true);
    for (const r of ['SUBJECT_TEACHER', 'EXECUTIVE', 'SUPER_ADMIN', 'DEPUTY_DIRECTOR_ACADEMIC']) expect(staffTaskSources(r).screening).toBe(false);
  });
  it('builds count-only tasks, never for other roles', () => {
    const t = buildStaffTasks({ activeRole: 'GUIDANCE_COUNSELOR', roomLeaves: [], lateRequests: [], screening: { twoQ: 2, redFlag: 1 } });
    expect(t.map(x => [x.kind, x.count])).toEqual([['SCREENING_2Q', 2], ['SCREENING_RED_FLAG', 1]]);
    expect(buildStaffTasks({ activeRole: 'EXECUTIVE', roomLeaves: [], lateRequests: [], screening: { twoQ: 2, redFlag: 1 } })).toEqual([]);
    expect(buildStaffTasks({ activeRole: 'GUIDANCE_COUNSELOR', roomLeaves: [], lateRequests: [], screening: { twoQ: 0, redFlag: 0 } })).toEqual([]);
  });
  it('the hook only exposes counts (no names/results) and the panel logs "met" via the service', () => {
    const hook = readSource('src/hooks/useScreeningBellData.ts');
    expect(hook).toMatch(/Promise<\{ twoQ: number; redFlag: number \}>|\{ twoQ: number; redFlag: number \}/);
    const panel = readSource('src/components/shared/DepressionScreeningPanel.tsx');
    expect(panel).toMatch(/recordStudentMet\(/);
  });
});
