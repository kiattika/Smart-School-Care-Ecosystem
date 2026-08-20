import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Shuffle, 
  Star, 
  TrendingUp, 
  MessageSquare,
  Award,
  ChevronLeft
} from 'lucide-react';
import { Course, Student } from '../types';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface ActiveLearningClassroomProps {
  course: Course;
  students: Student[];
  onBack: () => void;
}

export const ActiveLearningClassroom: React.FC<ActiveLearningClassroomProps> = ({
  course,
  students,
  onBack
}) => {
  const [activeTab, setActiveTab] = useState<'seating' | 'randomizer' | 'scoring'>('seating');
  const [randomStudent, setRandomStudent] = useState<Student | null>(null);
  const [isSpinning, setIsSpinning] = useState(false);
  const [scores, setScores] = useState<Record<string, number>>({});

  // Initialize random seating plan grid (simplified)
  const rows = 5;
  const cols = 8;
  const grid: (Student | null)[][] = Array(rows).fill(null).map(() => Array(cols).fill(null));
  
  let studentIndex = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (studentIndex < students.length) {
        grid[r][c] = students[studentIndex];
        studentIndex++;
      }
    }
  }

  const handleRandomize = () => {
    if (students.length === 0) return;
    setIsSpinning(true);
    setRandomStudent(null);
    
    // Fake spin effect
    let spins = 0;
    const interval = setInterval(() => {
      const randomIndex = Math.floor(Math.random() * students.length);
      setRandomStudent(students[randomIndex]);
      spins++;
      if (spins > 10) {
        clearInterval(interval);
        setIsSpinning(false);
      }
    }, 100);
  };

  const handleScore = (studentId: string, points: number) => {
    setScores(prev => ({
      ...prev,
      [studentId]: (prev[studentId] || 0) + points
    }));
  };

  return (
    <div className="flex flex-col h-full bg-[#05070a] text-slate-100 animate-in fade-in duration-300">
      <header className="h-16 border-b border-white/10 flex items-center px-6 shrink-0 bg-[#0a0d14]">
        <button 
          onClick={onBack}
          className="mr-4 p-2 hover:bg-white/5 rounded-full transition-colors text-slate-400 hover:text-white"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-400" />
            โหมดห้องเรียน (Classroom View)
          </h2>
          <p className="text-xs text-slate-400">
            {course.code} {course.name} ({course.room})
          </p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          
          <div className="flex gap-4 border-b border-white/10 pb-4">
            <button
              onClick={() => setActiveTab('seating')}
              className={cn(
                "px-4 py-2 rounded-lg font-bold text-sm transition-all",
                activeTab === 'seating' ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30" : "bg-white/5 text-slate-400 hover:bg-white/10"
              )}
            >
              แผนผังที่นั่ง
            </button>
            <button
              onClick={() => setActiveTab('randomizer')}
              className={cn(
                "px-4 py-2 rounded-lg font-bold text-sm transition-all",
                activeTab === 'randomizer' ? "bg-amber-500/20 text-amber-300 border border-amber-500/30" : "bg-white/5 text-slate-400 hover:bg-white/10"
              )}
            >
              สุ่มเรียกตอบ
            </button>
            <button
              onClick={() => setActiveTab('scoring')}
              className={cn(
                "px-4 py-2 rounded-lg font-bold text-sm transition-all",
                activeTab === 'scoring' ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" : "bg-white/5 text-slate-400 hover:bg-white/10"
              )}
            >
              ให้คะแนนความร่วมมือ
            </button>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {activeTab === 'seating' && (
                <div className="bg-[#0f1219] border border-white/10 rounded-2xl p-6">
                  <div className="w-64 h-12 bg-white/5 border border-white/10 rounded-xl mx-auto mb-10 flex items-center justify-center font-bold text-slate-400 uppercase tracking-widest text-sm">
                    หน้ากระดาน (Front)
                  </div>
                  <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
                    {grid.map((row, rIdx) => 
                      row.map((student, cIdx) => (
                        <div 
                          key={`${rIdx}-${cIdx}`}
                          className={cn(
                            "aspect-square rounded-xl border flex flex-col items-center justify-center p-2 text-center transition-all",
                            student ? "bg-[#161f30] border-slate-700/50 hover:border-indigo-500/50 cursor-pointer" : "bg-white/5 border-dashed border-white/10 opacity-50"
                          )}
                          onClick={() => {
                            if (student) handleScore(student.studentId, 1);
                          }}
                        >
                          {student ? (
                            <>
                              <div className="w-10 h-10 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-300 font-bold mb-2">
                                {student.studentId.slice(-2)}
                              </div>
                              <span className="text-[10px] text-slate-300 leading-tight line-clamp-2">
                                {student.name.split(' ').pop()}
                              </span>
                              {scores[student.studentId] > 0 && (
                                <div className="absolute top-1 right-1 flex items-center gap-0.5 bg-emerald-500/20 text-emerald-400 px-1.5 rounded-full text-[8px] font-bold">
                                  <Star className="w-2 h-2" /> +{scores[student.studentId]}
                                </div>
                              )}
                            </>
                          ) : (
                            <span className="text-[10px] text-slate-500">ว่าง</span>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'randomizer' && (
                <div className="flex flex-col items-center justify-center min-h-[400px] bg-[#0f1219] border border-white/10 rounded-2xl p-6">
                  <div className={cn(
                    "w-64 h-64 rounded-full flex flex-col items-center justify-center border-4 shadow-[0_0_50px_rgba(0,0,0,0.5)] transition-all duration-300 mb-8 relative overflow-hidden",
                    isSpinning ? "border-amber-500/50 bg-amber-500/5" : "border-indigo-500/50 bg-[#161f30]",
                    randomStudent && !isSpinning && "border-emerald-500 bg-emerald-500/10 shadow-[0_0_50px_rgba(16,185,129,0.3)] scale-110"
                  )}>
                    {isSpinning && <div className="absolute inset-0 border-4 border-amber-400 rounded-full border-t-transparent animate-spin"></div>}
                    
                    {randomStudent ? (
                      <>
                        <div className="text-4xl font-black text-white mb-2">{randomStudent.studentId.slice(-2)}</div>
                        <div className="text-sm text-slate-300 text-center px-4">{randomStudent.name}</div>
                      </>
                    ) : (
                      <Shuffle className="w-16 h-16 text-slate-600" />
                    )}
                  </div>
                  <button
                    onClick={handleRandomize}
                    disabled={isSpinning}
                    className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-8 py-4 rounded-full font-black text-lg shadow-[0_0_20px_rgba(79,70,229,0.4)] transition-all active:scale-95 flex items-center gap-3"
                  >
                    <Shuffle className="w-6 h-6" />
                    {isSpinning ? 'กำลังสุ่ม...' : 'สุ่มนักเรียน'}
                  </button>
                </div>
              )}

              {activeTab === 'scoring' && (
                <div className="bg-[#0f1219] border border-white/10 rounded-2xl p-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {students.map(student => (
                      <div key={student.studentId} className="bg-[#161f30] border border-slate-700/50 rounded-xl p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-400 shrink-0">
                            {student.studentId.slice(-2)}
                          </div>
                          <div>
                            <div className="text-sm font-bold text-slate-200 line-clamp-1">{student.name}</div>
                            <div className="text-xs text-emerald-400 font-medium flex items-center gap-1 mt-0.5">
                              <Star className="w-3 h-3" />
                              {scores[student.studentId] || 0} pts
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => handleScore(student.studentId, 1)}
                          className="w-8 h-8 rounded-full bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center transition-colors shrink-0"
                        >
                          +1
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};
