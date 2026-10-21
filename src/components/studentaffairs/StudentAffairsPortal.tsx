import React, { useState } from 'react';
import { AlertTriangle, ClipboardCheck, FilePen, Home, UserCheck, UserX } from 'lucide-react';
import { AbsenceAlertsPanel } from '../absence/AbsenceAlertsPanel';
import { PortalSidebarLayout } from '../shared/PortalSidebarLayout';
import { useRealStudents } from '../../hooks/useRealStudents';
import { ConductChangesPanel, ConductReviewPanel } from './ConductReviewPanel';
import { StudentConductPanel } from './StudentConductPanel';
import { useConsumeBellNav } from '../../lib/bellNavigation';
import { AbsentTodayPanel, HomeVisitOversightPanel } from './OversightPanels';

type Tab = 'review' | 'changes' | 'student' | 'homevisit' | 'absent' | 'streak';

/** งานกิจการนักเรียน: คะแนนความประพฤติ (พิจารณา/คำร้องแก้ลบ/รายบุคคล) + กำกับเยี่ยมบ้าน + นักเรียนที่ยังไม่เข้าโรงเรียน */
export function StudentAffairsPortal() {
  const { students } = useRealStudents();
  const [tab, setTab] = useState<Tab>('review');
  useConsumeBellNav('STUDENT_AFFAIRS', ['review', 'changes', 'streak'], (t) => setTab(t as Tab));
  const nameOf = (id: string) => students.find(s => s.studentId === id)?.name || id;
  return (
    <PortalSidebarLayout
      title="งานกิจการนักเรียน"
      activeId={tab}
      onSelect={id => setTab(id as Tab)}
      items={[
        { id: 'review', label: 'เรื่องรอพิจารณา', icon: ClipboardCheck },
        { id: 'changes', label: 'คำร้องแก้/ยกเลิกคะแนน', icon: FilePen },
        { id: 'student', label: 'คะแนนรายบุคคล', icon: UserCheck },
        { id: 'homevisit', label: 'กำกับเยี่ยมบ้าน', icon: Home },
        { id: 'absent', label: 'ยังไม่เข้าโรงเรียนวันนี้', icon: UserX },
        { id: 'streak', label: 'ขาดเรียนต่อเนื่อง', icon: AlertTriangle },
      ]}
    >
      <div className="p-4 sm:p-6 max-w-4xl space-y-4">
        <h2 className="text-lg font-bold text-slate-100">งานกิจการนักเรียน</h2>
        {tab === 'review' && <ConductReviewPanel />}
        {tab === 'changes' && <ConductChangesPanel nameOf={nameOf} />}
        {tab === 'student' && <StudentConductPanel students={students} />}
        {tab === 'homevisit' && <HomeVisitOversightPanel students={students} />}
        {tab === 'absent' && <AbsentTodayPanel students={students} />}
        {tab === 'streak' && <AbsenceAlertsPanel scope={{ kind: 'MIN_LEVEL', minLevel: 2 }} students={students} canEditThresholds />}
      </div>
    </PortalSidebarLayout>
  );
}
