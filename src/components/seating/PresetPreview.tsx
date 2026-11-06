import React from 'react';
import type { SeatingPresetPreviewGroup } from '../../lib/seatingPresets';

/** ภาพย่อผังแม่แบบ: ที่นั่ง = สี่เหลี่ยมเล็ก จัดเป็นกลุ่มตามจริง (กระดานอยู่ด้านบน) */
export function PresetPreview({ groups }: { groups: SeatingPresetPreviewGroup[] }) {
  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-lg px-2 py-2 mb-3" aria-hidden="true">
      <div className="h-1 rounded bg-slate-700/70 mb-2 mx-auto w-3/4" />
      <div className="flex justify-center items-start gap-2.5 flex-wrap">
        {groups.map((g, gi) => (
          <div
            key={gi}
            className="grid gap-[3px]"
            style={{ gridTemplateColumns: `repeat(${g.cols}, 0.55rem)` }}
          >
            {Array.from({ length: g.count }, (_, si) => (
              <span key={si} className="block w-[0.55rem] h-[0.45rem] rounded-[2px] border border-emerald-500/70 bg-emerald-500/10" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
