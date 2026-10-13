import { describe, it, expect } from 'vitest';
import { readSource } from './helpers/readSource';

describe('guard: คะแนนพฤติกรรม/Active Learning รอผลเขียนจริง', () => {
  const store = readSource('src/store.ts');
  it('adjustBehaviorScore / addActiveLearningPoints เป็น async และไม่กลืน error', () => {
    const adj = store.slice(store.indexOf('adjustBehaviorScore: async'), store.indexOf('adjustBehaviorScore: async') + 500);
    expect(adj).toMatch(/await updateBehaviorScoreAndTriggerAlert/);
    expect(adj).not.toMatch(/\.catch\(/);
    expect(store).toMatch(/addActiveLearningPoints: async/);
    expect(store).toMatch(/await saveActiveLearningLogFirestore\(newLog\)/);
    expect(store).not.toMatch(/saveActiveLearningLogFirestore\(newLog\)\.catch/);
  });
  it('saveActiveLearningLogFirestore throw ผ่าน handleFirestoreError', () => {
    const fs = readSource('src/services/firestoreService.ts');
    const i = fs.indexOf('export async function saveActiveLearningLogFirestore');
    const body = fs.slice(i, fs.indexOf('\n}\n', i));
    expect(body).toMatch(/handleFirestoreError/);
    expect(body).not.toMatch(/console\.warn/);
  });
  it('ผู้เรียกรอผลและแจ้งข้อผิดพลาด ไม่ปิด/ไม่แสดงสำเร็จก่อน', () => {
    const tp = readSource('src/TeacherPortal.tsx');
    expect(tp).toMatch(/await adjustBehaviorScore\(/);
    expect(tp).not.toMatch(/\n\s+adjustBehaviorScore\(selectedStudentForScore/);
    const rp = readSource('src/components/RandomStudentPickerModal.tsx');
    expect(rp).toMatch(/await addActiveLearningPoints\(/);
    expect(rp).toMatch(/Promise\.allSettled/);
    const cs = readSource('src/components/ClassroomSeatingManager.tsx');
    expect(cs).toMatch(/await addActiveLearningPoints\(student\.studentId, 1,/);
  });
});
