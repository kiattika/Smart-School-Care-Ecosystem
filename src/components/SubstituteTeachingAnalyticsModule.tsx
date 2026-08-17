import React, { useState, useMemo } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  PieChart, Pie, Cell, LineChart, Line, AreaChart, Area
} from 'recharts';
import { 
  Award, 
  Users, 
  UserCheck, 
  TrendingUp, 
  Calendar, 
  Clock, 
  BookOpen, 
  FileDown, 
  AlertTriangle, 
  Info, 
  CheckCircle, 
  ChevronRight, 
  Filter, 
  FileSpreadsheet, 
  Printer, 
  ShieldAlert, 
  ArrowRight,
  User,
  Activity,
  Layers,
  Search,
  Sparkles,
  AwardIcon,
  CheckCircle2,
  X,
  FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useStore } from '../store';
import { cn } from '../lib/utils';

// --- Types & Interfaces ---
interface SubRecord {
  id: string;
  date: string;          // YYYY-MM-DD
  month: string;         // 'ม.ค.', 'ก.พ.', etc.
  courseCode: string;
  courseName: string;
  room: string;
  period: string;        // e.g. "คาบ 2"
  originalTeacherName: string;
  originalTeacherEmail: string;
  substituteTeacherName: string;
  substituteTeacherEmail: string;
  department: string;
  isLogged: boolean;     // teaching record submitted
  hours: number;         // usually 1 hour per period
}

