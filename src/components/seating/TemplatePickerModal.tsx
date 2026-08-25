import React, { useState, useEffect } from 'react';
import { Copy, Layout, Sparkles, X, Check, Search, Users, Grid } from 'lucide-react';
import { SeatingLayout } from '../../types/seating';
import { getSharedLayoutTemplatesFromFirestore } from '../../services/seatingService';

interface TemplatePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTemplate: (templateLayoutId: string, templateData?: Partial<SeatingLayout>) => void;
}

export const TemplatePickerModal: React.FC<TemplatePickerModalProps> = ({
  isOpen,
  onClose,
  onSelectTemplate
}) => {
  const [remoteTemplates, setRemoteTemplates] = useState<SeatingLayout[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');

  useEffect(() => {
    if (!isOpen) return;

    const loadTemplates = async () => {
      setLoading(true);
      try {
        const templates = await getSharedLayoutTemplatesFromFirestore();
        setRemoteTemplates(templates);
      } catch (err) {
        console.warn('Could not load remote templates:', err);
      } finally {
        setLoading(false);
      }
    };

    loadTemplates();
  }, [isOpen]);

  if (!isOpen) return null;

  const defaultPresets = [
    {
      id: 'preset_standard_40',
      name: 'แถวคู่มาตรฐาน (4 แถวคู่ 40 ที่นั่ง)',
      category: 'CLASSROOM',
      totalCapacity: 40,
      description: 'จัดโต๊ะ 4 คู่แถวยาว (แถวละ 10 คน) เหมาะสำหรับห้องเรียนทั่วไป ม.4 - ม.6',
      groupsCount: 4
    },
    {
      id: 'preset_lab_pods_36',
      name: 'โต๊ะแล็บทดลอง (6 กลุ่ม x 6 ที่นั่ง = 36 คน)',
      category: 'LAB',
      totalCapacity: 36,
      description: 'แบ่ง 6 กลุ่ม โต๊ะสี่เหลี่ยมหันหน้าเข้าหากัน สำหรับคาบแล็บวิทย์ ฟิสิกส์ เคมี ชีวะ',
      groupsCount: 6
    },
    {
      id: 'preset_large_groups_40',
      name: 'กลุ่มแล็บใหญ่ (8 กลุ่ม x 5 ที่นั่ง = 40 คน)',
      category: 'ACTIVE_LEARNING',
      totalCapacity: 40,
      description: 'แบ่ง 8 กลุ่มย่อย สำหรับกิจกรรม Active Learning และการทำงานโครงงาน',
      groupsCount: 8
    },
    {
      id: 'preset_u_shape_32',
      name: 'จัดโต๊ะรูปตัว U / เกือกม้า (32 ที่นั่ง)',
      category: 'SEMINAR',
      totalCapacity: 32,
      description: 'จัดโต๊ะล้อมรอบเวทีกลาง สำหรับการนำเสนอ สัมมนา และอภิปราย',
      groupsCount: 3
    },
    {
      id: 'preset_exam_grid_40',
      name: 'โต๊ะสอบแถวเดี่ยวแยกอิสระ (5 แถว x 8 ที่นั่ง = 40 คน)',
      category: 'EXAM',
      totalCapacity: 40,
      description: 'แถวเดี่ยวระยะห่างมาตรฐาน สำหรับการสอบกลางภาค / ปลายภาค ป้องกันการทุจริต',
      groupsCount: 5
    }
  ];

  const filteredRemote = remoteTemplates.filter(t => 
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.room?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.subjectCode?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in">
      <div className="bg-[#121620] border border-slate-700/80 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-[#0b0e14]">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 rounded-xl text-emerald-400 border border-emerald-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                เลือกผังแม่แบบห้องเรียน (Layout Templates)
              </h3>
              <p className="text-xs text-slate-400">
                คัดลอกโครงสร้างกลุ่มและที่นั่งจากแม่แบบ โดยไม่นำเข้านักเรียนเดิม
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-slate-800 bg-[#0e111a]">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="ค้นหาแม่แบบห้องเรียน, รหัสวิชา, หรือประเภทห้อง..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-[#181c28] border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:border-emerald-500 outline-none"
            />
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Default Presets */}
          <div>
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Grid className="w-3.5 h-3.5 text-emerald-400" />
              แม่แบบมาตรฐานยอดนิยม (Standard Presets)
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {defaultPresets.map(preset => (
                <div
                  key={preset.id}
                  className="bg-[#181c28] border border-slate-800 hover:border-emerald-500/50 p-4 rounded-xl transition-all cursor-pointer group flex flex-col justify-between"
                  onClick={() => {
                    onSelectTemplate(preset.id, preset);
                    onClose();
                  }}
                >
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-bold text-white group-hover:text-emerald-300 transition-colors">
                        {preset.name}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-emerald-400 font-mono">
                        {preset.totalCapacity} ที่นั่ง
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed mb-3">
                      {preset.description}
                    </p>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-[10px] text-slate-500">
                    <span>{preset.groupsCount} กลุ่มย่อย</span>
                    <span className="text-emerald-400 font-bold group-hover:underline flex items-center gap-1">
                      <Copy className="w-3 h-3" /> ใช้ผังนี้
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Shared Cloud Templates */}
          {filteredRemote.length > 0 && (
            <div>
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Users className="w-3.5 h-3.5 text-indigo-400" />
                ผังแม่แบบที่แชร์โดยครูในโรงเรียน (Shared by Teachers)
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {filteredRemote.map(template => (
                  <div
                    key={template.id}
                    className="bg-[#181c28] border border-slate-800 hover:border-indigo-500/50 p-4 rounded-xl transition-all cursor-pointer group flex flex-col justify-between"
                    onClick={() => {
                      onSelectTemplate(template.id);
                      onClose();
                    }}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-bold text-white group-hover:text-indigo-300 transition-colors truncate">
                          {template.name}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/10 text-indigo-300 font-mono border border-indigo-500/20">
                          {template.totalCapacity} ที่นั่ง
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-relaxed mb-3">
                        ห้อง: {template.room} • รหัสวิชา: {template.subjectCode || 'ทั่วไป'}
                      </p>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-[10px] text-slate-500">
                      <span>สร้างโดย: {template.teacherEmail || 'คุณครู'}</span>
                      <span className="text-indigo-400 font-bold group-hover:underline flex items-center gap-1">
                        <Copy className="w-3 h-3" /> คัดลอกผังนี้
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-[#0b0e14] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition-all"
          >
            ยกเลิก
          </button>
        </div>
      </div>
    </div>
  );
};
