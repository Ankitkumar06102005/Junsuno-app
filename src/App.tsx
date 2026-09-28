import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { GrievanceWizard } from './components/CitizenPortal/GrievanceWizard';
import { PublicTracker } from './components/CitizenPortal/PublicTracker';
import { AdminDashboard } from './components/AdminDashboard/AdminDashboard';
import { SuperAdminOverview } from './components/SuperAdmin/SuperAdminOverview';
import { SupportedLanguage } from './types';
import { TRANSLATIONS } from './i18n/translations';
import { FileText, Search, Shield, Building2, User, Sparkles, CheckCircle2, Lock, Home, ArrowLeft } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AuthModal } from './components/Auth/AuthModal';
import { LandingPortal } from './components/Auth/LandingPortal';

function AppContent() {
  const { user, openAuthModal } = useAuth();

  // Navigation & Role states
  const [role, setRole] = useState<'citizen' | 'admin' | 'superadmin'>('citizen');
  const [citizenTab, setCitizenTab] = useState<'file' | 'track'>('file');
  const [selectedDeptId, setSelectedDeptId] = useState<string>('dept-roads');

  // Entry / Landing Portal state: Unauthenticated visitors land on entry page first
  const [guestCitizenMode, setGuestCitizenMode] = useState<boolean>(false);

  // Search/Ticket deep-link state
  const [searchTicketQuery, setSearchTicketQuery] = useState<string>('');

  // Accessibility & Localization states
  const [language, setLanguage] = useState<SupportedLanguage>('hi');
  const [fontSizeLarge, setFontSizeLarge] = useState<boolean>(false);
  const [highContrast, setHighContrast] = useState<boolean>(false);
  const [darkMode, setDarkMode] = useState<boolean>(false);

  // Sync role strictly to authenticated session
  useEffect(() => {
    if (user && (user.role === 'admin' || user.role === 'superadmin')) {
      if (user.role === 'superadmin') {
        setRole('superadmin');
      } else {
        setRole('admin');
        if (user.department_id) setSelectedDeptId(user.department_id);
      }
    } else {
      // Normal public visitors are strictly locked to the Citizen view
      setRole('citizen');
    }
  }, [user]);

  // Sync dark mode class on document element
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // Sync high contrast and large text classes
  useEffect(() => {
    if (highContrast) {
      document.documentElement.classList.add('high-contrast');
    } else {
      document.documentElement.classList.remove('high-contrast');
    }
  }, [highContrast]);

  useEffect(() => {
    if (fontSizeLarge) {
      document.documentElement.classList.add('large-text');
    } else {
      document.documentElement.classList.remove('large-text');
    }
  }, [fontSizeLarge]);

  const t = TRANSLATIONS[language] || TRANSLATIONS.en;

  // Handle viewing a newly submitted grievance in the ledger
  const handleViewGrievance = (complaintId: string) => {
    setGuestCitizenMode(true);
    setSearchTicketQuery(complaintId);
    setCitizenTab('track');
  };

  const handleTrackFromLanding = (ticketId: string) => {
    setSearchTicketQuery(ticketId);
    setGuestCitizenMode(true);
    setCitizenTab('track');
  };

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg)] text-[var(--ink)] transition-colors">
      {/* Universal Header with Navigation, Accessibility, Language, Auth */}
      <Header
        currentRole={role}
        onRoleChange={setRole}
        language={language}
        onLanguageChange={setLanguage}
        fontSizeLarge={fontSizeLarge}
        onToggleFontSize={() => setFontSizeLarge(!fontSizeLarge)}
        highContrast={highContrast}
        onToggleHighContrast={() => setHighContrast(!highContrast)}
        darkMode={darkMode}
        onToggleDarkMode={() => setDarkMode(!darkMode)}
      />

      {/* Main Content Area */}
      <main className="flex-1">
        {/* If user is not authenticated and hasn't chosen guest mode, ALWAYS START ON THE LANDING / ENTRY LOGIN PAGE */}
        {!user && !guestCitizenMode ? (
          <LandingPortal
            language={language}
            onTrackTicket={handleTrackFromLanding}
            onEnterAsGuest={() => setGuestCitizenMode(true)}
          />
        ) : (
          <>
            {/* CITIZEN PORTAL */}
            {role === 'citizen' && (
              <div>
                {/* Guest Navigation Banner (if accessing without login) */}
                {!user && guestCitizenMode && (
                  <div className="bg-emerald-100 dark:bg-emerald-950/80 border-b border-emerald-300 dark:border-emerald-800 px-4 py-2 text-xs flex items-center justify-between">
                    <div className="flex items-center gap-2 text-emerald-900 dark:text-emerald-200">
                      <span className="w-2 h-2 rounded-full bg-emerald-600" />
                      <span>Guest Citizen Mode — Direct Grievance Registration</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => openAuthModal('citizen')}
                        className="text-emerald-800 dark:text-emerald-300 font-semibold underline hover:text-emerald-950 cursor-pointer"
                      >
                        Sign in via OTP for SMS Alerts
                      </button>
                      <button
                        onClick={() => setGuestCitizenMode(false)}
                        className="px-2 py-0.5 rounded bg-white dark:bg-emerald-900 border border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-100 font-medium hover:bg-emerald-50 cursor-pointer flex items-center gap-1"
                      >
                        <ArrowLeft className="w-3 h-3" />
                        <span>Return to Main Login</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Citizen Secondary Tab Strip */}
                <div className="border-b border-[var(--line)] bg-[var(--card)] sticky top-14 z-30">
                  <div className="max-w-4xl mx-auto px-4 sm:px-6 flex items-center justify-between">
                    <div className="flex items-center gap-1 sm:gap-2">
                      <button
                        onClick={() => {
                          setCitizenTab('file');
                          setSearchTicketQuery('');
                        }}
                        className={`py-3 px-4 text-xs font-semibold border-b-2 cursor-pointer transition-colors flex items-center gap-2 ${
                          citizenTab === 'file'
                            ? 'border-[var(--green)] text-[var(--green)] font-bold'
                            : 'border-transparent text-[var(--ink-soft)] hover:text-[var(--ink)]'
                        }`}
                      >
                        <FileText className="w-4 h-4" />
                        <span>{t.fileGrievance}</span>
                      </button>

                      <button
                        onClick={() => setCitizenTab('track')}
                        className={`py-3 px-4 text-xs font-semibold border-b-2 cursor-pointer transition-colors flex items-center gap-2 ${
                          citizenTab === 'track'
                            ? 'border-[var(--green)] text-[var(--green)] font-bold'
                            : 'border-transparent text-[var(--ink-soft)] hover:text-[var(--ink)]'
                        }`}
                      >
                        <Search className="w-4 h-4" />
                        <span>{t.trackGrievance}</span>
                      </button>
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-[var(--ink-soft)] font-mono">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span>AI Multilingual Triaging Active</span>
                    </div>
                  </div>
                </div>

                {/* Tab Views */}
                {citizenTab === 'file' ? (
                  <GrievanceWizard
                    language={language}
                    onViewGrievance={handleViewGrievance}
                    onGoToLedger={() => setCitizenTab('track')}
                  />
                ) : (
                  <PublicTracker
                    language={language}
                    initialQuery={searchTicketQuery}
                    onNewComplaintClick={() => setCitizenTab('file')}
                  />
                )}
              </div>
            )}

            {/* DEPARTMENT ADMIN PORTAL */}
            {role === 'admin' && (
              <AdminDashboard
                language={language}
                selectedDeptId={selectedDeptId}
                onSelectDeptId={setSelectedDeptId}
              />
            )}

            {/* SUPER ADMIN OVERVIEW */}
            {role === 'superadmin' && (
              <SuperAdminOverview
                onSelectDepartment={(deptId) => {
                  setSelectedDeptId(deptId);
                  setRole('admin');
                }}
              />
            )}
          </>
        )}
      </main>

      {/* Global Auth Modal */}
      <AuthModal />

      {/* Institutional Civic Footer in Green & White Mix */}
      <footer className="border-t border-[var(--line)] bg-white dark:bg-[#0D2116] py-6 text-xs text-[var(--ink-soft)] mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-serif-civic font-bold text-emerald-950 dark:text-emerald-100">
              Junsono (जनसुनो)
            </span>
            <span className="opacity-40">|</span>
            <span className="text-[11px]">
              Civic Redressal & Municipal Operations System
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-[11px]">
            <span>Municipal Engineering Helpline: 1800-180-2026</span>
            <span className="opacity-40">|</span>
            <button
              onClick={() => setGuestCitizenMode(false)}
              className="text-emerald-800 dark:text-emerald-300 hover:underline cursor-pointer font-medium flex items-center gap-1"
            >
              <Home className="w-3 h-3" />
              <span>Main Entry Portal</span>
            </button>
            <span className="opacity-40">|</span>
            {/* Discrete Official Staff Link */}
            <button
              onClick={() => openAuthModal('admin')}
              className="text-emerald-800 dark:text-emerald-300 hover:text-emerald-950 flex items-center gap-1 cursor-pointer font-semibold underline"
              title="Restricted official access"
            >
              <Lock className="w-3 h-3 text-emerald-700" />
              <span>Official Municipal Staff Login</span>
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}

export function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
