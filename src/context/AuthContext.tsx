import React, { createContext, useContext, useState, useEffect } from 'react';

export interface CitizenUser {
  role: 'citizen';
  name: string;
  phone: string;
  email?: string;
  preferred_language?: string;
  isAuthenticated: boolean;
}

export interface AdminUser {
  role: 'admin' | 'superadmin';
  name: string;
  email: string;
  department_id: string;
  department_name: string;
  token: string;
  isAuthenticated: boolean;
}

export type AuthUser = CitizenUser | AdminUser | null;

interface AuthContextType {
  user: AuthUser;
  loginCitizen: (citizenData: { name: string; phone: string; email?: string }) => void;
  sendCitizenOtp: (contact: string) => Promise<{ code: string }>;
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

  const sendCitizenOtp = async (contact: string) => {
    // Generate simple 4-digit verification code
    const generated = Math.floor(1000 + Math.random() * 9000).toString();
    console.log(`[Junsono SMS Gateway] Verification OTP for ${contact}: ${generated}`);
    return { code: generated };
  };

  const verifyCitizenOtp = async (contact: string, code: string, name?: string) => {
    // Any valid 4-digit code succeeds in prototype
    if (code.length === 4) {
      const cleanName = name?.trim() || `Citizen (${contact.slice(-4)})`;
      const newUser: CitizenUser = {
        role: 'citizen',
        name: cleanName,
        phone: contact.includes('@') ? '+91 98000 00000' : contact,
        email: contact.includes('@') ? contact : undefined,
        isAuthenticated: true,
      };
      setUser(newUser);
      setIsAuthModalOpen(false);
      return true;
    }
    return false;
  };

  const loginAdmin = async ({
    email,
    department_id = 'dept-roads',
  }: {
    email: string;
    password?: string;
    department_id?: string;
  }) => {
    let deptName = 'Roads & Infrastructure';
    let role: 'admin' | 'superadmin' = 'admin';
    let officerName = 'Municipal Officer';

    if (email.includes('super') || email.includes('commissioner') || department_id === 'superadmin') {
      role = 'superadmin';
      deptName = 'City Municipal Command';
      officerName = 'Shri K.K. Sharma, IAS (Commissioner)';
    } else if (department_id === 'dept-sanitation' || email.includes('sanitation')) {
      deptName = 'Sanitation & Solid Waste';
      officerName = 'Dr. Sunita Meena (Health Officer)';
    } else if (department_id === 'dept-water' || email.includes('water')) {
      deptName = 'Water Supply & Sewerage';
      officerName = 'Shri Vikramaditya Rathore (SE)';
    } else if (department_id === 'dept-electricity' || email.includes('electric')) {
      deptName = 'Electricity & Street Lighting';
      officerName = 'Er. Anil Verma (Executive Engineer)';
    } else if (department_id === 'dept-health' || email.includes('health')) {
      deptName = 'Public Health & Vector Control';
      officerName = 'Dr. Neha Kulkarni (CMO)';
    } else {
      deptName = 'Roads & Infrastructure';
      officerName = 'Er. Rajeshwar Sharma (Chief Engineer)';
    }

    const newAdmin: AdminUser = {
      role,
      name: officerName,
      email,
      department_id,
      department_name: deptName,
      token: `jwt_sim_${Date.now()}_${department_id}`,
      isAuthenticated: true,
    };

    setUser(newAdmin);
    setIsAuthModalOpen(false);
    return true;
  };

  const logout = () => {
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
