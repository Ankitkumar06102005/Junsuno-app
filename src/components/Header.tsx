import React from 'react';
import { Volume2, Moon, Sun, Eye, Globe, Building2, User, ShieldCheck, LogIn, LogOut, Lock } from 'lucide-react';
import { LANGUAGES, TRANSLATIONS } from '../i18n/translations';
import { SupportedLanguage } from '../types';
import { useAuth } from '../context/AuthContext';

interface HeaderProps {
  currentRole: 'citizen' | 'admin' | 'superadmin';
  onRoleChange: (role: 'citizen' | 'admin' | 'superadmin') => void;
  language: SupportedLanguage;
  onLanguageChange: (lang: SupportedLanguage) => void;
  fontSizeLarge: boolean;
  onToggleFontSize: () => void;
  highContrast: boolean;
  onToggleHighContrast: () => void;
  darkMode: boolean;
  onToggleDarkMode: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentRole,
  onRoleChange,
  language,
  onLanguageChange,
  fontSizeLarge,
  onToggleFontSize,
  highContrast,
  onToggleHighContrast,
  darkMode,
  onToggleDarkMode,
}) => {
  const t = TRANSLATIONS[language] || TRANSLATIONS.en;
  const { user, logout, openAuthModal } = useAuth();

  const handleRoleClick = (newRole: 'citizen' | 'admin' | 'superadmin') => {
    // If selecting admin or superadmin and not logged in as admin, trigger login modal
    if ((newRole === 'admin' || newRole === 'superadmin') && (!user || (user.role !== 'admin' && user.role !== 'superadmin'))) {
      openAuthModal('admin');
      return;
    }
    onRoleChange(newRole);
  };

  return (
    <header className="border-b border-[var(--line)] bg-[var(--card)] sticky top-0 z-40 transition-colors">
      {/* Top Civic Jurisdiction Bar */}
      <div className="bg-[var(--green-deep)] text-[#EAF0E4] px-4 py-1.5 text-xs flex flex-wrap items-center justify-between gap-2 border-b border-[#2C392F]">
        <div className="flex items-center gap-3">
          <span className="font-medium tracking-wide">MUNICIPAL CORPORATION CIVIC GRIEVANCE REGISTER</span>
          <span className="opacity-40">|</span>
          <span className="opacity-80">Central Redressal & Triaging Division</span>
        </div>

        {/* Accessibility & Language Strip */}
        <div className="flex items-center gap-3">
          {/* User Sign-In / Account Strip */}
          {user ? (
            <div className="flex items-center gap-2 pr-2 border-r border-[#2C392F]">
              <span className="text-[11px] font-medium text-emerald-200 flex items-center gap-1">
                {user.role === 'citizen' ? <User className="w-3 h-3" /> : <Lock className="w-3 h-3 text-amber-300" />}
                <span className="truncate max-w-[120px]">{user.name}</span>
              </span>
              <button
                onClick={logout}
                className="text-[11px] hover:text-white text-emerald-300 underline cursor-pointer flex items-center gap-0.5"
                title="Sign out"
              >
                <LogOut className="w-3 h-3" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          ) : (
            <button
              onClick={() => openAuthModal('citizen')}
              className="flex items-center gap-1 text-[11px] font-semibold text-white bg-[var(--green)] hover:bg-emerald-700 px-2 py-0.5 rounded cursor-pointer transition-colors"
            >
              <LogIn className="w-3 h-3" />
              <span>Sign In / Login</span>
            </button>
          )}

          {/* Font Size Toggle */}
          <button
            onClick={onToggleFontSize}
            className="flex items-center gap-1 hover:text-white px-1.5 py-0.5 rounded transition-colors text-xs cursor-pointer"
            title="Toggle larger font size for accessibility"
            aria-label="Toggle font size"
          >
            <span className="font-bold">A</span>
            <span className="text-[10px]">{fontSizeLarge ? 'A-' : 'A+'}</span>
          </button>

          {/* High Contrast Toggle */}
          <button
            onClick={onToggleHighContrast}
            className={`flex items-center gap-1 px-1.5 py-0.5 rounded transition-colors text-xs cursor-pointer ${
              highContrast ? 'bg-amber-400 text-black font-bold' : 'hover:text-white'
            }`}
            title="Toggle high contrast mode"
            aria-label="Toggle high contrast"
          >
            <Eye className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Contrast</span>
          </button>

          {/* Dark Mode Toggle */}
          <button
            onClick={onToggleDarkMode}
            className="hover:text-white p-1 rounded transition-colors cursor-pointer"
            title="Toggle dark mode"
            aria-label="Toggle theme"
          >
            {darkMode ? <Sun className="w-3.5 h-3.5 text-amber-300" /> : <Moon className="w-3.5 h-3.5" />}
          </button>

          {/* Language Picker Dropdown */}
          <div className="flex items-center gap-1 bg-[#153529] border border-[#2C392F] rounded px-2 py-0.5">
            <Globe className="w-3.5 h-3.5 opacity-80" />
            <select
              value={language}
              onChange={(e) => onLanguageChange(e.target.value as SupportedLanguage)}
              className="bg-transparent text-xs text-white outline-none cursor-pointer pr-1"
              aria-label="Select language"
            >
              {LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code} className="bg-[#1C2620] text-white">
                  {lang.nativeName} ({lang.label})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main App Navigation Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-4">
        {/* Brand & Seal */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg border-2 border-[var(--green)] flex items-center justify-center bg-[var(--bg2)] text-[var(--green)] flex-shrink-0 shadow-xs">
            <svg
              className="w-6 h-6"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 2L3 7v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-9-5z" />
              <path d="M12 8v8" />
              <path d="M8 12h8" />
            </svg>
          </div>

          <div>
            <div className="flex items-baseline gap-2">
              <h1 className="text-xl sm:text-2xl font-bold font-serif-civic tracking-tight text-[var(--ink)]">
                {t.appName}
              </h1>
              <span className="text-xs font-mono font-medium px-1.5 py-0.5 rounded border border-[var(--line)] text-[var(--ink-soft)] bg-[var(--bg)]">
                Municipal Hub
              </span>
            </div>
            <p className="text-xs text-[var(--ink-soft)] font-sans-civic line-clamp-1">
              {t.tagline}
            </p>
          </div>
        </div>

        {/* Role Switching Control */}
        <div className="flex items-center p-1 bg-[var(--bg2)] border border-[var(--line)] rounded-lg">
          <button
            onClick={() => handleRoleClick('citizen')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${
              currentRole === 'citizen'
                ? 'bg-[var(--card)] text-[var(--ink)] shadow-xs font-semibold'
                : 'text-[var(--ink-soft)] hover:text-[var(--ink)]'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>{t.citizenPortal}</span>
          </button>

          <button
            onClick={() => handleRoleClick('admin')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${
              currentRole === 'admin'
                ? 'bg-[var(--card)] text-[var(--ink)] shadow-xs font-semibold'
                : 'text-[var(--ink-soft)] hover:text-[var(--ink)]'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>{t.adminPortal}</span>
            {user && (user.role === 'admin' || user.role === 'superadmin') && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            )}
          </button>

          <button
            onClick={() => handleRoleClick('superadmin')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${
              currentRole === 'superadmin'
                ? 'bg-[var(--card)] text-[var(--ink)] shadow-xs font-semibold'
                : 'text-[var(--ink-soft)] hover:text-[var(--ink)]'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t.superAdminPortal}</span>
            <span className="sm:hidden">Command</span>
          </button>
        </div>
      </div>
    </header>
  );
};
