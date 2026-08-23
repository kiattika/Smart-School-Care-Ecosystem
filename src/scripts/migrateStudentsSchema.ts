import { collection, getDocs, writeBatch, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';

/**
 * Normalizes student documents in Firestore to enforce canonical schema:
 * - `className`: normalized string (e.g. 'ม.5/8')
 * - `studentNumber`: numeric index for clean ascending sorting
 * - `studentId`: unique student ID string
 */
export async function migrateStudentsSchema(): Promise<{
  total: number;
  migrated: number;
  unmatched: string[];
}> {
  const studentsCol = collection(db, 'students');
  const snapshot = await getDocs(studentsCol);
  const batch = writeBatch(db);
  let migratedCount = 0;
  const unmatched: string[] = [];

  snapshot.docs.forEach((docSnap) => {
    const data = docSnap.data();
    const studentId = data.studentId || docSnap.id;
    
    // Normalize room/className
    let rawClass = data.className || data.room || '';
    let normalizedClass = rawClass.trim();
    if (normalizedClass.startsWith('M.') || normalizedClass.startsWith('m.')) {
      normalizedClass = normalizedClass.replace(/^M\./i, 'ม.');
    }

    const studentNumber = Number(data.studentNumber ?? data.studentNo ?? data.number ?? 0);

    if (!normalizedClass) {
      unmatched.push(`Student ID ${studentId} (${data.fullName || 'Unknown'}) has no valid class or room!`);
      return;
    }

    const docRef = doc(db, 'students', docSnap.id);
    batch.update(docRef, {
      className: normalizedClass,
      room: normalizedClass, // backward compatibility
      studentNumber: studentNumber,
      studentNo: studentNumber,
      studentId: studentId,
      updatedAt: new Date().toISOString()
    });
    migratedCount++;
  });

  if (migratedCount > 0) {
    await batch.commit();
  }

  console.log(`[Migration] Completed: ${migratedCount}/${snapshot.size} student records normalized.`);
  if (unmatched.length > 0) {
    console.warn('[Migration Warning] Unmatched records:', unmatched);
  }

  return {
    total: snapshot.size,
    migrated: migratedCount,
    unmatched
  };
}
