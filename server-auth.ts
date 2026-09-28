import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';

const JWT_SECRET = process.env.JWT_SECRET || 'junsono_civic_auth_secret_key_84920491823758291024';

// ----------------------------------------------------
// 1. JWT Implementation via Native Node.js Crypto
// ----------------------------------------------------
export interface AuthUserPayload {
  role: 'citizen' | 'admin' | 'superadmin';
  name: string;
  phone?: string;
  email?: string;
  department_id?: string;
  department_name?: string;
  exp: number;
  iat: number;
}

function base64UrlEncode(str: string): string {
  return Buffer.from(str)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return Buffer.from(base64, 'base64').toString('utf8');
}

export function signJwt(payload: Record<string, any>, expiresInSeconds: number = 86400 * 7): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const fullPayload = {
    ...payload,
    iat: now,
    exp: now + expiresInSeconds,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload));

  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

export function verifyJwt(token: string): AuthUserPayload | null {
  try {
    if (!token || typeof token !== 'string') return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [encodedHeader, encodedPayload, signature] = parts;
    const expectedSignature = crypto
      .createHmac('sha256', JWT_SECRET)
      .update(`${encodedHeader}.${encodedPayload}`)
      .digest('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');

    // Constant-time buffer comparison to prevent timing attacks
    const sigA = Buffer.from(signature);
    const sigB = Buffer.from(expectedSignature);
    if (sigA.length !== sigB.length || !crypto.timingSafeEqual(sigA, sigB)) {
      return null;
    }

    const payload: AuthUserPayload = JSON.parse(base64UrlDecode(encodedPayload));
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return null; // Expired token
    }

    return payload;
  } catch (err) {
    return null;
  }
}

// ----------------------------------------------------
// 2. Cryptographic OTP Storage & Throttling
// ----------------------------------------------------
interface OtpRecord {
  code: string;
  expiresAt: number;
  attempts: number;
  lastSentAt: number;
  role: 'citizen' | 'admin' | 'superadmin';
  name?: string;
  department_id?: string;
  department_name?: string;
}

const otpStore = new Map<string, OtpRecord>();

// Clean up expired OTPs periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of otpStore.entries()) {
    if (record.expiresAt < now) {
      otpStore.delete(key);
    }
  }
}, 60 * 1000);

export function requestOtp(
  identifier: string,
  options: {
    name?: string;
    role?: 'citizen' | 'admin' | 'superadmin';
    department_id?: string;
    department_name?: string;
  } = {}
): { success: boolean; waitSeconds?: number; debug_code?: string; message: string } {
  const cleanId = identifier.trim().toLowerCase();
  const now = Date.now();

  const existing = otpStore.get(cleanId);
  // Rate limit: enforce 30 seconds cooldown between OTP requests
  if (existing && now - existing.lastSentAt < 30 * 1000) {
    const remainingSeconds = Math.ceil((30 * 1000 - (now - existing.lastSentAt)) / 1000);
    return {
      success: false,
      waitSeconds: remainingSeconds,
      message: `Please wait ${remainingSeconds} seconds before requesting a new OTP.`,
    };
  }

  // Generate cryptographically secure 6-digit OTP
  const code = crypto.randomInt(100000, 999999).toString();
  const ttlMs = 5 * 60 * 1000; // 5 minutes validity

  otpStore.set(cleanId, {
    code,
    expiresAt: now + ttlMs,
    attempts: 0,
    lastSentAt: now,
    role: options.role || 'citizen',
    name: options.name,
    department_id: options.department_id,
    department_name: options.department_name,
  });

  console.log(`\n=================================================`);
  console.log(`[JUNSONO AUTH GATEWAY] Secure OTP for: ${cleanId}`);
  console.log(`CODE: >>> ${code} <<< (Valid for 5 minutes)`);
  console.log(`=================================================\n`);

  return {
    success: true,
    debug_code: process.env.NODE_ENV !== 'production' ? code : undefined,
    message: `Verification code successfully dispatched to ${identifier}`,
  };
}

