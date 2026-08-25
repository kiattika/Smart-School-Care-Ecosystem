import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  query, 
  where, 
  orderBy, 
  writeBatch,
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { SeatingLayout, SeatingGroup, SeatingSeat, SeatingAssignment } from '../types/seating';

const LAYOUTS_COL = 'seating_layouts';
const ASSIGNMENTS_COL = 'seating_assignments';

/**
 * Generate a unique ID
 */
export const generateUniqueId = (prefix = 'id'): string => {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
};

/**
 * Save a complete Seating Layout with its groups and seats to Firestore subcollections
 */
export async function saveSeatingLayoutToFirestore(
  layout: SeatingLayout,
  groups?: SeatingGroup[],
  assignments?: SeatingAssignment[]
): Promise<void> {
  try {
    const layoutRef = doc(db, LAYOUTS_COL, layout.id);
    const batch = writeBatch(db);

    const actualGroups = groups || layout.groups || [];
    const derivedCapacity = actualGroups.reduce((sum, g) => sum + (g.capacity || g.seats?.length || 0), 0);

    // 1. Top-level layout document
    const topLevelData = {
      id: layout.id,
      name: layout.name,
      subjectCode: layout.subjectCode,
      room: layout.room,
      teacherId: layout.teacherId || '',
      teacherEmail: layout.teacherEmail || '',
      teacherName: layout.teacherName || '',
      category: layout.category || 'CLASSROOM',
      isTemplate: !!layout.isTemplate,
      isLocked: !!layout.isLocked,
      totalCapacity: derivedCapacity,
      zoomScale: layout.zoomScale || 100,
      createdAt: layout.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    batch.set(layoutRef, topLevelData, { merge: true });

    // 2. Subcollection: groups and nested seats
    for (let gIdx = 0; gIdx < actualGroups.length; gIdx++) {
      const group = actualGroups[gIdx];
      const groupRef = doc(db, `${LAYOUTS_COL}/${layout.id}/groups`, group.id);
      batch.set(groupRef, {
        id: group.id,
        name: group.name,
        groupIndex: group.groupIndex ?? gIdx,
        capacity: group.capacity || group.seats?.length || 1,
        positionX: group.positionX ?? (gIdx * 280),
        positionY: group.positionY ?? 0,
        color: group.color || '#3b82f6',
        shape: group.shape || 'GRID'
      }, { merge: true });

      if (group.seats) {
        for (const seat of group.seats) {
          const seatRef = doc(db, `${LAYOUTS_COL}/${layout.id}/groups/${group.id}/seats`, seat.id);
          batch.set(seatRef, {
            id: seat.id,
            seatNumber: seat.seatNumber,
            relativeRow: seat.relativeRow ?? 0,
            relativeCol: seat.relativeCol ?? 0,
            label: seat.label || `${seat.seatNumber}`
          }, { merge: true });
        }
      }
    }

    // 3. If active assignments provided, write them
    if (assignments && assignments.length > 0) {
      for (const a of assignments) {
        const aRef = doc(db, ASSIGNMENTS_COL, a.id);
        batch.set(aRef, a, { merge: true });
      }
    }

    await batch.commit();
  } catch (error) {
    console.error('Error saving seating layout to Firestore:', error);
    throw error;
  }
}

export interface SeatingLayoutData {
  layout: SeatingLayout;
  groups: SeatingGroup[];
  assignments: SeatingAssignment[];
}

/**
 * Fetch a Seating Layout with its groups, seats, and active assignments from Firestore
 */
export async function getSeatingLayoutFromFirestore(layoutId: string): Promise<SeatingLayoutData | null> {
  try {
    const layoutRef = doc(db, LAYOUTS_COL, layoutId);
    const layoutSnap = await getDoc(layoutRef);

    if (!layoutSnap.exists()) {
      return null;
    }

    const layoutData = layoutSnap.data();

    // Fetch groups subcollection
    const groupsCol = collection(db, `${LAYOUTS_COL}/${layoutId}/groups`);
    const groupsSnap = await getDocs(groupsCol);

    const groups: SeatingGroup[] = [];

    for (const groupDoc of groupsSnap.docs) {
      const gData = groupDoc.data();
      const groupId = groupDoc.id;

      // Fetch seats subcollection
      const seatsCol = collection(db, `${LAYOUTS_COL}/${layoutId}/groups/${groupId}/seats`);
      const seatsSnap = await getDocs(seatsCol);

      const seats: SeatingSeat[] = seatsSnap.docs.map(sDoc => {
        const sData = sDoc.data();
        return {
          id: sDoc.id,
          seatNumber: sData.seatNumber ?? 1,
          relativeRow: sData.relativeRow ?? 0,
          relativeCol: sData.relativeCol ?? 0,
          label: sData.label || `${sData.seatNumber ?? 1}`
        };
      }).sort((a, b) => a.seatNumber - b.seatNumber);

      groups.push({
        id: groupId,
        name: gData.name || `กลุ่ม ${gData.groupIndex + 1}`,
        groupIndex: gData.groupIndex ?? 0,
        capacity: gData.capacity || seats.length,
        positionX: gData.positionX ?? 0,
        positionY: gData.positionY ?? 0,
        color: gData.color || '#3b82f6',
        shape: gData.shape || 'GRID',
        seats
      });
    }

    groups.sort((a, b) => a.groupIndex - b.groupIndex);

    // Fetch assignments for this layout
    const assignments = await getActiveAssignmentsFromFirestore(layoutId);

    const layout: SeatingLayout = {
      id: layoutSnap.id,
      name: layoutData.name || '',
      subjectCode: layoutData.subjectCode || '',
      room: layoutData.room || '',
      teacherId: layoutData.teacherId || '',
      teacherEmail: layoutData.teacherEmail || '',
      teacherName: layoutData.teacherName || '',
      category: layoutData.category || 'CLASSROOM',
      isTemplate: !!layoutData.isTemplate,
      isLocked: !!layoutData.isLocked,
      totalCapacity: layoutData.totalCapacity || groups.reduce((sum, g) => sum + g.capacity, 0),
      zoomScale: layoutData.zoomScale || 100,
      createdAt: layoutData.createdAt || new Date().toISOString(),
      updatedAt: layoutData.updatedAt || new Date().toISOString(),
      groups
    };

    return {
      layout,
      groups,
      assignments
    };
  } catch (error) {
    console.error(`Error fetching seating layout '${layoutId}':`, error);
    return null;
  }
}

/**
 * Fetch all available layout templates across the school
 */
export async function getTemplateLayoutsFromFirestore(): Promise<SeatingLayout[]> {
  try {
    const q = query(collection(db, LAYOUTS_COL), where('isTemplate', '==', true));
    const snap = await getDocs(q);
    const templates: SeatingLayout[] = [];

    for (const d of snap.docs) {
      const data = await getSeatingLayoutFromFirestore(d.id);
      if (data) {
        templates.push(data.layout);
      }
    }
    return templates;
  } catch (error) {
    console.warn('Error fetching layout templates:', error);
    return [];
  }
}

export const getSharedLayoutTemplatesFromFirestore = getTemplateLayoutsFromFirestore;

/**
 * Clone layout template groups and seats without copying assignments
 */
export async function cloneLayoutTemplateInFirestore(templateId: string, targetLayoutId: string): Promise<SeatingGroup[]> {
  const templateData = await getSeatingLayoutFromFirestore(templateId);
  if (!templateData || !templateData.groups) {
    return [];
  }

  const newGroups: SeatingGroup[] = templateData.groups.map((group, gIdx) => {
    const newGroupId = `group_${Date.now()}_${gIdx + 1}`;
    const newSeats: SeatingSeat[] = group.seats.map((seat, sIdx) => ({
      id: `seat_${newGroupId}_${sIdx + 1}`,
      seatNumber: seat.seatNumber ?? (sIdx + 1),
      relativeRow: seat.relativeRow ?? 0,
      relativeCol: seat.relativeCol ?? 0,
      label: seat.label || `${seat.seatNumber ?? (sIdx + 1)}`
    }));

    return {
      id: newGroupId,
      name: group.name,
      groupIndex: gIdx,
      capacity: group.capacity,
      positionX: group.positionX,
      positionY: group.positionY,
      color: group.color,
      shape: group.shape,
      seats: newSeats
    };
  });

  return newGroups;
}

/**
 * Fetch all ACTIVE assignments for a specific layout
 */
export async function getActiveAssignmentsFromFirestore(layoutId: string): Promise<SeatingAssignment[]> {
  try {
    const q = query(
      collection(db, ASSIGNMENTS_COL),
      where('layoutId', '==', layoutId),
      where('effectiveTo', '==', null)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as SeatingAssignment));
  } catch (error) {
    console.warn(`Error fetching active assignments for layout '${layoutId}':`, error);
    return [];
  }
}

