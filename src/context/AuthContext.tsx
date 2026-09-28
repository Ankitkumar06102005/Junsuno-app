import React, { createContext, useContext, useState, useEffect } from 'react';
import { CitizenUser, AdminUser, AuthUser } from '../types';
import * as api from '../services/api';

interface AuthContextType {
  user: AuthUser;
  loginCitizen: (citizenData: { name: string; phone: string; email?: string }) => void;
  sendCitizenOtp: (contact: string, name?: string) => Promise<{ code: string; message: string; waitSeconds?: number }>;
  verifyCitizenOtp: (contact: string, code: string, name?: string) => Promise<boolean>;
  loginAdmin: (credentials: { email: string; password?: string; department_id?: string }) => Promise<boolean>;
  logout: () => void;
  isAuthModalOpen: boolean;
  openAuthModal: (mode?: 'citizen' | 'admin') => void;
  closeAuthModal: () => void;
  authModalMode: 'citizen' | 'admin';
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEY = 'junsono_auth_session';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Failed to parse saved auth session:', e);
    }
    return null;
  });

  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'citizen' | 'admin'>('citizen');

  // Validate session on mount with backend
  useEffect(() => {
    const token = api.getAuthToken();
    if (token) {
      api
        .getCurrentUser()
        .then((res) => {
          if (res?.user) {
            setUser(res.user);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(res.user));
          }
        })
        .catch(() => {
          // Token invalid or expired
          api.setAuthToken(null);
          setUser(null);
          localStorage.removeItem(STORAGE_KEY);
        });
    }
  }, []);

  useEffect(() => {
    if (user) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [user]);

  const loginCitizen = (data: { name: string; phone: string; email?: string }) => {
    const newUser: CitizenUser = {
      role: 'citizen',
      name: data.name || 'Citizen',
      phone: data.phone,
      email: data.email,
      isAuthenticated: true,
    };
    setUser(newUser);
  };

  const sendCitizenOtp = async (contact: string, name?: string) => {
    try {
      const res = await api.sendOtp(contact, name, 'citizen');
      return {
        code: res.debug_code || '',
        message: res.message,
        waitSeconds: res.waitSeconds,
      };
    } catch (err: any) {
      throw err;
    }
  };

  const verifyCitizenOtp = async (contact: string, code: string, name?: string) => {
    try {
      const res = await api.verifyOtp(contact, code, name);
      if (res && res.user) {
        setUser(res.user as CitizenUser);
        setIsAuthModalOpen(false);
        return true;
      }
      return false;
    } catch (err: any) {
      throw err;
    }
  };

  const loginAdmin = async ({
    email,
    password,
    department_id = 'dept-roads',
  }: {
    email: string;
    password?: string;
    department_id?: string;
  }) => {
    try {
      const res = await api.adminLogin({ email, password, department_id });
      if (res && res.user) {
        setUser(res.user as AdminUser);
        setIsAuthModalOpen(false);
        return true;
      }
      return false;
    } catch (err: any) {
      throw err;
    }
  };

  const logout = () => {
    api.logoutUser();
    setUser(null);
    localStorage.removeItem(STORAGE_KEY);
  };

  const openAuthModal = (mode: 'citizen' | 'admin' = 'citizen') => {
    setAuthModalMode(mode);
    setIsAuthModalOpen(true);
  };

  const closeAuthModal = () => {
    setIsAuthModalOpen(false);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loginCitizen,
        sendCitizenOtp,
        verifyCitizenOtp,
        loginAdmin,
        logout,
        isAuthModalOpen,
        openAuthModal,
        closeAuthModal,
        authModalMode,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
