import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, User, Users, Check, X, ChevronDown } from 'lucide-react';
import { useRealStudents } from '../../hooks/useRealStudents';
import { Student } from '../../types';

/**
 * ตัวเลือกนักเรียนกลาง — แทนที่ pattern การเลือกนักเรียนที่กระจัดกระจายไม่สม่ำเสมอกันหลายจุดในระบบ
 * (บางที่ select ธรรมดาไม่มีช่องค้นหา, บางที่มี checkbox หลายคนแต่ไม่มีช่องค้นหา ฯลฯ)
 *
 * ดึงรายชื่อนักเรียนจริงผ่าน useRealStudents() เอง (real-time) โดยไม่ต้องส่ง prop ใดๆ เพิ่ม —
 * หรือส่ง `students` เข้ามาเองได้ถ้าไฟล์นั้นดึงรายชื่อไว้แล้ว (กัน listener ซ้ำซ้อน)
 *
 * โหมด "single": ช่องค้นหา autocomplete พิมพ์เลขประจำตัวหรือชื่อ-นามสกุล เลือกได้ทีละคน
 * โหมด "multi-room": เลือกห้องก่อน (dropdown) แล้วติ๊ก checkbox เลือกได้หลายคนในห้องนั้น
 *   พร้อมปุ่ม "เลือกทั้งหมด"/"ยกเลิกทั้งหมด"
 */

