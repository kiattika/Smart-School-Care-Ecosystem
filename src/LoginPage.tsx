import React, { useState } from 'react';
import { useStore } from './store';
import { LogIn, AlertCircle, Loader2, KeyRound, Sparkles } from 'lucide-react';
import { signInWithGoogle, signInWithEmailPassword } from './lib/auth';

const EMULATOR_TEST_USERS = [
  { email: 'kiattika@utd.ac.th', label: 'ผู้ดูแลระบบ (นายเกียรติศักดิ์ แก้วหล้า)', roleTag: 'SUPER_ADMIN', desc: 'ผู้ดูแลระบบสูงสุด (Admin)' },
  { email: 'teacher.test@utd.ac.th', label: 'ครูผู้สอน', roleTag: 'SUBJECT_TEACHER', desc: 'ครูสมปอง สอนดี' },
  { email: 'advisor.test@utd.ac.th', label: 'ครูประจำชั้น ม.5/8', roleTag: 'HOMEROOM_TEACHER', desc: 'ครูเกียรติศักดิ์ สถิตการุณย์' },
  { email: 'exec.test@utd.ac.th', label: 'ผู้บริหารโรงเรียน', roleTag: 'EXECUTIVE', desc: 'ดร.สมเกียรติ บริหารวิชาการ' },
  { email: 'deputy.test@utd.ac.th', label: 'รองผู้อำนวยการฝ่ายวิชาการ', roleTag: 'DEPUTY_DIRECTOR_ACADEMIC', desc: 'ดร.สุนทร (อนุมัติเช็คชื่อย้อนหลัง)' },
  { email: 'admin.test@utd.ac.th', label: 'ผู้ดูแลระบบ (Admin)', roleTag: 'SUPER_ADMIN', desc: 'แอดมินศูนย์ไอที' },
  { email: 'guidance.test@utd.ac.th', label: 'ครูแนะแนว / จิตวิทยา', roleTag: 'GUIDANCE_COUNSELOR', desc: 'ดร.สุดา (สิทธิ์เข้าถึง PHQ-9)' },
  { email: 'finance.test@utd.ac.th', label: 'ฝ่ายการเงิน', roleTag: 'FINANCE_STAFF', desc: 'นางศิริพร การเงินพัสดุ' },
  { email: 'infirmary.test@utd.ac.th', label: 'ห้องพยาบาล', roleTag: 'INFIRMARY_STAFF', desc: 'น.ส.กนกวรรณ พยาบาล' },
  { email: 'parent.test@gmail.com', label: 'ผู้ปกครอง (นายกิตติคุณ)', roleTag: 'PARENT', desc: 'คุณพ่อมนตรี มงคลศิลป์' },
  { email: 'student.test@utd.ac.th', label: 'นักเรียน (ม.5/8)', roleTag: 'STUDENT', desc: 'นายกิตติคุณ มงคลศิลป์' },
];