/**
 * Assign a student to a seat in Firestore with history closing
 */
export async function assignStudentToSeatInFirestore(assignment: SeatingAssignment): Promise<void> {
  const now = new Date().toISOString();
  const batch = writeBatch(db);

  try {
    // 1. Close active assignment on that seat
    const active = await getActiveAssignmentsFromFirestore(assignment.layoutId);
    const existing = active.find(a => a.seatId === assignment.seatId || a.studentId === assignment.studentId);
    if (existing) {
      const prevRef = doc(db, ASSIGNMENTS_COL, existing.id);
      batch.update(prevRef, { effectiveTo: now });
    }

    // 2. Set new assignment
    const newRef = doc(db, ASSIGNMENTS_COL, assignment.id);
    batch.set(newRef, assignment, { merge: true });

    await batch.commit();
  } catch (error) {
    console.error('Error assigning student to seat in Firestore:', error);
    throw error;
  }
}

/**
 * Unassign seat in Firestore
 */
export async function unassignSeatInFirestore(layoutId: string, seatId: string, studentId: string): Promise<void> {
  const now = new Date().toISOString();
  try {
    const q = query(
      collection(db, ASSIGNMENTS_COL),
      where('layoutId', '==', layoutId),
      where('seatId', '==', seatId),
      where('studentId', '==', studentId),
      where('effectiveTo', '==', null)
    );
    const snap = await getDocs(q);
    const batch = writeBatch(db);

    snap.docs.forEach(d => {
      batch.update(d.ref, { effectiveTo: now });
    });

    await batch.commit();
  } catch (error) {
    console.error('Error unassigning seat in Firestore:', error);
    throw error;
  }
}

