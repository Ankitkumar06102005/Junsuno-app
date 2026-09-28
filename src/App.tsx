import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { GrievanceWizard } from './components/CitizenPortal/GrievanceWizard';
import { PublicTracker } from './components/CitizenPortal/PublicTracker';
import { AdminDashboard } from './components/AdminDashboard/AdminDashboard';
import { SuperAdminOverview } from './components/SuperAdmin/SuperAdminOverview';
import { SupportedLanguage } from './types';
import { TRANSLATIONS } from './i18n/translations';
import { FileText, Search, Shield, Building2, User, Sparkles, CheckCircle2, Lock } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AuthModal } from './components/Auth/AuthModal';

function AppContent() {
  const { user, openAuthModal } = useAuth();

  // Navigation & Role states
  const [role, setRole] = useState<'citizen' | 'admin' | 'superadmin'>('citizen');
  const [citizenTab, setCitizenTab] = useState<'file' | 'track'>('file');
  const [selectedDeptId, setSelectedDeptId] = useState<string>('dept-roads');

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
    setSearchTicketQuery(complaintId);
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
        {/* CITIZEN PORTAL */}
        {role === 'citizen' && (
          <div>
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

                <div className="hidden sm:flex items-center gap-2 text-[11px] text-[var(--ink-soft)] font-mono">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>AI Triaging Active</span>
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
      </main>

      {/* Global Auth Modal */}
      <AuthModal />

      {/* Institutional Civic Footer */}
      <footer className="border-t border-[var(--line)] bg-[var(--card)] py-6 text-xs text-[var(--ink-soft)] mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-[var(--ink)]">Junsono (जनसुनो)</span>
            <span>·</span>
            <span>Municipal Corporation Grievance Redressal</span>
            <span>·</span>
            <span>Integrated Civic Portal</span>
            <span>·</span>
            <button
              onClick={() => openAuthModal('admin')}
              className="text-emerald-700 dark:text-emerald-400 hover:underline flex items-center gap-1 font-semibold cursor-pointer ml-1"
            >
              <Lock className="w-3 h-3 text-amber-500" />
              <span>Municipal Officer Access</span>
            </button>
          </div>

          <div className="flex items-center gap-4 text-[11px]">
            <span>Powered by Gemini 2.5 Flash & Multilingual NLP</span>
            <span>·</span>
            <span className="font-mono">Interactive Map & Geotagging</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
