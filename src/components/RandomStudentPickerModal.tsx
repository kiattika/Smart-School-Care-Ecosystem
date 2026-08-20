import React, { useState } from 'react';
import { motion } from 'motion/react';
import confetti from 'canvas-confetti';
import { 
  Sparkles, 
  RotateCcw, 
  Award, 
  Users, 
  User, 
  X, 
  CheckCircle2, 
  Flame, 
  Volume2, 
  VolumeX, 
  Plus, 
  RefreshCw,
  LayoutGrid,
  Check
} from 'lucide-react';
import { Student, AttendanceStatus } from '../types';
import { playCelebrationSound, playTickSound, playPointAwardSound } from '../lib/soundEffects';
import { useStore } from '../store';

export interface ClassroomDeskGroup {
  id: string;
  name: string;
  tableNumber: number;
  icon?: string;
  seatIndices: number[];
  students: Student[];
}

interface RandomStudentPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  courseStudents: Student[];
  classroomGroups?: ClassroomDeskGroup[];
  attendanceRecords: Record<string, AttendanceStatus>;
  courseId: string;
  onSelectHighlight?: (studentIds: string[]) => void;
}

export const RandomStudentPickerModal: React.FC<RandomStudentPickerModalProps> = ({
  isOpen,
  onClose,
  courseStudents,
  classroomGroups = [],
  attendanceRecords,
  courseId,
  onSelectHighlight
}) => {
  const { addActiveLearningPoints, adjustBehaviorScore, activeLearningPoints } = useStore();

  // Mode: 'INDIVIDUAL' (สุ่มรายบุคคล) | 'DESK_GROUP' (สุ่มรายโต๊ะ/กลุ่ม)
  const [pickMode, setPickMode] = useState<'INDIVIDUAL' | 'DESK_GROUP'>('INDIVIDUAL');
  
  // No-repeat mechanism: picked students/groups in current round
  const [pickedStudentIdsInRound, setPickedStudentIdsInRound] = useState<string[]>([]);
  const [pickedGroupIdsInRound, setPickedGroupIdsInRound] = useState<string[]>([]);
  
  // Active spinning animation state
  const [isSpinning, setIsSpinning] = useState(false);
  const [spinningPreviewStudent, setSpinningPreviewStudent] = useState<Student | null>(null);
  const [spinningPreviewGroup, setSpinningPreviewGroup] = useState<ClassroomDeskGroup | null>(null);
  
  // Winner Results
  const [selectedIndividualWinner, setSelectedIndividualWinner] = useState<Student | null>(null);
  const [selectedGroupWinner, setSelectedGroupWinner] = useState<ClassroomDeskGroup | null>(null);
  
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [awardedStudents, setAwardedStudents] = useState<Record<string, number>>({});
  const [groupAwardedPoints, setGroupAwardedPoints] = useState<number>(0);

  // 1. Filter Eligible Students:
  // Rule: Exclude students marked as ABSENT (ขาด) or LEAVE (ลา).
  // Only PRESENT (มา), LATE (สาย), or UNMARKED are eligible.
  const isStudentEligible = (s: Student) => {
    const status = attendanceRecords[s.studentId];
    return status !== 'ABSENT' && status !== 'LEAVE';
  };

  const eligibleStudents = courseStudents.filter(isStudentEligible);

  // Available students in round
  const availableStudentsInRound = eligibleStudents.filter(
    s => !pickedStudentIdsInRound.includes(s.studentId)
  );

  // 2. Filter Eligible Groups (Must contain at least 1 eligible student seated)
  const eligibleGroups = classroomGroups
    .map(g => ({
      ...g,
      students: g.students.filter(isStudentEligible)
    }))
    .filter(g => g.students.length > 0);

  const availableGroupsInRound = eligibleGroups.filter(
    g => !pickedGroupIdsInRound.includes(g.id)
  );

  // Trigger Confetti Blast
  const triggerConfetti = () => {
    try {
      confetti({
        particleCount: 90,
        spread: 75,
        origin: { y: 0.6 },
        colors: ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#3b82f6']
      });
      setTimeout(() => {
        confetti({
          particleCount: 60,
          angle: 60,
          spread: 60,
          origin: { x: 0 },
          colors: ['#fbbf24', '#f43f5e', '#38bdf8']
        });
        confetti({
          particleCount: 60,
          angle: 120,
          spread: 60,
          origin: { x: 1 },
          colors: ['#a855f7', '#34d399', '#f97316']
        });
      }, 200);
    } catch (err) {
      console.warn('Confetti error:', err);
    }
  };

  // Reset current round
  const handleResetRound = () => {
    setPickedStudentIdsInRound([]);
    setPickedGroupIdsInRound([]);
    setSelectedIndividualWinner(null);
    setSelectedGroupWinner(null);
    setAwardedStudents({});
    setGroupAwardedPoints(0);
    if (onSelectHighlight) onSelectHighlight([]);
  };

  // Perform Random Pick
  const handleStartSpin = () => {
    if (pickMode === 'INDIVIDUAL') {
      // Individual Spin
      let pool = availableStudentsInRound;
      if (pool.length === 0) {
        if (eligibleStudents.length === 0) return;
        // Auto reset round
        setPickedStudentIdsInRound([]);
        pool = eligibleStudents;
      }

      setIsSpinning(true);
      setSelectedIndividualWinner(null);
      setSelectedGroupWinner(null);
      setAwardedStudents({});
      setGroupAwardedPoints(0);

      let count = 0;
      const maxSpins = 18;
      const interval = setInterval(() => {
        const randomIdx = Math.floor(Math.random() * pool.length);
        setSpinningPreviewStudent(pool[randomIdx]);
        if (soundEnabled && count % 2 === 0) {
          playTickSound();
        }
        count++;

        if (count >= maxSpins) {
          clearInterval(interval);
          const winnerIndex = Math.floor(Math.random() * pool.length);
          const winner = pool[winnerIndex];

          setPickedStudentIdsInRound(prev => [...prev, winner.studentId]);
          setSelectedIndividualWinner(winner);
          setIsSpinning(false);
          setSpinningPreviewStudent(null);

          if (onSelectHighlight) {
            onSelectHighlight([winner.studentId]);
          }

          triggerConfetti();
          if (soundEnabled) {
            playCelebrationSound();
          }
        }
      }, 85);

    } else {
      // Desk / Group Spin
      let pool = availableGroupsInRound;
      if (pool.length === 0) {
        if (eligibleGroups.length === 0) return;
        setPickedGroupIdsInRound([]);
        pool = eligibleGroups;
      }

      setIsSpinning(true);
      setSelectedIndividualWinner(null);
      setSelectedGroupWinner(null);
      setAwardedStudents({});
      setGroupAwardedPoints(0);

      let count = 0;
      const maxSpins = 18;
      const interval = setInterval(() => {
        const randomIdx = Math.floor(Math.random() * pool.length);
        setSpinningPreviewGroup(pool[randomIdx]);
        if (soundEnabled && count % 2 === 0) {
          playTickSound();
        }
        count++;

        if (count >= maxSpins) {
          clearInterval(interval);
          const winnerIdx = Math.floor(Math.random() * pool.length);
          const winnerGroup = pool[winnerIdx];

          setPickedGroupIdsInRound(prev => [...prev, winnerGroup.id]);
          setSelectedGroupWinner(winnerGroup);
          setIsSpinning(false);
          setSpinningPreviewGroup(null);

          const studentIds = winnerGroup.students.map(s => s.studentId);
          if (onSelectHighlight) {
            onSelectHighlight(studentIds);
          }

          triggerConfetti();
          if (soundEnabled) {
            playCelebrationSound();
          }
        }
      }, 85);
    }
  };

  // Award Active Learning Points to Individual Student
  const handleAwardIndividualPoints = (student: Student, points: number) => {
    addActiveLearningPoints(
      student.studentId,
      points,
      'ANSWER',
      `กิจกรรมสุ่มตอบคำถาม Active Learning (+${points} คะแนน)`,
      courseId
    );
    adjustBehaviorScore(student.studentId, points);
    
    setAwardedStudents(prev => ({
      ...prev,
      [student.studentId]: (prev[student.studentId] || 0) + points
    }));

    if (soundEnabled) {
      playPointAwardSound();
    }
  };

  // Award Active Learning Points to ENTIRE GROUP / TABLE
  const handleAwardGroupPoints = (group: ClassroomDeskGroup, points: number) => {
    group.students.forEach(student => {
      addActiveLearningPoints(
        student.studentId,
        points,
        'COLLABORATION',
        `กิจกรรมกลุ่ม/โต๊ะเรียน: ${group.name} (+${points} คะแนน)`,
        courseId
      );
      adjustBehaviorScore(student.studentId, points);
    });

    setGroupAwardedPoints(prev => prev + points);
    setAwardedStudents(prev => {
      const next = { ...prev };
      group.students.forEach(s => {
        next[s.studentId] = (next[s.studentId] || 0) + points;
      });
      return next;
    });

    if (soundEnabled) {
      playPointAwardSound();
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      id="random-student-picker-modal"
      className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-[9999] p-4 animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-[#0f1422] border border-indigo-500/30 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-gradient-to-r from-indigo-950/60 via-[#131a2e] to-[#0f1422]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-indigo-500 p-0.5 shadow-lg flex items-center justify-center">
              <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-amber-400 animate-pulse" />
              </div>
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                ระบบสุ่มนักเรียน & โต๊ะเรียน (Smart Picker)
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 bg-amber-500/10 text-amber-300 border border-amber-500/20 rounded-full font-bold">
                  Active Learning
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                สุ่มตอบคำถามรายคนหรือสุ่มโต๊ะกิจกรรม พร้อมให้คะแนนกลุ่มแบบ Real-time
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="btn-toggle-sound"
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
              title={soundEnabled ? "ปิดเสียงเอฟเฟกต์" : "เปิดเสียงเอฟเฟกต์"}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
            </button>
            <button
              id="btn-close-picker-modal"
              onClick={onClose}
              className="p-2 rounded-xl bg-white/5 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Controls & Mode Bar */}
        <div className="px-6 py-3 bg-[#141b2d]/80 border-b border-white/5 flex flex-wrap items-center justify-between gap-3 text-xs">
          
          {/* Mode Selector */}
          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-medium">รูปแบบการสุ่ม:</span>
            <div className="bg-slate-900 p-1 rounded-xl border border-white/10 flex items-center gap-1">
              <button
                id="mode-individual-btn"
                onClick={() => { 
                  setPickMode('INDIVIDUAL'); 
                  setSelectedIndividualWinner(null); 
                  setSelectedGroupWinner(null);
                  if (onSelectHighlight) onSelectHighlight([]);
                }}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
                  pickMode === 'INDIVIDUAL' 
                    ? 'bg-indigo-600 text-white shadow-md' 
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <User className="w-3.5 h-3.5" />
                สุ่มรายบุคคล (Individual)
              </button>
              <button
                id="mode-group-btn"
                onClick={() => { 
                  setPickMode('DESK_GROUP'); 
                  setSelectedIndividualWinner(null); 
                  setSelectedGroupWinner(null);
                  if (onSelectHighlight) onSelectHighlight([]);
                }}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
                  pickMode === 'DESK_GROUP' 
                    ? 'bg-indigo-600 text-white shadow-md' 
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                สุ่มรายโต๊ะ/กลุ่ม (Desk Group)
              </button>
            </div>
          </div>

          {/* Round Progress & No-Repeat Status */}
          <div className="flex items-center gap-2 ml-auto">
            {pickMode === 'INDIVIDUAL' ? (
              <div className="px-2.5 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-300 font-mono text-[11px] flex items-center gap-1.5">
                <span>สุ่มแล้ว:</span>
                <span className="font-bold text-white">{pickedStudentIdsInRound.length}</span>
                <span className="text-slate-500">/</span>
                <span>{eligibleStudents.length} คน</span>
                <span className="text-slate-400">({availableStudentsInRound.length} เหลือ)</span>
              </div>
            ) : (
              <div className="px-2.5 py-1 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-300 font-mono text-[11px] flex items-center gap-1.5">
                <span>สุ่มโต๊ะแล้ว:</span>
                <span className="font-bold text-white">{pickedGroupIdsInRound.length}</span>
                <span className="text-slate-500">/</span>
                <span>{eligibleGroups.length} โต๊ะ</span>
                <span className="text-slate-400">({availableGroupsInRound.length} เหลือ)</span>
              </div>
            )}

            <button
              id="btn-reset-picker-round"
              onClick={handleResetRound}
              disabled={(pickMode === 'INDIVIDUAL' ? pickedStudentIdsInRound.length : pickedGroupIdsInRound.length) === 0}
              className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-slate-300 hover:text-white transition-all flex items-center gap-1 text-[11px] px-2.5 border border-white/10"
              title="รีเซ็ตรอบการสุ่มใหม่ เพื่อให้ทุกคนหรือทุกโต๊ะมีสิทธิ์สุ่มอีกครั้ง"
            >
              <RotateCcw className="w-3 h-3" />
              รีเซ็ตรอบ
            </button>
          </div>
        </div>

        {/* Filter Notice */}
        <div className="px-6 py-2 bg-slate-950/40 border-b border-white/5 flex items-center justify-between text-[11px] text-slate-400">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>กฎการสุ่ม: กรองเฉพาะนักเรียนที่ <strong>มา (Present)</strong> หรือ <strong>สาย (Tardy)</strong> เท่านั้น</span>
          </div>
          <span className="text-slate-500 font-mono">
            {pickMode === 'INDIVIDUAL' 
              ? `พร้อมสุ่ม: ${availableStudentsInRound.length} คน` 
              : `พร้อมสุ่ม: ${availableGroupsInRound.length} โต๊ะ`}
          </span>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center justify-center min-h-[340px]">
          
          {/* 1. Spinning Animation State */}
          {isSpinning && (
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="flex flex-col items-center justify-center space-y-4 py-6"
            >
              {pickMode === 'INDIVIDUAL' && spinningPreviewStudent && (
                <>
                  <div className="relative">
                    <div className="w-28 h-28 rounded-full border-4 border-amber-400/80 p-1 animate-spin">
                      <div className="w-full h-full rounded-full border-2 border-indigo-400 border-dashed"></div>
                    </div>
                    <img 
                      src={spinningPreviewStudent.avatar || spinningPreviewStudent.photoUrl} 
                      alt="" 
                      className="w-24 h-24 rounded-full absolute inset-2 object-cover bg-slate-800 shadow-xl"
                    />
                  </div>

                  <div className="text-center space-y-1">
                    <div className="text-lg font-bold text-amber-300 font-mono animate-pulse">
                      กำลังสุ่มรายชื่อนักเรียน...
                    </div>
                    <div className="text-sm font-semibold text-slate-200">
                      {spinningPreviewStudent.fullName || spinningPreviewStudent.name}
                    </div>
                    <div className="text-xs text-slate-400 font-mono">
                      เลขที่ {spinningPreviewStudent.studentNo || spinningPreviewStudent.number} (#{spinningPreviewStudent.studentCode || spinningPreviewStudent.studentId})
                    </div>
                  </div>
                </>
              )}

              {pickMode === 'DESK_GROUP' && spinningPreviewGroup && (
                <>
                  <div className="w-28 h-28 rounded-3xl bg-gradient-to-tr from-amber-500/20 via-indigo-500/20 to-emerald-500/20 border-2 border-amber-400 flex items-center justify-center text-4xl shadow-2xl animate-bounce">
                    {spinningPreviewGroup.icon || '🪑'}
                  </div>

                  <div className="text-center space-y-1">
                    <div className="text-lg font-bold text-amber-300 font-mono animate-pulse">
                      กำลังสุ่มโต๊ะ / กลุ่มกิจกรรม...
                    </div>
                    <div className="text-base font-bold text-white">
                      {spinningPreviewGroup.name}
                    </div>
                    <div className="text-xs text-slate-400">
                      มีสมาชิกนั่งอยู่ {spinningPreviewGroup.students.length} คน
                    </div>
                  </div>
                </>
              )}
            </motion.div>
          )}

          {/* 2. Winner Result Card - INDIVIDUAL MODE */}
          {!isSpinning && selectedIndividualWinner && (
            <div className="w-full space-y-5 animate-in zoom-in-95 duration-300">
              <div className="text-center space-y-1">
                <div className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-gradient-to-r from-amber-500/20 via-orange-500/20 to-emerald-500/20 border border-amber-500/40 text-amber-300 text-xs font-bold shadow-lg">
                  <Flame className="w-4 h-4 text-amber-400 animate-bounce" />
                  🎉 ผู้โชคดีประจำรอบ (Selected Student)
                </div>
              </div>

              {/* Single Winner Card */}
              {(() => {
                const winner = selectedIndividualWinner;
                const studentNo = winner.studentNo || winner.number || (winner.seatIndex !== null ? winner.seatIndex + 1 : 1);
                const nickname = winner.nickname || '-';
                const studentCode = winner.studentCode || winner.studentId;
                const currentALPoints = activeLearningPoints[winner.studentId] || 0;
                const awardedNow = awardedStudents[winner.studentId] || 0;

                return (
                  <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    className="max-w-md mx-auto bg-gradient-to-b from-[#1a233a] to-[#111728] border-2 border-amber-500/60 rounded-3xl p-6 shadow-2xl relative overflow-hidden flex flex-col items-center text-center group"
                  >
                    <div className="absolute -top-12 -right-12 w-32 h-32 bg-amber-500/20 rounded-full blur-2xl pointer-events-none"></div>

                    {/* Top Badges */}
                    <div className="w-full flex items-center justify-between mb-2">
                      <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 px-3 py-1 rounded-xl text-xs font-bold font-mono">
                        เลขที่ {studentNo}
                      </span>
                      <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 px-3 py-1 rounded-xl text-xs font-bold font-mono">
                        🌟 {currentALPoints} แต้มสะสม
                      </span>
                    </div>

                    {/* Avatar */}
                    <div className="relative my-3">
                      <div className="w-24 h-24 rounded-full p-1 bg-gradient-to-tr from-amber-400 via-rose-400 to-indigo-500 animate-pulse shadow-xl">
                        <img 
                          src={winner.avatar || winner.photoUrl} 
                          alt={winner.name} 
                          className="w-full h-full rounded-full object-cover bg-slate-900 border-2 border-slate-950"
                        />
                      </div>
                      <div className="absolute -bottom-1 -right-1 bg-emerald-500 text-slate-950 rounded-full p-1 shadow-md font-bold text-xs">
                        <Check className="w-3.5 h-3.5" />
                      </div>
                    </div>

                    {/* Name & details */}
                    <div className="space-y-1.5 w-full">
                      <h3 className="font-bold text-base text-white group-hover:text-amber-300 transition-colors">
                        {winner.title || ''}{winner.fullName || winner.name}
                      </h3>
                      <div className="flex items-center justify-center gap-3 text-xs">
                        <span className="text-amber-300 font-semibold bg-amber-400/10 px-2.5 py-0.5 rounded-lg border border-amber-500/20">
                          ชื่อเล่น: {nickname}
                        </span>
                        <span className="text-slate-400 font-mono">
                          #{studentCode}
                        </span>
                        {winner.room && (
                          <span className="text-indigo-400 font-mono">
                            ห้อง {winner.room}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Awarded Indicator */}
                    {awardedNow > 0 && (
                      <div className="mt-3 px-4 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded-xl text-xs font-bold animate-in zoom-in duration-200">
                        🎉 มอบคะแนน Active Learning +{awardedNow} แต้มเรียบร้อย!
                      </div>
                    )}

                    {/* Quick Award Buttons */}
                    <div className="mt-5 pt-4 border-t border-white/10 w-full flex items-center justify-center gap-2">
                      <button
                        id="award-plus-1"
                        onClick={() => handleAwardIndividualPoints(winner, 1)}
                        className="flex-1 py-2 bg-emerald-600/30 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/40 rounded-xl text-xs font-bold transition-all active:scale-95 flex items-center justify-center gap-1 shadow-md cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" /> +1 ตอบคำถาม
                      </button>
                      <button
                        id="award-plus-2"
                        onClick={() => handleAwardIndividualPoints(winner, 2)}
                        className="flex-1 py-2 bg-amber-600/30 hover:bg-amber-600 text-amber-300 hover:text-white border border-amber-500/40 rounded-xl text-xs font-bold transition-all active:scale-95 flex items-center justify-center gap-1 shadow-md cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" /> +2 นำเสนอดี
                      </button>
                      <button
                        id="award-plus-5"
                        onClick={() => handleAwardIndividualPoints(winner, 5)}
                        className="flex-1 py-2 bg-indigo-600/30 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/40 rounded-xl text-xs font-bold transition-all active:scale-95 flex items-center justify-center gap-1 shadow-md cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" /> +5 ช่วยเพื่อน/ยอดเยี่ยม
                      </button>
                    </div>
                  </motion.div>
                );
              })()}
            </div>
          )}

          {/* 3. Winner Result Card - GROUP / TABLE MODE */}
          {!isSpinning && selectedGroupWinner && (
            <div className="w-full space-y-5 animate-in zoom-in-95 duration-300">
              
              {/* Group Header & Title */}
              <div className="text-center space-y-1">
                <div className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-gradient-to-r from-amber-500/20 via-orange-500/20 to-emerald-500/20 border border-amber-500/40 text-amber-300 text-xs font-bold shadow-lg">
                  <Flame className="w-4 h-4 text-amber-400 animate-bounce" />
                  🎉 โต๊ะ/กลุ่มผู้โชคดี (Selected Group / Table)
                </div>
              </div>

              {/* Group Winner Banner Card */}
              <div className="bg-gradient-to-r from-[#172138] via-[#1f2c4a] to-[#172138] border-2 border-amber-500/60 rounded-3xl p-5 shadow-2xl relative overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-2xl shadow-md">
                      {selectedGroupWinner.icon || '🪑'}
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-white flex items-center gap-2">
                        {selectedGroupWinner.name}
                        <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-300 rounded-lg text-xs font-mono">
                          {selectedGroupWinner.students.length} คน
                        </span>
                      </h3>
                      <p className="text-xs text-amber-300/90 font-medium mt-0.5">
                        สมาชิกโต๊ะได้รับเลือกเป็นตัวแทนร่วมกิจกรรม Active Learning
                      </p>
                    </div>
                  </div>

                  {groupAwardedPoints > 0 && (
                    <div className="px-3 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded-xl text-xs font-bold animate-in zoom-in duration-200">
                      🎉 เพิ่มให้ทุกคนในกลุ่ม +{groupAwardedPoints} แต้มแล้ว!
                    </div>
                  )}
                </div>

                {/* Seated Students Grid inside this selected Group */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 my-4">
                  {selectedGroupWinner.students.map((st, idx) => {
                    const stNo = st.studentNo || st.number || (st.seatIndex !== null ? st.seatIndex + 1 : idx + 1);
                    const currentPts = activeLearningPoints[st.studentId] || 0;
                    const awardedForStudent = awardedStudents[st.studentId] || 0;

                    return (
                      <div 
                        key={st.studentId}
                        className="bg-[#0f1524]/90 p-3 rounded-2xl border border-white/10 hover:border-amber-500/40 flex items-center gap-3 shadow-md transition-all group/item"
                      >
                        <img 
                          src={st.avatar || st.photoUrl} 
                          alt="" 
                          className="w-11 h-11 rounded-full object-cover border-2 border-slate-700 bg-slate-800 shrink-0 group-hover/item:border-amber-400"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="font-bold text-xs text-white group-hover/item:text-amber-300 truncate">
                            {st.fullName || st.name}
                          </div>
                          <div className="text-[10px] text-slate-400 flex items-center justify-between font-mono mt-0.5">
                            <span>เลขที่ {stNo}</span>
                            <span className="text-amber-300 font-bold">🌟 {currentPts} แต้ม</span>
                          </div>
                          {awardedForStudent > 0 && (
                            <div className="text-[10px] text-emerald-400 font-bold mt-0.5">
                              +{awardedForStudent} แต้มในรอบนี้
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* GROUP POINT AWARDING ACTIONS (APPLIES TO ALL STUDENTS IN GROUP) */}
                <div className="p-3.5 bg-indigo-950/60 border border-indigo-500/40 rounded-2xl flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Award className="w-5 h-5 text-amber-400 shrink-0" />
                    <div>
                      <h4 className="font-bold text-xs text-white">
                        ให้คะแนนทั้งโต๊ะ / กลุ่ม (Group Scoring)
                      </h4>
                      <p className="text-[10px] text-indigo-300">
                        กดปุ่มเพื่อเพิ่มคะแนนให้นักเรียนทั้ง {selectedGroupWinner.students.length} คนในโต๊ะนี้พร้อมกัน
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 ml-auto">
                    <button
                      id="group-award-plus-1"
                      onClick={() => handleAwardGroupPoints(selectedGroupWinner, 1)}
                      className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs transition-all shadow-md active:scale-95 cursor-pointer flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" /> +1 ทั้งกลุ่ม
                    </button>
                    <button
                      id="group-award-plus-2"
                      onClick={() => handleAwardGroupPoints(selectedGroupWinner, 2)}
                      className="px-3.5 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl font-bold text-xs transition-all shadow-md active:scale-95 cursor-pointer flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" /> +2 ทั้งกลุ่ม
                    </button>
                    <button
                      id="group-award-plus-5"
                      onClick={() => handleAwardGroupPoints(selectedGroupWinner, 5)}
                      className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-xs transition-all shadow-md active:scale-95 cursor-pointer flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" /> +5 ทั้งกลุ่ม
                    </button>
                  </div>
                </div>

              </div>

            </div>
          )}

          {/* 4. Empty Initial State */}
          {!isSpinning && !selectedIndividualWinner && !selectedGroupWinner && (
            <div className="text-center space-y-4 py-8">
              <div className="w-20 h-20 rounded-3xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mx-auto text-indigo-400 shadow-xl">
                {pickMode === 'INDIVIDUAL' ? <Sparkles className="w-10 h-10" /> : <LayoutGrid className="w-10 h-10 text-amber-400" />}
              </div>
              <div className="space-y-1.5">
                <h3 className="text-base font-bold text-white">
                  พร้อมทำการสุ่ม {pickMode === 'INDIVIDUAL' ? 'รายบุคคล' : 'รายโต๊ะ/กลุ่มกิจกรรม'}
                </h3>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  {pickMode === 'INDIVIDUAL'
                    ? 'ระบบจะสุ่มนักเรียนที่มาเรียนในคาบนี้แบบไม่ซ้ำคนเดิมในรอบปัจจุบัน'
                    : `ระบบจะสุ่มโต๊ะเรียนที่จัดผังไว้ (${eligibleGroups.length} โต๊ะที่พร้อม) และสามารถให้คะแนน Active Learning ทั้งกลุ่มได้ในคลิกเดียว`}
                </p>
              </div>
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-white/10 bg-[#0c101c] flex items-center justify-between gap-3">
          <button
            id="btn-close-picker-footer"
            onClick={onClose}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
          >
            ปิดหน้าต่าง (Close)
          </button>

          <div className="flex items-center gap-3">
            {(selectedIndividualWinner || selectedGroupWinner) && (
              <button
                id="btn-spin-next"
                onClick={handleStartSpin}
                disabled={isSpinning}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 border border-white/10 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 active:scale-95 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                {pickMode === 'INDIVIDUAL' ? 'สุ่มคนถัดไป (Next)' : 'สุ่มโต๊ะถัดไป (Next Table)'}
              </button>
            )}

            <button
              id="btn-start-random-spin"
              onClick={handleStartSpin}
              disabled={isSpinning || (pickMode === 'INDIVIDUAL' ? eligibleStudents.length === 0 : eligibleGroups.length === 0)}
              className="px-6 py-2.5 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:opacity-50 text-slate-950 font-bold rounded-xl text-xs transition-all shadow-lg shadow-amber-500/20 flex items-center gap-2 active:scale-95 cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              {isSpinning 
                ? 'กำลังสุ่ม...' 
                : (selectedIndividualWinner || selectedGroupWinner) 
                  ? 'สุ่มใหม่ (Spin Again)' 
                  : (pickMode === 'INDIVIDUAL' ? 'เริ่มสุ่มรายชื่อ (Start Pick)' : 'เริ่มสุ่มโต๊ะเรียน (Start Group Pick)')}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