// --- Historical High-Quality Mock Data (Jan - Jul 2026) ---
const HISTORICAL_SUB_RECORDS: SubRecord[] = [
  // Jan 2026
  { id: 'h-1', date: '2026-01-12', month: 'ม.ค.', courseCode: 'ว31102', courseName: 'วิทยาการคำนวณ 1', room: 'ม.4/1', period: 'คาบ 3', originalTeacherName: 'คุณครู สมใจ รักสอน', originalTeacherEmail: 'somjai@utd.ac.th', substituteTeacherName: 'นาย เกียรติศักดิ์ ศรีวิไล', substituteTeacherEmail: 'kiattisak@utd.ac.th', department: 'กลุ่มสาระการเรียนรู้วิทยาศาสตร์และเทคโนโลยี', isLogged: true, hours: 1 },
  { id: 'h-2', date: '2026-01-15', month: 'ม.ค.', courseCode: 'ค31101', courseName: 'คณิตศาสตร์พื้นฐาน', room: 'ม.1/1', period: 'คาบ 1', originalTeacherName: 'คุณครู มานะ บากบั่น', originalTeacherEmail: 'mana@utd.ac.th', substituteTeacherName: 'คุณครู วิภาดา รักเรียน', substituteTeacherEmail: 'wipada.r@school.ac.th', department: 'กลุ่มสาระการเรียนรู้คณิตศาสตร์', isLogged: true, hours: 1 },
  { id: 'h-3', date: '2026-01-19', month: 'ม.ค.', courseCode: 'ท32101', courseName: 'ภาษาไทย 3', room: 'ม.5/1', period: 'คาบ 2', originalTeacherName: 'นาย ก (ครูภาษาไทย)', originalTeacherEmail: 'teacher@utd.ac.th', substituteTeacherName: 'คุณครู วีณา รื่นรมย์', substituteTeacherEmail: 'weena@utd.ac.th', department: 'กลุ่มสาระการเรียนรู้ภาษาไทย', isLogged: true, hours: 1 },
  { id: 'h-4', date: '2026-01-22', month: 'ม.ค.', courseCode: 'ว30101', courseName: 'วิทยาศาสตร์กายภาพ 1', room: 'ม.4/2', period: 'คาบ 5', originalTeacherName: 'คุณครู สมใจ รักสอน', originalTeacherEmail: 'somjai@utd.ac.th', substituteTeacherName: 'คุณครู วิภาดา รักเรียน', substituteTeacherEmail: 'wipada.r@school.ac.th', department: 'กลุ่มสาระการเรียนรู้วิทยาศาสตร์และเทคโนโลยี', isLogged: false, hours: 1 },
  { id: 'h-5', date: '2026-01-28', month: 'ม.ค.', courseCode: 'ศ32101', courseName: 'ศิลปะ 2', room: 'ม.2/3', period: 'คาบ 4', originalTeacherName: 'คุณครู วีณา รื่นรมย์', originalTeacherEmail: 'weena@utd.ac.th', substituteTeacherName: 'นาย เกียรติศักดิ์ ศรีวิไล', substituteTeacherEmail: 'kiattisak@utd.ac.th', department: 'กลุ่มสาระการเรียนรู้ศิลปะ', isLogged: true, hours: 1 },

  // Feb 2026
  { id: 'h-6', date: '2026-02-02', month: 'ก.พ.', courseCode: 'ว31102', courseName: 'วิทยาการคำนวณ 1', room: 'ม.4/2', period: 'คาบ 2', originalTeacherName: 'คุณครู สมใจ รักสอน', originalTeacherEmail: 'somjai@utd.ac.th', substituteTeacherName: 'นาย เกียรติศักดิ์ ศรีวิไล', substituteTeacherEmail: 'kiattisak@utd.ac.th', department: 'กลุ่มสาระการเรียนรู้วิทยาศาสตร์และเทคโนโลยี', isLogged: true, hours: 1 },
  { id: 'h-7', date: '2026-02-05', month: 'ก.พ.', courseCode: 'ค31101', courseName: 'คณิตศาสตร์พื้นฐาน', room: 'ม.1/2', period: 'คาบ 3', originalTeacherName: 'คุณครู มานะ บากบั่น', originalTeacherEmail: 'mana@utd.ac.th', substituteTeacherName: 'นาย เกียรติศักดิ์ ศรีวิไล', substituteTeacherEmail: 'kiattisak@utd.ac.th', department: 'กลุ่มสาระการเรียนรู้คณิตศาสตร์', isLogged: true, hours: 1 },
  { id: 'h-8', date: '2026-02-12', month: 'ก.พ.', courseCode: 'อ32101', courseName: 'ภาษาอังกฤษ 4', room: 'ม.5/2', period: 'คาบ 6', originalTeacherName: 'คุณครูต่างชาติ จอห์น', originalTeacherEmail: 'john@utd.ac.th', substituteTeacherName: 'นาย ก (ครูภาษาไทย)', substituteTeacherEmail: 'teacher@utd.ac.th', department: 'กลุ่มสาระการเรียนรู้ภาษาต่างประเทศ', isLogged: true, hours: 1 },
  { id: 'h-9', date: '2026-02-17', month: 'ก.พ.', courseCode: 'ส31101', courseName: 'สังคมศึกษา 1', room: 'ม.4/3', period: 'คาบ 1', originalTeacherName: 'คุณครู สมเกียรต ดีเด่น', originalTeacherEmail: 'somkiat@utd.ac.th', substituteTeacherName: 'คุณครู วิภาดา รักเรียน', substituteTeacherEmail: 'wipada.r@school.ac.th', department: 'กลุ่มสาระการเรียนรู้สังคมศึกษาฯ', isLogged: true, hours: 1 },
  { id: 'h-10', date: '2026-02-19', month: 'ก.พ.', courseCode: 'ว30101', courseName: 'วิทยาศาสตร์กายภาพ 1', room: 'ม.4/1', period: 'คาบ 2', originalTeacherName: 'คุณครู สมใจ รักสอน', originalTeacherEmail: 'somjai@utd.ac.th', substituteTeacherName: 'คุณครู วีณา รื่นรมย์', substituteTeacherEmail: 'weena@utd.ac.th', department: 'กลุ่มสาระการเรียนรู้วิทยาศาสตร์และเทคโนโลยี', isLogged: true, hours: 1 },
  { id: 'h-11', date: '2026-02-24', month: 'ก.พ.', courseCode: 'ท32101', courseName: 'ภาษาไทย 3', room: 'ม.5/3', period: 'คาบ 3', originalTeacherName: 'นาย ก (ครูภาษาไทย)', originalTeacherEmail: 'teacher@utd.ac.th', substituteTeacherName: 'นาย เกียรติศักดิ์ ศรีวิไล', substituteTeacherEmail: 'kiattisak@utd.ac.th', department: 'กลุ่มสาระการเรียนรู้ภาษาไทย', isLogged: true, hours: 1 },

  // Mar 2026
  { id: 'h-12', date: '2026-03-03', month: 'มี.ค.', courseCode: 'ว31102', courseName: 'วิทยาการคำนวณ 1', room: 'ม.4/1', period: 'คาบ 3', originalTeacherName: 'คุณครู สมใจ รักสอน', originalTeacherEmail: 'somjai@utd.ac.th', substituteTeacherName: 'นาย เกียรติศักดิ์ ศรีวิไล', substituteTeacherEmail: 'kiattisak@utd.ac.th', department: 'กลุ่มสาระการเรียนรู้วิทยาศาสตร์และเทคโนโลยี', isLogged: true, hours: 1 },
  { id: 'h-13', date: '2026-03-05', month: 'มี.ค.', courseCode: 'ค31101', courseName: 'คณิตศาสตร์พื้นฐาน', room: 'ม.1/1', period: 'คาบ 1', originalTeacherName: 'คุณครู มานะ บากบั่น', originalTeacherEmail: 'mana@utd.ac.th', substituteTeacherName: 'คุณครู วิภาดา รักเรียน', substituteTeacherEmail: 'wipada.r@school.ac.th', department: 'กลุ่มสาระการเรียนรู้คณิตศาสตร์', isLogged: true, hours: 1 },
  { id: 'h-14', date: '2026-03-10', month: 'มี.ค.', courseCode: 'ส31101', courseName: 'สังคมศึกษา 1', room: 'ม.4/2', period: 'คาบ 5', originalTeacherName: 'คุณครู สมเกียรต ดีเด่น', originalTeacherEmail: 'somkiat@utd.ac.th', substituteTeacherName: 'นาย เกียรติศักดิ์ ศรีวิไล', substituteTeacherEmail: 'kiattisak@utd.ac.th', department: 'กลุ่มสาระการเรียนรู้สังคมศึกษาฯ', isLogged: true, hours: 1 },
  { id: 'h-15', date: '2026-03-12', month: 'มี.ค.', courseCode: 'อ32101', courseName: 'ภาษาอังกฤษ 4', room: 'ม.5/1', period: 'คาบ 2', originalTeacherName: 'คุณครูต่างชาติ จอห์น', originalTeacherEmail: 'john@utd.ac.th', substituteTeacherName: 'คุณครู วิภาดา รักเรียน', substituteTeacherEmail: 'wipada.r@school.ac.th', department: 'กลุ่มสาระการเรียนรู้ภาษาต่างประเทศ', isLogged: true, hours: 1 },
  { id: 'h-16', date: '2026-03-17', month: 'มี.ค.', courseCode: 'พ31101', courseName: 'สุขศึกษา 1', room: 'ม.3/1', period: 'คาบ 4', originalTeacherName: 'คุณครู วันชัย พลดี', originalTeacherEmail: 'wanchai@utd.ac.th', substituteTeacherName: 'นาย ก (ครูภาษาไทย)', substituteTeacherEmail: 'teacher@utd.ac.th', department: 'กลุ่มสาระการเรียนรู้สุขศึกษาฯ', isLogged: true, hours: 1 },
  { id: 'h-17', date: '2026-03-24', month: 'มี.ค.', courseCode: 'ว30101', courseName: 'วิทยาศาสตร์กายภาพ 1', room: 'ม.4/3', period: 'คาบ 2', originalTeacherName: 'คุณครู สมใจ รักสอน', originalTeacherEmail: 'somjai@utd.ac.th', substituteTeacherName: 'นาย เกียรติศักดิ์ ศรีวิไล', substituteTeacherEmail: 'kiattisak@utd.ac.th', department: 'กลุ่มสาระการเรียนรู้วิทยาศาสตร์และเทคโนโลยี', isLogged: true, hours: 1 },

  // Apr 2026
  { id: 'h-18', date: '2026-04-01', month: 'เม.ย.', courseCode: 'ค31101', courseName: 'คณิตศาสตร์พื้นฐาน', room: 'ม.1/3', period: 'คาบ 3', originalTeacherName: 'คุณครู มานะ บากบั่น', originalTeacherEmail: 'mana@utd.ac.th', substituteTeacherName: 'นาย เกียรติศักดิ์ ศรีวิไล', substituteTeacherEmail: 'kiattisak@utd.ac.th', department: 'กลุ่มสาระการเรียนรู้คณิตศาสตร์', isLogged: true, hours: 1 },
  { id: 'h-19', date: '2026-04-07', month: 'เม.ย.', courseCode: 'ท32101', courseName: 'ภาษาไทย 3', room: 'ม.5/2', period: 'คาบ 2', originalTeacherName: 'นาย ก (ครูภาษาไทย)', originalTeacherEmail: 'teacher@utd.ac.th', substituteTeacherName: 'คุณครู วิภาดา รักเรียน', substituteTeacherEmail: 'wipada.r@school.ac.th', department: 'กลุ่มสาระการเรียนรู้ภาษาไทย', isLogged: true, hours: 1 },
  { id: 'h-20', date: '2026-04-20', month: 'เม.ย.', courseCode: 'ว30101', courseName: 'วิทยาศาสตร์กายภาพ 1', room: 'ม.4/1', period: 'คาบ 6', originalTeacherName: 'คุณครู สมใจ รักสอน', originalTeacherEmail: 'somjai@utd.ac.th', substituteTeacherName: 'คุณครู วีณา รื่นรมย์', substituteTeacherEmail: 'weena@utd.ac.th', department: 'กลุ่มสาระการเรียนรู้วิทยาศาสตร์และเทคโนโลยี', isLogged: true, hours: 1 },

  // May 2026
  { id: 'h-21', date: '2026-05-12', month: 'พ.ค.', courseCode: 'ว31102', courseName: 'วิทยาการคำนวณ 1', room: 'ม.4/1', period: 'คาบ 3', originalTeacherName: 'คุณครู สมใจ รักสอน', originalTeacherEmail: 'somjai@utd.ac.th', substituteTeacherName: 'นาย เกียรติศักดิ์ ศรีวิไล', substituteTeacherEmail: 'kiattisak@utd.ac.th', department: 'กลุ่มสาระการเรียนรู้วิทยาศาสตร์และเทคโนโลยี', isLogged: true, hours: 1 },
  { id: 'h-22', date: '2026-05-14', month: 'พ.ค.', courseCode: 'ค31101', courseName: 'คณิตศาสตร์พื้นฐาน', room: 'ม.1/2', period: 'คาบ 1', originalTeacherName: 'คุณครู มานะ บากบั่น', originalTeacherEmail: 'mana@utd.ac.th', substituteTeacherName: 'คุณครู วิภาดา รักเรียน', substituteTeacherEmail: 'wipada.r@school.ac.th', department: 'กลุ่มสาระการเรียนรู้คณิตศาสตร์', isLogged: true, hours: 1 },
  { id: 'h-23', date: '2026-05-18', month: 'พ.ค.', courseCode: 'ท32101', courseName: 'ภาษาไทย 3', room: 'ม.5/1', period: 'คาบ 2', originalTeacherName: 'นาย ก (ครูภาษาไทย)', originalTeacherEmail: 'teacher@utd.ac.th', substituteTeacherName: 'นาย เกียรติศักดิ์ ศรีวิไล', substituteTeacherEmail: 'kiattisak@utd.ac.th', department: 'กลุ่มสาระการเรียนรู้ภาษาไทย', isLogged: true, hours: 1 },
  { id: 'h-24', date: '2026-05-21', month: 'พ.ค.', courseCode: 'อ32101', courseName: 'ภาษาอังกฤษ 4', room: 'ม.5/3', period: 'คาบ 5', originalTeacherName: 'คุณครูต่างชาติ จอห์น', originalTeacherEmail: 'john@utd.ac.th', substituteTeacherName: 'คุณครู วิภาดา รักเรียน', substituteTeacherEmail: 'wipada.r@school.ac.th', department: 'กลุ่มสาระการเรียนรู้ภาษาต่างประเทศ', isLogged: true, hours: 1 },
  { id: 'h-25', date: '2026-05-25', month: 'พ.ค.', courseCode: 'ศ32101', courseName: 'ศิลปะ 2', room: 'ม.2/2', period: 'คาบ 4', originalTeacherName: 'คุณครู วีณา รื่นรมย์', originalTeacherEmail: 'weena@utd.ac.th', substituteTeacherName: 'นาย ก (ครูภาษาไทย)', substituteTeacherEmail: 'teacher@utd.ac.th', department: 'กลุ่มสาระการเรียนรู้ศิลปะ', isLogged: true, hours: 1 },
  { id: 'h-26', date: '2026-05-28', month: 'พ.ค.', courseCode: 'ส31101', courseName: 'สังคมศึกษา 1', room: 'ม.4/1', period: 'คาบ 7', originalTeacherName: 'คุณครู สมเกียรต ดีเด่น', originalTeacherEmail: 'somkiat@utd.ac.th', substituteTeacherName: 'นาย เกียรติศักดิ์ ศรีวิไล', substituteTeacherEmail: 'kiattisak@utd.ac.th', department: 'กลุ่มสาระการเรียนรู้สังคมศึกษาฯ', isLogged: false, hours: 1 },

  // Jun 2026
  { id: 'h-27', date: '2026-06-02', month: 'มิ.ย.', courseCode: 'ว31102', courseName: 'วิทยาการคำนวณ 1', room: 'ม.4/3', period: 'คาบ 2', originalTeacherName: 'คุณครู สมใจ รักสอน', originalTeacherEmail: 'somjai@utd.ac.th', substituteTeacherName: 'นาย เกียรติศักดิ์ ศรีวิไล', substituteTeacherEmail: 'kiattisak@utd.ac.th', department: 'กลุ่มสาระการเรียนรู้วิทยาศาสตร์และเทคโนโลยี', isLogged: true, hours: 1 },
  { id: 'h-28', date: '2026-06-04', month: 'มิ.ย.', courseCode: 'ค31101', courseName: 'คณิตศาสตร์พื้นฐาน', room: 'ม.1/1', period: 'คาบ 1', originalTeacherName: 'คุณครู มานะ บากบั่น', originalTeacherEmail: 'mana@utd.ac.th', substituteTeacherName: 'คุณครู วิภาดา รักเรียน', substituteTeacherEmail: 'wipada.r@school.ac.th', department: 'กลุ่มสาระการเรียนรู้คณิตศาสตร์', isLogged: true, hours: 1 },
  { id: 'h-29', date: '2026-06-11', month: 'มิ.ย.', courseCode: 'ว30101', courseName: 'วิทยาศาสตร์กายภาพ 1', room: 'ม.4/2', period: 'คาบ 5', originalTeacherName: 'คุณครู สมใจ รักสอน', originalTeacherEmail: 'somjai@utd.ac.th', substituteTeacherName: 'คุณครู วิภาดา รักเรียน', substituteTeacherEmail: 'wipada.r@school.ac.th', department: 'กลุ่มสาระการเรียนรู้วิทยาศาสตร์และเทคโนโลยี', isLogged: true, hours: 1 },
  { id: 'h-30', date: '2026-06-15', month: 'มิ.ย.', courseCode: 'ท32101', courseName: 'ภาษาไทย 3', room: 'ม.5/3', period: 'คาบ 3', originalTeacherName: 'นาย ก (ครูภาษาไทย)', originalTeacherEmail: 'teacher@utd.ac.th', substituteTeacherName: 'คุณครู วีณา รื่นรมย์', substituteTeacherEmail: 'weena@utd.ac.th', department: 'กลุ่มสาระการเรียนรู้ภาษาไทย', isLogged: true, hours: 1 },
  { id: 'h-31', date: '2026-06-18', month: 'มิ.ย.', courseCode: 'อ32101', courseName: 'ภาษาอังกฤษ 4', room: 'ม.5/1', period: 'คาบ 2', originalTeacherName: 'คุณครูต่างชาติ จอห์น', originalTeacherEmail: 'john@utd.ac.th', substituteTeacherName: 'นาย เกียรติศักดิ์ ศรีวิไล', substituteTeacherEmail: 'kiattisak@utd.ac.th', department: 'กลุ่มสาระการเรียนรู้ภาษาต่างประเทศ', isLogged: true, hours: 1 },
  { id: 'h-32', date: '2026-06-23', month: 'มิ.ย.', courseCode: 'ส31101', courseName: 'สังคมศึกษา 1', room: 'ม.4/3', period: 'คาบ 1', originalTeacherName: 'คุณครู สมเกียรต ดีเด่น', originalTeacherEmail: 'somkiat@utd.ac.th', substituteTeacherName: 'คุณครู วิภาดา รักเรียน', substituteTeacherEmail: 'wipada.r@school.ac.th', department: 'กลุ่มสาระการเรียนรู้สังคมศึกษาฯ', isLogged: true, hours: 1 },
  { id: 'h-33', date: '2026-06-29', month: 'มิ.ย.', courseCode: 'ศ32101', courseName: 'ศิลปะ 2', room: 'ม.2/3', period: 'คาบ 4', originalTeacherName: 'คุณครู วีณา รื่นรมย์', originalTeacherEmail: 'weena@utd.ac.th', substituteTeacherName: 'นาย เกียรติศักดิ์ ศรีวิไล', substituteTeacherEmail: 'kiattisak@utd.ac.th', department: 'กลุ่มสาระการเรียนรู้ศิลปะ', isLogged: true, hours: 1 },

  // Jul 2026
  { id: 'h-34', date: '2026-07-02', month: 'ก.ค.', courseCode: 'ว31102', courseName: 'วิทยาการคำนวณ 1', room: 'ม.4/1', period: 'คาบ 3', originalTeacherName: 'คุณครู สมใจ รักสอน', originalTeacherEmail: 'somjai@utd.ac.th', substituteTeacherName: 'นาย เกียรติศักดิ์ ศรีวิไล', substituteTeacherEmail: 'kiattisak@utd.ac.th', department: 'กลุ่มสาระการเรียนรู้วิทยาศาสตร์และเทคโนโลยี', isLogged: true, hours: 1 },
  { id: 'h-35', date: '2026-07-06', month: 'ก.ค.', courseCode: 'ค31101', courseName: 'คณิตศาสตร์พื้นฐาน', room: 'ม.1/2', period: 'คาบ 1', originalTeacherName: 'คุณครู มานะ บากบั่น', originalTeacherEmail: 'mana@utd.ac.th', substituteTeacherName: 'คุณครู วิภาดา รักเรียน', substituteTeacherEmail: 'wipada.r@school.ac.th', department: 'กลุ่มสาระการเรียนรู้คณิตศาสตร์', isLogged: true, hours: 1 },
  { id: 'h-36', date: '2026-07-09', month: 'ก.ค.', courseCode: 'ท32101', courseName: 'ภาษาไทย 3', room: 'ม.5/2', period: 'คาบ 2', originalTeacherName: 'นาย ก (ครูภาษาไทย)', originalTeacherEmail: 'teacher@utd.ac.th', substituteTeacherName: 'คุณครู วีณา รื่นรมย์', substituteTeacherEmail: 'weena@utd.ac.th', department: 'กลุ่มสาระการเรียนรู้ภาษาไทย', isLogged: true, hours: 1 },
  { id: 'h-37', date: '2026-07-13', month: 'ก.ค.', courseCode: 'ว30101', courseName: 'วิทยาศาสตร์กายภาพ 1', room: 'ม.4/1', period: 'คาบ 5', originalTeacherName: 'คุณครู สมใจ รักสอน', originalTeacherEmail: 'somjai@utd.ac.th', substituteTeacherName: 'นาย เกียรติศักดิ์ ศรีวิไล', substituteTeacherEmail: 'kiattisak@utd.ac.th', department: 'กลุ่มสาระการเรียนรู้วิทยาศาสตร์และเทคโนโลยี', isLogged: true, hours: 1 },
  { id: 'h-38', date: '2026-07-15', month: 'ก.ค.', courseCode: 'ศ32101', courseName: 'ศิลปะ 2', room: 'ม.2/3', period: 'คาบ 4', originalTeacherName: 'คุณครู วีณา รื่นรมย์', originalTeacherEmail: 'weena@utd.ac.th', substituteTeacherName: 'คุณครู วิภาดา รักเรียน', substituteTeacherEmail: 'wipada.r@school.ac.th', department: 'กลุ่มสาระการเรียนรู้ศิลปะ', isLogged: false, hours: 1 },
  { id: 'h-39', date: '2026-07-17', month: 'ก.ค.', courseCode: 'ค31101', courseName: 'คณิตศาสตร์พื้นฐาน', room: 'ม.1/1', period: 'คาบ 3', originalTeacherName: 'คุณครู มานะ บากบั่น', originalTeacherEmail: 'mana@utd.ac.th', substituteTeacherName: 'นาย ก (ครูภาษาไทย)', substituteTeacherEmail: 'teacher@utd.ac.th', department: 'กลุ่มสาระการเรียนรู้คณิตศาสตร์', isLogged: true, hours: 1 },
  { id: 'h-40', date: '2026-07-20', month: 'ก.ค.', courseCode: 'อ32101', courseName: 'ภาษาอังกฤษ 4', room: 'ม.5/2', period: 'คาบ 1', originalTeacherName: 'คุณครูต่างชาติ จอห์น', originalTeacherEmail: 'john@utd.ac.th', substituteTeacherName: 'นาย เกียรติศักดิ์ ศรีวิไล', substituteTeacherEmail: 'kiattisak@utd.ac.th', department: 'กลุ่มสาระการเรียนรู้ภาษาต่างประเทศ', isLogged: true, hours: 1 }
];