export function verifyOtpCode(
  identifier: string,
  inputCode: string,
  fallbackName?: string
): { success: boolean; error?: string; user?: any; token?: string } {
  const cleanId = identifier.trim().toLowerCase();
  const cleanCode = inputCode.trim();

  const record = otpStore.get(cleanId);
  if (!record) {
    return { success: false, error: 'No active OTP found. Please request a new verification code.' };
  }

  const now = Date.now();
  if (record.expiresAt < now) {
    otpStore.delete(cleanId);
    return { success: false, error: 'Verification code has expired. Please request a new code.' };
  }

  // Brute-force protection: max 3 attempts
  if (record.attempts >= 3) {
    otpStore.delete(cleanId);
    return {
      success: false,
      error: 'Maximum verification attempts exceeded. For security, please request a fresh code.',
    };
  }

  if (record.code !== cleanCode) {
    record.attempts += 1;
    const remainingAttempts = 3 - record.attempts;
    return {
      success: false,
      error: `Invalid code. ${remainingAttempts} attempt(s) remaining.`,
    };
  }

  // Code verified! Delete record to prevent replay attacks
  otpStore.delete(cleanId);

  const isEmail = cleanId.includes('@');
  const user = {
    role: record.role,
    name: record.name || fallbackName || (record.role === 'citizen' ? `Citizen (${cleanId.slice(-4)})` : 'Municipal Officer'),
    phone: isEmail ? '+91 98000 00000' : identifier.trim(),
    email: isEmail ? identifier.trim() : undefined,
    department_id: record.department_id,
    department_name: record.department_name,
    isAuthenticated: true,
  };

  const token = signJwt(user, 86400 * 7); // 7 days session

  return {
    success: true,
    user,
    token,
  };
}

// ----------------------------------------------------
// 3. Express Middlewares & Security Guards
// ----------------------------------------------------
export interface AuthenticatedRequest extends Request {
  user?: AuthUserPayload | null;
}

export function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    const userPayload = verifyJwt(token);
    req.user = userPayload;
  } else {
    req.user = null;
  }
  next();
}

export function requireAdminOrOfficer(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'superadmin')) {
    return res.status(403).json({
      error: 'Access Denied: Officer or Administrative authentication required.',
    });
  }
  next();
}

// ----------------------------------------------------
// 4. PII Data Masking & Redaction Helpers
// ----------------------------------------------------
export function maskPhoneNumber(phone?: string): string {
  if (!phone) return '+91 **********';
  const clean = phone.trim();
  if (clean.length < 8) return '****';
  return clean.substring(0, 7) + '*** **' + clean.slice(-3);
}

export function maskEmailAddress(email?: string): string {
  if (!email) return '***@***.***';
  const parts = email.split('@');
  if (parts.length !== 2) return '***@***.***';
  const name = parts[0];
  const domain = parts[1];
  const maskedName = name.length > 2 ? `${name[0]}***${name.slice(-1)}` : `${name[0]}***`;
  return `${maskedName}@${domain}`;
}

export function redactComplaintForPublic(complaint: any, user: AuthUserPayload | null): any {
  // If user is Admin or Superadmin, return full complaint
  if (user && (user.role === 'admin' || user.role === 'superadmin')) {
    return complaint;
  }

  // If user is the citizen who filed this complaint (by phone or email match)
  const isOwner =
    user &&
    user.role === 'citizen' &&
    ((user.phone && complaint.citizen_phone && user.phone.replace(/\D/g, '') === complaint.citizen_phone.replace(/\D/g, '')) ||
      (user.email && complaint.citizen_email && user.email.toLowerCase() === complaint.citizen_email.toLowerCase()));

  if (isOwner) {
    return complaint;
  }

  // Redact PII and internal notes for public viewers
  return {
    ...complaint,
    citizen_phone: maskPhoneNumber(complaint.citizen_phone),
    citizen_email: complaint.citizen_email ? maskEmailAddress(complaint.citizen_email) : undefined,
    internal_notes: [], // Conceal internal officer discussions from public view
  };
}
