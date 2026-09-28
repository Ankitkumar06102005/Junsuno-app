export type Severity = 'low' | 'medium' | 'high' | 'critical';
export type ComplaintStatus = 'new' | 'acknowledged' | 'in_progress' | 'resolved' | 'rejected';

export interface Department {
  id: string;
  name: string;
  short_code: string;
  contact_email: string;
  phone: string;
  head_officer: string;
  municipal_zone: string;
  color: string;
}

export interface StatusHistory {
  id: string;
  complaint_id: string;
  changed_by: string;
  old_status: string;
  new_status: string;
  note: string;
  timestamp: string;
}

export interface Correspondence {
  id: string;
  direction: 'outbound_dispatch' | 'inbound_reply';
  from_email: string;
  to_email: string;
  subject: string;
  body: string;
  timestamp: string;
  officer_name?: string;
}

export interface CitizenComplaint {
  id: string; // e.g. JSN-1001
  uuid: string;
  citizen_name: string;
  citizen_phone: string;
  citizen_email?: string;
  preferred_language: string;
  department_id: string;
  department_name: string;
  raw_input_text: string;
  ai_summary: string;
  category: string;
  severity: Severity;
  status: ComplaintStatus;
  latitude: number;
  longitude: number;
  address_text: string;
  landmark?: string;
  ward: string;
  photo_url?: string;
  duplicate_of?: string;
  report_count: number;
  reporter_names: string[];
  embedding?: number[];
  internal_notes: string[];
  history: StatusHistory[];
  correspondence: Correspondence[];
  created_at: string;
  updated_at: string;
  resolution_proof_photo?: string;
  rejection_reason?: string;
}

export interface AnalyticsMetrics {
  total: number;
  open: number;
  resolved: number;
  rejected: number;
  avg_resolution_hours: number;
  sla_compliance_rate: number;
  total_citizens_reached: number;
  deduplicated_reports: number;
}

export interface AnalyticsData {
  metrics: AnalyticsMetrics;
  by_status: Record<string, number>;
  by_severity: Record<string, number>;
  by_category: Record<string, number>;
  by_ward: Record<string, number>;
}

export type SupportedLanguage = 'en' | 'hi' | 'bn' | 'ta' | 'te' | 'mr' | 'gu' | 'kn';

export interface CitizenUser {
  role: 'citizen';
  name: string;
  phone: string;
  email?: string;
  preferred_language?: string;
  token?: string;
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

export interface AuthResponse {
  token: string;
  user: CitizenUser | AdminUser;
  message?: string;
}