export function LoginPage() {
  const { setUser } = useStore();
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('test1234');
  const [showManualEmailForm, setShowManualEmailForm] = useState(false);

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      setErrorMessage(null);
      const appUser = await signInWithGoogle();
      setUser(appUser);
    } catch (err: any) {
      if (
        err.code === 'auth/popup-closed-by-user' || 
        err.code === 'auth/cancelled-popup-request' ||
        err.message?.includes('auth/popup-closed-by-user')
      ) {
        return;
      }

      console.error('Google Sign-In Error:', err);
      if (err.message?.includes('AUTH_DOMAIN_RESTRICTED')) {
        setErrorMessage('กรุณาใช้อีเมล Google Workspace ของโรงเรียน (@utd.ac.th) เท่านั้น');
      } else if (err.code === 'auth/unauthorized-domain') {
        setErrorMessage('โดเมนนี้ยังไม่ได้รับอนุญาตใน Firebase Console (Authorized Domains)');
      } else if (err.code === 'auth/popup-blocked') {
        setErrorMessage('เบราว์เซอร์บล็อกหน้าต่างป๊อปอัป กรุณาอนุญาตป๊อปอัปเพื่อเข้าสู่ระบบ');
      } else {
        setErrorMessage(err.message || 'เกิดข้อผิดพลาดในการเข้าสู่ระบบด้วย Google');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEmulatorTestAccountLogin = async (email: string, pass: string = 'test1234') => {
    try {
      setLoading(true);
      setErrorMessage(null);
      const appUser = await signInWithEmailPassword(email, pass);
      setUser(appUser);
    } catch (err: any) {
      console.warn('Sign-In Notice:', err);
      setErrorMessage(`เข้าสู่ระบบไม่สำเร็จ (${err.message || 'กรุณาลองใหม่อีกครั้ง'})`);
    } finally {
      setLoading(false);
    }
  };

  const handleLineParentLogin = () => {
    setErrorMessage('ระบบเข้าสู่ระบบสำหรับผู้ปกครองผ่าน LINE Official Account กำลังเชื่อมต่อ API Gateway (LINE LIFF & Cloud Functions)');
  };

  return (
    <div className="min-h-[100dvh] w-full bg-slate-900 flex flex-col items-center justify-center p-3 sm:p-6 overflow-y-auto touch-scroll">
      <div className="bg-[#151921] border border-white/10 rounded-2xl sm:rounded-3xl p-5 sm:p-8 w-full max-w-full sm:max-w-lg shadow-2xl flex flex-col items-center text-center space-y-5 sm:space-y-6 my-auto">
        <div className="w-14 h-14 sm:w-16 sm:h-16 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-2xl flex items-center justify-center border border-white/10 shadow-lg">
          <LogIn className="w-7 h-7 sm:w-8 sm:h-8 text-white" />
        </div>
        
        <div className="space-y-1 sm:space-y-2">
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Smart School Care</h1>
          <p className="text-slate-400 text-xs sm:text-sm px-2">เข้าสู่ระบบเพื่อเข้าใช้งานระบบบริหารจัดการและช่วยเหลือนักเรียน</p>
        </div>

        {errorMessage && (
          <div className="w-full p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-2.5 text-left text-xs text-red-400">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* ระบบเข้าใช้งานหลักแบบ Real Firebase Auth */}
        <div className="w-full space-y-3 pt-1">
          <button 
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full min-h-[48px] flex items-center justify-center gap-3 bg-white hover:bg-slate-100 disabled:opacity-60 text-slate-900 font-medium py-3 px-4 rounded-xl text-xs sm:text-sm transition-all shadow-md active:scale-[0.98] cursor-pointer"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin text-slate-700" />
            ) : (
              <>
                <img src="https://www.google.com/favicon.ico" alt="Google" className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
                <span className="truncate">เข้าสู่ระบบด้วย Google Workspace (@utd.ac.th)</span>
              </>
            )}
          </button>
          
          <button 
            onClick={handleLineParentLogin}
            disabled={loading}
            className="w-full min-h-[48px] flex items-center justify-center gap-3 bg-[#00B900] hover:bg-[#00A000] disabled:opacity-60 text-white font-medium py-3 px-4 rounded-xl text-xs sm:text-sm transition-all shadow-md active:scale-[0.98] cursor-pointer"
          >
            <div className="w-4 h-4 sm:w-5 sm:h-5 bg-white text-[#00B900] rounded-full flex items-center justify-center font-bold text-[10px] sm:text-xs shrink-0">
              L
            </div>
            <span className="truncate">เข้าสู่ระบบสำหรับผู้ปกครอง (LINE)</span>
          </button>
        </div>

        {/* บัญชีทดสอบสำหรับ Development & Firebase Emulator (Gated behind import.meta.env.DEV) */}
        {import.meta.env.DEV && (
          <div className="w-full pt-4 sm:pt-5 border-t border-white/10 space-y-2.5 sm:space-y-3">
            <div className="text-left flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-[11px] sm:text-xs font-bold text-amber-400 uppercase tracking-wider block">
                  Local Dev / Emulator Test Accounts
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowManualEmailForm(!showManualEmailForm)}
                className="text-[10px] text-slate-400 hover:text-white underline cursor-pointer"
              >
                {showManualEmailForm ? 'ซ่อนฟอร์ม' : 'กรอกอีเมลเอง'}
              </button>
            </div>
            <p className="text-[10px] sm:text-[11px] text-slate-400 text-left">
              คลิกเพื่อเข้าสู่ระบบทันทีด้วยบัญชีทดสอบในเครื่อง (รหัสผ่าน: <code className="text-amber-300">test1234</code>)
            </p>

            {showManualEmailForm && (
              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  if (emailInput) handleEmulatorTestAccountLogin(emailInput, passwordInput);
                }}
                className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/60 text-left space-y-2"
              >
                <div>
                  <label className="text-[10px] text-slate-300 block mb-1">Email (@utd.ac.th / @gmail.com)</label>
                  <input 
                    type="email" 
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    placeholder="advisor.test@utd.ac.th"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-300 block mb-1">Password</label>
                  <input 
                    type="password" 
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-2 py-1.5 px-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>เข้าสู่ระบบด้วย Email/Password</span>
                </button>
              </form>
            )}

            <div className="grid grid-cols-1 gap-1.5 text-left max-h-60 overflow-y-auto pr-1">
              {EMULATOR_TEST_USERS.map((item) => (
                <button
                  key={item.email}
                  type="button"
                  onClick={() => handleEmulatorTestAccountLogin(item.email, 'test1234')}
                  disabled={loading}
                  className="w-full p-2 bg-slate-800/40 hover:bg-slate-800/90 border border-slate-800 hover:border-indigo-500/40 rounded-xl transition-all flex items-center justify-between group cursor-pointer active:scale-[0.99]"
                >
                  <div className="min-w-0 pr-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-slate-200 group-hover:text-white truncate">
                        {item.label}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 truncate">{item.email} • {item.desc}</p>
                  </div>
                  
                  <span className="text-[9px] px-1.5 py-0.5 bg-slate-900 text-slate-300 rounded border border-slate-700/50 shrink-0">
                    {item.roleTag}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
