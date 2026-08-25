import React, { useState, useEffect } from 'react';
import { History, Clock, User, X, Calendar, ShieldAlert } from 'lucide-react';
import { SeatingAssignment, SeatingSeat, SeatingGroup } from '../../types/seating';
import { getSeatHistoryFromFirestore, getStudentSeatingHistory } from '../../services/seatingService';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';

interface SeatHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  layoutId: string;
  selectedSeat?: {
    seat: SeatingSeat;
    group: SeatingGroup;
  } | null;
  selectedStudentId?: string | null;
  studentName?: string;
  allLocalAssignments?: SeatingAssignment[];
}

export const SeatHistoryModal: React.FC<SeatHistoryModalProps> = ({
  isOpen,
  onClose,
  layoutId,
  selectedSeat,
  selectedStudentId,
  studentName,
  allLocalAssignments = []
}) => {
  const [history, setHistory] = useState<SeatingAssignment[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!isOpen) return;

    const fetchHistory = async () => {
      setLoading(true);
      try {
        if (selectedSeat) {
          const remoteHistory = await getSeatHistoryFromFirestore(layoutId, selectedSeat.seat.id);
          if (remoteHistory.length > 0) {
            setHistory(remoteHistory);
          } else {
            // Fallback to local memory / state assignments
            const filtered = allLocalAssignments.filter(
              a => a.layoutId === layoutId && a.seatId === selectedSeat.seat.id
            ).sort((a, b) => new Date(b.effectiveFrom).getTime() - new Date(a.effectiveFrom).getTime());
            setHistory(filtered);
          }
        } else if (selectedStudentId) {
          const remoteHistory = await getStudentSeatingHistory(selectedStudentId);
          if (remoteHistory.length > 0) {
            setHistory(remoteHistory);
          } else {
            const filtered = allLocalAssignments.filter(
              a => a.studentId === selectedStudentId
            ).sort((a, b) => new Date(b.effectiveFrom).getTime() - new Date(a.effectiveFrom).getTime());
            setHistory(filtered);
          }
        }
      } catch (err) {
        console.warn('Could not load remote seating history, using fallback:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [isOpen, layoutId, selectedSeat, selectedStudentId, allLocalAssignments]);

  if (!isOpen) return null;

  const formatDateLabel = (isoDate?: string | null) => {
    if (!isoDate) return 'ปัจจุบัน';
    try {
      return format(new Date(isoDate), 'dd MMM yyyy HH:mm', { locale: th }) + ' น.';
    } catch {
      return isoDate;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in">
      <div className="bg-[#121620] border border-slate-700/80 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-[#0b0e14]">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/10 rounded-xl text-indigo-400 border border-indigo-500/20">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                ประวัติการนั่ง (Seating History)
              </h3>
              <p className="text-xs text-slate-400">
                {selectedSeat ? `${selectedSeat.group.name} • ที่นั่ง ${selectedSeat.seat.label || selectedSeat.seat.seatNumber}` : `ประวัตินักเรียน: ${studentName || selectedStudentId}`}
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

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {loading ? (
            <div className="py-12 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-2">
              <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              <span>กำลังดึงประวัติการนั่ง...</span>
            </div>
          ) : history.length === 0 ? (
            <div className="py-12 text-center border border-dashed border-slate-800 rounded-xl bg-slate-900/30">
              <Clock className="w-10 h-10 text-slate-600 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-400">ยังไม่มีประวัติการนั่งที่บันทึกไว้</p>
              <p className="text-xs text-slate-500 mt-1">ประวัติจะถูกบันทึกอัตโนมัติเมื่อมีการมอบหมายหรือย้ายที่นั่ง</p>
            </div>
          ) : (
            <div className="relative border-l-2 border-slate-800 ml-4 space-y-6">
              {history.map((record, index) => {
                const isActive = !record.effectiveTo;
                return (
                  <div key={record.id || index} className="relative pl-6">
                    {/* Timeline dot */}
                    <div className={`absolute -left-[9px] top-1.5 w-4 h-4 rounded-full border-2 ${isActive ? 'bg-emerald-500 border-emerald-300 ring-4 ring-emerald-500/20' : 'bg-slate-700 border-slate-600'}`} />

                    <div className={`p-4 rounded-xl border transition-all ${isActive ? 'bg-emerald-950/20 border-emerald-500/40 text-slate-200' : 'bg-[#181c28] border-slate-800 text-slate-300'}`}>
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-2">
                          <User className={`w-4 h-4 ${isActive ? 'text-emerald-400' : 'text-slate-400'}`} />
                          <span className="text-sm font-bold text-white">
                            {record.studentName || `รหัส ${record.studentId}`}
                          </span>
                          {record.studentNo && (
                            <span className="text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded font-mono">
                              เลขที่ {record.studentNo}
                            </span>
                          )}
                        </div>
                        {isActive ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            นั่งอยู่ปัจจุบัน
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400">
                            ย้ายออกแล้ว
                          </span>
                        )}
                      </div>

                      <div className="text-xs text-slate-400 space-y-1 font-mono pt-1">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-500" />
                          <span>ตั้งแต่: <strong className="text-slate-200">{formatDateLabel(record.effectiveFrom)}</strong></span>
                        </div>
                        {record.effectiveTo && (
                          <div className="flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-slate-500" />
                            <span>ถึง: <strong className="text-slate-200">{formatDateLabel(record.effectiveTo)}</strong></span>
                          </div>
                        )}
                        {record.reason && (
                          <div className="text-[11px] text-slate-400 font-sans mt-2 pt-2 border-t border-slate-800/80">
                            สาเหตุ / บันทึก: <span className="text-slate-300">{record.reason}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-[#0b0e14] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition-all"
          >
            ปิดหน้าต่าง
          </button>
        </div>
      </div>
    </div>
  );
};
