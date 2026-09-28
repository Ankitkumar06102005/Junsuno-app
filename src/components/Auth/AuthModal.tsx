import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { X, Lock, Phone, Mail, ArrowRight, ShieldCheck, RefreshCw, KeyRound, Building, CheckCircle2 } from 'lucide-react';

export const AuthModal: React.FC = () => {
  const { isAuthModalOpen, closeAuthModal, authModalMode, sendCitizenOtp, verifyCitizenOtp, loginAdmin } = useAuth();

  // Mode: 'citizen' | 'admin'
  const [activeTab, setActiveTab] = useState<'citizen' | 'admin'>(authModalMode);

  // Sync activeTab when modal opens
  useEffect(() => {
    setActiveTab(authModalMode);
  }, [authModalMode, isAuthModalOpen]);

  // Citizen OTP flow states: 'contact' | 'otp'
  const [citizenStep, setCitizenStep] = useState<'contact' | 'otp'>('contact');
  const [citizenContact, setCitizenContact] = useState('');
  const [citizenName, setCitizenName] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);

  // Admin Login states
  const [adminDept, setAdminDept] = useState('dept-roads');
  const [adminEmail, setAdminEmail] = useState('roads.admin@municipal.gov.in');
  const [adminPassword, setAdminPassword] = useState('Roads@2026!');
  const [isAdminLoggingIn, setIsAdminLoggingIn] = useState(false);
  const [adminError, setAdminError] = useState<string | null>(null);

  // Resend cooldown timer
  useEffect(() => {
    if (countdown <= 0) return;
    const interval = setInterval(() => {
      setCountdown((c) => c - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [countdown]);

  if (!isAuthModalOpen) return null;

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!citizenContact.trim()) return;
    setIsSendingOtp(true);
    setOtpError(null);
    try {
      const res = await sendCitizenOtp(citizenContact.trim(), citizenName);
      setCitizenStep('otp');
      setCountdown(res.waitSeconds || 30);
    } catch (err: any) {
      setOtpError(err.message || 'Failed to dispatch verification code. Please check your network and retry.');
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleResendOtp = async () => {
    if (countdown > 0 || isSendingOtp) return;
    setIsSendingOtp(true);
    setOtpError(null);
    try {
      const res = await sendCitizenOtp(citizenContact.trim(), citizenName);
      setCountdown(res.waitSeconds || 30);
    } catch (err: any) {
      setOtpError(err.message || 'Failed to resend verification code.');
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otpCode.length !== 6) {
      setOtpError('Please enter the full 6-digit verification code.');
      return;
    }
    setIsVerifying(true);
    setOtpError(null);
    try {
      const success = await verifyCitizenOtp(citizenContact, otpCode, citizenName);
      if (!success) {
        setOtpError('Invalid verification code. Please verify the numbers and retry.');
      }
    } catch (err: any) {
      setOtpError(err.message || 'Invalid or expired verification code. Please retry.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAdminLoggingIn(true);
    setAdminError(null);
    try {
      await loginAdmin({
        email: adminEmail,
        department_id: adminDept,
        password: adminPassword,
      });
    } catch (err: any) {
      setAdminError(err.message || 'Municipal authentication failed. Please verify credentials.');
    } finally {
      setIsAdminLoggingIn(false);
    }
  };

  const handleQuickAdminSelect = (deptId: string, email: string, defaultPass: string) => {
    setAdminDept(deptId);
    setAdminEmail(email);
    setAdminPassword(defaultPass);
    setAdminError(null);
  };

  const isEmailContact = citizenContact.includes('@');

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-[#0F2117] border border-[var(--line)] rounded-2xl w-full max-w-md shadow-2xl overflow-hidden font-sans-civic animate-in fade-in zoom-in-95 duration-150">
        {/* Header Strip in Green & White Theme */}
        <div className="bg-emerald-800 text-white p-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white/15 text-white flex items-center justify-center shadow-xs">
              <Lock className="w-4 h-4 text-emerald-100" />
            </div>
            <div>
              <h3 className="text-sm font-bold font-serif-civic text-white">
                Municipal Authentication Portal
              </h3>
              <p className="text-[11px] text-emerald-100">
                Official Junsono (जनसुनो) Redressal System
              </p>
            </div>
          </div>
          <button
            onClick={closeAuthModal}
            className="p-1.5 rounded-lg text-emerald-200 hover:text-white hover:bg-white/10 cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-[var(--line)] text-xs font-semibold bg-emerald-50/50 dark:bg-emerald-950/20">
          <button
            onClick={() => setActiveTab('citizen')}
            className={`flex-1 py-3 text-center transition-colors cursor-pointer border-b-2 ${
              activeTab === 'citizen'
                ? 'border-[var(--green)] text-[var(--green)] bg-white dark:bg-[#0F2117] font-bold'
                : 'border-transparent text-[var(--ink-soft)] hover:text-[var(--ink)]'
            }`}
          >
            Citizen Sign-In (SMS / Email OTP)
          </button>
          <button
            onClick={() => setActiveTab('admin')}
            className={`flex-1 py-3 text-center transition-colors cursor-pointer border-b-2 ${
              activeTab === 'admin'
                ? 'border-[var(--green)] text-[var(--green)] bg-white dark:bg-[#0F2117] font-bold'
                : 'border-transparent text-[var(--ink-soft)] hover:text-[var(--ink)]'
            }`}
          >
            Official Staff Login
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6">
          {/* ---------------------------------------------------- */}
          {/* CITIZEN OTP FLOW (NO DEV CODE IN UI)                 */}
          {/* ---------------------------------------------------- */}
          {activeTab === 'citizen' && (
            <div>
              {citizenStep === 'contact' ? (
                <form onSubmit={handleSendOtp} className="space-y-4">
                  <div>
                    <h4 className="text-base font-bold font-serif-civic text-[var(--ink)]">
                      Citizen Access & Grievance Registration
                    </h4>
                    <p className="text-xs text-[var(--ink-soft)] mt-0.5">
                      Provide your mobile number or email address. A 6-digit cryptographic verification OTP will be sent to your device.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-[var(--ink)] mb-1">
                        Citizen Full Name (Optional):
                      </label>
                      <input
                        type="text"
                        value={citizenName}
                        onChange={(e) => setCitizenName(e.target.value)}
                        placeholder="e.g. Ramesh Kumar"
                        className="w-full px-3 py-2 text-xs rounded-lg border border-[var(--line)] bg-white dark:bg-[#132A1F] text-[var(--ink)] focus:outline-none focus:border-[var(--green)]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[var(--ink)] mb-1">
                        Mobile Number or Email Address:
                      </label>
                      <div className="relative">
                        {isEmailContact ? (
                          <Mail className="w-3.5 h-3.5 text-emerald-700 absolute left-3 top-3" />
                        ) : (
                          <Phone className="w-3.5 h-3.5 text-emerald-700 absolute left-3 top-3" />
                        )}
                        <input
                          type="text"
                          required
                          value={citizenContact}
                          onChange={(e) => setCitizenContact(e.target.value)}
                          placeholder="+91 98765 43210 or citizen@gmail.com"
                          className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-[var(--line)] bg-white dark:bg-[#132A1F] text-[var(--ink)] focus:outline-none focus:border-[var(--green)] font-mono"
                        />
                      </div>
                      <span className="text-[10px] text-emerald-700 dark:text-emerald-400 mt-1 block">
                        SMS delivery for phone numbers | Email delivery for email addresses
                      </span>
                    </div>
                  </div>

                  {otpError && (
                    <p className="text-xs text-red-700 bg-red-50 dark:bg-red-950/40 p-2.5 rounded-lg border border-red-200 dark:border-red-800">
                      {otpError}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={isSendingOtp || !citizenContact.trim()}
                    className="w-full py-2.5 px-4 rounded-xl bg-[var(--green)] hover:bg-[var(--green-deep)] text-white text-xs font-semibold cursor-pointer shadow-xs transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    {isSendingOtp ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Dispatching verification code...</span>
                      </>
                    ) : (
                      <>
                        <span>Send 6-Digit Verification Code</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>

                  <div className="pt-2 border-t border-[var(--line)] text-center">
                    <p className="text-[11px] text-[var(--ink-soft)]">
                      Public civic intake is also accessible directly. Logging in enables SMS/Email status alerts and official tracking.
                    </p>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleVerifyOtp} className="space-y-4">
                  <div>
                    <h4 className="text-base font-bold font-serif-civic text-[var(--ink)]">
                      Enter 6-Digit Verification OTP
                    </h4>
                    <p className="text-xs text-[var(--ink-soft)] mt-0.5">
                      Security code dispatched to: <span className="font-mono font-semibold text-[var(--green)]">{citizenContact}</span>
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[var(--ink)] mb-1.5">
                      Enter Security Code:
                    </label>
                    <input
                      type="text"
                      maxLength={6}
                      required
                      autoFocus
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/[^0-9]/g, ''))}
                      placeholder="• • • • • •"
                      className="w-full text-center tracking-[0.5em] text-xl font-bold py-2.5 rounded-xl border border-[var(--line)] bg-white dark:bg-[#132A1F] text-[var(--ink)] focus:outline-none focus:border-[var(--green)] font-mono"
                    />
                    <span className="text-[11px] text-[var(--ink-soft)] mt-1 block text-center">
                      Code expires in 5 minutes
                    </span>
                  </div>

                  {otpError && (
                    <p className="text-xs text-red-700 bg-red-50 dark:bg-red-950/40 p-2.5 rounded-lg border border-red-200 dark:border-red-800 text-center">
                      {otpError}
                    </p>
                  )}

                  <div className="flex items-center justify-between text-xs pt-1">
                    <button
                      type="button"
                      onClick={() => setCitizenStep('contact')}
                      className="text-[var(--ink-soft)] hover:text-[var(--ink)] underline cursor-pointer"
                    >
                      Change contact details
                    </button>

                    <button
                      type="button"
                      onClick={handleResendOtp}
                      disabled={countdown > 0 || isSendingOtp}
                      className="text-[var(--green)] hover:underline font-semibold cursor-pointer disabled:opacity-40 disabled:no-underline"
                    >
                      {countdown > 0 ? `Resend OTP in ${countdown}s` : 'Resend code'}
                    </button>
                  </div>

                  <button
                    type="submit"
                    disabled={isVerifying || otpCode.length !== 6}
                    className="w-full py-2.5 px-4 rounded-xl bg-[var(--green)] hover:bg-[var(--green-deep)] text-white text-xs font-semibold cursor-pointer shadow-xs transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    {isVerifying ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Verifying security code...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Verify & Enter Portal</span>
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          )}

          {/* ---------------------------------------------------- */}
          {/* MUNICIPAL OFFICIAL STAFF LOGIN                       */}
          {/* ---------------------------------------------------- */}
          {activeTab === 'admin' && (
            <form onSubmit={handleAdminLogin} className="space-y-4">
              <div>
                <h4 className="text-base font-bold font-serif-civic text-[var(--ink)]">
                  Municipal Department Authentication
                </h4>
                <p className="text-xs text-[var(--ink-soft)] mt-0.5">
                  Select your department division and enter official municipal credentials to access your isolated inbox.
                </p>
              </div>

              {/* Department Selector */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider block">
                  Select Department:
                </span>
                <div className="grid grid-cols-2 gap-1.5 text-xs">
                  {[
                    { id: 'dept-roads', name: 'Roads & Infrastructure', email: 'roads.admin@municipal.gov.in', pass: 'Roads@2026!' },
                    { id: 'dept-sanitation', name: 'Sanitation & Solid Waste', email: 'sanitation.admin@municipal.gov.in', pass: 'Swachh@2026!' },
                    { id: 'dept-water', name: 'Water & Sewerage', email: 'water.admin@municipal.gov.in', pass: 'JalSeva@2026!' },
                    { id: 'dept-electricity', name: 'Electricity & Lighting', email: 'electric.admin@municipal.gov.in', pass: 'Power@2026!' },
                    { id: 'dept-health', name: 'Public Health & Vector', email: 'health.admin@municipal.gov.in', pass: 'Arogya@2026!' },
                    { id: 'superadmin', name: 'City Command (Super Admin)', email: 'commissioner@municipal.gov.in', pass: 'JunsonoSuper@2026!' },
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleQuickAdminSelect(item.id, item.email, item.pass)}
                      className={`text-left p-2 rounded-lg border text-xs cursor-pointer transition-all ${
                        adminDept === item.id
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 border-[var(--green)] font-semibold text-emerald-900 dark:text-emerald-200 ring-1 ring-[var(--green)]'
                          : 'bg-white dark:bg-[#132A1F] border-[var(--line)] text-[var(--ink-soft)] hover:text-[var(--ink)]'
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
                    Official Email Address:
                  </label>
                  <div className="relative">
                    <Mail className="w-3.5 h-3.5 text-[var(--ink-soft)] absolute left-3 top-3" />
                    <input
                      type="email"
                      required
                      value={adminEmail}
                      onChange={(e) => setAdminEmail(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-[var(--line)] bg-white dark:bg-[#132A1F] font-mono text-[var(--ink)] focus:outline-none focus:border-[var(--green)]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--ink)] mb-1">
                    Official Password / Key:
                  </label>
                  <div className="relative">
                    <KeyRound className="w-3.5 h-3.5 text-[var(--ink-soft)] absolute left-3 top-3" />
                    <input
                      type="password"
                      required
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-[var(--line)] bg-white dark:bg-[#132A1F] font-mono text-[var(--ink)] focus:outline-none focus:border-[var(--green)]"
                    />
                  </div>
                </div>
              </div>

              {adminError && (
                <p className="text-xs text-red-700 bg-red-50 dark:bg-red-950/40 p-2.5 rounded-lg border border-red-200 dark:border-red-800">
                  {adminError}
                </p>
              )}

              <button
                type="submit"
                disabled={isAdminLoggingIn}
                className="w-full py-2.5 px-4 rounded-xl bg-[var(--green)] hover:bg-[var(--green-deep)] text-white text-xs font-semibold cursor-pointer shadow-xs transition-colors flex items-center justify-center gap-1.5"
              >
                {isAdminLoggingIn ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Verifying Official Credentials...</span>
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