// List of teachers with position and department
const TEACHER_PROFILES = [
  { name: 'นาย เกียรติศักดิ์ ศรีวิไล', email: 'kiattisak@utd.ac.th', dept: 'กลุ่มสาระการเรียนรู้วิทยาศาสตร์และเทคโนโลยี', position: 'ครู คศ.3 (วิทยฐานะชำนาญการพิเศษ)' },
  { name: 'คุณครู วิภาดา รักเรียน', email: 'wipada.r@school.ac.th', dept: 'กลุ่มสาระการเรียนรู้วิทยาศาสตร์และเทคโนโลยี', position: 'ครู คศ.2 (วิทยฐานะชำนาญการ)' },
  { name: 'คุณครู สมใจ รักสอน', email: 'somjai@utd.ac.th', dept: 'กลุ่มสาระการเรียนรู้วิทยาศาสตร์และเทคโนโลยี', position: 'ครู คศ.1' },
  { name: 'คุณครู มานะ บากบั่น', email: 'mana@utd.ac.th', dept: 'กลุ่มสาระการเรียนรู้คณิตศาสตร์', position: 'ครู คศ.2' },
  { name: 'นาย ก (ครูภาษาไทย)', email: 'teacher@utd.ac.th', dept: 'กลุ่มสาระการเรียนรู้ภาษาไทย', position: 'ครู คศ.1' },
  { name: 'คุณครู วีณา รื่นรมย์', email: 'weena@utd.ac.th', dept: 'กลุ่มสาระการเรียนรู้ศิลปะ', position: 'ครู คศ.2' }
];

const DEPARTMENTS = [
  'กลุ่มสาระการเรียนรู้วิทยาศาสตร์และเทคโนโลยี',
  'กลุ่มสาระการเรียนรู้คณิตศาสตร์',
  'กลุ่มสาระการเรียนรู้ภาษาไทย',
  'กลุ่มสาระการเรียนรู้ภาษาต่างประเทศ',
  'กลุ่มสาระการเรียนรู้ศิลปะ',
  'กลุ่มสาระการเรียนรู้สังคมศึกษาฯ',
  'กลุ่มสาระการเรียนรู้สุขศึกษาฯ'
];