interface StudentPickerBaseProps {
  students?: Student[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

interface StudentPickerSingleProps extends StudentPickerBaseProps {
  mode: 'single';
  value: string; // studentId ที่เลือกอยู่ (ค่าว่าง = ยังไม่เลือก)
  onSelect: (studentId: string) => void;
}

interface StudentPickerMultiRoomProps extends StudentPickerBaseProps {
  mode: 'multi-room';
  value: string[]; // studentId[] ที่เลือกอยู่
  onSelect: (studentIds: string[]) => void;
}

type StudentPickerProps = StudentPickerSingleProps | StudentPickerMultiRoomProps;

export function StudentPicker(props: StudentPickerProps) {
  const { students: studentsProp, placeholder, className, disabled } = props;
  // ถ้ามีคน pass `students` มาเอง ใช้เลย ไม่เรียก useRealStudents() ซ้ำ (กัน listener ซ้ำซ้อนในหน้าที่
  // ดึงรายชื่อไว้แล้ว) — hook ยังต้องถูกเรียกเสมอ (React rules of hooks) แค่ไม่ได้ใช้ผลลัพธ์ถ้ามี prop
  const { students: liveStudents } = useRealStudents();
  const students = studentsProp ?? liveStudents;

  if (props.mode === 'single') {
    return (
      <StudentPickerSingle
        students={students}
        value={props.value}
        onSelect={props.onSelect}
        placeholder={placeholder}
        className={className}
        disabled={disabled}
      />
    );
  }
  return (
    <StudentPickerMultiRoom
      students={students}
      value={props.value}
      onSelect={props.onSelect}
      placeholder={placeholder}
      className={className}
      disabled={disabled}
    />
  );
}

function StudentPickerSingle({
  students,
  value,
  onSelect,
  placeholder,
  className,
  disabled,
}: {
  students: Student[];
  value: string;
  onSelect: (studentId: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const selectedStudent = students.find(s => s.studentId === value) || null;

  // แสดงชื่อนักเรียนที่เลือกอยู่ในช่องค้นหาเมื่อไม่ได้กำลังพิมพ์ค้นหาใหม่
  useEffect(() => {
    if (!isOpen) {
      setQuery(selectedStudent ? `${selectedStudent.fullName} (${selectedStudent.studentId})` : '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, isOpen]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return students.slice(0, 50);
    return students
      .filter(s => s.studentId.toLowerCase().includes(q) || s.fullName.toLowerCase().includes(q))
      .slice(0, 50);
  }, [students, query]);

  const handlePick = (s: Student) => {
    onSelect(s.studentId);
    setQuery(`${s.fullName} (${s.studentId})`);
    setIsOpen(false);
  };

  const handleClear = () => {
    onSelect('');
    setQuery('');
  };

  return (
    <div ref={wrapRef} className={`relative ${className || ''}`}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
        <input
          type="text"
          disabled={disabled}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setIsOpen(true); }}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder || 'ค้นหาด้วยเลขประจำตัวหรือชื่อ-นามสกุล...'}
          className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-8 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 disabled:opacity-50"
        />
        {value && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 cursor-pointer"
            aria-label="ล้างค่าที่เลือก"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {isOpen && (
        <div className="absolute z-40 mt-1 w-full max-h-56 overflow-y-auto bg-slate-900 border border-slate-800 rounded-xl shadow-2xl divide-y divide-slate-800">
          {results.length === 0 ? (
            <div className="p-3 text-center text-[11px] text-slate-500">ไม่พบนักเรียนที่ตรงกับคำค้นหา</div>
          ) : (
            results.map((s) => (
              <button
                type="button"
                key={s.studentId}
                onClick={() => handlePick(s)}
                className={`w-full text-left px-3 py-2 text-xs flex items-center gap-2.5 hover:bg-slate-800/70 transition-colors cursor-pointer ${
                  s.studentId === value ? 'bg-emerald-500/10' : ''
                }`}
              >
                <User className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <span className="text-white font-medium truncate">{s.fullName}</span>
                <span className="text-slate-500 font-mono text-[10px] shrink-0 ml-auto">{s.studentId} · {s.room}</span>
                {s.studentId === value && <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function StudentPickerMultiRoom({
  students,
  value,
  onSelect,
  placeholder,
  className,
  disabled,
}: {
  students: Student[];
  value: string[];
  onSelect: (studentIds: string[]) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}) {
  const rooms = useMemo(() => {
    const set = new Set<string>();
    students.forEach(s => { if (s.room) set.add(s.room); });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'th'));
  }, [students]);

  const [selectedRoom, setSelectedRoom] = useState<string>('');

  // เลือกห้องแรกอัตโนมัติทันทีที่รายชื่อโหลดเสร็จ (ถ้ายังไม่ได้เลือกห้องไหนเลย)
  useEffect(() => {
    if (!selectedRoom && rooms.length > 0) setSelectedRoom(rooms[0]);
  }, [rooms, selectedRoom]);

  const roomStudents = useMemo(
    () => students.filter(s => s.room === selectedRoom),
    [students, selectedRoom]
  );

  const selectedSet = new Set(value);
  const allSelectedInRoom = roomStudents.length > 0 && roomStudents.every(s => selectedSet.has(s.studentId));

  const toggleStudent = (studentId: string) => {
    if (selectedSet.has(studentId)) {
      onSelect(value.filter(id => id !== studentId));
    } else {
      onSelect([...value, studentId]);
    }
  };

  const toggleAllInRoom = () => {
    const roomIds = roomStudents.map(s => s.studentId);
    if (allSelectedInRoom) {
      onSelect(value.filter(id => !roomIds.includes(id)));
    } else {
      const merged = new Set([...value, ...roomIds]);
      onSelect(Array.from(merged));
    }
  };

  return (
    <div className={className}>
      <div className="flex items-center gap-2 mb-2">
        <div className="relative flex-1">
          <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          <select
            disabled={disabled}
            value={selectedRoom}
            onChange={(e) => setSelectedRoom(e.target.value)}
            className="w-full appearance-none bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-8 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 disabled:opacity-50"
          >
            {rooms.length === 0 && <option value="">— ไม่มีข้อมูลห้องเรียน —</option>}
            {rooms.map(r => <option key={r} value={r}>ห้อง {r}</option>)}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
        </div>
        <button
          type="button"
          onClick={toggleAllInRoom}
          disabled={disabled || roomStudents.length === 0}
          className="px-3 py-2 rounded-xl text-[11px] font-semibold border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 disabled:opacity-40 cursor-pointer whitespace-nowrap"
        >
          {allSelectedInRoom ? 'ยกเลิกทั้งหมด' : 'เลือกทั้งหมด'}
        </button>
      </div>

      <div className="max-h-56 overflow-y-auto bg-slate-950 border border-slate-800 rounded-xl divide-y divide-slate-800">
        {roomStudents.length === 0 ? (
          <div className="p-3 text-center text-[11px] text-slate-500">
            {placeholder || 'ไม่มีนักเรียนในห้องนี้'}
          </div>
        ) : (
          roomStudents.map((s) => {
            const checked = selectedSet.has(s.studentId);
            return (
              <label
                key={s.studentId}
                className="flex items-center gap-2.5 px-3 py-2 text-xs cursor-pointer hover:bg-slate-900/60"
              >
                <input
                  type="checkbox"
                  disabled={disabled}
                  checked={checked}
                  onChange={() => toggleStudent(s.studentId)}
                  className="accent-emerald-500"
                />
                <span className="text-white font-medium truncate">{s.fullName}</span>
                <span className="text-slate-500 font-mono text-[10px] ml-auto shrink-0">{s.studentId}</span>
              </label>
            );
          })
        )}
      </div>

      {value.length > 0 && (
        <p className="mt-1.5 text-[10px] text-emerald-400 font-semibold">เลือกแล้ว {value.length} คน</p>
      )}
    </div>
  );
}
