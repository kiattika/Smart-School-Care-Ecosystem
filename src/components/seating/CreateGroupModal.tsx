import React, { useState } from 'react';
import { Plus, Users, X, Layers, Grid } from 'lucide-react';

interface CreateGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateGroup: (name: string, capacity: number, description?: string) => void;
  nextGroupNumber: number;
}

export const CreateGroupModal: React.FC<CreateGroupModalProps> = ({
  isOpen,
  onClose,
  onCreateGroup,
  nextGroupNumber
}) => {
  const [groupName, setGroupName] = useState<string>(`กลุ่มที่ ${nextGroupNumber}`);
  const [capacity, setCapacity] = useState<number>(6);
  const [description, setDescription] = useState<string>('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName.trim()) return;
    onCreateGroup(groupName.trim(), capacity, description.trim());
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in">
      <div className="bg-[#121620] border border-slate-700/80 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-[#0b0e14]">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 rounded-xl text-emerald-400 border border-emerald-500/20">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">เพิ่มกลุ่มโต๊ะใหม่ (Add Seating Group)</h3>
              <p className="text-xs text-slate-400">สร้างกลุ่มหรือแถวโต๊ะอิสระในห้องเรียน</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">
              ชื่อกลุ่มโต๊ะ / โซน <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={groupName}
              onChange={e => setGroupName(e.target.value)}
              placeholder="เช่น กลุ่มที่ 1, แถวริมหน้าต่าง, โต๊ะทดลอง A"
              className="w-full bg-[#181c28] border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:border-emerald-500 outline-none"
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="block text-xs font-bold text-slate-300">
                จำนวนที่นั่งเริ่มต้น (Capacity)
              </label>
              <span className="text-xs font-mono font-bold text-emerald-400">
                {capacity} ที่นั่ง
              </span>
            </div>
            <div className="grid grid-cols-6 gap-2 mb-2">
              {[2, 4, 5, 6, 8, 10].map(val => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setCapacity(val)}
                  className={`py-2 text-xs font-bold rounded-lg border transition-all ${
                    capacity === val
                      ? 'bg-emerald-600 text-white border-emerald-500'
                      : 'bg-[#181c28] text-slate-300 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {val}
                </button>
              ))}
            </div>
            <input
              type="range"
              min="1"
              max="16"
              value={capacity}
              onChange={e => setCapacity(parseInt(e.target.value) || 1)}
              className="w-full accent-emerald-500 cursor-pointer"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">
              คำอธิบายเพิ่มเติม / ตำแหน่ง (Optional)
            </label>
            <input
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="เช่น โซนหน้าห้อง, โต๊ะหน้ากระดาน"
              className="w-full bg-[#181c28] border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:border-emerald-500 outline-none"
            />
          </div>

          <div className="flex gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-all"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-600/20"
            >
              <Plus className="w-4 h-4" /> สร้างกลุ่มโต๊ะ
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
