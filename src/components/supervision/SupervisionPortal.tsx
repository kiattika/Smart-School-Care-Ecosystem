import React, { useState } from 'react';
import { BookOpen } from 'lucide-react';
import { PortalSidebarLayout } from '../shared/PortalSidebarLayout';
import { SupervisionWorkspace, useSupervisionTabs, type Tab } from './SupervisionWorkspace';
import { useConsumeBellNav } from '../../lib/bellNavigation';
import { useStore } from '../../store';

/**
 * งานนิเทศการสอน — หน้าของหัวหน้างานนิเทศ (INSTRUCTIONAL_SUPERVISOR) และครูนิเทศ (SUPERVISORY_TEACHER)
 * ข้อมูลทั้งหมดมาจาก Firestore จริงผ่าน SupervisionWorkspace (ไม่มีข้อมูลตัวอย่าง) — ดู src/lib/supervision.ts
 */
export function SupervisionPortal() {
  const tabs = useSupervisionTabs();
  const [pick, setPick] = useState<Tab | ''>('');
  const tab = (tabs.find(t => t.id === pick)?.id || tabs[0]?.id || '') as Tab | '';
  // กระดิ่ง "มีแผนรอตรวจ" พาหัวหน้างานนิเทศมาที่แท็บตรวจแผนการสอน
  const activeRole = useStore(s => s.user?.activeRole) || '';
  useConsumeBellNav(activeRole, ['plans'], (t) => setPick(t as Tab));
  return (
    <div className="flex-1 min-h-0 bg-slate-950 text-slate-100 flex flex-col overflow-hidden">
      <div className="bg-gradient-to-r from-cyan-950/60 via-slate-900 to-slate-900 border-b border-cyan-500/20 px-6 py-6">
        <div className="max-w-7xl mx-auto flex items-center gap-3">
          <div className="p-3 bg-cyan-500/20 border border-cyan-500/30 rounded-2xl text-cyan-400 shadow-lg">
            <BookOpen className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">งานนิเทศการสอน</h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-0.5">สังเกตการสอน บันทึกผลพร้อมภาพถ่าย และติดตามผลรายภาคเรียน</p>
          </div>
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="max-w-7xl w-full mx-auto px-6 py-6">
          {tabs.length === 0 ? (
            <p className="text-sm text-slate-400">บทบาทปัจจุบันไม่มีเมนูในระบบนิเทศ</p>
          ) : (
            <PortalSidebarLayout title="งานนิเทศ" items={tabs} activeId={tab} onSelect={(id) => setPick(id as Tab)}>
              {tab && <SupervisionWorkspace tab={tab} />}
            </PortalSidebarLayout>
          )}
        </div>
      </div>
    </div>
  );
}
