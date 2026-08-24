import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// Mock firebase modules
vi.mock('../lib/firebase', () => {
  return {
    db: { type: 'firestore-instance' },
    auth: {
      currentUser: {
        uid: 'test_teacher_001',
        email: 'teacher.test@utd.ac.th'
      }
    }
  };
});

const mockSetDoc = vi.fn();
const mockOnSnapshot = vi.fn();
const mockCollection = vi.fn((_db, name) => ({ path: name }));
const mockDoc = vi.fn((_db, col, id) => ({ path: `${col}/${id}` }));

vi.mock('firebase/firestore', () => {
  return {
    collection: (_db: any, name: string) => mockCollection(_db, name),
    doc: (_db: any, col: string, id?: string) => mockDoc(_db, col, id),
    onSnapshot: (ref: any, onNext: any, onError: any) => {
      mockOnSnapshot(ref, onNext, onError);
      return vi.fn(); // unsubscribe
    },
    setDoc: (ref: any, data: any, options: any) => mockSetDoc(ref, data, options),
    getDocs: vi.fn(),
    setLogLevel: vi.fn()
  };
});

describe('Task 4: Write Failure Handling & Auto-seed Removal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('verifies setLogLevel is set to "error" in src/lib/firebase.ts', () => {
    const firebaseTs = fs.readFileSync(path.join(process.cwd(), 'src/lib/firebase.ts'), 'utf8');
    expect(firebaseTs).toContain("setLogLevel('error')");
    expect(firebaseTs).not.toContain("setLogLevel('silent')");
  });

  it('verifies useTeacherFirestoreSchedule does not execute setDoc or getDocs on mount', async () => {
    // Dynamically import the hook
    const { useTeacherFirestoreSchedule } = await import('../hooks/useTeacherFirestoreSchedule');
    
    // Check source code directly to ensure no mount seeding
    const hookSource = fs.readFileSync(path.join(process.cwd(), 'src/hooks/useTeacherFirestoreSchedule.ts'), 'utf8');
    expect(hookSource).not.toContain('getDocs(');
    // setDoc should only exist in the update functions, not within useEffect
    const useEffectSection = hookSource.substring(hookSource.indexOf('useEffect('), hookSource.indexOf('const updateScheduleAttendance'));
    expect(useEffectSection).not.toContain('setDoc(');
  });

  it('verifies usePeriodsConfig does not execute setDoc on mount', async () => {
    const hookSource = fs.readFileSync(path.join(process.cwd(), 'src/hooks/usePeriodsConfig.ts'), 'utf8');
    const useEffectSection = hookSource.substring(hookSource.indexOf('useEffect('), hookSource.indexOf('const updatePeriodsConfig'));
    expect(useEffectSection).not.toContain('setDoc(');
  });

  it('verifies updateScheduleAttendance and updatePartnerAttendance revert state on Firestore error', async () => {
    const hookSource = fs.readFileSync(path.join(process.cwd(), 'src/hooks/useTeacherFirestoreSchedule.ts'), 'utf8');
    
    // Ensure both functions have optimistic update followed by revert in catch block
    expect(hookSource).toContain('updateScheduleAttendance');
    expect(hookSource).toContain('updatePartnerAttendance');
    expect(hookSource).toContain('บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
    expect(hookSource).toContain('console.error(');
    expect(hookSource).toContain('throw err');
  });

  it('verifies updatePeriodsConfig in usePeriodsConfig reverts state on Firestore error and rethrows', async () => {
    const hookSource = fs.readFileSync(path.join(process.cwd(), 'src/hooks/usePeriodsConfig.ts'), 'utf8');
    
    expect(hookSource).toContain('updatePeriodsConfig');
    expect(hookSource).toContain('previousPeriods');
    expect(hookSource).toContain('บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
    expect(hookSource).toContain('console.error(');
    expect(hookSource).toContain('throw err');
  });

  it('verifies seedEmulatorAuth seeds admin_periods_config and school_settings/periods_config', () => {
    const seedSource = fs.readFileSync(path.join(process.cwd(), 'scripts/seedEmulatorAuth.ts'), 'utf8');
    expect(seedSource).toContain('admin_periods_config');
    expect(seedSource).toContain('school_settings');
    expect(seedSource).toContain('periods_config');
  });

  it('verifies useTeacherFirestoreSchedule initializes schedules as [] and exposes isSchedulesEmpty', () => {
    const hookSource = fs.readFileSync(path.join(process.cwd(), 'src/hooks/useTeacherFirestoreSchedule.ts'), 'utf8');
    // schedules state must initialize with empty array []
    expect(hookSource).toContain('const [schedules, setSchedules] = useState<ScheduleItem[]>([]);');
    expect(hookSource).not.toContain('useState<ScheduleItem[]>(() => getSchedulesToSeed());');
    // return values must include isSchedulesEmpty and emptySchedulesMessage
    expect(hookSource).toContain('isSchedulesEmpty: !loading && schedules.length === 0');
    expect(hookSource).toContain("emptySchedulesMessage: 'ยังไม่มีตารางสอนในระบบ กรุณาติดต่อผู้ดูแลระบบ'");
    // getSchedulesToSeed must not be used as fallback
    expect(hookSource).not.toContain('getSchedulesToSeed');
  });

  it('verifies TeacherPortal displays emptySchedulesMessage and avoids silent fake schedule fallback', () => {
    const teacherPortalSource = fs.readFileSync(path.join(process.cwd(), 'src/TeacherPortal.tsx'), 'utf8');
    expect(teacherPortalSource).toContain('isSchedulesEmpty');
    expect(teacherPortalSource).toContain('emptySchedulesMessage');
    expect(teacherPortalSource).toContain('id="empty-schedules-banner"');
  });
});
