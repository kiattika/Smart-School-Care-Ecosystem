import React, { useState } from 'react';
import { useStore } from '../../store';
import { useRealStudents } from '../../hooks/useRealStudents';
import { 
  Wallet, 
  Receipt, 
  FileText, 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  Plus, 
  Search, 
  Download, 
  Printer, 
  DollarSign, 
  CreditCard, 
  PieChart, 
  Check, 
  X, 
  ArrowUpRight, 
  Building2 
} from 'lucide-react';
import { BillingInvoice } from '../../types';

export function FinancePortal() {
  const { billingInvoices, payBillingInvoice } = useStore();
  const { students } = useRealStudents(); // นักเรียนจาก Firestore สด (ใช้แสดงชื่อในใบแจ้งหนี้)
  const [activeTab, setActiveTab] = useState<'collection' | 'requisitions' | 'reports'>('collection');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  // Teacher Requisitions state (mock)
  const [requisitions, setRequisitions] = useState([
    {
      id: 'REQ-2026-001',
      teacherName: 'นายเกียรติศักดิ์ ใจมั่น',
      department: 'กลุ่มสาระฯ คณิตศาสตร์',
      title: 'จัดซื้ออุปกรณ์สื่อการสอนคณิตศาสตร์ (เรขาคณิต 3 มิติ)',
      category: 'INSTRUCTIONAL_MATERIALS',
      amount: 4500,
      description: 'ใช้ประกอบการเรียนการสอนรายวิชาคณิตศาสตร์ ชั้น ม.5',
      status: 'APPROVED',
      requestedAt: '2026-08-15',
      approvedBy: 'ดร.ณรงค์ วิชาการ'
    },
    {
      id: 'REQ-2026-002',
      teacherName: 'นางสาวสมใจ รักสอน',
      department: 'กลุ่มสาระฯ วิทยาศาสตร์',
      title: 'งบจัดค่ายโครงงานวิทยาศาสตร์เยาวชน',
      category: 'PROJECT_FUNDS',
      amount: 15000,
      description: 'ค่าอาหารว่างและวัสดุห้องปฏิบัติการโครงงาน',
      status: 'SUBMITTED',
      requestedAt: '2026-08-19'
    },
    {
      id: 'REQ-2026-003',
      teacherName: 'ดร.สุดา จิตวิทยา',
      department: 'ฝ่ายแนะแนว',
      title: 'จัดซื้อแบบทดสอบคัดกรองสุขภาพจิต SDQ/EQ รุ่นใหม่',
      category: 'DEPARTMENT_BUDGET',
      amount: 3200,
      description: 'แบบประเมินสำหรับนักเรียนระดับชั้น ม.1 และ ม.4',
      status: 'PAID',
      requestedAt: '2026-08-10',
      approvedBy: 'นายสมเกียรติ ยอดเยี่ยม'
    }
  ]);

  // Modal new requisition
  const [showReqModal, setShowReqModal] = useState(false);
  const [newReqTitle, setNewReqTitle] = useState('');
  const [newReqCategory, setNewReqCategory] = useState<'INSTRUCTIONAL_MATERIALS' | 'PROJECT_FUNDS' | 'DEPARTMENT_BUDGET'>('INSTRUCTIONAL_MATERIALS');
  const [newReqAmount, setNewReqAmount] = useState('2500');
  const [newReqDesc, setNewReqDesc] = useState('');

  // Selected receipt modal
  const [selectedInvoice, setSelectedInvoice] = useState<BillingInvoice | null>(null);

  const handleCreateRequisition = (e: React.FormEvent) => {
    e.preventDefault();
    const newR = {
      id: `REQ-2026-00${requisitions.length + 1}`,
      teacherName: 'นางสาวสมหญิง การเงิน (ผู้เบิก)',
      department: 'ฝ่ายการเงินและบัญชี',
      title: newReqTitle,
      category: newReqCategory,
      amount: parseFloat(newReqAmount) || 0,
      description: newReqDesc,
      status: 'SUBMITTED' as const,
      requestedAt: new Date().toISOString().split('T')[0]
    };
    setRequisitions([newR, ...requisitions]);
    setShowReqModal(false);
    setNewReqTitle('');
    setNewReqDesc('');
  };

  const handleUpdateReqStatus = (id: string, status: 'APPROVED' | 'REJECTED' | 'PAID') => {
    setRequisitions(requisitions.map(r => r.id === id ? { ...r, status, approvedBy: status === 'APPROVED' ? 'ฝ่ายการเงินโรงเรียน' : r.approvedBy } : r));
  };

  const filteredInvoices = billingInvoices.filter(inv => {
    const student = students.find(s => s.studentId === inv.studentId);
    const query = searchTerm.toLowerCase();
    const matchesQuery = (
      inv.title.toLowerCase().includes(query) ||
      inv.studentId.toLowerCase().includes(query) ||
      (student && student.fullName.toLowerCase().includes(query))
    );
    const matchesStatus = filterStatus === 'ALL' || inv.status === filterStatus;
    return matchesQuery && matchesStatus;
  });

  const totalCollected = billingInvoices.filter(i => i.status === 'PAID').reduce((acc, i) => acc + i.totalAmount, 0);
  const totalPending = billingInvoices.filter(i => i.status === 'UNPAID').reduce((acc, i) => acc + i.totalAmount, 0);
  const totalOverdue = billingInvoices.filter(i => i.status === 'OVERDUE').reduce((acc, i) => acc + i.totalAmount, 0);

  return (
    <div className="flex-1 bg-slate-950 text-slate-100 flex flex-col min-h-screen">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-950/60 via-slate-900 to-slate-900 border-b border-emerald-500/20 px-6 py-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-500/20 border border-emerald-500/30 rounded-2xl text-emerald-400 shadow-lg">
              <Wallet className="w-8 h-8" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">งานการเงินและบัญชีโรงเรียน</h1>
                <span className="px-2 py-0.5 bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-[10px] font-bold rounded-md">
                  Finance & Accounting Services
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                ระบบจัดการจัดเก็บค่าธรรมเนียมการศึกษา ใบเสร็จดิจิทัล อนุมัติงบประมาณเบิกจ่าย และรายงานการเงินโปร่งใส
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowReqModal(true)}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 rounded-xl font-bold text-xs shadow-lg transition-all cursor-pointer active:scale-95"
            >
              <Plus className="w-4 h-4" />
              สร้างคำขอเบิกงบประมาณ / จัดซื้อ
            </button>
          </div>
        </div>
      </div>

      {/* Metric Summary Cards */}
      <div className="max-w-7xl w-full mx-auto px-6 pt-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl shadow-xl flex items-center justify-between">
            <div>
              <span className="text-xs text-slate-400 block font-medium">ยอดจัดเก็บสำเร็จ (ภาคเรียนนี้)</span>
              <p className="text-2xl font-black font-mono text-emerald-400 mt-1">฿{totalCollected.toLocaleString()}</p>
              <span className="text-[10px] text-emerald-400/80 font-mono">อัปเดตแบบเรียลไทม์</span>
            </div>
            <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
              <DollarSign className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl shadow-xl flex items-center justify-between">
            <div>
              <span className="text-xs text-slate-400 block font-medium">ยอดค้างชำระ (Pending)</span>
              <p className="text-2xl font-black font-mono text-amber-400 mt-1">฿{totalPending.toLocaleString()}</p>
              <span className="text-[10px] text-amber-400/80 font-mono">แจ้งเตือนผู้ปกครองอัตโนมัติ</span>
            </div>
            <div className="p-3 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/20">
              <Clock className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl shadow-xl flex items-center justify-between">
            <div>
              <span className="text-xs text-slate-400 block font-medium">เกินกำหนด (Overdue)</span>
              <p className="text-2xl font-black font-mono text-rose-400 mt-1">฿{totalOverdue.toLocaleString()}</p>
              <span className="text-[10px] text-rose-400/80 font-mono">ประสานงานฝ่ายปกครอง</span>
            </div>
            <div className="p-3 bg-rose-500/10 text-rose-400 rounded-xl border border-rose-500/20">
              <AlertCircle className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl shadow-xl flex items-center justify-between">
            <div>
              <span className="text-xs text-slate-400 block font-medium">คำขอเบิกงบครูรออนุมัติ</span>
              <p className="text-2xl font-black font-mono text-cyan-400 mt-1">
                {requisitions.filter(r => r.status === 'SUBMITTED').length} รายการ
              </p>
              <span className="text-[10px] text-cyan-400/80 font-mono">วงเงินรวม ฿18,200</span>
            </div>
            <div className="p-3 bg-cyan-500/10 text-cyan-400 rounded-xl border border-cyan-500/20">
              <Receipt className="w-6 h-6" />
            </div>
          </div>
        </div>
      </div>

      {/* Main Tabs */}
      <div className="max-w-7xl w-full mx-auto px-6 pt-6">
        <div className="flex border-b border-slate-800 gap-6">
          <button
            onClick={() => setActiveTab('collection')}
            className={`pb-3 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'collection' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            <span>จัดเก็บค่าธรรมเนียมและใบเสร็จนักเรียน ({billingInvoices.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('requisitions')}
            className={`pb-3 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'requisitions' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Receipt className="w-4 h-4" />
            <span>งบเบิกจ่ายครูและโครงการ ({requisitions.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('reports')}
            className={`pb-3 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'reports' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <PieChart className="w-4 h-4" />
            <span>รายงานการเงินและงบประมาณประจำปี</span>
          </button>
        </div>
      </div>

      {/* Content Body */}
      <div className="max-w-7xl w-full mx-auto px-6 py-6 flex-1 space-y-6">
        
        {/* TAB 1: FEE COLLECTION & INVOICES */}
        {activeTab === 'collection' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="ค้นหาตามรายการ, ชื่อนักเรียน, หรือรหัสประจำตัว..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                >
                  <option value="ALL">สถานะทั้งหมด (All Status)</option>
                  <option value="PAID">ชำระแล้ว (Paid)</option>
                  <option value="UNPAID">รอชำระ (Pending)</option>
                  <option value="OVERDUE">เกินกำหนด (Overdue)</option>
                </select>
              </div>
            </div>

            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-800/80 text-slate-300 uppercase font-mono text-[10px]">
                    <tr>
                      <th className="p-3.5">รหัสใบแจ้งหนี้ / วันที่</th>
                      <th className="p-3.5">นักเรียน</th>
                      <th className="p-3.5">รายการชำระ (Description)</th>
                      <th className="p-3.5 text-right">จำนวนเงิน (บาท)</th>
                      <th className="p-3.5 text-center">กำหนดชำระ</th>
                      <th className="p-3.5 text-center">สถานะการชำระ</th>
                      <th className="p-3.5 text-right">ออกใบเสร็จ / การจัดการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    {filteredInvoices.map((inv) => {
                      const student = students.find(s => s.studentId === inv.studentId);
                      return (
                        <tr key={inv.id} className="hover:bg-slate-800/30 transition-colors">
                          <td className="p-3.5 whitespace-nowrap">
                            <span className="font-mono font-bold text-emerald-400">{inv.id}</span>
                            <span className="block text-[10px] text-slate-400">{inv.dueDate}</span>
                          </td>
                          <td className="p-3.5 font-medium text-white">
                            <p className="font-bold">{student?.fullName || inv.studentId}</p>
                            <p className="text-[10px] text-slate-400 font-mono">ID: {inv.studentId}</p>
                          </td>
                          <td className="p-3.5 text-white font-medium">
                            {inv.title}
                          </td>
                          <td className="p-3.5 text-right font-mono font-bold text-white text-sm">
                            ฿{inv.totalAmount.toLocaleString()}
                          </td>
                          <td className="p-3.5 text-center font-mono text-slate-400">
                            {inv.dueDate}
                          </td>
                          <td className="p-3.5 text-center">
                            {inv.status === 'PAID' ? (
                              <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full text-[10px] font-bold inline-flex items-center gap-1">
                                <CheckCircle className="w-3 h-3" /> ชำระแล้ว (Paid)
                              </span>
                            ) : inv.status === 'UNPAID' ? (
                              <span className="px-2.5 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-full text-[10px] font-bold inline-flex items-center gap-1">
                                <Clock className="w-3 h-3" /> รอชำระ (Pending)
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-full text-[10px] font-bold inline-flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" /> เกินกำหนด (Overdue)
                              </span>
                            )}
                          </td>
                          <td className="p-3.5 text-right space-x-2">
                            {inv.status !== 'PAID' && (
                              <button
                                onClick={() => payBillingInvoice(inv.id)}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold text-[10px] transition-colors cursor-pointer"
                              >
                                บันทึกรับเงิน
                              </button>
                            )}
                            <button
                              onClick={() => setSelectedInvoice(inv)}
                              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg font-bold text-[10px] transition-colors cursor-pointer inline-flex items-center gap-1"
                            >
                              <Printer className="w-3 h-3" /> ใบเสร็จ
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: TEACHER BUDGET REQUISITIONS */}
        {activeTab === 'requisitions' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white">ระบบอนุมัติคำขอเบิกงบประมาณและจัดซื้อของครู</h3>
                <p className="text-xs text-slate-400">กระบวนการตรวจสอบและอนุมัติงบโครงการ สื่อการสอน และกิจกรรมนักเรียนแบบดิจิทัล</p>
              </div>
              <button
                onClick={() => setShowReqModal(true)}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-colors"
              >
                + ยื่นคำขอเบิกงบใหม่
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {requisitions.map((req) => (
                <div key={req.id} className="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-slate-800 text-emerald-400 text-[10px] font-mono rounded font-bold">
                        {req.id}
                      </span>
                      <span className="px-2 py-0.5 bg-indigo-500/10 text-indigo-300 text-[10px] font-semibold rounded border border-indigo-500/20">
                        {req.department}
                      </span>
                      <span className="text-xs text-slate-400 font-mono">ยื่นเมื่อ: {req.requestedAt}</span>
                    </div>
                    <h4 className="text-sm font-bold text-white">{req.title}</h4>
                    <p className="text-xs text-slate-300">{req.description}</p>
                    <p className="text-xs text-slate-400">ผู้เบิก: <span className="text-white font-medium">{req.teacherName}</span></p>
                  </div>

                  <div className="flex flex-col md:items-end gap-3 w-full md:w-auto">
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 block">งบประมาณขออนุมัติ</span>
                      <p className="text-xl font-black font-mono text-emerald-400">฿{req.amount.toLocaleString()}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      {req.status === 'SUBMITTED' && (
                        <>
                          <button
                            onClick={() => handleUpdateReqStatus(req.id, 'APPROVED')}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                          >
                            ✓ อนุมัติงบ
                          </button>
                          <button
                            onClick={() => handleUpdateReqStatus(req.id, 'REJECTED')}
                            className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                          >
                            ✕ ไม่อนุมัติ
                          </button>
                        </>
                      )}
                      {req.status === 'APPROVED' && (
                        <button
                          onClick={() => handleUpdateReqStatus(req.id, 'PAID')}
                          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                        >
                          💸 โอนจ่ายเงินแล้ว
                        </button>
                      )}
                      {req.status === 'PAID' && (
                        <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl text-xs font-bold inline-flex items-center gap-1">
                          <CheckCircle className="w-3.5 h-3.5" /> โอนจ่ายสำเร็จ
                        </span>
                      )}
                      {req.status === 'REJECTED' && (
                        <span className="px-3 py-1 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-xl text-xs font-bold">
                          ไม่อนุมัติ
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: FINANCIAL REPORTS */}
        {activeTab === 'reports' && (
          <div className="space-y-4">
            <div className="bg-slate-900/80 border border-slate-800 p-6 rounded-2xl shadow-xl space-y-6">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div>
                  <h3 className="text-base font-bold text-white">รายงานสรุปงบประมาณและกระแสเงินสดประจำปีการศึกษา 2569</h3>
                  <p className="text-xs text-slate-400">ข้อมูลการเบิกจ่ายและรายรับจำแนกตามหมวดหมู่บัญชีโรงเรียน</p>
                </div>
                <button
                  onClick={() => alert('ดาวน์โหลดรายงาน Excel / PDF สำเร็จ')}
                  className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white px-3 py-2 rounded-xl text-xs font-semibold border border-slate-700 transition-colors"
                >
                  <Download className="w-4 h-4" /> ส่งออกรายงานการเงิน (Excel/PDF)
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                  <span className="text-xs text-slate-400 block font-medium">หมวดรายรับค่าธรรมเนียมการศึกษา</span>
                  <p className="text-2xl font-black font-mono text-emerald-400">฿1,420,000</p>
                  <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div className="bg-emerald-500 h-full w-[85%]"></div>
                  </div>
                  <span className="text-[10px] text-slate-400">เก็บแล้ว 85% จากเป้าหมายทั้งหมด</span>
                </div>

                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                  <span className="text-xs text-slate-400 block font-medium">หมวดงบสนับสนุนสื่อการสอนและวิชาการ</span>
                  <p className="text-2xl font-black font-mono text-cyan-400">฿380,000</p>
                  <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div className="bg-cyan-500 h-full w-[60%]"></div>
                  </div>
                  <span className="text-[10px] text-slate-400">เบิกจ่ายแล้ว 60%</span>
                </div>

                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                  <span className="text-xs text-slate-400 block font-medium">หมวดกองทุนพัฒนาโรงเรียนและอาคาร</span>
                  <p className="text-2xl font-black font-mono text-purple-400">฿950,000</p>
                  <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div className="bg-purple-500 h-full w-[90%]"></div>
                  </div>
                  <span className="text-[10px] text-slate-400">ดำเนินโครงการแล้ว 90%</span>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* NEW REQUISITION MODAL */}
      {showReqModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl">
                  <Wallet className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-white">ยื่นคำขอเบิกงบประมาณ / จัดซื้อ</h3>
              </div>
              <button 
                onClick={() => setShowReqModal(false)}
                className="text-slate-400 hover:text-white text-sm font-bold px-2 py-1 bg-slate-800 rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateRequisition} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">หัวข้อโครงการ / รายการจัดซื้อ</label>
                <input
                  type="text"
                  required
                  value={newReqTitle}
                  onChange={(e) => setNewReqTitle(e.target.value)}
                  placeholder="เช่น จัดซื้อสื่อการสอนฟิสิกส์ ม.6"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">หมวดหมู่งบประมาณ</label>
                  <select
                    value={newReqCategory}
                    onChange={(e: any) => setNewReqCategory(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                  >
                    <option value="INSTRUCTIONAL_MATERIALS">สื่อการสอน (Instructional Materials)</option>
                    <option value="PROJECT_FUNDS">งบโครงการนักเรียน (Project Funds)</option>
                    <option value="DEPARTMENT_BUDGET">งบกลุ่มสาระฯ (Department Budget)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">จำนวนเงิน (บาท)</label>
                  <input
                    type="number"
                    required
                    value={newReqAmount}
                    onChange={(e) => setNewReqAmount(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">รายละเอียดความจำเป็น / วัตถุประสงค์</label>
                <textarea
                  rows={3}
                  value={newReqDesc}
                  onChange={(e) => setNewReqDesc(e.target.value)}
                  placeholder="อธิบายเหตุผลและความคุ้มค่าในการเบิกจ่ายงบประมาณ..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowReqModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700 transition-colors"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg transition-all"
                >
                  ส่งคำขอเบิกงบประมาณ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RECEIPT PRINT / PREVIEW MODAL */}
      {selectedInvoice && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Printer className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-bold text-white">ใบเสร็จรับเงินดิจิทัล (Digital Receipt)</h3>
              </div>
              <button 
                onClick={() => setSelectedInvoice(null)}
                className="text-slate-400 hover:text-white text-sm font-bold px-2 py-1 bg-slate-800 rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className="bg-white text-slate-900 p-6 rounded-xl space-y-4 font-sans text-xs shadow-inner">
              <div className="text-center border-b pb-3">
                <h4 className="font-black text-sm uppercase">โรงเรียนอุตรดิตถ์ (Utaradit School)</h4>
                <p className="text-[10px] text-slate-600">ใบเสร็จรับเงินค่าธรรมเนียมการศึกษา / ใบกำกับภาษีอย่างย่อ</p>
                <p className="text-[10px] font-mono text-slate-500 mt-1">เลขที่ใบเสร็จ: REC-{selectedInvoice.id}</p>
              </div>

              <div className="space-y-1">
                <p><span className="font-bold">รหัสนักเรียน:</span> {selectedInvoice.studentId}</p>
                <p><span className="font-bold">รายการ:</span> {selectedInvoice.title}</p>
                <p><span className="font-bold">วันที่ออกใบเสร็จ:</span> {selectedInvoice.dueDate}</p>
              </div>

              <div className="border-t pt-3 flex justify-between font-bold text-sm">
                <span>จำนวนเงินรวมทั้งสิ้น:</span>
                <span className="font-mono text-emerald-700">฿{selectedInvoice.amount.toLocaleString()} บาท</span>
              </div>

              <div className="text-center pt-4 text-[10px] text-slate-500 border-t">
                <p>ลงชื่อ ....................................................... (ผู้รับเงิน)</p>
                <p className="mt-1 font-mono">ฝ่ายการเงินและบัญชี โรงเรียนอุตรดิตถ์</p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => {
                  alert('พิมพ์ใบเสร็จสำเร็จ');
                  setSelectedInvoice(null);
                }}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-lg"
              >
                <Printer className="w-4 h-4" /> พิมพ์ใบเสร็จ (Print / PDF)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