/**
 * Swap seats in Firestore
 */
export async function swapStudentSeatsInFirestore(layoutId: string, seatAId: string, seatBId: string): Promise<void> {
  const active = await getActiveAssignmentsFromFirestore(layoutId);
  const assignA = active.find(a => a.seatId === seatAId);
  const assignB = active.find(a => a.seatId === seatBId);

  const now = new Date().toISOString();
  const batch = writeBatch(db);

  if (assignA) {
    batch.update(doc(db, ASSIGNMENTS_COL, assignA.id), { effectiveTo: now });
    const newA: SeatingAssignment = {
      ...assignA,
      id: `assign_${layoutId}_${seatBId}_${assignA.studentId}_${Date.now()}`,
      seatId: seatBId,
      effectiveFrom: now,
      effectiveTo: null
    };
    batch.set(doc(db, ASSIGNMENTS_COL, newA.id), newA);
  }

  if (assignB) {
    batch.update(doc(db, ASSIGNMENTS_COL, assignB.id), { effectiveTo: now });
    const newB: SeatingAssignment = {
      ...assignB,
      id: `assign_${layoutId}_${seatAId}_${assignB.studentId}_${Date.now() + 1}`,
      seatId: seatAId,
      effectiveFrom: now,
      effectiveTo: null
    };
    batch.set(doc(db, ASSIGNMENTS_COL, newB.id), newB);
  }

  await batch.commit();
}

/**
 * Fetch complete history for a specific seat
 */
export async function getSeatHistoryFromFirestore(layoutId: string, seatId: string): Promise<SeatingAssignment[]> {
  try {
    const q = query(
      collection(db, ASSIGNMENTS_COL),
      where('layoutId', '==', layoutId),
      where('seatId', '==', seatId)
    );
    const snap = await getDocs(q);
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as SeatingAssignment));
    return list.sort((a, b) => new Date(b.effectiveFrom).getTime() - new Date(a.effectiveFrom).getTime());
  } catch (error) {
    console.warn(`Error fetching history for seat '${seatId}':`, error);
    return [];
  }
}

/**
 * Fetch complete seating history for a specific student
 */
export async function getStudentSeatingHistory(studentId: string): Promise<SeatingAssignment[]> {
  try {
    const q = query(
      collection(db, ASSIGNMENTS_COL),
      where('studentId', '==', studentId)
    );
    const snap = await getDocs(q);
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as SeatingAssignment));
    return list.sort((a, b) => new Date(b.effectiveFrom).getTime() - new Date(a.effectiveFrom).getTime());
  } catch (error) {
    console.warn(`Error fetching seating history for student '${studentId}':`, error);
    return [];
  }
}
