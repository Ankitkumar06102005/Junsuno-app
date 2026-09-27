import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { X, Lock, Phone, Mail, ArrowRight, ShieldCheck, CheckCircle2, Building, RefreshCw, KeyRound } from 'lucide-react';

export const AuthModal: React.FC = () => {
  const { isAuthModalOpen, closeAuthModal, authModalMode, sendCitizenOtp, verifyCitizenOtp, loginAdmin } = useAuth();

  // Mode: 'citizen' | 'admin'
  const [activeTab, setActiveTab] = useState<'citizen' | 'admin'>(authModalMode);

  // Citizen OTP flow states: 'contact' | 'otp'
  const [citizenStep, setCitizenStep] = useState<'contact' | 'otp'>('contact');
  const [citizenContact, setCitizenContact] = useState('');
  const [citizenName, setCitizenName] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [demoCodeHint, setDemoCodeHint] = useState<string | null>(null);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);

  // Admin Login states
  const [adminDept, setAdminDept] = useState('dept-roads');
  const [adminEmail, setAdminEmail] = useState('roads.admin@municipal.gov.in');
  const [adminPassword, setAdminPassword] = useState('••••••••');
  const [isAdminLoggingIn, setIsAdminLoggingIn] = useState(false);

  if (!isAuthModalOpen) return null;

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!citizenContact.trim()) return;
    setIsSendingOtp(true);
    setOtpError(null);
    try {
      const res = await sendCitizenOtp(citizenContact.trim());
      setDemoCodeHint(res.code);
      setCitizenStep('otp');
    } catch (err: any) {
      setOtpError('Failed to send code. Please try again.');
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otpCode.length !== 4) {
      setOtpError('Please enter the 4-digit code.');
      return;
    }
    const success = await verifyCitizenOtp(citizenContact, otpCode, citizenName);
    if (!success) {
      setOtpError('Invalid code. Please try again.');
    }
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAdminLoggingIn(true);
    try {
      await loginAdmin({
        email: adminEmail,
        department_id: adminDept,
        password: adminPassword,
      });
    } finally {
      setIsAdminLoggingIn(false);
    }
  };

  const handleQuickAdminSelect = (deptId: string, email: string) => {
    setAdminDept(deptId);
    setAdminEmail(email);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-[var(--card)] border border-[var(--line)] rounded-2xl w-full max-w-md shadow-2xl overflow-hidden font-sans-civic animate-in fade-in zoom-in-95 duration-150">
        {/* Header Strip */}
        <div className="bg-[var(--bg2)] border-b border-[var(--line)] p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[var(--green)] text-white flex items-center justify-center">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold font-serif-civic text-[var(--ink)]">
                Junsono Authentication Portal
              </h3>
              <p className="text-[11px] text-[var(--ink-soft)]">
                Secure access for citizens & municipal authorities
              </p>
            </div>
          </div>
          <button
            onClick={closeAuthModal}
            className="p-1.5 rounded-lg text-[var(--ink-soft)] hover:text-[var(--ink)] hover:bg-[var(--card)] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-[var(--line)] text-xs font-semibold bg-[var(--bg)]">
          <button
            onClick={() => setActiveTab('citizen')}
            className={`flex-1 py-3 text-center transition-colors cursor-pointer border-b-2 ${
              activeTab === 'citizen'
                ? 'border-[var(--green)] text-[var(--green)] bg-[var(--card)]'
                : 'border-transparent text-[var(--ink-soft)] hover:text-[var(--ink)]'
            }`}
          >
            Citizen Sign-In
          </button>
          <button
            onClick={() => setActiveTab('admin')}
            className={`flex-1 py-3 text-center transition-colors cursor-pointer border-b-2 ${
              activeTab === 'admin'
                ? 'border-[var(--green)] text-[var(--green)] bg-[var(--card)]'
                : 'border-transparent text-[var(--ink-soft)] hover:text-[var(--ink)]'
            }`}
          >
            Department Officer Login
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6">
          {/* ---------------------------------------------------- */}
          {/* CITIZEN LOGIN (OTP FLOW AS PER SPEC SECTION 15.3)     */}
          {/* ---------------------------------------------------- */}
          {activeTab === 'citizen' && (
            <div>
              {citizenStep === 'contact' ? (
                <form onSubmit={handleSendOtp} className="space-y-4">
                  <div>
                    <h4 className="text-base font-bold font-serif-civic text-[var(--ink)]">
                      Sign in to track your grievances
                    </h4>
                    <p className="text-xs text-[var(--ink-soft)] mt-0.5">
                      Enter your mobile number or email. We will send a 4-digit verification code.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-[var(--ink)] mb-1">
                        Your Full Name (Optional):
                      </label>
                      <input
                        type="text"
                        value={citizenName}
                        onChange={(e) => setCitizenName(e.target.value)}
                        placeholder="e.g. Rahul Sharma"
                        className="w-full px-3 py-2 text-xs rounded-lg border border-[var(--line)] bg-[var(--bg)] text-[var(--ink)] focus:outline-none focus:border-[var(--green)]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[var(--ink)] mb-1">
                        Mobile Number or Email Address:
                      </label>
                      <div className="relative">
                        <Phone className="w-3.5 h-3.5 text-[var(--ink-soft)] absolute left-3 top-3" />
                        <input
                          type="text"
                          required
                          value={citizenContact}
                          onChange={(e) => setCitizenContact(e.target.value)}
                          placeholder="+91 98765 43210 or yourname@gmail.com"
                          className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-[var(--line)] bg-[var(--bg)] text-[var(--ink)] focus:outline-none focus:border-[var(--green)] font-mono"
                        />
                      </div>
                    </div>
                  </div>

                  {otpError && (
                    <p className="text-xs text-[var(--brick)] bg-red-50 p-2 rounded border border-red-200">
                      {otpError}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={isSendingOtp || !citizenContact.trim()}
                    className="w-full py-2.5 px-4 rounded-xl bg-[var(--green)] hover:bg-[var(--green-deep)] text-white text-xs font-semibold cursor-pointer shadow-xs transition-colors flex items-center justify-center gap-1.5"
                  >
                    {isSendingOtp ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Sending verification code...</span>
                      </>
                    ) : (
                      <>
                        <span>Send verification code</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>

                  <p className="text-[11px] text-[var(--ink-soft)] text-center">
                    Note: Filing complaints is open to all citizens without prior account creation.
                  </p>
                </form>
              ) : (
                <form onSubmit={handleVerifyOtp} className="space-y-4">
                  <div>
                    <h4 className="text-base font-bold font-serif-civic text-[var(--ink)]">
                      Enter Verification Code
                    </h4>
                    <p className="text-xs text-[var(--ink-soft)] mt-0.5">
                      Code sent to <span className="font-mono font-semibold text-[var(--ink)]">{citizenContact}</span>.
                    </p>
                  </div>

                  {demoCodeHint && (
                    <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center justify-between">
                      <span>Prototype verification OTP:</span>
                      <strong className="font-mono text-sm bg-white px-2 py-0.5 rounded border border-emerald-300">
                        {demoCodeHint}
                      </strong>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-[var(--ink)] mb-1.5">
                      4-Digit Code:
                    </label>
                    <input
                      type="text"
                      maxLength={4}
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/[^0-9]/g, ''))}
                      placeholder="• • • •"
                      className="w-full text-center tracking-widest text-xl py-2 rounded-lg border border-[var(--line)] bg-[var(--bg)] font-mono font-bold text-[var(--ink)] focus:outline-none focus:border-[var(--green)]"
                      autoFocus
                    />
                  </div>

                  {otpError && (
                    <p className="text-xs text-[var(--brick)] bg-red-50 p-2 rounded border border-red-200">
                      {otpError}
                    </p>
                  )}

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setCitizenStep('contact')}
                      className="flex-1 py-2 text-xs border border-[var(--line)] rounded-xl text-[var(--ink-soft)] hover:text-[var(--ink)] cursor-pointer"
                    >
                      Change number
                    </button>
                    <button
                      type="submit"
                      className="flex-1 py-2 rounded-xl bg-[var(--green)] hover:bg-[var(--green-deep)] text-white text-xs font-semibold cursor-pointer shadow-xs transition-colors"
                    >
                      Verify & Sign In
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* ---------------------------------------------------- */}
          {/* MUNICIPAL ADMIN LOGIN                                */}
          {/* ---------------------------------------------------- */}
          {activeTab === 'admin' && (
            <form onSubmit={handleAdminLogin} className="space-y-4">
              <div>
                <h4 className="text-base font-bold font-serif-civic text-[var(--ink)]">
                  Municipal Department Authentication
                </h4>
                <p className="text-xs text-[var(--ink-soft)] mt-0.5">
                  Sign in with your official municipal credentials to access your department queue.
                </p>
              </div>

              {/* Quick Preset Selector for Demo/Judging */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-semibold text-[var(--ink-soft)] uppercase tracking-wider block">
                  Select Department Role:
                </span>
                <div className="grid grid-cols-2 gap-1.5 text-xs">
                  {[
                    { id: 'dept-roads', name: 'Roads Dept', email: 'roads.dept@municipal.gov.in' },
                    { id: 'dept-sanitation', name: 'Sanitation Dept', email: 'sanitation@municipal.gov.in' },
                    { id: 'dept-water', name: 'Water Supply', email: 'watersupply@municipal.gov.in' },
                    { id: 'dept-electricity', name: 'Street Lighting', email: 'streetlighting@municipal.gov.in' },
                    { id: 'dept-health', name: 'Public Health', email: 'publichealth@municipal.gov.in' },
                    { id: 'superadmin', name: 'Super Admin', email: 'commissioner@municipal.gov.in' },
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleQuickAdminSelect(item.id, item.email)}
                      className={`text-left p-2 rounded-lg border text-xs cursor-pointer transition-all ${
                        adminDept === item.id
                          ? 'bg-emerald-50 border-[var(--green)] font-semibold text-emerald-950'
                          : 'bg-[var(--bg)] border-[var(--line)] text-[var(--ink-soft)] hover:text-[var(--ink)]'
                      }`}
                    >
                      <span className="block truncate">{item.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2.5">
                <div>
                  <label className="block text-xs font-semibold text-[var(--ink)] mb-1">
                    Officer Email / User ID:
                  </label>
                  <div className="relative">
                    <Mail className="w-3.5 h-3.5 text-[var(--ink-soft)] absolute left-3 top-3" />
                    <input
                      type="email"
                      required
                      value={adminEmail}
                      onChange={(e) => setAdminEmail(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-[var(--line)] bg-[var(--bg)] font-mono text-[var(--ink)] focus:outline-none focus:border-[var(--green)]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--ink)] mb-1">
                    Password / PIN:
                  </label>
                  <div className="relative">
                    <KeyRound className="w-3.5 h-3.5 text-[var(--ink-soft)] absolute left-3 top-3" />
                    <input
                      type="password"
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-[var(--line)] bg-[var(--bg)] font-mono text-[var(--ink)] focus:outline-none focus:border-[var(--green)]"
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={isAdminLoggingIn}
                className="w-full py-2.5 px-4 rounded-xl bg-[var(--green)] hover:bg-[var(--green-deep)] text-white text-xs font-semibold cursor-pointer shadow-xs transition-colors flex items-center justify-center gap-1.5"
              >
                {isAdminLoggingIn ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Authenticating Department Officer...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>Sign In to Municipal Console</span>
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
