import React, { useState } from 'react';
import { useStore } from '../../store';
import { useRealStudents } from '../../hooks/useRealStudents';
import {
  Wallet,
  CheckCircle,
  Clock,
  AlertCircle,
  Search,
  Printer,
  DollarSign
} from 'lucide-react';
import { BillingInvoice } from '../../types';

export function FinancePortal() {
  const { billingInvoices, payBillingInvoice } = useStore();
  const { students } = useRealStudents(); // นักเรียนจาก Firestore สด (ใช้แสดงชื่อในใบแจ้งหนี้)
  // TASK 0 (เฟส 2 การเงิน): ตัดแท็บ requisitions (อนุมัติเบิกงบ/จัดซื้อครู) และ reports
  // (รายงานงบประมาณ) ออก — เกินขอบเขตงานจริงที่ยืนยันแล้ว ("แจ้งค่าใช้จ่าย + ส่งใบเสร็จ เท่านั้น")
  // ทั้งสองแท็บเดิมเป็น mock data 100% ไม่เคยเขียน Firestore เลย
  const [activeTab, setActiveTab] = useState<'collection'>('collection');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  // Selected receipt modal
  const [selectedInvoice, setSelectedInvoice] = useState<BillingInvoice | null>(null);

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
                ระบบแจ้งค่าใช้จ่ายที่นักเรียน/ผู้ปกครองต้องชำระ และออกใบเสร็จดิจิทัล
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Metric Summary Cards */}
      <div className="max-w-7xl w-full mx-auto px-6 pt-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
      </div>

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
