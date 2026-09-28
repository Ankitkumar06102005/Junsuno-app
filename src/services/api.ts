import { CitizenComplaint, Department, AnalyticsData, CitizenUser, AdminUser, AuthResponse } from '../types';

export const API_BASE = '/api';

const TOKEN_KEY = 'junsono_auth_token';

// In-memory + localStorage token cache
let currentToken: string | null = null;
try {
  currentToken = localStorage.getItem(TOKEN_KEY);
} catch (e) {
  // Ignore in SSR / restricted environments
}

export function setAuthToken(token: string | null) {
  currentToken = token;
  try {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  } catch (e) {
    // Ignore
  }
}

export function getAuthToken(): string | null {
  return currentToken;
}

// Internal authenticated fetch wrapper
async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const headers = new Headers(options.headers || {});
  if (currentToken && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${currentToken}`);
  }
  return fetch(url, {
    ...options,
    headers,
  });
}

// ----------------------------------------------------
// Authentication Service Calls
// ----------------------------------------------------

export async function sendOtp(
  contact: string,
  name?: string,
  role: 'citizen' | 'admin' | 'superadmin' = 'citizen',
  department_id?: string
): Promise<{ success: boolean; message: string; debug_code?: string; waitSeconds?: number }> {
  const res = await fetch(`${API_BASE}/auth/send-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contact, name, role, department_id }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to dispatch verification OTP');
  }
  return data;
}

export async function verifyOtp(
  contact: string,
  code: string,
  name?: string
): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/auth/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contact, code, name }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'OTP verification failed');
  }
  if (data.token) {
    setAuthToken(data.token);
  }
  return data;
}

export async function adminLogin(payload: {
  email: string;
  password?: string;
  department_id?: string;
}): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/auth/admin-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Department login failed');
  }
  if (data.token) {
    setAuthToken(data.token);
  }
  return data;
}

export async function getCurrentUser(): Promise<{ user: CitizenUser | AdminUser }> {
  const res = await authFetch(`${API_BASE}/auth/me`);
  if (!res.ok) {
    throw new Error('Not authenticated');
  }
  return res.json();
}

export async function logoutUser(): Promise<void> {
  setAuthToken(null);
  await fetch(`${API_BASE}/auth/logout`, { method: 'POST' }).catch(() => {});
}

// ----------------------------------------------------
// Public & Civic Domain Service Calls
// ----------------------------------------------------

export async function fetchDepartments(): Promise<Department[]> {
  const res = await fetch(`${API_BASE}/departments`);
  if (!res.ok) throw new Error('Failed to load departments');
  const data = await res.json();
  return data.departments || [];
}

export async function classifyComplaintAI(text: string, preferred_language: string = 'Hindi') {
  const res = await authFetch(`${API_BASE}/ai/classify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, preferred_language }),
  });
  if (!res.ok) throw new Error('Classification failed');
  return res.json();
}

export async function submitComplaint(payload: {
  citizen_name?: string;
  citizen_phone?: string;
  citizen_email?: string;
  preferred_language?: string;
  raw_input_text: string;
  latitude?: number;
  longitude?: number;
  address_text?: string;
  landmark?: string;
  ward?: string;
  photo_url?: string;
  override_category?: string;
  override_severity?: string;
  override_department_id?: string;
}): Promise<{ is_duplicate: boolean; duplicate_of?: string; complaint: CitizenComplaint; message: string }> {
  const res = await authFetch(`${API_BASE}/complaints`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to submit complaint');
  }
  return res.json();
}

export async function fetchComplaints(params: {
  department_id?: string;
  status?: string;
  severity?: string;
  phone?: string;
  query?: string;
} = {}): Promise<{ complaints: CitizenComplaint[]; total: number }> {
  const searchParams = new URLSearchParams();
  if (params.department_id) searchParams.set('department_id', params.department_id);
  if (params.status) searchParams.set('status', params.status);
  if (params.severity) searchParams.set('severity', params.severity);
  if (params.phone) searchParams.set('phone', params.phone);
  if (params.query) searchParams.set('query', params.query);

  const res = await authFetch(`${API_BASE}/complaints?${searchParams.toString()}`);
  if (!res.ok) throw new Error('Failed to load complaints');
  return res.json();
}

export async function fetchComplaintById(id: string): Promise<CitizenComplaint> {
  const res = await authFetch(`${API_BASE}/complaints/${encodeURIComponent(id)}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Complaint not found');
  }
  const data = await res.json();
  return data.complaint;
}

export async function updateComplaintStatus(
  id: string,
  payload: {
    new_status: string;
    admin_name?: string;
    note?: string;
    resolution_proof_photo?: string;
    rejection_reason?: string;
  }
): Promise<CitizenComplaint> {
  const res = await authFetch(`${API_BASE}/complaints/${encodeURIComponent(id)}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to update status. Officer authentication required.');
  }
  const data = await res.json();
  return data.complaint;
}

export async function reassignComplaint(
  id: string,
  payload: {
    new_department_id: string;
    admin_name?: string;
    reason?: string;
  }
): Promise<CitizenComplaint> {
  const res = await authFetch(`${API_BASE}/complaints/${encodeURIComponent(id)}/reassign`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to reassign department. Authority credentials required.');
  }
  const data = await res.json();
  return data.complaint;
}

export async function addInternalNote(
  id: string,
  note: string,
  author: string = 'Admin'
): Promise<string[]> {
  const res = await authFetch(`${API_BASE}/complaints/${encodeURIComponent(id)}/notes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ note, author }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to save note. Authorized session required.');
  }
  const data = await res.json();
  return data.notes;
}

export async function simulateInboundEmailReply(
  id: string,
  payload: {
    officer_name: string;
    from_email: string;
    reply_text: string;
    update_status_to?: string;
  }
): Promise<CitizenComplaint> {
  const res = await authFetch(`${API_BASE}/complaints/${encodeURIComponent(id)}/reply`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to simulate officer reply');
  }
  const data = await res.json();
  return data.complaint;
}

export async function fetchAnalytics(department_id?: string): Promise<AnalyticsData> {
  const url = department_id && department_id !== 'all'
    ? `${API_BASE}/admin/analytics?department_id=${encodeURIComponent(department_id)}`
    : `${API_BASE}/admin/analytics`;
  const res = await authFetch(url);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to load analytics. Officer credentials required.');
  }
  return res.json();
}
