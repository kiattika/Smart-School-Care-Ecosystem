import React, { useEffect, useMemo, useState } from 'react';
import {
  CreditCard,
  Calendar,
  CheckCircle2,
  Download,
  Upload,
  Video,
  MapPin,
  Clock,
  Receipt,
  Check,
  Sparkles,
  Phone,
  User,
  ShieldCheck
} from 'lucide-react';
import { useStore } from '../../store';
import { NoStudentNotice } from './NoStudentNotice';
import { format } from 'date-fns';
import { subscribeBillingInvoices, submitPaymentSlip, subscribeAppointments, subscribeStaffList, createAppointmentRequest, cancelAppointment } from '../../services/firestoreService';
import {
  APPOINTMENT_MEETING_LABEL, APPOINTMENT_RECIPIENT_LABEL, APPOINTMENT_TIME_SLOTS, APPOINTMENT_TOPIC_MAX,
  appointmentStatusLabel, canCancelAppointment, safeMeetingLink,
  type AppointmentMeetingType, type AppointmentRecipient,
} from '../../lib/appointmentFlow';
import { uploadBillingFile } from '../../services/storageService';
import { validateBillingFile, buildSlipSubmissionPatch, canSubmitSlip } from '../../lib/billingPayment';
import { BillingInvoice, ParentAppointment, Student } from '../../types';
import { DatePicker } from '../shared/DatePicker';
import { advisorsOfRoom, counselorsOf } from '../../lib/advisors';
import type { UserProfile } from '../../types/auth';
import { PromptPayQr } from '../shared/PromptPayQr';
import { useBillingPaymentInfo } from '../../hooks/useBillingPaymentInfo';
import { hasPaymentChannel } from '../../lib/billingPaymentInfo';

/** เมนูแยกกัน: ชำระเงิน | นัดพบครู & ปรึกษา (การสนทนาย้ายไปที่ ClassChatPanel เมนูของตัวเอง) */
type ParentEngagementServicesProps = { studentId: string; student?: Student; isParentView?: boolean; section?: 'billing' | 'appointment' };

/** ไม่มีนักเรียนจริง = empty state (ห้าม fallback เป็นนักเรียนปลอม/คนแรกของ store — อาจเป็นลูกคนอื่น) */
export function ParentEngagementServices(props: ParentEngagementServicesProps) {
  const students = useStore(s => s.students);
  const student = props.student || students.find(s => s.studentId === props.studentId);
  if (!student) return <NoStudentNotice />;
  return <ParentEngagementServicesInner {...props} student={student} />;
}

