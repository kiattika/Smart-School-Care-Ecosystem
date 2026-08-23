import React, { useState } from 'react';
import { 
  CreditCard, 
  MessageSquare, 
  Calendar, 
  QrCode, 
  CheckCircle2, 
  Download, 
  Upload, 
  Send, 
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
import { BillingInvoice, ParentTeacherMessage, ParentAppointment } from '../../types';

export function ParentEngagementServices({ studentId }: { studentId: string }) {
  const { 
    billingInvoices, 
    payBillingInvoice, 
    parentTeacherMessages, 
    sendParentTeacherMessage, 
    parentAppointments, 
    bookParentAppointment,
    students 
  } = useStore();

  const student = students.find(s => s.studentId === studentId) || students[0];
  const invoices = billingInvoices.filter(i => i.studentId === student.studentId);
  const messages = parentTeacherMessages.filter(m => m.studentId === student.studentId);
  const appointments = parentAppointments.filter(a => a.studentId === student.studentId);

  const [activeTab, setActiveTab] = useState<'billing' | 'messaging' | 'appointment'>('billing');

  // PromptPay Modal / Payment state
  const [selectedInvoice, setSelectedInvoice] = useState<BillingInvoice | null>(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [slipUploaded, setSlipUploaded] = useState(false);

  // Chat message state
  const [msgText, setMsgText] = useState('');

  // Appointment booking form state
  const [teacherName, setTeacherName] = useState('ครูกิตติศักดิ์ (ครูประจำชั้น ม.5/8)');
  const [appointmentDate, setAppointmentDate] = useState('2026-08-25');
  const [timeSlot, setTimeSlot] = useState('15:30 - 16:00 น.');
  const [meetingType, setMeetingType] = useState<'IN_PERSON' | 'ONLINE_MEET'>('ONLINE_MEET');
  const [topic, setTopic] = useState('ปรึกษาแนวทางการเตรียมตัวสอบ TCAS รอบ 1 Portfolio และผลการเรียน');
  const [bookingSuccess, setBookingSuccess] = useState(false);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!msgText.trim()) return;

    sendParentTeacherMessage(
      student.studentId,
      'PARENT',
      'ผู้ปกครอง',
      msgText
    );
    setMsgText('');

    // Simulate teacher auto-response after 1.5 seconds
    setTimeout(() => {
      sendParentTeacherMessage(
        student.studentId,
        'TEACHER',
        'ครูกิตติศักดิ์ (ครูประจำชั้น)',
        'สวัสดีครับผู้ปกครอง ครูได้รับข้อความแล้วครับ จะดำเนินการตรวจสอบและประสานงานให้อย่างรวดเร็วครับ'
      );
    }, 1500);
  };

  const handleConfirmPayment = () => {
    if (!selectedInvoice) return;
    setIsProcessingPayment(true);
    setTimeout(() => {
      payBillingInvoice(selectedInvoice.id);
      setIsProcessingPayment(false);
      setSelectedInvoice(null);
      setSlipUploaded(false);
    }, 1200);
  };

  const handleBookAppointment = (e: React.FormEvent) => {
    e.preventDefault();
    bookParentAppointment({
      studentId: student.studentId,
      parentId: (student as any)?.parentUid || (student as any)?.parentId || `parent_${student.studentId}`,
      teacherName,
      date: appointmentDate,
      timeSlot,
      topic,
      meetingType,
      locationOrLink: meetingType === 'ONLINE_MEET' ? 'https://meet.google.com/ssc-parent-conf' : 'ห้องแนะแนว อาคาร 1 ชั้น 2'
    });

    setBookingSuccess(true);
    setTimeout(() => setBookingSuccess(false), 3000);
  };

  return (
    <div className="space-y-6">
      {/* Sub navigation pills */}
      <div className="flex items-center gap-2 p-1.5 bg-slate-900/60 border border-slate-800 rounded-2xl w-full max-w-lg mx-auto">
        <button
          onClick={() => setActiveTab('billing')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'billing'
              ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-md'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <CreditCard className="w-3.5 h-3.5" />
          <span>ชำระค่าบำรุง & สลิป QR</span>
        </button>
        <button
          onClick={() => setActiveTab('messaging')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'messaging'
              ? 'bg-gradient-to-r from-indigo-500 to-blue-600 text-white shadow-md'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          <span>สนทนากับครู ({messages.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('appointment')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'appointment'
              ? 'bg-gradient-to-r from-purple-500 to-indigo-600 text-white shadow-md'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Calendar className="w-3.5 h-3.5" />
          <span>นัดพบครู & ปรึกษา</span>
        </button>
      </div>

      {activeTab === 'billing' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-emerald-400" />
                ใบแจ้งยอดชำระเงินค่าบำรุงการศึกษา (e-Billing & Official Receipts)
              </h3>
              <p className="text-[11px] text-slate-400">
                ระบบออกใบเสร็จรับเงินอิเล็กทรอนิกส์ (e-Receipt) อัตโนมัติทันทีหลังยืนยันยอด
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {invoices.map((inv) => (
              <div
                key={inv.id}
                className="bg-slate-900/70 border border-slate-800 rounded-3xl p-5 sm:p-6 backdrop-blur-md shadow-xl space-y-4 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                      {inv.invoiceNo}
                    </span>
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                      inv.status === 'PAID'
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                        : 'bg-amber-500/10 border-amber-500/30 text-amber-400 animate-pulse'
                    }`}>
                      {inv.status === 'PAID' ? '✅ ชำระเงินเรียบร้อยแล้ว' : '⏳ รอการชำระเงิน'}
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
                      <span className="text-emerald-400 font-black">฿{(inv.totalAmount ?? (inv as any).amount ?? 0).toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  {inv.status === 'PAID' ? (
                    <>
                      <div className="text-[11px] text-slate-400">
                        <span>ชำระเมื่อ: {inv.paidAt}</span>
                        <p className="text-emerald-400 font-mono">เลขที่ใบเสร็จ: {inv.receiptNo}</p>
                      </div>
                      <button 
                        onClick={() => alert(`ดาวน์โหลดใบเสร็จรับเงินอิเล็กทรอนิกส์ ${inv.receiptNo}`)}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border border-slate-700 transition-all cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>ใบเสร็จ e-Receipt</span>
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="text-[11px] text-amber-400">กำหนดชำระภายใน: {inv.dueDate}</span>
                      <button
                        onClick={() => setSelectedInvoice(inv)}
                        className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-lg transition-all cursor-pointer"
                      >
                        <QrCode className="w-3.5 h-3.5" />
                        <span>ชำระผ่าน PromptPay QR</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* PromptPay QR Payment Modal */}
          {selectedInvoice && (
            <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-5 animate-fadeIn">
                <div className="text-center space-y-1">
                  <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">
                    THAI QR PAYMENT • PROMPTPAY
                  </span>
                  <h3 className="text-base font-bold text-white">{selectedInvoice.title}</h3>
                  <p className="text-2xl font-black text-emerald-400">฿{(selectedInvoice.totalAmount ?? (selectedInvoice as any).amount ?? 0).toLocaleString()}</p>
                </div>

                {/* PromptPay QR Code Mockup */}
                <div className="bg-white p-6 rounded-2xl max-w-[220px] mx-auto text-center shadow-lg">
                  <div className="flex items-center justify-center mb-2">
                    <span className="text-blue-900 font-black text-xs">PromptPay | พร้อมเพย์</span>
                  </div>
                  <QrCode className="w-40 h-40 mx-auto text-slate-900" />
                  <span className="text-[9px] text-slate-500 font-mono block mt-2">
                    REF: {selectedInvoice.invoiceNo}
                  </span>
                </div>

                <div className="space-y-3">
                  <div 
                    onClick={() => setSlipUploaded(true)}
                    className={`p-3 rounded-2xl border-2 border-dashed text-center cursor-pointer transition-all ${
                      slipUploaded ? 'bg-emerald-500/10 border-emerald-500 text-emerald-300' : 'bg-slate-800/40 border-slate-700 text-slate-400 hover:border-emerald-500/50'
                    }`}
                  >
                    <Upload className="w-5 h-5 mx-auto mb-1 text-emerald-400" />
                    <span className="text-xs font-bold block">
                      {slipUploaded ? '✅ แนบสลิปโอนเงินเรียบร้อยแล้ว' : 'คลิกเพื่อจำลองการอัปโหลดสลิปโอนเงิน'}
                    </span>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => setSelectedInvoice(null)}
                      className="flex-1 py-2.5 bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold cursor-pointer"
                    >
                      ยกเลิก
                    </button>
                    <button
                      onClick={handleConfirmPayment}
                      disabled={isProcessingPayment}
                      className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow transition-all cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      {isProcessingPayment ? 'กำลังบันทึก...' : 'ยืนยันการชำระเงิน'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'messaging' && (
        <div className="bg-slate-900/70 border border-slate-800 rounded-3xl p-5 sm:p-6 backdrop-blur-md shadow-xl flex flex-col h-[520px]">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                <User className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">ห้องสนทนาครูประจำชั้น & ผู้ปกครอง</h3>
                <p className="text-[11px] text-emerald-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  ครูกิตติศักดิ์ (ครูประจำชั้น ม.5/8) ออนไลน์
                </p>
              </div>
            </div>
          </div>

          {/* Messages feed */}
          <div className="flex-1 overflow-y-auto py-4 space-y-3 pr-1">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.senderRole === 'PARENT' ? 'items-end' : 'items-start'}`}
              >
                <span className="text-[10px] text-slate-500 mb-1 px-1">
                  {msg.senderName} • {msg.timestamp}
                </span>
                <div
                  className={`max-w-[80%] p-3.5 rounded-2xl text-xs leading-relaxed ${
                    msg.senderRole === 'PARENT'
                      ? 'bg-indigo-600 text-white rounded-tr-none'
                      : 'bg-slate-800 text-slate-200 rounded-tl-none border border-slate-700/60'
                  }`}
                >
                  {msg.message}
                </div>
              </div>
            ))}
          </div>

          {/* Send Input */}
          <form onSubmit={handleSendMessage} className="pt-3 border-t border-slate-800 flex gap-2">
            <input
              type="text"
              value={msgText}
              onChange={(e) => setMsgText(e.target.value)}
              placeholder="พิมพ์ข้อความสอบถามครูประจำชั้น..."
              className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
            />
            <button
              type="submit"
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow flex items-center gap-1.5 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>ส่ง</span>
            </button>
          </form>
        </div>
      )}

      {activeTab === 'appointment' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Booking Form */}
          <div className="lg:col-span-5 bg-slate-900/70 border border-slate-800 rounded-3xl p-5 sm:p-6 backdrop-blur-md shadow-xl space-y-4">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-1">
                <Calendar className="w-4 h-4 text-purple-400" />
                จองเวลานัดพบครูและฝ่ายแนะแนว (Conference Booking)
              </h3>
              <p className="text-[11px] text-slate-400">
                สามารถเลือกนัดพบแบบ Onsite ที่โรงเรียน หรือปรึกษาผ่าน Google Meet
              </p>
            </div>

            {bookingSuccess && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>ยืนยันการนัดหมายเรียบร้อยแล้ว ระบบสร้างลิงก์การประชุมให้แล้ว</span>
              </div>
            )}

            <form onSubmit={handleBookAppointment} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-300 block mb-1">เลือกคุณครูที่ต้องการนัดหมาย:</label>
                <select
                  value={teacherName}
                  onChange={(e) => setTeacherName(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                >
                  <option value="ครูกิตติศักดิ์ (ครูประจำชั้น ม.5/8)">ครูกิตติศักดิ์ (ครูประจำชั้น ม.5/8)</option>
                  <option value="ครูแนะแนวพิมพ์ชนก (หัวหน้างานแนะแนว)">ครูแนะแนวพิมพ์ชนก (หัวหน้างานแนะแนว)</option>
                  <option value="ครูสมศักดิ์ (ครูผู้สอนวิชาฟิสิกส์)">ครูสมศักดิ์ (ครูผู้สอนวิชาฟิสิกส์)</option>
                </select>
              </div>

              <div>
                <label className="text-slate-300 block mb-1">รูปแบบการพบ:</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setMeetingType('ONLINE_MEET')}
                    className={`py-2 px-2 rounded-xl font-bold border transition-all flex items-center justify-center gap-1.5 ${
                      meetingType === 'ONLINE_MEET'
                        ? 'bg-purple-500/20 border-purple-500 text-purple-300'
                        : 'bg-slate-800 border-slate-700 text-slate-400'
                    }`}
                  >
                    <Video className="w-3.5 h-3.5" />
                    <span>Google Meet</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMeetingType('IN_PERSON')}
                    className={`py-2 px-2 rounded-xl font-bold border transition-all flex items-center justify-center gap-1.5 ${
                      meetingType === 'IN_PERSON'
                        ? 'bg-indigo-500/20 border-indigo-500 text-indigo-300'
                        : 'bg-slate-800 border-slate-700 text-slate-400'
                    }`}
                  >
                    <MapPin className="w-3.5 h-3.5" />
                    <span>พบที่โรงเรียน</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-300 block mb-1">วันที่นัดหมาย:</label>
                  <input
                    type="date"
                    value={appointmentDate}
                    onChange={(e) => setAppointmentDate(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="text-slate-300 block mb-1">ช่วงเวลา:</label>
                  <select
                    value={timeSlot}
                    onChange={(e) => setTimeSlot(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  >
                    <option value="15:30 - 16:00 น.">15:30 - 16:00 น.</option>
                    <option value="16:00 - 16:30 น.">16:00 - 16:30 น.</option>
                    <option value="16:30 - 17:00 น.">16:30 - 17:00 น.</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-slate-300 block mb-1">หัวข้อประเด็นที่ต้องการปรึกษา:</label>
                <textarea
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  rows={3}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white resize-none"
                  required
                ></textarea>
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl shadow cursor-pointer transition-all"
              >
                ยืนยันการจองเวลานัดหมาย
              </button>
            </form>
          </div>

          {/* Confirmed Appointments List */}
          <div className="lg:col-span-7 bg-slate-900/70 border border-slate-800 rounded-3xl p-5 sm:p-6 backdrop-blur-md shadow-xl space-y-4">
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-purple-400" />
              รายการนัดหมายและห้องประชุมออนไลน์ (Confirmed Appointments)
            </h4>

            <div className="space-y-3">
              {appointments.map((apt) => (
                <div
                  key={apt.id}
                  className="p-4 bg-slate-800/40 border border-slate-800 rounded-2xl space-y-2.5 hover:border-purple-500/30 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">{apt.teacherName}</span>
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">
                      ✓ ยืนยันการนัดแล้ว
                    </span>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
                    หัวข้อ: {apt.topic}
                  </p>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs pt-1">
                    <span className="text-slate-400">
                      📅 {apt.date} • ⏱️ {apt.timeSlot}
                    </span>

                    {apt.meetingType === 'ONLINE_MEET' ? (
                      <a
                        href={apt.meetLink || '#'}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold flex items-center gap-1.5 shadow"
                      >
                        <Video className="w-3.5 h-3.5" />
                        <span>เข้าห้อง Google Meet</span>
                      </a>
                    ) : (
                      <span className="text-slate-300 font-medium flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-indigo-400" />
                        {apt.locationOrLink}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