export function SubstituteTeachingAnalyticsModule() {
  const { substituteAssignments, courses, postTeachingRecords } = useStore();

  // --- UI States ---
  const [activeTab, setActiveTab] = useState<'TEACHER' | 'HOD' | 'EXECUTIVE'>('TEACHER');
  
  // Simulated Roles Setup
  const [selectedTeacherEmail, setSelectedTeacherEmail] = useState<string>('kiattisak@utd.ac.th');
  const [selectedHODDept, setSelectedHODDept] = useState<string>('กลุ่มสาระการเรียนรู้วิทยาศาสตร์และเทคโนโลยี');

  // Filters for Tab 2 (HOD)
  const [hodTeacherFilter, setHodTeacherFilter] = useState<string>('ALL');
  const [hodStartDate, setHodStartDate] = useState<string>('2026-01-01');
  const [hodEndDate, setHodEndDate] = useState<string>('2026-07-31');

  // Export Modal state
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<'PDF' | 'EXCEL'>('PDF');
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);

  // Success message toast
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const triggerToast = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => {
      setSuccessToast(null);
    }, 4000);
  };

  // --- Dynamic Store Integration ---
  // Combine historical records and active approved assignments from state store
  const allRecordsMerged = useMemo(() => {
    const activeSubs: SubRecord[] = substituteAssignments.map((sa, index) => {
      const course = courses.find(c => c.id === sa.courseId);
      const isLogged = postTeachingRecords.some(ptr => ptr.courseId === sa.courseId && ptr.date === sa.date);
      const originalTeacher = TEACHER_PROFILES.find(t => t.email === sa.originalTeacherEmail)?.name || sa.originalTeacherEmail;
      const subTeacher = TEACHER_PROFILES.find(t => t.email === sa.substituteTeacherEmail);
      
      const subTeacherName = subTeacher?.name || sa.substituteTeacherEmail;
      const subDept = subTeacher?.dept || 'กลุ่มสาระการเรียนรู้วิทยาศาสตร์และเทคโนโลยี';

      // Map month from date
      let monthStr = 'ก.ค.';
      if (sa.date) {
        const m = parseInt(sa.date.split('-')[1]);
        if (m === 1) monthStr = 'ม.ค.';
        else if (m === 2) monthStr = 'ก.พ.';
        else if (m === 3) monthStr = 'มี.ค.';
        else if (m === 4) monthStr = 'เม.ย.';
        else if (m === 5) monthStr = 'พ.ค.';
        else if (m === 6) monthStr = 'มิ.ย.';
        else if (m === 7) monthStr = 'ก.ค.';
      }

      return {
        id: `store-sub-${sa.id || index}`,
        date: sa.date || '2026-07-21',
        month: monthStr,
        courseCode: course?.code || 'ว30101',
        courseName: course?.name || 'สอนแทนระบบ',
        room: course?.room || 'ม.4/1',
        period: course?.schedule ? `คาบ ${course.schedule.replace(/^\D+/, '')}` : 'คาบ 1',
        originalTeacherName: originalTeacher,
        originalTeacherEmail: sa.originalTeacherEmail,
        substituteTeacherName: subTeacherName,
        substituteTeacherEmail: sa.substituteTeacherEmail,
        department: subDept,
        isLogged: isLogged,
        hours: 1
      };
    });

    return [...activeSubs, ...HISTORICAL_SUB_RECORDS];
  }, [substituteAssignments, courses, postTeachingRecords]);

  // --- TAB 1 Calculations (Teacher) ---
  const teacherProfile = useMemo(() => {
    return TEACHER_PROFILES.find(t => t.email === selectedTeacherEmail) || TEACHER_PROFILES[0];
  }, [selectedTeacherEmail]);

  const teacherRecords = useMemo(() => {
    return allRecordsMerged.filter(r => r.substituteTeacherEmail === selectedTeacherEmail);
  }, [allRecordsMerged, selectedTeacherEmail]);

  const teacherKPIs = useMemo(() => {
    const cumulative = teacherRecords.length;
    const currentMonth = teacherRecords.filter(r => r.month === 'ก.ค.').length;
    const loggedCount = teacherRecords.filter(r => r.isLogged).length;
    const pendingLogCount = cumulative - loggedCount;
    return { cumulative, currentMonth, loggedCount, pendingLogCount };
  }, [teacherRecords]);

  // --- TAB 2 Calculations (Head of Dept) ---
  const deptTeachers = useMemo(() => {
    return TEACHER_PROFILES.filter(t => t.dept === selectedHODDept);
  }, [selectedHODDept]);

  const deptRecords = useMemo(() => {
    return allRecordsMerged.filter(r => r.department === selectedHODDept);
  }, [allRecordsMerged, selectedHODDept]);

  // Bar chart of work distribution within the selected department
  const deptWorkloadChartData = useMemo(() => {
    return deptTeachers.map(t => {
      const hours = deptRecords.filter(r => r.substituteTeacherEmail === t.email).length;
      return {
        name: t.name.split(' ')[1] || t.name, // Just display name without Title
        fullName: t.name,
        hours: hours
      };
    });
  }, [deptTeachers, deptRecords]);

  // Calculate HOD stats & warning threshold
  const deptStats = useMemo(() => {
    const totalHours = deptRecords.length;
    const teacherCount = deptTeachers.length;
    const avg = teacherCount > 0 ? Number((totalHours / teacherCount).toFixed(1)) : 0;
    // Highlight teachers with > avg + 2 hours as high workload
    const highWorkloadThreshold = avg + 1.5;
    return { totalHours, avg, highWorkloadThreshold };
  }, [deptRecords, deptTeachers]);

  // HOD filtered history records
  const hodFilteredRecords = useMemo(() => {
    return deptRecords.filter(r => {
      const matchTeacher = hodTeacherFilter === 'ALL' || r.substituteTeacherEmail === hodTeacherFilter;
      const matchStart = !hodStartDate || r.date >= hodStartDate;
      const matchEnd = !hodEndDate || r.date <= hodEndDate;
      return matchTeacher && matchStart && matchEnd;
    });
  }, [deptRecords, hodTeacherFilter, hodStartDate, hodEndDate]);

  // --- TAB 3 Calculations (Executive Dashboard) ---
  const executiveKPIs = useMemo(() => {
    const totalSchoolHours = allRecordsMerged.length;
    
    // Distribution by dept to find the highest
    const deptCounts: Record<string, number> = {};
    allRecordsMerged.forEach(r => {
      deptCounts[r.department] = (deptCounts[r.department] || 0) + 1;
    });

    let maxDept = 'วิทยาศาสตร์และเทคโนโลยี';
    let maxVal = 0;
    Object.entries(deptCounts).forEach(([dept, count]) => {
      if (count > maxVal) {
        maxVal = count;
        maxDept = dept;
      }
    });

    const loggedTotal = allRecordsMerged.filter(r => r.isLogged).length;
    const successRate = totalSchoolHours > 0 ? ((loggedTotal / totalSchoolHours) * 100).toFixed(1) : '100';

    // Unique participating teachers count
    const uniqueTeachers = new Set(allRecordsMerged.map(r => r.substituteTeacherEmail)).size;

    return {
      totalSchoolHours,
      highestDept: maxDept.replace('กลุ่มสาระการเรียนรู้', ''),
      successRate,
      participatingTeachers: uniqueTeachers
    };
  }, [allRecordsMerged]);

  // Department distribution pie chart
  const deptDistributionChartData = useMemo(() => {
    const deptCounts: Record<string, number> = {};
    allRecordsMerged.forEach(r => {
      const shortDept = r.department.replace('กลุ่มสาระการเรียนรู้', '');
      deptCounts[shortDept] = (deptCounts[shortDept] || 0) + 1;
    });

    return Object.entries(deptCounts).map(([name, value]) => ({
      name,
      value
    })).sort((a, b) => b.value - a.value);
  }, [allRecordsMerged]);

  // Monthly trend chart data
  const monthlyTrendChartData = useMemo(() => {
    const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.'];
    return months.map(m => {
      const count = allRecordsMerged.filter(r => r.month === m).length;
      const logged = allRecordsMerged.filter(r => r.month === m && r.isLogged).length;
      return {
        month: m,
        'จำนวนคาบสอนแทน': count,
        'บันทึกสำเร็จ': logged
      };
    });
  }, [allRecordsMerged]);

  // Top 10 Leaderboard
  const leaderboardData = useMemo(() => {
    const counts: Record<string, { name: string; dept: string; count: number; email: string }> = {};
    allRecordsMerged.forEach(r => {
      if (!counts[r.substituteTeacherEmail]) {
        counts[r.substituteTeacherEmail] = {
          name: r.substituteTeacherName,
          dept: r.department.replace('กลุ่มสาระการเรียนรู้', ''),
          count: 0,
          email: r.substituteTeacherEmail
        };
      }
      counts[r.substituteTeacherEmail].count += 1;
    });

    return Object.values(counts)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [allRecordsMerged]);

  // Formally formatted Print function
  const handleStartExport = (format: 'PDF' | 'EXCEL') => {
    setExportFormat(format);
    setIsExporting(true);
    setExportProgress(0);
    
    const interval = setInterval(() => {
      setExportProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(() => {
            setIsExporting(false);
            setIsExportModalOpen(false);
            triggerToast(`ส่งออกไฟล์ประวัติการสอนแทน (${format}) สำเร็จ! บันทึกไฟล์ลงอุปกรณ์เรียบร้อย`);
          }, 600);
          return 100;
        }
        return prev + 25;
      });
    }, 300);
  };

  const COLORS_PALETTE = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6', '#14b8a6', '#f43f5e'];

  return (
    <div className="w-full bg-[#0a0f18] text-slate-100 min-h-screen font-sans">
      
      {/* Toast Notification */}
      <AnimatePresence>
        {successToast && (
          <motion.div 
            initial={{ opacity: 0, y: -30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-24 right-6 z-50 max-w-sm bg-slate-900 border border-emerald-500/30 text-emerald-100 p-4 rounded-xl shadow-2xl backdrop-blur-md flex gap-2 items-center"
          >
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <span className="text-xs font-semibold">{successToast}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* COMPACT UPPER SWITCHER & TITLE */}
      <div className="bg-slate-950/40 border-b border-slate-800/80 py-5 px-6">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded text-[10px] font-black tracking-widest flex items-center gap-1">
                <Activity className="w-3 h-3" /> ANALYTICS CENTER
              </span>
              <span className="text-[10px] text-slate-500 font-mono">Role-Based Dashboard V1.1</span>
            </div>
            <h1 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
              Substitute Teaching Analytics <span className="text-indigo-400 font-medium text-sm font-mono">| ระบบจำลองสรุปภาระงานและพอร์ทัลสอนแทน</span>
            </h1>
          </div>

          {/* VIEW CONTROLLER TAB SWITCHER */}
          <div className="bg-slate-900/90 border border-slate-800 p-1 rounded-xl flex self-start lg:self-center">
            <button
              onClick={() => setActiveTab('TEACHER')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5",
                activeTab === 'TEACHER'
                  ? "bg-indigo-600 text-white shadow-md"
                  : "text-slate-400 hover:text-slate-200"
              )}
            >
              <User className="w-3.5 h-3.5" /> ครูผู้สอนรายคน
            </button>
            <button
              onClick={() => setActiveTab('HOD')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5",
                activeTab === 'HOD'
                  ? "bg-indigo-600 text-white shadow-md"
                  : "text-slate-400 hover:text-slate-200"
              )}
            >
              <Users className="w-3.5 h-3.5" /> หัวหน้ากลุ่มสาระฯ
            </button>
            <button
              onClick={() => setActiveTab('EXECUTIVE')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5",
                activeTab === 'EXECUTIVE'
                  ? "bg-indigo-600 text-white shadow-md"
                  : "text-slate-400 hover:text-slate-200"
              )}
            >
              <Award className="w-3.5 h-3.5" /> คณะผู้บริหาร / EIS
            </button>
          </div>
        </div>
      </div>

      {/* SUB-DASHBOARD BAR FOR CURRENTLY SELECTED SIMULATION */}
      <div className="max-w-7xl mx-auto px-6 mt-6">
        {activeTab === 'TEACHER' && (
          <div className="bg-[#111827]/80 border border-indigo-500/10 p-3 px-4 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs text-indigo-300">
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 text-indigo-400 shrink-0" />
              <span className="font-bold">จำลองสิทธิ์: ครูผู้สอน (เช็กชั่วโมงการทำงานและเตรียมทำประเมิน PA)</span>
            </div>
            <div className="flex items-center gap-2 font-medium">
              <span>สลับครูผู้สอนสมมติเพื่อดูประวัติรายบุคคล:</span>
              <select
                value={selectedTeacherEmail}
                onChange={e => setSelectedTeacherEmail(e.target.value)}
                className="bg-slate-950 text-slate-100 border border-slate-800 rounded-lg p-1.5 px-2.5 text-[11px] font-semibold outline-none focus:border-indigo-500"
              >
                <option value="kiattisak@utd.ac.th">นาย เกียรติศักดิ์ ศรีวิไล</option>
                <option value="wipada.r@school.ac.th">คุณครู วิภาดา รักเรียน</option>
                <option value="teacher@utd.ac.th">นาย ก (ครูภาษาไทย)</option>
                <option value="weena@utd.ac.th">คุณครู วีณา รื่นรมย์</option>
              </select>
            </div>
          </div>
        )}

        {activeTab === 'HOD' && (
          <div className="bg-[#111827]/80 border border-amber-500/10 p-3 px-4 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs text-amber-300">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="font-bold">จำลองสิทธิ์: หัวหน้ากลุ่มสาระวิชา (ตรวจสอบกระจายภาระงานสอนแทนคนในสังกัด)</span>
            </div>
            <div className="flex items-center gap-2 font-medium">
              <span>เลือกกลุ่มสาระการเรียนรู้ที่ท่านดูแล:</span>
              <select
                value={selectedHODDept}
                onChange={e => {
                  setSelectedHODDept(e.target.value);
                  setHodTeacherFilter('ALL'); // Reset teacher filter when changing dept
                }}
                className="bg-slate-950 text-slate-100 border border-slate-800 rounded-lg p-1.5 px-2.5 text-[11px] font-semibold outline-none focus:border-amber-500"
              >
                <option value="กลุ่มสาระการเรียนรู้วิทยาศาสตร์และเทคโนโลยี">กลุ่มสาระฯ วิทยาศาสตร์และเทคโนโลยี</option>
                <option value="กลุ่มสาระการเรียนรู้คณิตศาสตร์">กลุ่มสาระฯ คณิตศาสตร์</option>
                <option value="กลุ่มสาระการเรียนรู้ภาษาไทย">กลุ่มสาระฯ ภาษาไทย</option>
                <option value="กลุ่มสาระการเรียนรู้ศิลปะ">กลุ่มสาระฯ ศิลปะ</option>
              </select>
            </div>
          </div>
        )}

        {activeTab === 'EXECUTIVE' && (
          <div className="bg-[#111827]/80 border border-emerald-500/10 p-3 px-4 rounded-xl flex items-center gap-2 text-xs text-emerald-300">
            <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-bold">
              จำลองสิทธิ์: ผู้อำนวยการสถานศึกษา / ผู้ช่วย ผอ. วิชาการ (EIS Dashboard - ตรวจสอบภาพรวมและครูจิตอาสา)
            </span>
          </div>
        )}
      </div>

      {/* MAIN RENDER AREAS */}
      <div className="max-w-7xl mx-auto px-6 mt-6 pb-12">
        <AnimatePresence mode="wait">
          
          {/* TAB 1: TEACHER VIEW */}
          {activeTab === 'TEACHER' && (
            <motion.div
              key="teacher"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              {/* Profile Card & Info banner */}
              <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500/20 to-indigo-600/30 border border-indigo-500/30 flex items-center justify-center text-indigo-400 text-lg font-bold">
                    {teacherProfile.name.charAt(0) === 'น' ? 'น' : 'ค'}
                  </div>
                  <div>
                    <h2 className="text-base font-extrabold text-white">{teacherProfile.name}</h2>
                    <p className="text-xs text-slate-400 mt-1">{teacherProfile.position} | สังกัด {teacherProfile.dept}</p>
                  </div>
                </div>

                <button
                  onClick={() => setIsExportModalOpen(true)}
                  className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-md shadow-indigo-600/15 shrink-0"
                >
                  <FileDown className="w-4 h-4" /> ส่งออกรายงานภาระงานสอนแทน (PA)
                </button>
              </div>

              {/* KPI Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-[#0f1422] border border-slate-800 p-5 rounded-2xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 text-indigo-500/10">
                    <Award className="w-16 h-16" />
                  </div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">ภาระงานสะสมภาคเรียนนี้</span>
                  <div className="text-3xl font-black text-indigo-400 mt-2 font-mono">{teacherKPIs.cumulative} <span className="text-sm font-medium text-slate-400">คาบสอน</span></div>
                  <p className="text-[10px] text-slate-500 mt-1">อัปเดตระบบ ณ วันที่ {new Date().toLocaleDateString('th-TH')}</p>
                </div>

                <div className="bg-[#0f1422] border border-slate-800 p-5 rounded-2xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 text-emerald-500/10">
                    <Calendar className="w-16 h-16" />
                  </div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">คาบสอนแทนในเดือนปัจจุบัน</span>
                  <div className="text-3xl font-black text-emerald-400 mt-2 font-mono">{teacherKPIs.currentMonth} <span className="text-sm font-medium text-slate-400">คาบสอน</span></div>
                  <p className="text-[10px] text-slate-500 mt-1">ประจำเดือน กรกฎาคม 2026</p>
                </div>

                <div className="bg-[#0f1422] border border-slate-800 p-5 rounded-2xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 text-blue-500/10">
                    <CheckCircle className="w-16 h-16" />
                  </div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">ส่งบันทึกหลังสอนเสร็จสิ้น</span>
                  <div className="text-3xl font-black text-blue-400 mt-2 font-mono">{teacherKPIs.loggedCount} <span className="text-sm font-medium text-slate-400">คาบเรียน</span></div>
                  <p className="text-[10px] text-slate-500 mt-1">ร้อยละ {teacherKPIs.cumulative > 0 ? ((teacherKPIs.loggedCount / teacherKPIs.cumulative) * 100).toFixed(0) : '100'} ของภาระงานสะสม</p>
                </div>

                <div className="bg-[#0f1422] border border-slate-800 p-5 rounded-2xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 text-amber-500/10">
                    <Clock className="w-16 h-16" />
                  </div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">รอดำเนินการเขียนสรุปแผน</span>
                  <div className="text-3xl font-black text-amber-400 mt-2 font-mono">{teacherKPIs.pendingLogCount} <span className="text-sm font-medium text-slate-400">คาบเรียน</span></div>
                  <p className="text-[10px] text-slate-500 mt-1">กรุณากรอกบันทึกหลังสอนแทนเพื่อยืนยันชั่วโมง</p>
                </div>
              </div>

              {/* Personal history Table */}
              <div className="bg-[#0f1422] border border-slate-800/80 rounded-2xl overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-800/80 flex justify-between items-center bg-slate-950/20">
                  <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                    <FileText className="w-4 h-4 text-indigo-400" />
                    ประวัติปฏิบัติการสอนแทนรายชั่วโมง
                  </h3>
                  <span className="bg-slate-800 text-slate-300 border border-slate-700 px-2.5 py-0.5 rounded text-[10px] font-bold font-mono">
                    ประวัติ {teacherRecords.length} คาบ
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-950/60 text-slate-300 font-bold border-b border-slate-800/60">
                      <tr>
                        <th className="px-6 py-3.5">วันที่ปฏิบัติการ</th>
                        <th className="px-6 py-3.5">คาบสอน</th>
                        <th className="px-6 py-3.5">รายวิชา</th>
                        <th className="px-6 py-3.5">ห้องเรียน</th>
                        <th className="px-6 py-3.5">ปฏิบัติหน้าที่แทน</th>
                        <th className="px-6 py-3.5">สถานะบันทึกแผนสรุป</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-slate-300">
                      {teacherRecords.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                            <Info className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                            ไม่มีข้อมูลปฏิบัติการสอนแทนของครูท่านนี้ในประวัติ
                          </td>
                        </tr>
                      ) : (
                        teacherRecords.map(rec => (
                          <tr key={rec.id} className="hover:bg-slate-900/30 transition-colors">
                            <td className="px-6 py-3.5 font-mono">{rec.date}</td>
                            <td className="px-6 py-3.5 text-slate-400">{rec.period}</td>
                            <td className="px-6 py-3.5">
                              <span className="font-bold text-white">{rec.courseCode}</span>
                              <span className="text-slate-400 ml-2">{rec.courseName}</span>
                            </td>
                            <td className="px-6 py-3.5 font-mono text-indigo-400 font-semibold">{rec.room}</td>
                            <td className="px-6 py-3.5 text-slate-200">{rec.originalTeacherName}</td>
                            <td className="px-6 py-3.5">
                              {rec.isLogged ? (
                                <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 w-max">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> ส่งบันทึกแล้ว
                                </span>
                              ) : (
                                <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 w-max">
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span> รอดำเนินการ
                                </span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}

          {/* TAB 2: HEAD OF DEPT VIEW */}
          {activeTab === 'HOD' && (
            <motion.div
              key="hod"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              {/* Dept Summary & Workload Alert Threshold Banner */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* Visual Bar Chart of work distribution */}
                <div className="bg-[#0f1422] border border-slate-800/80 p-5 rounded-2xl md:col-span-2 space-y-4">
                  <div className="flex justify-between items-center border-b border-slate-800/80 pb-3">
                    <div>
                      <h3 className="text-xs font-black text-amber-400 uppercase tracking-widest">WORKLOAD DISTRIBUTION CHART</h3>
                      <h4 className="text-sm font-extrabold text-white mt-1">เปรียบเทียบภาระงานสอนแทนของครูรายบุคคลในกลุ่มสาระฯ</h4>
                    </div>
                    <span className="bg-slate-800 text-slate-300 px-2.5 py-0.5 rounded text-[10px] font-mono">
                      {selectedHODDept.replace('กลุ่มสาระการเรียนรู้', '')}
                    </span>
                  </div>

                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={deptWorkloadChartData}
                        margin={{ top: 20, right: 10, left: -20, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                        <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} />
                        <YAxis stroke="#64748b" fontSize={11} allowDecimals={false} />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#090d16', borderColor: '#334155' }}
                          labelStyle={{ color: '#ffffff', fontWeight: 'bold' }}
                        />
                        <Bar dataKey="hours" name="จำนวนชั่วโมงสอนแทนสะสม" fill="#6366f1" radius={[4, 4, 0, 0]}>
                          {deptWorkloadChartData.map((entry, index) => {
                            const isOver = entry.hours > deptStats.highWorkloadThreshold;
                            return (
                              <Cell 
                                key={`cell-${index}`} 
                                fill={isOver ? '#f59e0b' : '#6366f1'} 
                              />
                            );
                          })}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="flex gap-4 text-[10px] text-slate-400 border-t border-slate-800/60 pt-2 justify-end">
                    <div className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded bg-indigo-500 inline-block"></span>
                      <span>ภาระงานปกติ</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded bg-amber-500 inline-block"></span>
                      <span>สูงกว่าค่าเฉลี่ยสังกัด (เกินสมดุล)</span>
                    </div>
                  </div>
                </div>

                {/* KPI Sidebar Stats & Badges */}
                <div className="bg-[#0f1422] border border-slate-800/80 p-5 rounded-2xl space-y-4 flex flex-col justify-between">
                  <div className="space-y-4">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-800/80 pb-3">ภาระงานรวมสังกัด</h3>
                    
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase">รวมคาบสอนแทนสะสม</span>
                      <div className="text-4xl font-black text-indigo-400 mt-1 font-mono">{deptStats.totalHours} <span className="text-xs text-slate-400 font-normal">คาบเรียน</span></div>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-500 uppercase">อัตราเฉลี่ยรายบุคคล</span>
                      <div className="text-2xl font-black text-emerald-400 mt-1 font-mono">{deptStats.avg} <span className="text-xs text-slate-400 font-normal">คาบ/คน</span></div>
                    </div>

                    <div className="border-t border-slate-800/80 pt-3">
                      <span className="text-[10px] text-slate-500 uppercase block mb-1.5">ตรวจคัดกรองความเท่าเทียม (Equitable Workload Check)</span>
                      
                      {/* Check if any teacher is higher than average */}
                      {deptWorkloadChartData.some(entry => entry.hours > deptStats.highWorkloadThreshold) ? (
                        <div className="bg-amber-500/10 border border-amber-500/20 text-amber-300 p-3 rounded-xl space-y-2 text-[11px] leading-relaxed">
                          <div className="flex items-center gap-1.5 font-bold">
                            <AlertTriangle className="w-4 h-4 text-amber-500" />
                            พบคู่สัญญาที่มีภาระเกินสมดุล!
                          </div>
                          <div className="space-y-1">
                            {deptWorkloadChartData
                              .filter(entry => entry.hours > deptStats.highWorkloadThreshold)
                              .map(entry => (
                                <div key={entry.fullName} className="flex justify-between font-medium">
                                  <span>• {entry.fullName}</span>
                                  <span className="bg-amber-500/20 text-amber-300 px-1.5 rounded text-[9px] font-bold">ภาระงานสูงเกินเกณฑ์ ({entry.hours} คาบ)</span>
                                </div>
                              ))}
                          </div>
                          <p className="text-[10px] text-slate-400 pt-1 border-t border-amber-500/15">
                            *กรุณาจัดบุคลากรท่านอื่นที่มีเวลาสอนว่าตรงกันเข้าปฏิบัติหน้าที่แทนในคำขอถัดไป เพื่อเกลี่ยภาระงาน
                          </p>
                        </div>
                      ) : (
                        <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 p-3 rounded-xl text-[11px] flex items-center gap-1.5">
                          <CheckCircle className="w-4 h-4 text-emerald-500" />
                          การกระจายภาระงานปัจจุบันเป็นไปตามมาตรฐานที่เท่าเทียม
                        </div>
                      )}
                    </div>
                  </div>

                  <p className="text-[10px] text-slate-500">เกณฑ์คำนวณ: คณะครูในสังกัดที่มีชั่วโมงปฏิบัติเกินค่าเฉลี่ยกลุ่มสาระมากกว่า +1.5 คาบ</p>
                </div>

              </div>

              {/* Department assignments and interactive filters */}
              <div className="bg-[#0f1422] border border-slate-800/80 rounded-2xl p-5 space-y-4">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
                  <div>
                    <h3 className="text-sm font-extrabold text-white flex items-center gap-1.5">
                      <Filter className="w-4 h-4 text-amber-400" /> ตารางประวัติและตัวกรองค้นหาภาระในกลุ่มสาระฯ
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">ใช้ตรวจสอบประวัติการสอนแทนรายวัน หรือกรองเฉพาะคุณครูที่ประสงค์เช็กชั่วโมงการสอน</p>
                  </div>

                  {/* Filters selectors */}
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-1.5 text-xs text-slate-400">
                      <span>กรองคุณครู:</span>
                      <select
                        value={hodTeacherFilter}
                        onChange={e => setHodTeacherFilter(e.target.value)}
                        className="bg-slate-950 text-slate-100 border border-slate-800 rounded-lg p-1.5 px-2.5 text-[11px] font-semibold outline-none focus:border-amber-500"
                      >
                        <option value="ALL">-- ครูทุกคนในสังกัด --</option>
                        {deptTeachers.map(t => (
                          <option key={t.email} value={t.email}>{t.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="flex items-center gap-1 text-xs text-slate-400">
                      <span>จาก:</span>
                      <input
                        type="date"
                        value={hodStartDate}
                        onChange={e => setHodStartDate(e.target.value)}
                        className="bg-slate-950 text-slate-100 border border-slate-800 rounded-lg p-1 px-2 text-[10px] font-mono"
                      />
                      <span>ถึง:</span>
                      <input
                        type="date"
                        value={hodEndDate}
                        onChange={e => setHodEndDate(e.target.value)}
                        className="bg-slate-950 text-slate-100 border border-slate-800 rounded-lg p-1 px-2 text-[10px] font-mono"
                      />
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-950/40 text-slate-300 font-bold border-b border-slate-800/60">
                      <tr>
                        <th className="px-5 py-3">วันที่</th>
                        <th className="px-5 py-3">ครูผู้สอนแทน</th>
                        <th className="px-5 py-3">วิชาที่แทน / คาบ</th>
                        <th className="px-5 py-3">ห้อง</th>
                        <th className="px-5 py-3">แทนอาจารย์</th>
                        <th className="px-5 py-3">สถานะผลเรียน</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-slate-300">
                      {hodFilteredRecords.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-5 py-8 text-center text-slate-500">
                            ไม่พบรายการที่ตรงตามเงื่อนไขการค้นหาในช่วงเวลาดังกล่าว
                          </td>
                        </tr>
                      ) : (
                        hodFilteredRecords.map(rec => (
                          <tr key={rec.id} className="hover:bg-slate-900/20 transition-colors">
                            <td className="px-5 py-3 font-mono">{rec.date}</td>
                            <td className="px-5 py-3 font-bold text-slate-200">{rec.substituteTeacherName}</td>
                            <td className="px-5 py-3">
                              <span className="font-semibold">{rec.courseCode}</span>
                              <span className="text-slate-500 ml-1.5 font-mono text-[10px]">{rec.period}</span>
                            </td>
                            <td className="px-5 py-3 font-mono text-indigo-400 font-semibold">{rec.room}</td>
                            <td className="px-5 py-3 text-slate-400">{rec.originalTeacherName}</td>
                            <td className="px-5 py-3">
                              {rec.isLogged ? (
                                <span className="bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded text-[10px] font-bold">
                                  บันทึกครบถ้วน
                                </span>
                              ) : (
                                <span className="bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded text-[10px] font-bold">
                                  รอดำเนินการ
                                </span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}

          {/* TAB 3: EXECUTIVE VIEW */}
          {activeTab === 'EXECUTIVE' && (
            <motion.div
              key="executive"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              {/* Top EIS 4 Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                
                <div className="bg-[#0f1422] border border-slate-800 p-5 rounded-2xl relative overflow-hidden">
                  <span className="text-[10px] text-slate-400 uppercase font-black tracking-widest block">รวมคาบสอนแทนสะสมทั้งโรงเรียน</span>
                  <div className="text-3xl font-black text-indigo-400 mt-2 font-mono">
                    {executiveKPIs.totalSchoolHours} <span className="text-xs font-normal text-slate-400">คาบเรียน</span>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">ปีการศึกษา 1/2569</p>
                </div>

                <div className="bg-[#0f1422] border border-slate-800 p-5 rounded-2xl relative overflow-hidden">
                  <span className="text-[10px] text-slate-400 uppercase font-black tracking-widest block">กลุ่มสาระที่มีอัตราสูงสุด</span>
                  <div className="text-base font-black text-amber-400 mt-2.5 truncate" title={executiveKPIs.highestDept}>
                    {executiveKPIs.highestDept}
                  </div>
                  <p className="text-[10px] text-slate-500 mt-2">ต้องการความช่วยเหลือบ่อยที่สุด</p>
                </div>

                <div className="bg-[#0f1422] border border-slate-800 p-5 rounded-2xl relative overflow-hidden">
                  <span className="text-[10px] text-slate-400 uppercase font-black tracking-widest block">ร้อยละการจัดสอนแทนสำเร็จ</span>
                  <div className="text-3xl font-black text-emerald-400 mt-2 font-mono">
                    {executiveKPIs.successRate}%
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">มีการส่งบันทึกการสอนหลังเข้าทำหน้าที่</p>
                </div>

                <div className="bg-[#0f1422] border border-slate-800 p-5 rounded-2xl relative overflow-hidden">
                  <span className="text-[10px] text-slate-400 uppercase font-black tracking-widest block">จำนวนบุคลากรที่ร่วมสลับเวร</span>
                  <div className="text-3xl font-black text-blue-400 mt-2 font-mono">
                    {executiveKPIs.participatingTeachers} <span className="text-xs font-normal text-slate-400">ท่าน</span>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">จากผู้ประสงค์จิตสาธารณะสะสม</p>
                </div>

              </div>

              {/* Charts Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* Department distribution Pie Chart */}
                <div className="bg-[#0f1422] border border-slate-800/80 p-5 rounded-2xl space-y-4">
                  <div>
                    <h3 className="text-xs font-black text-indigo-400 uppercase tracking-widest">SUBSTITUTION BY DEPARTMENTS</h3>
                    <h4 className="text-sm font-extrabold text-white mt-1">สัดส่วนและปริมาณการสอนแทนจำแนกตามสาระการเรียนรู้</h4>
                  </div>

                  <div className="h-64 flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="w-full md:w-1/2 h-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={deptDistributionChartData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={4}
                            dataKey="value"
                          >
                            {deptDistributionChartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS_PALETTE[index % COLORS_PALETTE.length]} />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={{ backgroundColor: '#090d16', borderColor: '#334155' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Custom Legend to fit design constraint and not clip */}
                    <div className="w-full md:w-1/2 overflow-y-auto max-h-[220px] pr-2 space-y-1.5 text-[10px]">
                      {deptDistributionChartData.map((entry, idx) => (
                        <div key={entry.name} className="flex items-center justify-between text-slate-300">
                          <div className="flex items-center gap-1.5 truncate">
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: COLORS_PALETTE[idx % COLORS_PALETTE.length] }}></span>
                            <span className="truncate">{entry.name}</span>
                          </div>
                          <span className="font-mono font-bold text-white pl-2">{entry.value} คาบ</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Monthly Trend Area Line Chart */}
                <div className="bg-[#0f1422] border border-slate-800/80 p-5 rounded-2xl space-y-4">
                  <div>
                    <h3 className="text-xs font-black text-emerald-400 uppercase tracking-widest">MONTHLY SUBSTITUTION TREND</h3>
                    <h4 className="text-sm font-extrabold text-white mt-1">แนวโน้มสถิติจำนวนคาบสอนแทนสะสมรายเดือน</h4>
                  </div>

                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={monthlyTrendChartData}
                        margin={{ top: 15, right: 10, left: -20, bottom: 5 }}
                      >
                        <defs>
                          <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2}/>
                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                          </linearGradient>
                          <linearGradient id="colorLogged" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                        <XAxis dataKey="month" stroke="#64748b" fontSize={11} />
                        <YAxis stroke="#64748b" fontSize={11} allowDecimals={false} />
                        <Tooltip contentStyle={{ backgroundColor: '#090d16', borderColor: '#334155' }} />
                        <Legend wrapperStyle={{ fontSize: 10, color: '#94a3b8' }} />
                        <Area type="monotone" dataKey="จำนวนคาบสอนแทน" stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill="url(#colorCount)" />
                        <Area type="monotone" dataKey="บันทึกสำเร็จ" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorLogged)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

              </div>

              {/* Leaderboard Section of public-minded teachers */}
              <div className="bg-[#0f1422] border border-slate-800/80 rounded-2xl p-5 space-y-4">
                <div className="border-b border-slate-800/80 pb-3">
                  <h3 className="text-sm font-extrabold text-white flex items-center gap-1.5">
                    <AwardIcon className="w-5 h-5 text-emerald-400" />
                    ทำเนียบอันดับครูจิตสาธารณะช่วยสอนแทนสูงสุดประจำปีการศึกษา (Top 10 Public-Minded Teachers)
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    ระบบดึงข้อมูลชั่วโมงบันทึกสอนแทนที่ได้รับการอนุมัติและเขียนสรุปแผนการเข้าปฏิบัติการสอนของอาจารย์ทุกท่านมาคำนวณแบบสด
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Rank 1 to 5 */}
                  <div className="space-y-2.5">
                    {leaderboardData.slice(0, 5).map((teacher, index) => (
                      <div 
                        key={teacher.email}
                        className={cn(
                          "p-3.5 rounded-xl border flex items-center justify-between gap-4 transition-all hover:translate-x-1 duration-200",
                          index === 0 ? "bg-amber-500/5 border-amber-500/20" :
                          index === 1 ? "bg-slate-400/5 border-slate-400/20" :
                          index === 2 ? "bg-yellow-700/5 border-yellow-700/20" :
                          "bg-slate-900/40 border-slate-800/80"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-7 h-7 rounded-lg font-black text-xs flex items-center justify-center font-mono border",
                            index === 0 ? "bg-amber-500/10 text-amber-400 border-amber-500/30" :
                            index === 1 ? "bg-slate-400/10 text-slate-300 border-slate-400/30" :
                            index === 2 ? "bg-yellow-700/10 text-yellow-500 border-yellow-700/30" :
                            "bg-slate-800 text-slate-400 border-slate-700"
                          )}>
                            {index + 1}
                          </div>
                          <div>
                            <h4 className="text-xs font-bold text-slate-200">{teacher.name}</h4>
                            <p className="text-[10px] text-slate-500 mt-0.5">{teacher.dept}</p>
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="text-xs font-bold text-indigo-400 font-mono">{teacher.count} คาบ</span>
                          <span className="text-[9px] text-slate-500 block">เกียรติบัตรระดับทอง</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Rank 6 to 10 */}
                  <div className="space-y-2.5">
                    {leaderboardData.slice(5, 10).map((teacher, index) => (
                      <div 
                        key={teacher.email}
                        className="p-3.5 rounded-xl border bg-slate-900/40 border-slate-800/80 flex items-center justify-between gap-4 transition-all hover:translate-x-1 duration-200"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-7 h-7 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 font-black text-xs flex items-center justify-center font-mono">
                            {index + 6}
                          </div>
                          <div>
                            <h4 className="text-xs font-bold text-slate-200">{teacher.name}</h4>
                            <p className="text-[10px] text-slate-500 mt-0.5">{teacher.dept}</p>
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="text-xs font-bold text-indigo-400 font-mono">{teacher.count} คาบ</span>
                          <span className="text-[9px] text-slate-500 block">เกียรติบัตรระดับดี</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      {/* DETAILED GOVERNMENT MINISTRY REPORT PREVIEW MODAL */}
      <AnimatePresence>
        {isExportModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white text-slate-900 max-w-4xl w-full rounded-2xl shadow-2xl overflow-hidden my-8"
            >
              {/* Header Bar */}
              <div className="bg-slate-900 text-white px-6 py-4 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Printer className="w-5 h-5 text-indigo-400" />
                  <span className="font-extrabold text-sm tracking-tight">พรีวิวเอกสารรายงานภาระงานสอนแทนประกอบประเมินข้อตกลงในการพัฒนางาน (PA)</span>
                </div>
                <button 
                  onClick={() => setIsExportModalOpen(false)}
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Printable Area Wrapper */}
              <div className="p-8 bg-slate-100 overflow-x-auto max-h-[65vh] overflow-y-auto">
                <div className="w-[790px] mx-auto bg-white p-12 shadow-md border border-slate-300 rounded text-[13px] font-serif leading-relaxed text-slate-900 relative">
                  
                  {/* Mock Garuda Emblem in SVG */}
                  <div className="w-14 h-14 mx-auto mb-4 flex items-center justify-center text-red-700">
                    <svg viewBox="0 0 100 100" className="w-full h-full fill-current">
                      <path d="M50 0 C47 20 20 20 5 35 C15 55 40 50 50 100 C60 50 85 55 95 35 C80 20 53 20 50 0 Z" opacity="0.8" />
                      <circle cx="50" cy="40" r="12" fill="white" />
                      <path d="M44 40 L56 40 L50 30 Z" fill="red" />
                    </svg>
                  </div>

                  {/* Ministry document headers */}
                  <div className="text-center font-bold space-y-1 mb-8">
                    <h3 className="text-base">รายงานการปฏิบัติการสอนแทนบุคคลผู้ลากิจ/ลาป่วย</h3>
                    <h4 className="text-sm">โรงเรียนอุตรดิตถ์ดรุณี สำนักงานเขตพื้นที่การศึกษามัธยมศึกษาพิษณุโลก อุตรดิตถ์</h4>
                    <p className="text-xs font-normal text-slate-500">สำหรับประกอบการเสนอแนบข้อตกลงในการพัฒนางาน (Performance Agreement: PA)</p>
                  </div>

                  {/* Document metadata table info */}
                  <div className="grid grid-cols-2 gap-4 mb-6 border-b border-slate-300 pb-4 text-xs font-sans">
                    <div>
                      <span className="font-bold">ข้อมูลผู้รับการปฏิบัติหน้าที่แทน:</span> {teacherProfile.name}
                    </div>
                    <div>
                      <span className="font-bold">กลุ่มสาระการเรียนรู้:</span> {teacherProfile.dept}
                    </div>
                    <div>
                      <span className="font-bold">ตำแหน่ง/วิทยฐานะ:</span> {teacherProfile.position}
                    </div>
                    <div>
                      <span className="font-bold">ปีการศึกษา:</span> 1/2569
                    </div>
                  </div>

                  {/* Core List Table of teacher's replacements */}
                  <table className="w-full text-left text-xs border-collapse border border-slate-400 font-sans mb-8">
                    <thead>
                      <tr className="bg-slate-100 text-slate-800 border-b border-slate-400">
                        <th className="border-r border-slate-400 p-2 font-bold text-center w-12">ลำดับ</th>
                        <th className="border-r border-slate-400 p-2 font-bold text-center w-28">วันที่-เวลา</th>
                        <th className="border-r border-slate-400 p-2 font-bold text-center w-20">รหัสวิชา</th>
                        <th className="border-r border-slate-400 p-2 font-bold">ชื่อวิชา</th>
                        <th className="border-r border-slate-400 p-2 font-bold text-center w-16">ห้องเรียน</th>
                        <th className="border-r border-slate-400 p-2 font-bold text-center w-28">ผู้ซึ่งลากิจ/ลาป่วย</th>
                        <th className="p-2 font-bold text-center w-16">จำนวน (คาบ)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {teacherRecords.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="p-4 text-center text-slate-400 italic">ไม่มีบันทึกประวัติการสอนแทนที่ได้รับการจดแจ้ง</td>
                        </tr>
                      ) : (
                        teacherRecords.map((rec, idx) => (
                          <tr key={rec.id} className="border-b border-slate-400">
                            <td className="border-r border-slate-400 p-2 text-center font-mono">{idx + 1}</td>
                            <td className="border-r border-slate-400 p-2 text-center font-mono">{rec.date} ({rec.period})</td>
                            <td className="border-r border-slate-400 p-2 text-center font-mono font-bold">{rec.courseCode}</td>
                            <td className="border-r border-slate-400 p-2">{rec.courseName}</td>
                            <td className="border-r border-slate-400 p-2 text-center font-mono">{rec.room}</td>
                            <td className="border-r border-slate-400 p-2">{rec.originalTeacherName}</td>
                            <td className="p-2 text-center font-mono">{rec.hours}</td>
                          </tr>
                        ))
                      )}
                      
                      {/* Total summaries */}
                      <tr className="bg-slate-50 font-bold border-t border-slate-400">
                        <td colSpan={6} className="border-r border-slate-400 p-2 text-right">รวมจำนวนชั่วโมงปฏิบัติการสอนแทนสะสมภาคเรียนนี้:</td>
                        <td className="p-2 text-center font-mono text-indigo-600 font-black">{teacherKPIs.cumulative} คาบ</td>
                      </tr>
                    </tbody>
                  </table>

                  {/* Form signature sections */}
                  <div className="grid grid-cols-2 gap-8 pt-8 text-xs font-sans">
                    <div className="text-center space-y-12">
                      <p>ลงชื่อ........................................................ ผู้บันทึกภาระงาน<br />({teacherProfile.name})<br />ครูผู้ปฎิบัติการแทนชั่วคราว</p>
                    </div>

                    <div className="text-center space-y-12">
                      <p>ลงชื่อ........................................................ ผู้ตรวจสอบ/รับรอง<br />(........................................................)<br />หัวหน้ากลุ่มสาระการเรียนรู้</p>
                    </div>

                    <div className="text-center col-span-2 pt-8 space-y-12 border-t border-slate-200">
                      <p>ลงชื่อ........................................................ ผู้อนุมัติรับรองชั่วโมงวิชาการ<br />(ดร. สมเกียรติ ยอดเยี่ยม)<br />ผู้ช่วยผู้อำนวยการฝ่ายการบริหารงานวิชาการ</p>
                    </div>
                  </div>

                </div>
              </div>

              {/* Action Buttons with Mock Download Loader */}
              <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="text-xs text-slate-500">
                  *ข้อมูลได้รับการลงนามความสอดคล้องตามมาตรฐานหลักสูตรแกนกลาง 2551 สพม. พิษณุโลก อุตรดิตถ์
                </div>

                <div className="flex gap-2">
                  <button 
                    onClick={() => setIsExportModalOpen(false)}
                    className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-xl text-xs font-bold transition-all"
                  >
                    ยกเลิก
                  </button>
                  
                  {isExporting ? (
                    <div className="px-4 py-2 bg-indigo-600/20 text-indigo-700 rounded-xl text-xs font-black flex items-center gap-2 min-w-[180px]">
                      <div className="w-4 h-4 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin"></div>
                      <span>กำลังส่งออก... {exportProgress}%</span>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleStartExport('EXCEL')}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-lg shadow-emerald-600/10"
                      >
                        <FileSpreadsheet className="w-4 h-4" /> ส่งออก Excel Sheet
                      </button>
                      <button
                        onClick={() => handleStartExport('PDF')}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-lg shadow-indigo-600/10"
                      >
                        <Printer className="w-4 h-4" /> พิมพ์หรือส่งออก PDF
                      </button>
                    </div>
                  )}
                </div>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
