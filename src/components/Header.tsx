import React from 'react';
import { Volume2, Moon, Sun, Eye, Globe, Building2, User, ShieldCheck, LogIn, LogOut, Lock, ExternalLink } from 'lucide-react';
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

  const isOfficerOrAdmin = user && (user.role === 'admin' || user.role === 'superadmin');

  return (
    <header className="border-b border-[var(--line)] bg-[var(--card)] sticky top-0 z-40 transition-colors shadow-2xs">
      {/* Top Civic Jurisdiction Bar */}
      <div className="bg-[var(--green-deep)] text-[#EAF0E4] px-4 py-1.5 text-xs flex flex-wrap items-center justify-between gap-2 border-b border-[#2C392F]">
        <div className="flex items-center gap-3">
          <span className="font-semibold tracking-wide">MUNICIPAL CORPORATION CIVIC GRIEVANCE REGISTER</span>
          <span className="opacity-40 hidden sm:inline">|</span>
          <span className="opacity-80 hidden sm:inline">Central Redressal & Triaging Division</span>
        </div>

        {/* Accessibility, Staff Link & Language Strip */}
        <div className="flex items-center gap-2.5">
          {/* Official Staff Portal Trigger (For unauthorized staff visitors) */}
          {!isOfficerOrAdmin && (
            <button
              onClick={() => openAuthModal('admin')}
              className="text-[11px] text-emerald-200 hover:text-white flex items-center gap-1 font-medium bg-[#153529] hover:bg-[#1a4233] px-2 py-0.5 rounded border border-[#2C392F] cursor-pointer transition-colors"
              title="Official municipal department credentials required"
            >
              <Lock className="w-3 h-3 text-amber-300" />
              <span>Official Staff Login</span>
            </button>
          )}

          {/* User Sign-In / Account Indicator */}
          {user ? (
            <div className="flex items-center gap-2 pr-2 border-r border-[#2C392F]">
              <span className="text-[11px] font-medium text-emerald-200 flex items-center gap-1">
                {user.role === 'citizen' ? (
                  <User className="w-3 h-3 text-emerald-300" />
                ) : (
                  <Lock className="w-3 h-3 text-amber-300" />
                )}
                <span className="truncate max-w-[140px] font-semibold">{user.name}</span>
              </span>
              <button
                onClick={logout}
                className="text-[11px] hover:text-white text-emerald-300 underline cursor-pointer flex items-center gap-0.5"
                title="Sign out"
              >
                <LogOut className="w-3 h-3" />
                <span>Logout</span>
              </button>
            </div>
          ) : (
            <button
              onClick={() => openAuthModal('citizen')}
              className="flex items-center gap-1 text-[11px] font-semibold text-white bg-[var(--green)] hover:bg-emerald-700 px-2 py-0.5 rounded cursor-pointer transition-colors"
            >
              <LogIn className="w-3 h-3" />
              <span>Citizen Sign In (OTP)</span>
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
            <span className="hidden md:inline">Contrast</span>
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
                Civic Redressal Portal
              </span>
            </div>
            <p className="text-xs text-[var(--ink-soft)] font-sans-civic line-clamp-1">
              {t.tagline}
            </p>
          </div>
        </div>

        {/* Dynamic Context Controls */}
        {isOfficerOrAdmin ? (
          // ONLY VISIBLE TO AUTHENTICATED OFFICERS & ADMINS
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex flex-col text-right pr-2 border-r border-[var(--line)]">
              <span className="text-[11px] font-bold text-[var(--ink)]">
                {user?.role === 'superadmin' ? 'City Command Headquarters' : user?.department_name}
              </span>
              <span className="text-[10px] text-[var(--ink-soft)] font-mono">
                {user?.name}
              </span>
            </div>

            <div className="flex items-center p-1 bg-[var(--bg2)] border border-[var(--line)] rounded-lg">
              {user?.role === 'superadmin' && (
                <button
                  onClick={() => onRoleChange('superadmin')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${
                    currentRole === 'superadmin'
                      ? 'bg-[var(--card)] text-[var(--ink)] shadow-xs font-bold'
                      : 'text-[var(--ink-soft)] hover:text-[var(--ink)]'
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-500" />
                  <span>City Command</span>
                </button>
              )}

              <button
                onClick={() => onRoleChange('admin')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${
                  currentRole === 'admin'
                    ? 'bg-[var(--card)] text-[var(--ink)] shadow-xs font-bold'
                    : 'text-[var(--ink-soft)] hover:text-[var(--ink)]'
                }`}
              >
                <Building2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>
                  {user?.role === 'admin' ? `${user.department_name?.split('&')[0]} Inbox` : 'Department Queue'}
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              </button>

              <button
                onClick={() => onRoleChange('citizen')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${
                  currentRole === 'citizen'
                    ? 'bg-[var(--card)] text-[var(--ink)] shadow-xs font-bold'
                    : 'text-[var(--ink-soft)] hover:text-[var(--ink)]'
                }`}
                title="Preview civic public view"
              >
                <User className="w-3.5 h-3.5" />
                <span>Public View</span>
              </button>
            </div>
          </div>
        ) : (
          // NORMAL CITIZEN VIEW: Admin & Super Admin are COMPLETELY HIDDEN
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-[var(--ink-soft)] bg-[var(--bg2)] px-3 py-1.5 rounded-lg border border-[var(--line)] flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Public Citizen Portal Active</span>
            </span>
          </div>
        )}
      </div>
    </header>
  );
};
