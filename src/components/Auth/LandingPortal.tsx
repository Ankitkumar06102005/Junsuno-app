import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  Shield,
  Building2,
  User,
  ArrowRight,
  Phone,
  Mail,
  Search,
  CheckCircle2,
  Lock,
  Sparkles,
  RefreshCw,
  FileText,
  AlertCircle,
  HelpCircle,
  KeyRound,
  ExternalLink,
} from 'lucide-react';
import { SupportedLanguage } from '../../types';
import { TRANSLATIONS } from '../../i18n/translations';

interface LandingPortalProps {
  language: SupportedLanguage;
  onTrackTicket: (ticketId: string) => void;
  onEnterAsGuest: () => void;
}

export const LandingPortal: React.FC<LandingPortalProps> = ({
  language,
  onTrackTicket,
  onEnterAsGuest,
}) => {
  const { sendCitizenOtp, verifyCitizenOtp, loginAdmin, openAuthModal } = useAuth();
  const t = TRANSLATIONS[language] || TRANSLATIONS.en;

  // Active form on landing page: 'citizen' | 'official' | 'track'
  const [activeForm, setActiveForm] = useState<'citizen' | 'official'>('citizen');

  // Inline Citizen OTP States
  const [citizenStep, setCitizenStep] = useState<'contact' | 'otp'>('contact');
  const [citizenContact, setCitizenContact] = useState('');
  const [citizenName, setCitizenName] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [otpMessage, setOtpMessage] = useState<string | null>(null);

  // Inline Officer Login States
  const [adminDept, setAdminDept] = useState('dept-roads');
  const [adminEmail, setAdminEmail] = useState('roads.admin@municipal.gov.in');
  const [adminPassword, setAdminPassword] = useState('Roads@2026!');
  const [isAdminLoggingIn, setIsAdminLoggingIn] = useState(false);
  const [adminError, setAdminError] = useState<string | null>(null);

  // Quick Tracker input
  const [trackerInput, setTrackerInput] = useState('');

  // Handle Send OTP
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!citizenContact.trim()) return;
    setIsSendingOtp(true);
    setOtpError(null);
    setOtpMessage(null);
    try {
      const res = await sendCitizenOtp(citizenContact.trim(), citizenName);
      setCitizenStep('otp');
      setOtpMessage(res.message);
    } catch (err: any) {
      setOtpError(err.message || 'Failed to dispatch verification code. Please retry.');
    } finally {
      setIsSendingOtp(false);
    }
  };

  // Handle Verify OTP
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otpCode.length !== 6) {
      setOtpError('Please enter the complete 6-digit code.');
      return;
    }
    setIsVerifying(true);
    setOtpError(null);
    try {
      const success = await verifyCitizenOtp(citizenContact, otpCode, citizenName);
      if (!success) {
        setOtpError('Invalid verification code. Please check and retry.');
      }
    } catch (err: any) {
      setOtpError(err.message || 'Invalid or expired code.');
    } finally {
      setIsVerifying(false);
    }
  };

  // Handle Admin Login
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
      setAdminError(err.message || 'Authentication failed. Please verify credentials.');
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

  const handleTrackSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (trackerInput.trim()) {
      onTrackTicket(trackerInput.trim().toUpperCase());
    }
  };

  return (
    <div className="min-h-[85vh] bg-gradient-to-b from-[#F0FDF4] via-[#FFFFFF] to-[#F0FDF4] dark:from-[#08150E] dark:via-[#0D2116] dark:to-[#08150E] py-8 px-4 sm:px-6">
      <div className="max-w-6xl mx-auto space-y-10">
        {/* Institutional Hero Banner */}
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
            <span>Official Municipal Civic Redressal Portal</span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold font-serif-civic text-emerald-950 dark:text-emerald-50 tracking-tight">
            Junsono (जनसुनो)
          </h1>
          <p className="text-sm sm:text-base text-emerald-800 dark:text-emerald-200/90 font-sans-civic max-w-2xl mx-auto">
            Centralized Grievance Redressal, Multilingual AI Triaging, and Departmental Dispatch for Municipal Corporations.
          </p>
        </div>

        {/* Quick Ticket Tracker Bar */}
        <div className="max-w-xl mx-auto bg-white dark:bg-[#12281D] p-2 rounded-2xl border-2 border-emerald-200 dark:border-emerald-900 shadow-md">
          <form onSubmit={handleTrackSubmit} className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-emerald-700 absolute left-3 top-3" />
              <input
                type="text"
                value={trackerInput}
                onChange={(e) => setTrackerInput(e.target.value)}
                placeholder="Track grievance by Ticket # (e.g. JSN-1001)..."
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-emerald-50/50 dark:bg-[#0A1B12] text-emerald-950 dark:text-emerald-100 font-mono outline-none border border-emerald-100 dark:border-emerald-900/60 focus:border-emerald-500"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-semibold cursor-pointer shadow-xs transition-colors flex items-center gap-1.5"
            >
              <span>Track</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>

        {/* Dual Entry Portals (Citizen & Official Staff) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start max-w-5xl mx-auto">
          {/* LEFT: Portal Switcher & Informational Column */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-white dark:bg-[#12281D] p-5 rounded-2xl border border-emerald-100 dark:border-emerald-900/70 shadow-sm space-y-4">
              <h2 className="text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-400">
                Choose Access Section
              </h2>

              <div className="space-y-2">
                {/* Citizen Option */}
                <button
                  type="button"
                  onClick={() => setActiveForm('citizen')}
                  className={`w-full p-4 rounded-xl text-left border transition-all cursor-pointer flex items-start gap-3 ${
                    activeForm === 'citizen'
                      ? 'bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-600 dark:border-emerald-500 shadow-xs'
                      : 'bg-white dark:bg-[#0F2218] border-gray-200 dark:border-emerald-900/40 hover:border-emerald-300'
                  }`}
                >
                  <div
                    className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      activeForm === 'citizen'
                        ? 'bg-emerald-700 text-white'
                        : 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300'
                    }`}
                  >
                    <User className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-emerald-950 dark:text-emerald-50">
                      Citizen Grievance Portal
                    </h3>
                    <p className="text-xs text-emerald-800/80 dark:text-emerald-300/80 mt-0.5">
                      Log civic defects, upload site photos, get SMS/Email updates, or continue directly.
                    </p>
                  </div>
                </button>

                {/* Municipal Staff Option */}
                <button
                  type="button"
                  onClick={() => setActiveForm('official')}
                  className={`w-full p-4 rounded-xl text-left border transition-all cursor-pointer flex items-start gap-3 ${
                    activeForm === 'official'
                      ? 'bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-600 dark:border-emerald-500 shadow-xs'
                      : 'bg-white dark:bg-[#0F2218] border-gray-200 dark:border-emerald-900/40 hover:border-emerald-300'
                  }`}
                >
                  <div
                    className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      activeForm === 'official'
                        ? 'bg-emerald-700 text-white'
                        : 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300'
                    }`}
                  >
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-emerald-950 dark:text-emerald-50">
                      Official Department Login
                    </h3>
                    <p className="text-xs text-emerald-800/80 dark:text-emerald-300/80 mt-0.5">
                      Protected console for Municipal Engineers, Health Officers, and Zonal Staff.
                    </p>
                  </div>
                </button>
              </div>

              {/* Direct Guest Entry Option */}
              <div className="pt-2 border-t border-emerald-100 dark:border-emerald-900/40">
                <button
                  type="button"
                  onClick={onEnterAsGuest}
                  className="w-full py-2.5 px-3 rounded-xl border border-dashed border-emerald-300 dark:border-emerald-700/60 bg-emerald-50/40 dark:bg-emerald-950/20 hover:bg-emerald-100/50 text-emerald-800 dark:text-emerald-200 text-xs font-semibold cursor-pointer transition-colors flex items-center justify-center gap-1.5"
                >
                  <FileText className="w-3.5 h-3.5 text-emerald-600" />
                  <span>File Complaint Directly (Guest Citizen Entry)</span>
                </button>
              </div>
            </div>

            {/* Department Quick Directory */}
            <div className="bg-white dark:bg-[#12281D] p-4 rounded-2xl border border-emerald-100 dark:border-emerald-900/60 text-xs space-y-2">
              <span className="font-bold text-emerald-950 dark:text-emerald-100 block">
                Active Municipal Divisions:
              </span>
              <div className="grid grid-cols-2 gap-2 text-[11px] text-emerald-900/80 dark:text-emerald-300/80">
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                  Roads & Works
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                  Sanitation & Waste
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                  Water & Drainage
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                  Street Lighting
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                  Public Health
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                  City Command
                </span>
              </div>
            </div>
          </div>

          {/* RIGHT: Active Form Card (Citizen OTP or Official Staff Login) */}
          <div className="lg:col-span-7 bg-white dark:bg-[#12281D] rounded-2xl border-2 border-emerald-200 dark:border-emerald-800 shadow-xl p-6 sm:p-8">
            {/* CITIZEN PORTAL INTAKE FORM */}
            {activeForm === 'citizen' && (
              <div>
                <div className="border-b border-emerald-100 dark:border-emerald-900/60 pb-4 mb-5">
                  <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 text-xs font-semibold">
                    <User className="w-4 h-4" />
                    <span>Citizen Verification & Entry</span>
                  </div>
                  <h3 className="text-xl font-bold font-serif-civic text-emerald-950 dark:text-emerald-50 mt-1">
                    Sign In with Mobile or Email OTP
                  </h3>
                  <p className="text-xs text-emerald-800/80 dark:text-emerald-300/80 mt-1">
                    Receive a 6-digit cryptographic verification code on your mobile SMS or email address.
                  </p>
                </div>

                {citizenStep === 'contact' ? (
                  <form onSubmit={handleSendOtp} className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-emerald-950 dark:text-emerald-100 mb-1">
                        Citizen Name (Optional):
                      </label>
                      <input
                        type="text"
                        value={citizenName}
                        onChange={(e) => setCitizenName(e.target.value)}
                        placeholder="e.g. Ramesh Kumar"
                        className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-emerald-200 dark:border-emerald-900/80 bg-emerald-50/30 dark:bg-[#0A1B12] text-emerald-950 dark:text-emerald-100 outline-none focus:border-emerald-600"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-emerald-950 dark:text-emerald-100 mb-1">
                        Mobile Number or Email Address:
                      </label>
                      <div className="relative">
                        {citizenContact.includes('@') ? (
                          <Mail className="w-4 h-4 text-emerald-700 absolute left-3.5 top-3" />
                        ) : (
                          <Phone className="w-4 h-4 text-emerald-700 absolute left-3.5 top-3" />
                        )}
                        <input
                          type="text"
                          required
                          value={citizenContact}
                          onChange={(e) => setCitizenContact(e.target.value)}
                          placeholder="+91 98765 43210 or yourname@gmail.com"
                          className="w-full pl-10 pr-3.5 py-2.5 text-xs rounded-xl border border-emerald-200 dark:border-emerald-900/80 bg-emerald-50/30 dark:bg-[#0A1B12] text-emerald-950 dark:text-emerald-100 font-mono outline-none focus:border-emerald-600"
                        />
                      </div>
                      <span className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-1 block">
                        SMS OTP for 10-digit mobile numbers | Email OTP for email addresses
                      </span>
                    </div>

                    {otpError && (
                      <p className="text-xs text-red-700 bg-red-50 dark:bg-red-950/40 p-2.5 rounded-xl border border-red-200 dark:border-red-800">
                        {otpError}
                      </p>
                    )}

                    <button
                      type="submit"
                      disabled={isSendingOtp || !citizenContact.trim()}
                      className="w-full py-3 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold cursor-pointer shadow-md transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {isSendingOtp ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Dispatching Security OTP...</span>
                        </>
                      ) : (
                        <>
                          <span>Get 6-Digit Verification OTP</span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </form>
                ) : (
                  <form onSubmit={handleVerifyOtp} className="space-y-4">
                    <div className="bg-emerald-50 dark:bg-emerald-950/40 p-3 rounded-xl border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-900 dark:text-emerald-200">
                      <span>Code dispatched to: </span>
                      <strong className="font-mono">{citizenContact}</strong>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-emerald-950 dark:text-emerald-100 mb-1.5">
                        Enter 6-Digit OTP:
                      </label>
                      <input
                        type="text"
                        maxLength={6}
                        required
                        autoFocus
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value.replace(/[^0-9]/g, ''))}
                        placeholder="• • • • • •"
                        className="w-full text-center tracking-[0.5em] text-2xl font-bold py-3 rounded-xl border-2 border-emerald-300 dark:border-emerald-700 bg-white dark:bg-[#0A1B12] text-emerald-950 dark:text-emerald-100 font-mono outline-none focus:border-emerald-600"
                      />
                    </div>

                    {otpError && (
                      <p className="text-xs text-red-700 bg-red-50 dark:bg-red-950/40 p-2.5 rounded-xl border border-red-200 dark:border-red-800 text-center">
                        {otpError}
                      </p>
                    )}

                    <div className="flex items-center justify-between text-xs pt-1">
                      <button
                        type="button"
                        onClick={() => setCitizenStep('contact')}
                        className="text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer"
                      >
                        Change Contact
                      </button>
                      <button
                        type="button"
                        onClick={handleSendOtp}
                        className="text-emerald-700 dark:text-emerald-400 font-semibold hover:underline cursor-pointer"
                      >
                        Resend Code
                      </button>
                    </div>

                    <button
                      type="submit"
                      disabled={isVerifying || otpCode.length !== 6}
                      className="w-full py-3 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold cursor-pointer shadow-md transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {isVerifying ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Verifying OTP...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Verify & Proceed to Dashboard</span>
                        </>
                      )}
                    </button>
                  </form>
                )}
              </div>
            )}

            {/* OFFICIAL MUNICIPAL STAFF LOGIN FORM */}
            {activeForm === 'official' && (
              <form onSubmit={handleAdminLogin} className="space-y-4">
                <div className="border-b border-emerald-100 dark:border-emerald-900/60 pb-4 mb-5">
                  <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 text-xs font-semibold">
                    <Lock className="w-4 h-4" />
                    <span>Official Authentication Console</span>
                  </div>
                  <h3 className="text-xl font-bold font-serif-civic text-emerald-950 dark:text-emerald-50 mt-1">
                    Municipal Staff & Department Sign-In
                  </h3>
                  <p className="text-xs text-emerald-800/80 dark:text-emerald-300/80 mt-1">
                    Select your municipal department to load credentials and manage your isolated complaint queue.
                  </p>
                </div>

                {/* Department Selector */}
                <div className="space-y-1.5">
                  <span className="text-[11px] font-bold text-emerald-900 dark:text-emerald-300 uppercase tracking-wider block">
                    Choose Department:
                  </span>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {[
                      { id: 'dept-roads', name: 'Roads & Infrastructure', email: 'roads.admin@municipal.gov.in', pass: 'Roads@2026!' },
                      { id: 'dept-sanitation', name: 'Sanitation & Solid Waste', email: 'sanitation.admin@municipal.gov.in', pass: 'Swachh@2026!' },
                      { id: 'dept-water', name: 'Water & Sewerage', email: 'water.admin@municipal.gov.in', pass: 'JalSeva@2026!' },
                      { id: 'dept-electricity', name: 'Street Lighting & Power', email: 'electric.admin@municipal.gov.in', pass: 'Power@2026!' },
                      { id: 'dept-health', name: 'Public Health & Vector', email: 'health.admin@municipal.gov.in', pass: 'Arogya@2026!' },
                      { id: 'superadmin', name: 'City Command (Commissioner)', email: 'commissioner@municipal.gov.in', pass: 'JunsonoSuper@2026!' },
                    ].map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleQuickAdminSelect(item.id, item.email, item.pass)}
                        className={`text-left p-2.5 rounded-xl border text-xs cursor-pointer transition-all ${
                          adminDept === item.id
                            ? 'bg-emerald-100/70 dark:bg-emerald-950/60 border-emerald-600 dark:border-emerald-500 font-bold text-emerald-950 dark:text-emerald-100 ring-1 ring-emerald-500'
                            : 'bg-emerald-50/40 dark:bg-[#0A1B12] border-emerald-100 dark:border-emerald-900/60 text-emerald-800 dark:text-emerald-300 hover:border-emerald-400'
                        }`}
                      >
                        <span className="block truncate">{item.name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-emerald-950 dark:text-emerald-100 mb-1">
                      Official Email:
                    </label>
                    <div className="relative">
                      <Mail className="w-3.5 h-3.5 text-emerald-700 absolute left-3 top-3" />
                      <input
                        type="email"
                        required
                        value={adminEmail}
                        onChange={(e) => setAdminEmail(e.target.value)}
                        className="w-full pl-9 pr-3 py-2.5 text-xs rounded-xl border border-emerald-200 dark:border-emerald-900 bg-white dark:bg-[#0A1B12] text-emerald-950 dark:text-emerald-100 font-mono outline-none focus:border-emerald-600"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-emerald-950 dark:text-emerald-100 mb-1">
                      Official Password / PIN:
                    </label>
                    <div className="relative">
                      <KeyRound className="w-3.5 h-3.5 text-emerald-700 absolute left-3 top-3" />
                      <input
                        type="password"
                        required
                        value={adminPassword}
                        onChange={(e) => setAdminPassword(e.target.value)}
                        className="w-full pl-9 pr-3 py-2.5 text-xs rounded-xl border border-emerald-200 dark:border-emerald-900 bg-white dark:bg-[#0A1B12] text-emerald-950 dark:text-emerald-100 font-mono outline-none focus:border-emerald-600"
                      />
                    </div>
                  </div>
                </div>

                {adminError && (
                  <p className="text-xs text-red-700 bg-red-50 dark:bg-red-950/40 p-2.5 rounded-xl border border-red-200 dark:border-red-800">
                    {adminError}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={isAdminLoggingIn}
                  className="w-full py-3 px-4 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold cursor-pointer shadow-md transition-colors flex items-center justify-center gap-2"
                >
                  {isAdminLoggingIn ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Authenticating Department Officer...</span>
                    </>
                  ) : (
                    <>
                      <Building2 className="w-4 h-4" />
                      <span>Sign In to Department Console</span>
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