function ParentEngagementServicesInner({
  studentId,
  student: studentProp,
  isParentView = false,
  section = 'billing'
}: ParentEngagementServicesProps) {
  const user = useStore(s => s.user);
  const { students } = useStore();

  // ใช้ student ของจริงที่ผู้เรียก (StudentPortal/ParentPortal) ดึงมาจาก useRealStudents() ถ้าส่งมาให้
  // แทนการค้นจาก state.students ของ Zustand (session-local ไม่เคยมี listener ผูกไว้ — ค่า studentUid/
  // parentUid ที่ต้องใช้กรอง query ใบแจ้งหนี้จริงจะไม่มีวันครบถ้วนถ้าพึ่ง state นี้)
  const student = studentProp as Student;

  // TASK 2 (เฟส 2 การเงิน): ใบแจ้งหนี้จริงจาก Firestore แบบ real-time แทน state.billingInvoices
  // ของ Zustand (ไม่เคยมี listener ผูกไว้เลย — ผู้ปกครองเขียนจ่ายเงินได้จริงแต่ไม่เคยเห็นยอดที่ต้องจ่าย)
  // กรองตาม role: ผู้ปกครองกรองด้วย parentUid ของตัวเอง, นักเรียนกรองด้วย studentUid ของตัวเอง
  const [billingInvoices, setBillingInvoices] = useState<BillingInvoice[]>([]);
  useEffect(() => {
    if (!user?.uid) { setBillingInvoices([]); return; }
    const unsubscribe = subscribeBillingInvoices(
      setBillingInvoices,
      isParentView ? { parentUid: user.uid } : { studentUid: user.uid }
    );
    return () => unsubscribe();
  }, [user?.uid, isParentView]);

  const invoices = billingInvoices.filter(i => i.studentId === student.studentId);
  // TASK 2: แยกรายการค้างชำระ (PENDING/OVERDUE) ออกจากที่จ่ายแล้วให้ชัดเจน
  const unpaidInvoices = invoices.filter(i => i.status !== 'PAID'); // รวม VERIFYING (รอตรวจสอบ)
  const paidInvoices = invoices.filter(i => i.status === 'PAID');
  // นัดพบครูจริงจาก Firestore แบบ real-time (ผู้ปกครองกรองด้วย parentUid, นักเรียนด้วย studentUid) — ไม่ใช้ Zustand
  const [allAppointments, setAllAppointments] = useState<ParentAppointment[]>([]);
  useEffect(() => {
    if (!user?.uid) { setAllAppointments([]); return; }
    return subscribeAppointments(setAllAppointments, isParentView ? { parentUid: user.uid } : { studentUid: user.uid });
  }, [user?.uid, isParentView]);
  const appointments = allAppointments.filter(a => a.studentId === student.studentId);

  const activeTab = section;

  // PromptPay Modal / Payment state
  const [selectedInvoice, setSelectedInvoice] = useState<BillingInvoice | null>(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const { info: payInfo, loading: payInfoLoading } = useBillingPaymentInfo();
  const [slipFile, setSlipFile] = useState<File | null>(null);
  const [slipNote, setSlipNote] = useState('');
  const [slipError, setSlipError] = useState('');
  const closePaymentModal = () => { setSelectedInvoice(null); setSlipFile(null); setSlipNote(''); setSlipError(''); };

  // Chat message state

  // Appointment request form state — ไม่ตั้งค่าเริ่มต้นแทนผู้ใช้ (ต้องเลือกเอง)
  const [recipient, setRecipient] = useState<AppointmentRecipient | ''>('');
  // ครูแนะแนวที่เลือก ('' = ใครก็ได้) — รายชื่อมาจาก staff จริงที่มีบทบาทแนะแนว
  const [targetStaffId, setTargetStaffId] = useState('');
  const [staffList, setStaffList] = useState<UserProfile[]>([]);
  useEffect(() => subscribeStaffList(setStaffList), []);
  const counselors = useMemo(() => counselorsOf(staffList), [staffList]);
  const advisors = useMemo(() => advisorsOfRoom(staffList, student.room), [staffList, student.room]);
  const targetChoices = recipient === 'HOMEROOM' ? advisors : counselors;
  const [appointmentDate, setAppointmentDate] = useState('');
  const [timeSlot, setTimeSlot] = useState('');
  const [meetingType, setMeetingType] = useState<AppointmentMeetingType | ''>('');
  const [topic, setTopic] = useState('');
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [bookingError, setBookingError] = useState('');
  const [bookingBusy, setBookingBusy] = useState(false);



  const handlePickSlip = (file: File | null) => {
    setSlipError('');
    if (!file) { setSlipFile(null); return; }
    const err = validateBillingFile(file);
    if (err) { setSlipFile(null); setSlipError(err); return; }
    setSlipFile(file);
  };

  // ส่งสลิปจริง: อัปโหลดไฟล์ขึ้น Storage แล้วเปลี่ยนสถานะเป็น "รอตรวจสอบ" — ห้ามตั้ง "ชำระแล้ว" เอง
  // เจ้าหน้าที่การเงินเป็นผู้ยืนยันหลังตรวจยอดและสลิป (firestore.rules บังคับซ้ำ)
  const handleSubmitSlip = async () => {
    if (!selectedInvoice) return;
    if (!user?.uid) { setSlipError('ไม่พบข้อมูลผู้ใช้ที่ล็อกอิน — กรุณาเข้าสู่ระบบใหม่'); return; }
    if (!canSubmitSlip(selectedInvoice)) { setSlipError('ใบแจ้งหนี้นี้ไม่อยู่ในสถานะที่แนบสลิปได้'); return; }
    const err = validateBillingFile(slipFile);
    if (err || !slipFile) { setSlipError(err || 'กรุณาแนบสลิปโอนเงิน'); return; }
    setIsProcessingPayment(true);
    setSlipError('');
    try {
      const uploaded = await uploadBillingFile('slip', user.uid, selectedInvoice.id, slipFile);
      await submitPaymentSlip(
        selectedInvoice.id,
        buildSlipSubmissionPatch({ file: uploaded, uploaderUid: user.uid, note: slipNote, nowIso: new Date().toISOString() }),
      );
      closePaymentModal();
    } catch (e) {
      console.error('[ParentEngagementServices] submit slip failed:', e);
      setSlipError('ส่งสลิปไม่สำเร็จ กรุณาลองใหม่อีกครั้ง (ใบแจ้งหนี้ยังไม่ถูกเปลี่ยนสถานะ)');
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const handleBookAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    setBookingError('');
    setBookingSuccess(false);
    // ผูกกับ Auth UID จริงเท่านั้น ห้ามสร้าง placeholder เช่น parent_<studentId>
    const parentUid = user?.uid;
    if (!parentUid) {
      setBookingError('ไม่พบข้อมูลผู้ใช้ที่ล็อกอิน — กรุณาเข้าสู่ระบบใหม่ก่อนขอนัดหมาย');
      return;
    }
    setBookingBusy(true);
    try {
      await createAppointmentRequest({
        student: { studentId: student.studentId, studentUid: student.studentUid || '', parentUid: student.parentUid, room: student.room },
        parent: { uid: parentUid, name: user?.displayName || 'ผู้ปกครอง' },
        form: { recipient, targetStaffId: recipient === 'GUIDANCE' ? targetStaffId : '', preferredDate: appointmentDate, timeSlot, meetingType, topic },
      });
      setRecipient(''); setTargetStaffId(''); setAppointmentDate(''); setTimeSlot(''); setMeetingType(''); setTopic('');
      setBookingSuccess(true);
      setTimeout(() => setBookingSuccess(false), 4000);
    } catch (err: any) {
      // เขียนไม่สำเร็จ = แจ้งตามจริง (ห้ามขึ้น "ส่งแล้ว")
      setBookingError(err?.message || 'ส่งคำขอไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setBookingBusy(false);
    }
  };

  const handleCancelAppointment = async (id: string) => {
    setBookingError('');
    try {
      await cancelAppointment(id);
    } catch (err: any) {
      setBookingError(err?.message || 'ยกเลิกนัดไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
    }
  };

  return (
    <div className="space-y-6">
      {activeTab === 'billing' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-emerald-400" />
                ใบแจ้งยอดชำระเงินค่าบำรุงการศึกษา (e-Billing & Official Receipts)
              </h3>
              <p className="text-[11px] text-slate-400">
                โอนเงินตามช่องทางที่โรงเรียนแจ้ง แล้วแนบสลิป — เจ้าหน้าที่การเงินจะตรวจสอบยอดและสลิปก่อนเปลี่ยนสถานะเป็น "ชำระแล้ว"
              </p>
            </div>
          </div>

          {/* TASK 2: แยกรายการค้างชำระ (PENDING/OVERDUE) ออกจากประวัติที่จ่ายแล้วให้ชัดเจน */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" /> รายการค้างชำระ ({unpaidInvoices.length})
            </h4>
            {unpaidInvoices.length === 0 ? (
              <div className="text-center py-6 text-slate-500 text-xs bg-slate-900/40 border border-slate-800 rounded-2xl">
                ไม่มีรายการค้างชำระในขณะนี้
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {unpaidInvoices.map((inv) => (
                  <div
                    key={inv.id}
                    className="bg-slate-900/70 border border-slate-800 rounded-3xl p-5 sm:p-6 backdrop-blur-md shadow-xl space-y-4 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                          {inv.invoiceNumber}
                        </span>
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                          inv.status === 'OVERDUE'
                            ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                            : inv.status === 'VERIFYING'
                              ? 'bg-sky-500/10 border-sky-500/30 text-sky-300'
                              : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                        }`}>
                          {inv.status === 'OVERDUE' ? '⚠️ เกินกำหนดชำระ' : inv.status === 'VERIFYING' ? '🔎 รอเจ้าหน้าที่ตรวจสอบสลิป' : '⏳ รอการชำระเงิน'}
                        </span>
                      </div>

                      <h4 className="text-base font-bold text-white mb-2">{inv.title}</h4>

                      <div className="space-y-1.5 text-xs bg-slate-800/40 p-3 rounded-2xl border border-slate-800">
                        {inv.items.map((item, idx) => (
                          <div key={idx} className="flex justify-between text-slate-300">
                            <span>{item.description || (item as any).name || 'รายการ'}</span>
                            <span className="font-mono">฿{(item.amount || 0).toLocaleString()}</span>
                          </div>
                        ))}
                        <div className="pt-2 border-t border-slate-700/60 flex justify-between font-bold text-sm text-white">
                          <span>ยอดรวมทั้งสิ้น:</span>
                          <span className="text-emerald-400 font-black">฿{inv.totalAmount.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>

                    {inv.slipRejectedReason && canSubmitSlip(inv) && (
                      <div role="alert" className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-[11px] text-rose-300">
                        เจ้าหน้าที่การเงินไม่รับสลิปครั้งก่อน: {inv.slipRejectedReason}
                      </div>
                    )}
                    <div className="pt-2 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                      <span className="text-[11px] text-amber-400">กำหนดชำระภายใน: {inv.dueDate}</span>
                      {canSubmitSlip(inv) ? (
                        <button
                          onClick={() => setSelectedInvoice(inv)}
                          className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-lg transition-all cursor-pointer"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          <span>{inv.slipRejectedReason ? 'แนบสลิปใหม่' : 'แจ้งโอนเงิน / แนบสลิป'}</span>
                        </button>
                      ) : (
                        <span className="text-[11px] text-sky-300">
                          ส่งสลิปแล้ว {inv.slipUploadedAt ? new Date(inv.slipUploadedAt).toLocaleString('th-TH') : ''} — รอการตรวจสอบ
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-3">
            <h4 className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" /> ประวัติการชำระเงิน ({paidInvoices.length})
            </h4>
            {paidInvoices.length === 0 ? (
              <div className="text-center py-6 text-slate-500 text-xs bg-slate-900/40 border border-slate-800 rounded-2xl">
                ยังไม่มีประวัติการชำระเงิน
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {paidInvoices.map((inv) => (
                  <div
                    key={inv.id}
                    className="bg-slate-900/70 border border-slate-800 rounded-3xl p-5 sm:p-6 backdrop-blur-md shadow-xl space-y-4 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                          {inv.invoiceNumber}
                        </span>
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold border bg-emerald-500/10 border-emerald-500/30 text-emerald-400">
                          ✅ ชำระเงินเรียบร้อยแล้ว
                        </span>
                      </div>

                      <h4 className="text-base font-bold text-white mb-2">{inv.title}</h4>

                      <div className="space-y-1.5 text-xs bg-slate-800/40 p-3 rounded-2xl border border-slate-800">
                        {inv.items.map((item, idx) => (
                          <div key={idx} className="flex justify-between text-slate-300">
                            <span>{item.description || (item as any).name || 'รายการ'}</span>
                            <span className="font-mono">฿{(item.amount || 0).toLocaleString()}</span>
                          </div>
                        ))}
                        <div className="pt-2 border-t border-slate-700/60 flex justify-between font-bold text-sm text-white">
                          <span>ยอดรวมทั้งสิ้น:</span>
                          <span className="text-emerald-400 font-black">฿{inv.totalAmount.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                      <div className="text-[11px] text-slate-400">
                        <span>ชำระเมื่อ: {inv.paidAt ? new Date(inv.paidAt).toLocaleString('th-TH') : '-'}</span>
                        <p className="text-emerald-400 font-mono">เลขที่ใบเสร็จ: {inv.receiptNo}</p>
                      </div>
                      {inv.receiptFileUrl ? (
                        <a
                          href={inv.receiptFileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border border-slate-700 transition-all"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>เปิดใบเสร็จรับเงิน</span>
                        </a>
                      ) : (
                        <span className="text-[10px] text-slate-500">ไม่มีไฟล์ใบเสร็จแนบ</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* แจ้งโอนเงิน / แนบสลิป */}
          {selectedInvoice && (
            <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-5 animate-fadeIn">
                <div className="text-center space-y-1">
                  <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">
                    แจ้งโอนเงิน • แนบสลิป
                  </span>
                  <h3 className="text-base font-bold text-white">{selectedInvoice.title}</h3>
                  <p className="text-2xl font-black text-emerald-400">฿{(selectedInvoice.totalAmount ?? 0).toLocaleString()}</p>
                  <p className="text-[11px] text-slate-400 font-mono">อ้างอิง: {selectedInvoice.invoiceNumber}</p>
                </div>

                <div className="bg-slate-800/40 border border-slate-800 rounded-2xl p-3 space-y-3" data-testid="payment-channel">
                  {payInfoLoading ? (
                    <p className="text-[11px] text-slate-400 text-center">กำลังโหลดช่องทางโอนเงิน...</p>
                  ) : !hasPaymentChannel(payInfo) ? (
                    <p className="text-[11px] text-amber-300 leading-relaxed">
                      โรงเรียนยังไม่ได้ตั้งค่าบัญชีรับโอนในระบบ กรุณาสอบถามเจ้าหน้าที่การเงินเพื่อขอช่องทางโอน แล้วกลับมาแนบสลิปที่นี่
                    </p>
                  ) : (
                    <>
                      {payInfo.promptPayType !== 'NONE' && (
                        <div className="space-y-1">
                          <PromptPayQr type={payInfo.promptPayType} id={payInfo.promptPayId} amount={selectedInvoice.totalAmount} size={200} />
                          <p className="text-[10px] text-slate-400 text-center">สแกนด้วยแอปธนาคาร ยอดเงินถูกกรอกให้แล้ว</p>
                        </div>
                      )}
                      <dl className="text-[11px] text-slate-300 space-y-1">
                        {payInfo.accountName && <div className="flex justify-between gap-3"><dt className="text-slate-500">ชื่อบัญชี</dt><dd className="text-right font-bold">{payInfo.accountName}</dd></div>}
                        {payInfo.bankName && <div className="flex justify-between gap-3"><dt className="text-slate-500">ธนาคาร</dt><dd className="text-right">{payInfo.bankName}</dd></div>}
                        {payInfo.bankAccountNo && <div className="flex justify-between gap-3"><dt className="text-slate-500">เลขที่บัญชี</dt><dd className="text-right font-mono">{payInfo.bankAccountNo}</dd></div>}
                      </dl>
                      {payInfo.promptPayType !== 'NONE' && (
                        <p className="text-[10px] text-amber-300 leading-relaxed">ก่อนยืนยันการโอน โปรดตรวจว่าชื่อผู้รับในแอปธนาคารตรงกับโรงเรียน</p>
                      )}
                      {payInfo.note && <p className="text-[11px] text-slate-400 leading-relaxed">{payInfo.note}</p>}
                    </>
                  )}
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    ระบุเลขอ้างอิง {selectedInvoice.invoiceNumber} แล้วแนบสลิปที่นี่
                    เจ้าหน้าที่การเงินจะตรวจสอบยอดและสลิป สถานะจะเปลี่ยนเป็น "ชำระแล้ว" เมื่อตรวจสอบเสร็จ
                  </p>
                </div>

                <div className="space-y-3">
                  <label className="block p-3 rounded-2xl border-2 border-dashed text-center cursor-pointer transition-all bg-slate-800/40 border-slate-700 text-slate-400 hover:border-emerald-500/50">
                    <Upload className="w-5 h-5 mx-auto mb-1 text-emerald-400" />
                    <span className="text-xs font-bold block">
                      {slipFile ? `📎 ${slipFile.name}` : 'เลือกไฟล์สลิปโอนเงิน (รูปภาพหรือ PDF ไม่เกิน 5 MB)'}
                    </span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,application/pdf"
                      className="sr-only"
                      onChange={(e) => handlePickSlip(e.target.files?.[0] || null)}
                    />
                  </label>

                  <textarea
                    value={slipNote}
                    onChange={(e) => setSlipNote(e.target.value)}
                    rows={2}
                    placeholder="หมายเหตุถึงเจ้าหน้าที่การเงิน (ไม่บังคับ) เช่น วัน-เวลาที่โอน"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-xs text-white resize-none"
                  />

                  {slipError && (
                    <div role="alert" className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-300">{slipError}</div>
                  )}

                  <div className="flex gap-2">
                    <button
                      onClick={closePaymentModal}
                      disabled={isProcessingPayment}
                      className="flex-1 py-2.5 bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold cursor-pointer"
                    >
                      ยกเลิก
                    </button>
                    <button
                      onClick={handleSubmitSlip}
                      disabled={isProcessingPayment || !slipFile}
                      className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold shadow transition-all cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      {isProcessingPayment ? 'กำลังส่งสลิป...' : 'ส่งสลิปให้เจ้าหน้าที่ตรวจสอบ'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'appointment' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Request Form (ผู้ปกครองเท่านั้น) */}
          <div className="lg:col-span-5 bg-slate-900/70 border border-slate-800 rounded-3xl p-5 sm:p-6 backdrop-blur-md shadow-xl space-y-4">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-1">
                <Calendar className="w-4 h-4 text-purple-400" />
                ขอนัดพบครู (Conference Request)
              </h3>
              <p className="text-[11px] text-slate-400">
                เลือกพบครูที่ปรึกษาหรือครูแนะแนว แบบพบที่โรงเรียนหรือผ่าน Google Meet — ครูจะยืนยันและแจ้งสถานที่/ลิงก์กลับมา
              </p>
            </div>

            {!isParentView ? (
              <p className="p-3 bg-slate-800/60 border border-slate-700 rounded-xl text-xs text-slate-300" data-testid="appointment-student-note">
                การขอนัดพบครูทำโดยผู้ปกครอง — ที่นี่แสดงรายการนัดของคุณให้ดูได้อย่างเดียว
              </p>
            ) : (
              <>
                {bookingSuccess && (
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>ส่งคำขอนัดหมายแล้ว รอครูยืนยันและแจ้งสถานที่/ลิงก์การประชุม</span>
                  </div>
                )}

                {bookingError && (
                  <div role="alert" className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-300">{bookingError}</div>
                )}

                <form onSubmit={handleBookAppointment} className="space-y-3 text-xs">
                  <div>
                    <label className="text-slate-300 block mb-1">ต้องการพบ:</label>
                    <div className="grid grid-cols-2 gap-2">
                      {(Object.keys(APPOINTMENT_RECIPIENT_LABEL) as AppointmentRecipient[]).map((r) => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => { setRecipient(r); setTargetStaffId(''); }}
                          aria-pressed={recipient === r}
                          className={`py-2 px-2 rounded-xl font-bold border transition-all ${
                            recipient === r ? 'bg-purple-500/20 border-purple-500 text-purple-300' : 'bg-slate-800 border-slate-700 text-slate-400'
                          }`}
                        >
                          {APPOINTMENT_RECIPIENT_LABEL[r]}
                        </button>
                      ))}
                    </div>
                  </div>

                  {recipient !== '' && (
                    <div>
                      <label htmlFor="appt-target" className="text-slate-300 block mb-1">{recipient === 'HOMEROOM' ? 'เลือกครูที่ปรึกษา:' : 'เลือกครูแนะแนว:'}</label>
                      <select
                        id="appt-target"
                        value={targetStaffId}
                        onChange={(e) => setTargetStaffId(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-200"
                      >
                        <option value="">{recipient === 'HOMEROOM' ? 'ครูที่ปรึกษาท่านใดก็ได้ (ทั้งหมด)' : 'ใครก็ได้ (ครูแนะแนวท่านใดรับก็ได้)'}</option>
                        {targetChoices.map(c => <option key={c.staffId} value={c.staffId}>{c.name}</option>)}
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="text-slate-300 block mb-1">รูปแบบการพบ:</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setMeetingType('ONLINE_MEET')}
                        aria-pressed={meetingType === 'ONLINE_MEET'}
                        className={`py-2 px-2 rounded-xl font-bold border transition-all flex items-center justify-center gap-1.5 ${
                          meetingType === 'ONLINE_MEET' ? 'bg-purple-500/20 border-purple-500 text-purple-300' : 'bg-slate-800 border-slate-700 text-slate-400'
                        }`}
                      >
                        <Video className="w-3.5 h-3.5" />
                        <span>Google Meet</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setMeetingType('IN_PERSON')}
                        aria-pressed={meetingType === 'IN_PERSON'}
                        className={`py-2 px-2 rounded-xl font-bold border transition-all flex items-center justify-center gap-1.5 ${
                          meetingType === 'IN_PERSON' ? 'bg-indigo-500/20 border-indigo-500 text-indigo-300' : 'bg-slate-800 border-slate-700 text-slate-400'
                        }`}
                      >
                        <MapPin className="w-3.5 h-3.5" />
                        <span>พบที่โรงเรียน</span>
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-slate-300 block mb-1">วันที่ต้องการนัด:</label>
                      <DatePicker value={appointmentDate} onChange={setAppointmentDate} min={format(new Date(), 'yyyy-MM-dd')} ariaLabel="วันที่นัดหมาย" className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white flex items-center gap-2 text-left cursor-pointer" />
                    </div>
                    <div>
                      <label className="text-slate-300 block mb-1">ช่วงเวลา:</label>
                      <select
                        value={timeSlot}
                        onChange={(e) => setTimeSlot(e.target.value)}
                        aria-label="ช่วงเวลานัดหมาย"
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                      >
                        <option value="">— เลือก —</option>
                        {APPOINTMENT_TIME_SLOTS.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-slate-300 block mb-1">หัวข้อประเด็นที่ต้องการปรึกษา:</label>
                    <textarea
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                      rows={3}
                      maxLength={APPOINTMENT_TOPIC_MAX}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white resize-none"
                    ></textarea>
                  </div>

                  <button
                    type="submit"
                    disabled={bookingBusy}
                    className="w-full py-3 bg-purple-600 hover:bg-purple-500 disabled:opacity-60 text-white font-bold rounded-xl shadow cursor-pointer transition-all"
                  >
                    {bookingBusy ? 'กำลังส่งคำขอ...' : 'ส่งคำขอนัดหมาย'}
                  </button>
                </form>
              </>
            )}
          </div>

          {/* Appointments List */}
          <div className="lg:col-span-7 bg-slate-900/70 border border-slate-800 rounded-3xl p-5 sm:p-6 backdrop-blur-md shadow-xl space-y-4">
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-purple-400" />
              รายการนัดหมาย
            </h4>

            <div className="space-y-3">
              {appointments.length === 0 && <p className="text-xs text-slate-500" data-testid="appointment-empty">ยังไม่มีรายการนัดหมาย</p>}
              {appointments.map((apt) => {
                const link = apt.meetingType === 'ONLINE_MEET' ? safeMeetingLink(apt.locationOrLink) : null;
                return (
                  <div
                    key={apt.id}
                    className="p-4 bg-slate-800/40 border border-slate-800 rounded-2xl space-y-2.5 hover:border-purple-500/30 transition-all"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-white">{APPOINTMENT_RECIPIENT_LABEL[apt.recipient]}{apt.targetStaffId ? ` (${[...advisors, ...counselors].find(c => c.staffId === apt.targetStaffId)?.name || 'ระบุครู'})` : ''}{apt.respondedBy ? ` · ${apt.respondedBy}` : ''}</span>
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        apt.status === 'CONFIRMED' || apt.status === 'COMPLETED' ? 'bg-emerald-500/20 text-emerald-300'
                          : apt.status === 'CANCELLED' || apt.status === 'DECLINED' ? 'bg-red-500/20 text-red-300'
                          : 'bg-amber-500/20 text-amber-300'
                      }`}>
                        {appointmentStatusLabel(apt.status)}
                      </span>
                    </div>

                    <p className="text-xs text-slate-300 leading-relaxed bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
                      หัวข้อ: {apt.topic}
                    </p>

                    {apt.teacherNote && (
                      <p className="text-xs text-slate-300 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">ข้อความจากครู: {apt.teacherNote}</p>
                    )}

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs pt-1">
                      <span className="text-slate-400">
                        📅 {apt.preferredDate} • ⏱️ {apt.timeSlot} • {APPOINTMENT_MEETING_LABEL[apt.meetingType]}
                      </span>

                      {apt.status === 'CONFIRMED' && link ? (
                        <a
                          href={link}
                          target="_blank"
                          rel="noreferrer"
                          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold flex items-center gap-1.5 shadow"
                        >
                          <Video className="w-3.5 h-3.5" />
                          <span>เข้าห้อง Google Meet</span>
                        </a>
                      ) : apt.status === 'CONFIRMED' && apt.locationOrLink ? (
                        <span className="text-slate-300 font-medium flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-indigo-400" />
                          {apt.locationOrLink}
                        </span>
                      ) : apt.status === 'REQUESTED' ? (
                        <span className="text-slate-400">รอครูยืนยันสถานที่/ลิงก์การประชุม</span>
                      ) : null}
                    </div>

                    {isParentView && canCancelAppointment(apt.status) && (
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => handleCancelAppointment(apt.id)}
                          className="px-3 py-1.5 rounded-xl text-[11px] font-bold text-red-300 border border-red-500/30 hover:bg-red-500/10"
                        >
                          ยกเลิกนัด
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
