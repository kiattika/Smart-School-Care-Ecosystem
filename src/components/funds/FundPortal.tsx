import React, { useState } from 'react';
import { Award, Landmark } from 'lucide-react';
import { PortalSidebarLayout } from '../shared/PortalSidebarLayout';
import { FundProgramsManager } from './FundProgramsManager';
import type { FundKind } from '../../lib/fundPrograms';

/** งานกองทุนและทุนการศึกษา: ทุนการศึกษา + กองทุนกู้ยืมเพื่อการศึกษา (กยศ.) */
export function FundPortal() {
  const [tab, setTab] = useState<FundKind>('SCHOLARSHIP');
  return (
    <PortalSidebarLayout
      title="งานกองทุนและทุนการศึกษา"
      activeId={tab}
      onSelect={id => setTab(id as FundKind)}
      items={[
        { id: 'SCHOLARSHIP', label: 'ทุนการศึกษา', icon: Award },
        { id: 'STUDENT_LOAN', label: 'กองทุนกู้ยืม (กยศ.)', icon: Landmark },
      ]}
    >
      <div className="p-4 sm:p-6 max-w-4xl space-y-4">
        <h2 className="text-lg font-bold text-slate-100">งานกองทุนและทุนการศึกษา</h2>
        <FundProgramsManager kind={tab} />
      </div>
    </PortalSidebarLayout>
  );
}
