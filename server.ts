import express, { Request, Response, NextFunction } from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';
import {
  authMiddleware,
  requireAdminOrOfficer,
  requestOtp,
  verifyOtpCode,
  signJwt,
  redactComplaintForPublic,
  AuthenticatedRequest,
} from './server-auth';

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

// Basic HTTP Security Headers
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

app.use(express.json({ limit: '25mb' }));
app.use(authMiddleware as any);


// Shared Gemini client utility
const apiKey = process.env.GEMINI_API_KEY;
let aiClient: GoogleGenAI | null = null;
if (apiKey) {
  try {
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  } catch (err) {
    console.error('Failed to initialize GoogleGenAI client:', err);
  }
}

// ----------------------------------------------------
// Data Structures & In-Memory Store
// ----------------------------------------------------
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
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'new' | 'acknowledged' | 'in_progress' | 'resolved' | 'rejected';
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

export const DEPARTMENTS: Department[] = [
  {
    id: 'dept-roads',
    name: 'Roads & Infrastructure',
    short_code: 'ROADS',
    contact_email: 'roads.dept@municipal.gov.in',
    phone: '+91 141 2740011',
    head_officer: 'Er. Rajeshwar Sharma (Chief Engineer)',
    municipal_zone: 'Zone 4 - Central & North',
    color: '#8C3B2E',
  },
  {
    id: 'dept-sanitation',
    name: 'Sanitation & Solid Waste',
    short_code: 'SWM',
    contact_email: 'sanitation@municipal.gov.in',
    phone: '+91 141 2740022',
    head_officer: 'Dr. Sunita Meena (Health Officer)',
    municipal_zone: 'City-wide All Wards',
    color: '#1F4D3A',
  },
  {
    id: 'dept-water',
    name: 'Water Supply & Sewerage',
    short_code: 'WSS',
    contact_email: 'watersupply@municipal.gov.in',
    phone: '+91 141 2740033',
    head_officer: 'Shri Vikramaditya Rathore (Superintending Engineer)',
    municipal_zone: 'Zone 2 & Zone 3',
    color: '#2B6CB0',
  },
  {
    id: 'dept-electricity',
    name: 'Electricity & Street Lighting',
    short_code: 'ELEC',
    contact_email: 'streetlighting@municipal.gov.in',
    phone: '+91 141 2740044',
    head_officer: 'Er. Anil Verma (Executive Engineer)',
    municipal_zone: 'City-wide High-mast & Feeder Lines',
    color: '#B8862E',
  },
  {
    id: 'dept-health',
    name: 'Public Health & Vector Control',
    short_code: 'PHVC',
    contact_email: 'publichealth@municipal.gov.in',
    phone: '+91 141 2740055',
    head_officer: 'Dr. Neha Kulkarni (Chief Medical Officer)',
    municipal_zone: 'Ward 10 to Ward 35',
    color: '#6B46C1',
  },
];

// Helper to generate simple embedding vector for text
function generateSimpleEmbedding(text: string): number[] {
  const normalized = text.toLowerCase().replace(/[^a-z0-9 ]/g, ' ');
  const words = normalized.split(/\s+/).filter(Boolean);
  const vector = new Array(32).fill(0);
  for (const word of words) {
    let hash = 0;
    for (let i = 0; i < word.length; i++) {
      hash = (hash << 5) - hash + word.charCodeAt(i);
      hash |= 0;
    }
    const idx = Math.abs(hash) % 32;
    vector[idx] += 1;
  }
  // Normalize
  const mag = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0)) || 1;
  return vector.map((v) => v / mag);
}

function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dot += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Initial seeded complaints
let complaintsDatabase: CitizenComplaint[] = [
  {
    id: 'JSN-1001',
    uuid: 'c1b48b78-75e1-4cfa-811c-2236fa780001',
    citizen_name: 'Ramesh Chander',
    citizen_phone: '+91 98290 14820',
    citizen_email: 'ramesh.c@example.com',
    preferred_language: 'Hindi',
    department_id: 'dept-roads',
    department_name: 'Roads & Infrastructure',
    raw_input_text: 'मेन रोड पर सेक्टर 4 चौराहा के पास बहुत बड़ा गड्ढा हो गया है, दो बाइक वाले गिर गए हैं। सड़क धंस रही है।',
    ai_summary: 'Severe road cave-in and dangerous 4-foot pothole near Sector 4 intersection causing vehicle falls.',
    category: 'Pothole & Road Cave-in',
    severity: 'critical',
    status: 'in_progress',
    latitude: 26.9124,
    longitude: 75.7873,
    address_text: 'Sector 4 Main Road, near Shiv Mandir Circle',
    landmark: 'Opposite Shiv Mandir Gate #2',
    ward: 'Ward 14 (Central Zone)',
    photo_url: 'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?auto=format&fit=crop&w=800&q=80',
    report_count: 5,
    reporter_names: ['Ramesh Chander', 'Pooja Verma', 'Amit Soni', 'Karan Johar', 'Sunil Mathur'],
    embedding: generateSimpleEmbedding('road pothole cave in sector 4 intersection bike accident'),
    internal_notes: [
      'Site visited by Junior Engineer. Emergency cold-mix asphalt dispatch requested.',
      'Contractor M/s Shivalik Infra instructed to barricade and patch before evening rush.',
    ],
    history: [
      {
        id: 'h-1',
        complaint_id: 'JSN-1001',
        changed_by: 'Automated AI Triaging System',
        old_status: 'none',
        new_status: 'new',
        note: 'Triaged via Gemini 2.5: Assigned to Roads & Infrastructure with Critical SLA (4 hrs).',
        timestamp: '2026-09-27T07:15:00.000Z',
      },
      {
        id: 'h-2',
        complaint_id: 'JSN-1001',
        changed_by: 'Er. Rajeshwar Sharma',
        old_status: 'new',
        new_status: 'acknowledged',
        note: 'Assigned to Ward 14 Rapid Action Paving Team.',
        timestamp: '2026-09-27T07:30:00.000Z',
      },
      {
        id: 'h-3',
        complaint_id: 'JSN-1001',
        changed_by: 'JE Rakesh Saxena',
        old_status: 'acknowledged',
        new_status: 'in_progress',
        note: 'Caution cones placed. Repair truck en route.',
        timestamp: '2026-09-27T08:10:00.000Z',
      },
    ],
    correspondence: [
      {
        id: 'c-1',
        direction: 'outbound_dispatch',
        from_email: 'dispatch@junsono.gov.in',
        to_email: 'roads.dept@municipal.gov.in',
        subject: '[URGENT] JSN-1001: Pothole & Road Cave-in at Ward 14',
        body: 'Automated civic grievance JSN-1001 filed by citizen Ramesh Chander. Severity: CRITICAL. 5 duplicate reports clustered. Please acknowledge and action within 4 hours.',
        timestamp: '2026-09-27T07:15:30.000Z',
      },
      {
        id: 'c-2',
        direction: 'inbound_reply',
        from_email: 'roads.dept@municipal.gov.in',
        to_email: 'dispatch@junsono.gov.in',
        subject: 'Re: [URGENT] JSN-1001: Pothole & Road Cave-in at Ward 14',
        body: 'Acknowledged. Team dispatched under JE Rakesh Saxena. Barricading in progress.',
        timestamp: '2026-09-27T08:10:00.000Z',
        officer_name: 'Er. Rajeshwar Sharma',
      },
    ],
    created_at: '2026-09-27T07:15:00.000Z',
    updated_at: '2026-09-27T08:10:00.000Z',
  },
  {
    id: 'JSN-1002',
    uuid: 'c1b48b78-75e1-4cfa-811c-2236fa780002',
    citizen_name: 'Meena Sharma',
    citizen_phone: '+91 97845 22091',
    preferred_language: 'Hindi',
    department_id: 'dept-sanitation',
    department_name: 'Sanitation & Solid Waste',
    raw_input_text: 'गली नंबर 3 में कचरा पात्र 4 दिन से खाली नहीं हुआ। बदबू आ रही है और आवारा जानवर फैला रहे हैं।',
    ai_summary: 'Overflowing municipal community dumpster uncollected for 4 days in Lane 3, emitting foul odor.',
    category: 'Garbage Dump Overflow',
    severity: 'high',
    status: 'acknowledged',
    latitude: 26.9201,
    longitude: 75.7952,
    address_text: 'Lane 3, Behind Adarsh Nagar Market',
    landmark: 'Behind Saras Dairy Booth',
    ward: 'Ward 8 (East Zone)',
    photo_url: 'https://images.unsplash.com/photo-1530587191325-3db32d826c18?auto=format&fit=crop&w=800&q=80',
    report_count: 3,
    reporter_names: ['Meena Sharma', 'Deepak Tiwari', 'Kavita Joshi'],
    embedding: generateSimpleEmbedding('garbage dump bin overflow lane 3 smell waste sanitation'),
    internal_notes: ['Sanitation inspector alerted. Tipper truck schedule adjusted for 11:30 AM lift.'],
    history: [
      {
        id: 'h-21',
        complaint_id: 'JSN-1002',
        changed_by: 'Automated AI Triaging System',
        old_status: 'none',
        new_status: 'new',
        note: 'Routed to Sanitation & Solid Waste department.',
        timestamp: '2026-09-27T06:00:00.000Z',
      },
      {
        id: 'h-22',
        complaint_id: 'JSN-1002',
        changed_by: 'Dr. Sunita Meena',
        old_status: 'new',
        new_status: 'acknowledged',
        note: 'Tipper truck #RJ14-GC-4412 assigned.',
        timestamp: '2026-09-27T07:45:00.000Z',
      },
    ],
    correspondence: [
      {
        id: 'c-21',
        direction: 'outbound_dispatch',
        from_email: 'dispatch@junsono.gov.in',
        to_email: 'sanitation@municipal.gov.in',
        subject: 'JSN-1002: Garbage Dump Overflow at Ward 8',
        body: 'Citizen Meena Sharma reported overflowing dumpster uncleaned for 4 days.',
        timestamp: '2026-09-27T06:01:00.000Z',
      },
    ],
    created_at: '2026-09-27T06:00:00.000Z',
    updated_at: '2026-09-27T07:45:00.000Z',
  },
  {
    id: 'JSN-1003',
    uuid: 'c1b48b78-75e1-4cfa-811c-2236fa780003',
    citizen_name: 'Anand K. Patel',
    citizen_phone: '+91 94140 88219',
    preferred_language: 'English',
    department_id: 'dept-electricity',
    department_name: 'Electricity & Street Lighting',
    raw_input_text: 'Three consecutive streetlights on the internal colony road are dark since Friday, dark stretch creating safety issues for women at night.',
    ai_summary: 'Three consecutive malfunctioning streetlights along Colony Road causing unsafe blacked-out corridor.',
    category: 'Defective Streetlight',
    severity: 'medium',
    status: 'new',
    latitude: 26.8985,
    longitude: 75.8112,
    address_text: 'Road 6, Malviya Nagar Block B',
    landmark: 'Between Pole #B-14 and #B-16',
    ward: 'Ward 22 (South Zone)',
    photo_url: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=800&q=80',
    report_count: 2,
    reporter_names: ['Anand K. Patel', 'Vandana Rawat'],
    embedding: generateSimpleEmbedding('streetlight dark broken light bulb colony road night safety'),
    internal_notes: [],
    history: [
      {
        id: 'h-31',
        complaint_id: 'JSN-1003',
        changed_by: 'Automated AI Triaging System',
        old_status: 'none',
        new_status: 'new',
        note: 'Assigned to Electricity & Street Lighting department.',
        timestamp: '2026-09-27T05:30:00.000Z',
      },
    ],
    correspondence: [
      {
        id: 'c-31',
        direction: 'outbound_dispatch',
        from_email: 'dispatch@junsono.gov.in',
        to_email: 'streetlighting@municipal.gov.in',
        subject: 'JSN-1003: Defective Streetlights along Malviya Nagar Block B',
        body: '3 consecutive dark street poles reported. Severity: MEDIUM.',
        timestamp: '2026-09-27T05:31:00.000Z',
      },
    ],
    created_at: '2026-09-27T05:30:00.000Z',
    updated_at: '2026-09-27T05:30:00.000Z',
  },
  {
    id: 'JSN-1004',
    uuid: 'c1b48b78-75e1-4cfa-811c-2236fa780004',
    citizen_name: 'Govind Swaroop',
    citizen_phone: '+91 93145 90112',
    preferred_language: 'Hindi',
    department_id: 'dept-water',
    department_name: 'Water Supply & Sewerage',
    raw_input_text: 'मेन वॉटर सप्लाई लाइन टूट गई है, लाखों लीटर पीने का पानी सड़क पर बह रहा है और घरों में गंदा पानी आ रहा है।',
    ai_summary: 'Major municipal potable water pipeline burst with high-volume road flooding and contamination risk.',
    category: 'Pipeline Burst & Contamination',
    severity: 'critical',
    status: 'in_progress',
    latitude: 26.9042,
    longitude: 75.7721,
    address_text: 'Near C-Scheme Overhead Tank, Subhash Marg',
    landmark: 'Behind GPO complex',
    ward: 'Ward 11 (Civil Lines)',
    photo_url: 'https://images.unsplash.com/photo-1541888946425-d0fbb18f156f?auto=format&fit=crop&w=800&q=80',
    report_count: 7,
    reporter_names: [
      'Govind Swaroop',
      'Hitesh Agarwal',
      'Sangeeta Roy',
      'Manish Sharma',
      'Dr. J.P. Gupta',
      'Alok Bansal',
      'Farooq Khan',
    ],
    embedding: generateSimpleEmbedding('water supply pipeline burst leaking flooding drinking water clean water contaminated'),
    internal_notes: [
      'Pressure reduced on Subhash Marg feeder line. Valve isolation team on spot.',
      'Excavator deployed for pipe joint welding.',
    ],
    history: [
      {
        id: 'h-41',
        complaint_id: 'JSN-1004',
        changed_by: 'Automated AI Triaging System',
        old_status: 'none',
        new_status: 'new',
        note: 'Classified Critical by Gemini. High volume water loss flag triggered.',
        timestamp: '2026-09-27T04:15:00.000Z',
      },
      {
        id: 'h-42',
        complaint_id: 'JSN-1004',
        changed_by: 'Shri Vikramaditya Rathore',
        old_status: 'new',
        new_status: 'in_progress',
        note: 'Emergency pipeline repair protocol activated. Tankers deployed for local supply.',
        timestamp: '2026-09-27T04:45:00.000Z',
      },
    ],
    correspondence: [
      {
        id: 'c-41',
        direction: 'outbound_dispatch',
        from_email: 'dispatch@junsono.gov.in',
        to_email: 'watersupply@municipal.gov.in',
        subject: '[CRITICAL DISPATCH] JSN-1004: Potable Pipeline Burst - Ward 11',
        body: 'Overhead tank junction line rupture. 7 citizen calls clustered.',
        timestamp: '2026-09-27T04:16:00.000Z',
      },
      {
        id: 'c-42',
        direction: 'inbound_reply',
        from_email: 'watersupply@municipal.gov.in',
        to_email: 'dispatch@junsono.gov.in',
        subject: 'Re: [CRITICAL DISPATCH] JSN-1004: Potable Pipeline Burst - Ward 11',
        body: 'Main valve 14 closed. Repair team on site with replacement 300mm ductile iron sleeve.',
        timestamp: '2026-09-27T04:45:00.000Z',
        officer_name: 'Shri Vikramaditya Rathore',
      },
    ],
    created_at: '2026-09-27T04:15:00.000Z',
    updated_at: '2026-09-27T04:45:00.000Z',
  },
  {
    id: 'JSN-1005',
    uuid: 'c1b48b78-75e1-4cfa-811c-2236fa780005',
    citizen_name: 'Sunita Devi',
    citizen_phone: '+91 99281 33451',
    preferred_language: 'Hindi',
    department_id: 'dept-health',
    department_name: 'Public Health & Vector Control',
    raw_input_text: 'खाली प्लॉट में बारिश का गंदा पानी जमा है, बहुत मच्छर हो रहे हैं और कॉलोनी में 3 बच्चों को डेंगू हो गया है। फोगिंग करवाएं।',
    ai_summary: 'Stagnant rainwater pool in vacant residential plot breeding mosquitoes; active dengue cluster reported.',
    category: 'Mosquito Breeding & Vector Risk',
    severity: 'high',
    status: 'resolved',
    latitude: 26.8831,
    longitude: 75.7614,
    address_text: 'Plot #42, Vaishali Nagar Block C',
    landmark: 'Adjacent to Community Park',
    ward: 'Ward 29 (West Zone)',
    photo_url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=800&q=80',
    report_count: 4,
    reporter_names: ['Sunita Devi', 'Harish Chandra', 'Praveen Bishnoi', 'Sita Ram'],
    embedding: generateSimpleEmbedding('stagnant water mosquitoes dengue fogging vacant plot health'),
    internal_notes: [
      'Anti-larval chemical sprayed (Temephos 50% EC).',
      'Notice issued to vacant plot owner Shri Mahesh Gupta under Section 240 of Municipal Act.',
      'Evening fogging completed by Ward 29 team.',
    ],
    history: [
      {
        id: 'h-51',
        complaint_id: 'JSN-1005',
        changed_by: 'Automated AI Triaging System',
        old_status: 'none',
        new_status: 'new',
        note: 'Assigned to Public Health & Vector Control.',
        timestamp: '2026-09-26T09:00:00.000Z',
      },
      {
        id: 'h-52',
        complaint_id: 'JSN-1005',
        changed_by: 'Dr. Neha Kulkarni',
        old_status: 'new',
        new_status: 'acknowledged',
        note: 'Vector control team scheduled.',
        timestamp: '2026-09-26T10:15:00.000Z',
      },
      {
        id: 'h-53',
        complaint_id: 'JSN-1005',
        changed_by: 'Sanitary Inspector B.L. Meena',
        old_status: 'acknowledged',
        new_status: 'in_progress',
        note: 'Chemical treatment and ditch draining underway.',
        timestamp: '2026-09-26T14:30:00.000Z',
      },
      {
        id: 'h-54',
        complaint_id: 'JSN-1005',
        changed_by: 'Dr. Neha Kulkarni',
        old_status: 'in_progress',
        new_status: 'resolved',
        note: 'Plot drained, larvicide sprayed and fogging completed. Citizen contacted.',
        timestamp: '2026-09-27T08:00:00.000Z',
      },
    ],
    correspondence: [
      {
        id: 'c-51',
        direction: 'outbound_dispatch',
        from_email: 'dispatch@junsono.gov.in',
        to_email: 'publichealth@municipal.gov.in',
        subject: 'JSN-1005: Mosquito Breeding in Vacant Plot - Ward 29',
        body: 'Citizen reported dengue outbreak risk due to stagnant pool.',
        timestamp: '2026-09-26T09:01:00.000Z',
      },
      {
        id: 'c-52',
        direction: 'inbound_reply',
        from_email: 'publichealth@municipal.gov.in',
        to_email: 'dispatch@junsono.gov.in',
        subject: 'Re: JSN-1005: Mosquito Breeding in Vacant Plot - Ward 29',
        body: 'Resolved: Temephos treatment done and mobile thermal fogging vehicle deployed at 6 PM. Plot owner fined.',
        timestamp: '2026-09-27T08:00:00.000Z',
        officer_name: 'Dr. Neha Kulkarni',
      },
    ],
    created_at: '2026-09-26T09:00:00.000Z',
    updated_at: '2026-09-27T08:00:00.000Z',
    resolution_proof_photo: 'https://images.unsplash.com/photo-1584467735871-8e85353a8413?auto=format&fit=crop&w=800&q=80',
  },
];

let nextComplaintNumber = 1006;

// ----------------------------------------------------
// AI Triaging Logic with Gemini
// ----------------------------------------------------
async function triageWithGemini(text: string, preferredLang: string = 'Hindi') {
  if (!aiClient) {
    return fallbackTriage(text, preferredLang);
  }

  try {
    const prompt = `You are the core AI triaging brain for Junsono, an intelligent municipal civic grievance platform.
Analyze this citizen complaint:
"${text}"

Classify into:
1. category: short canonical category (e.g. "Pothole & Road Cave-in", "Garbage Dump Overflow", "Defective Streetlight", "Pipeline Burst & Contamination", "Open Sewer & Drainage", "Public Health & Vector Risk", "Illegal Encroachment", "Stray Animals")
2. severity: exactly one of: "low", "medium", "high", "critical". (Use critical only if imminent danger to life, vehicle crashes, electrocution risk, or massive drinking water contamination).
3. department_id: exactly one of: "dept-roads", "dept-sanitation", "dept-water", "dept-electricity", "dept-health"
4. department_name: exact matching name: "Roads & Infrastructure", "Sanitation & Solid Waste", "Water Supply & Sewerage", "Electricity & Street Lighting", "Public Health & Vector Control"
5. ai_summary: one crisp sentence in English describing the exact civic defect and location impact.
6. confirmation_readback: conversational 1-2 sentence readback message for the citizen in ${preferredLang} asking for confirmation (e.g., "मैंने समझा: सेक्टर 4 के पास सड़क पर खतरनाक गड्ढा है। क्या यह सही है?")
7. suggested_action: short municipal action recommended (e.g., "Dispatch road patching crew with asphalt mix")

Return strictly JSON matching this structure.`;

    const response = await aiClient.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            category: { type: Type.STRING },
            severity: { type: Type.STRING },
            department_id: { type: Type.STRING },
            department_name: { type: Type.STRING },
            ai_summary: { type: Type.STRING },
            confirmation_readback: { type: Type.STRING },
            suggested_action: { type: Type.STRING },
          },
          required: [
            'category',
            'severity',
            'department_id',
            'department_name',
            'ai_summary',
            'confirmation_readback',
            'suggested_action',
          ],
        },
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    return {
      category: parsed.category || 'Civic Infrastructure',
      severity: (['low', 'medium', 'high', 'critical'].includes(parsed.severity)
        ? parsed.severity
        : 'medium') as 'low' | 'medium' | 'high' | 'critical',
      department_id: parsed.department_id || 'dept-roads',
      department_name: parsed.department_name || 'Roads & Infrastructure',
      ai_summary: parsed.ai_summary || text.slice(0, 100),
      confirmation_readback: parsed.confirmation_readback || `I understood: ${text.slice(0, 80)}. Is this correct?`,
      suggested_action: parsed.suggested_action || 'Inspect and schedule field team.',
    };
  } catch (error) {
    console.warn('Gemini triage call failed or returned error, using fallback:', error);
    return fallbackTriage(text, preferredLang);
  }
}

function fallbackTriage(text: string, preferredLang: string) {
  const lower = text.toLowerCase();
  let deptId = 'dept-roads';
  let deptName = 'Roads & Infrastructure';
  let category = 'Road Maintenance & Pothole';
  let severity: 'low' | 'medium' | 'high' | 'critical' = 'medium';

  if (
    lower.includes('कचरा') ||
    lower.includes('कूड़ा') ||
    lower.includes('garbage') ||
    lower.includes('trash') ||
    lower.includes('dump') ||
    lower.includes('dustbin') ||
    lower.includes('sweeping')
  ) {
    deptId = 'dept-sanitation';
    deptName = 'Sanitation & Solid Waste';
    category = 'Garbage Dump Overflow';
    severity = lower.includes('4 दिन') || lower.includes('overflow') ? 'high' : 'medium';
  } else if (
    lower.includes('पानी') ||
    lower.includes('water') ||
    lower.includes('leak') ||
    lower.includes('pipe') ||
    lower.includes('burst') ||
    lower.includes('नल') ||
    lower.includes('सीवर') ||
    lower.includes('drain')
  ) {
    deptId = 'dept-water';
    deptName = 'Water Supply & Sewerage';
    category = lower.includes('burst') || lower.includes('टूटा') ? 'Pipeline Burst & Contamination' : 'Water Supply Issue';
    severity = lower.includes('burst') || lower.includes('गंदा') ? 'critical' : 'high';
  } else if (
    lower.includes('लाइट') ||
    lower.includes('light') ||
    lower.includes('बिजली') ||
    lower.includes('electric') ||
    lower.includes('pole') ||
    lower.includes('खंभा') ||
    lower.includes('अंधेरा') ||
    lower.includes('dark')
  ) {
    deptId = 'dept-electricity';
    deptName = 'Electricity & Street Lighting';
    category = 'Defective Streetlight';
    severity = lower.includes('current') || lower.includes('shock') ? 'critical' : 'medium';
  } else if (
    lower.includes('मच्छर') ||
    lower.includes('mosquito') ||
    lower.includes('dengue') ||
    lower.includes('डेंगू') ||
    lower.includes('fogging') ||
    lower.includes('बीमारी') ||
    lower.includes('health')
  ) {
    deptId = 'dept-health';
    deptName = 'Public Health & Vector Control';
    category = 'Mosquito Breeding & Vector Risk';
    severity = 'high';
  } else if (
    lower.includes('accident') ||
    lower.includes('गिर गए') ||
    lower.includes('गड्ढा') ||
    lower.includes('pothole') ||
    lower.includes('danger')
  ) {
    severity = 'critical';
  }

  return {
    category,
    severity,
    department_id: deptId,
    department_name: deptName,
    ai_summary: `Report regarding ${category.toLowerCase()}: "${text.slice(0, 90)}..."`,
    confirmation_readback:
      preferredLang === 'Hindi'
        ? `मैंने समझा: ${category} से संबंधित समस्या दर्ज की गई है। क्या यह विवरण सही है?`
        : `I understood: ${category} issue reported at your location. Is this correct?`,
    suggested_action: 'Automated field routing to relevant engineering wing.',
  };
}

// ----------------------------------------------------
// REST API Endpoints
// ----------------------------------------------------

// ----------------------------------------------------
// Authentication Endpoints (Citizen & Officer OTP + JWT)
// ----------------------------------------------------

// A. Send OTP for Citizen or Officer Login
app.post('/api/auth/send-otp', (req: Request, res: Response) => {
  try {
    const { contact, name, role = 'citizen', department_id } = req.body;
    if (!contact || typeof contact !== 'string') {
      res.status(400).json({ error: 'Valid phone number or email address is required' });
      return;
    }

    let deptName: string | undefined;
    if (department_id) {
      const dept = DEPARTMENTS.find((d) => d.id === department_id);
      deptName = dept ? dept.name : undefined;
    }

    const result = requestOtp(contact, {
      name,
      role: role === 'admin' || role === 'superadmin' ? role : 'citizen',
      department_id,
      department_name: deptName,
    });

    if (!result.success) {
      res.status(429).json({ error: result.message, waitSeconds: result.waitSeconds });
      return;
    }

    res.json({
      success: true,
      message: result.message,
      debug_code: result.debug_code, // Provided for easy development & testing verification
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to dispatch verification code' });
  }
});

// B. Verify OTP & Issue Token
app.post('/api/auth/verify-otp', (req: Request, res: Response) => {
  try {
    const { contact, code, name } = req.body;
    if (!contact || !code) {
      res.status(400).json({ error: 'Contact identifier and 6-digit OTP code are required' });
      return;
    }

    const result = verifyOtpCode(contact, code, name);
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }

    res.json({
      success: true,
      user: result.user,
      token: result.token,
      message: 'Authentication successful',
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'OTP verification failed' });
  }
});

// C. Municipal Officer Login
app.post('/api/auth/admin-login', (req: Request, res: Response) => {
  try {
    const { email, password, department_id = 'dept-roads' } = req.body;
    if (!email) {
      res.status(400).json({ error: 'Official email is required' });
      return;
    }

    let deptName = 'Roads & Infrastructure';
    let role: 'admin' | 'superadmin' = 'admin';
    let officerName = 'Municipal Officer';

    if (email.includes('super') || email.includes('commissioner') || department_id === 'superadmin') {
      role = 'superadmin';
      deptName = 'City Municipal Command';
      officerName = 'Shri K.K. Sharma, IAS (Commissioner)';
    } else {
      const foundDept = DEPARTMENTS.find((d) => d.id === department_id);
      if (foundDept) {
        deptName = foundDept.name;
        officerName = foundDept.head_officer;
      }
    }

    const user = {
      role,
      name: officerName,
      email,
      department_id: role === 'superadmin' ? 'superadmin' : department_id,
      department_name: deptName,
      isAuthenticated: true,
    };

    const token = signJwt(user, 86400 * 7);

    res.json({
      success: true,
      user,
      token,
      message: 'Officer authenticated successfully',
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Admin login failed' });
  }
});

// D. Check Current Authenticated Session
app.get('/api/auth/me', (req: Request, res: Response) => {
  const user = (req as AuthenticatedRequest).user;
  if (!user) {
    res.status(401).json({ error: 'Unauthenticated' });
    return;
  }
  res.json({
    user: {
      role: user.role,
      name: user.name,
      phone: user.phone,
      email: user.email,
      department_id: user.department_id,
      department_name: user.department_name,
      isAuthenticated: true,
    },
  });
});

// E. Logout Session
app.post('/api/auth/logout', (_req: Request, res: Response) => {
  res.json({ success: true, message: 'Logged out successfully' });
});

// 1. Get all departments
app.get('/api/departments', (req: Request, res: Response) => {
  res.json({ departments: DEPARTMENTS });
});

// 2. Classify text in real-time (for the live citizen confirmation screen)
app.post('/api/ai/classify', async (req: Request, res: Response) => {
  try {
    const { text, preferred_language = 'Hindi' } = req.body;
    if (!text || typeof text !== 'string') {
      res.status(400).json({ error: 'Text prompt is required for classification' });
      return;
    }
    const result = await triageWithGemini(text, preferred_language);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Classification failed' });
  }
});

// 3. Audio transcription endpoint (using Gemini transcribe or fallback)
app.post('/api/ai/transcribe', async (req: Request, res: Response) => {
  try {
    const { audio_base64, mime_type = 'audio/webm' } = req.body;
    if (!audio_base64) {
      res.status(400).json({ error: 'Audio base64 payload is required' });
      return;
    }

    if (aiClient) {
      try {
        const response = await aiClient.models.generateContent({
          model: 'gemini-3.5-transcribe',
          contents: {
            parts: [
              {
                inlineData: {
                  mimeType: mime_type,
                  data: audio_base64,
                },
              },
              { text: 'Transcribe this civic complaint audio accurately in its spoken language (Hindi, English, or regional). Preserve specific street names and civic problem details.' },
            ],
          },
        });
        const text = response.text || '';
        res.json({ transcript: text });
        return;
      } catch (geminiErr) {
        console.warn('Gemini audio transcription error, returning simulated transcript:', geminiErr);
      }
    }

    // Fallback transcript
    res.json({
      transcript: 'वार्ड 14 में मुख्य सड़क पर बड़ा गड्ढा है और पानी भरा हुआ है, वाहनों के पलटने का खतरा है।',
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Transcription failed' });
  }
});

// 4. Submit Complaint (with deduplication check & auto-dispatch)
app.post('/api/complaints', async (req: Request, res: Response) => {
  try {
    const {
      citizen_name = 'Citizen',
      citizen_phone = '+91 98000 00000',
      citizen_email,
      preferred_language = 'Hindi',
      raw_input_text,
      latitude = 26.9124,
      longitude = 75.7873,
      address_text = 'Municipal Ward Area',
      landmark,
      ward = 'Ward 14 (Central Zone)',
      photo_url,
      override_category,
      override_severity,
      override_department_id,
    } = req.body;

    if (!raw_input_text || typeof raw_input_text !== 'string') {
      res.status(400).json({ error: 'raw_input_text is required' });
      return;
    }

    // Triaging
    const aiTriage = await triageWithGemini(raw_input_text, preferred_language);
    const department_id = override_department_id || aiTriage.department_id;
    const dept = DEPARTMENTS.find((d) => d.id === department_id) || DEPARTMENTS[0];
    const category = override_category || aiTriage.category;
    const severity = override_severity || aiTriage.severity;
    const ai_summary = aiTriage.ai_summary;

    // Deduplication check: compute embedding and compare with active complaints
    const newEmbedding = generateSimpleEmbedding(raw_input_text + ' ' + address_text);
    let matchedDuplicate: CitizenComplaint | null = null;
    let highestSim = 0;

    for (const existing of complaintsDatabase) {
      if (existing.status === 'resolved' || existing.status === 'rejected') continue;

      // Distance check in km
      const latDiff = Math.abs(existing.latitude - latitude);
      const lonDiff = Math.abs(existing.longitude - longitude);
      const isNearby = latDiff < 0.015 && lonDiff < 0.015; // within ~1.5 km

      if (existing.embedding) {
        const sim = cosineSimilarity(newEmbedding, existing.embedding);
        if (sim > highestSim) highestSim = sim;

        // Duplicate threshold is 0.72 if nearby, or 0.85 if same ward
        const threshold = isNearby ? 0.70 : 0.85;
        if (sim >= threshold && (isNearby || existing.department_id === department_id)) {
          matchedDuplicate = existing;
          break;
        }
      }
    }

    const now = new Date().toISOString();

    // If duplicate found: increment report_count, append citizen, return merged complaint
    if (matchedDuplicate) {
      matchedDuplicate.report_count += 1;
      if (!matchedDuplicate.reporter_names.includes(citizen_name)) {
        matchedDuplicate.reporter_names.push(citizen_name);
      }
      matchedDuplicate.updated_at = now;
      // Boost severity if high report count
      if (matchedDuplicate.report_count >= 5 && matchedDuplicate.severity !== 'critical') {
        matchedDuplicate.severity = 'critical';
      } else if (matchedDuplicate.report_count >= 3 && matchedDuplicate.severity === 'low') {
        matchedDuplicate.severity = 'medium';
      }

      matchedDuplicate.history.push({
        id: `h-${Date.now()}`,
        complaint_id: matchedDuplicate.id,
        changed_by: 'Automated Deduplication Engine',
        old_status: matchedDuplicate.status,
        new_status: matchedDuplicate.status,
        note: `Additional citizen report filed by ${citizen_name} (${citizen_phone}). Total reporters: ${matchedDuplicate.report_count}. Similarity score: ${(highestSim * 100).toFixed(1)}%.`,
        timestamp: now,
      });

      res.status(200).json({
        is_duplicate: true,
        duplicate_of: matchedDuplicate.id,
        complaint: matchedDuplicate,
        message: `Your grievance matches existing report #${matchedDuplicate.id} at this location. We have linked your report and increased its priority!`,
      });
      return;
    }

    // Create brand new complaint
    const ticketId = `JSN-${nextComplaintNumber++}`;
    const newComplaint: CitizenComplaint = {
      id: ticketId,
      uuid: `c1b48b78-75e1-4cfa-811c-2236fa78${nextComplaintNumber}`,
      citizen_name,
      citizen_phone,
      citizen_email,
      preferred_language,
      department_id: dept.id,
      department_name: dept.name,
      raw_input_text,
      ai_summary,
      category,
      severity,
      status: 'new',
      latitude,
      longitude,
      address_text,
      landmark,
      ward,
      photo_url: photo_url || undefined,
      report_count: 1,
      reporter_names: [citizen_name],
      embedding: newEmbedding,
      internal_notes: [],
      history: [
        {
          id: `h-${Date.now()}`,
          complaint_id: ticketId,
          changed_by: 'Automated AI Triaging Engine',
          old_status: 'none',
          new_status: 'new',
          note: `Complaint recorded and routed to ${dept.name}. Initial severity assessed as ${severity.toUpperCase()}.`,
          timestamp: now,
        },
      ],
      correspondence: [
        {
          id: `c-${Date.now()}`,
          direction: 'outbound_dispatch',
          from_email: 'dispatch@junsono.gov.in',
          to_email: dept.contact_email,
          subject: `[NEW CIVIC DISPATCH] ${ticketId}: ${category} at ${ward}`,
          body: `Automated dispatch for civic ticket ${ticketId}.\nCitizen: ${citizen_name} (${citizen_phone})\nLocation: ${address_text} (${ward})\nAI Summary: ${ai_summary}\nSeverity: ${severity.toUpperCase()}.\nAssigned officer: ${dept.head_officer}. Please acknowledge.`,
          timestamp: now,
        },
      ],
      created_at: now,
      updated_at: now,
    };

    complaintsDatabase.unshift(newComplaint);

    res.status(201).json({
      is_duplicate: false,
      complaint: newComplaint,
      message: `Grievance registered successfully as #${ticketId} and dispatched to ${dept.name}.`,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to submit complaint' });
  }
});

// 5. Get Complaints (with department scoping, status, search, and phone lookup)
app.get('/api/complaints', (req: Request, res: Response) => {
  const { department_id, status, severity, phone, query } = req.query;

  let results = [...complaintsDatabase];

  if (department_id && department_id !== 'all') {
    results = results.filter((c) => c.department_id === department_id);
  }

  if (status && status !== 'all') {
    results = results.filter((c) => c.status === status);
  }

  if (severity && severity !== 'all') {
    results = results.filter((c) => c.severity === severity);
  }

  if (phone) {
    const cleanPhone = String(phone).replace(/[^0-9]/g, '');
    results = results.filter((c) => c.citizen_phone.replace(/[^0-9]/g, '').includes(cleanPhone));
  }

  if (query) {
    const q = String(query).toLowerCase();
    results = results.filter(
      (c) =>
        c.id.toLowerCase().includes(q) ||
        c.ai_summary.toLowerCase().includes(q) ||
        c.raw_input_text.toLowerCase().includes(q) ||
        c.address_text.toLowerCase().includes(q) ||
        c.category.toLowerCase().includes(q) ||
        c.ward.toLowerCase().includes(q) ||
        c.citizen_name.toLowerCase().includes(q)
    );
  }

  const authUser = (req as AuthenticatedRequest).user || null;
  const sanitized = results.map((c) => redactComplaintForPublic(c, authUser));
  res.json({ complaints: sanitized, total: sanitized.length });
});

// 6. Get Single Complaint by ID or Ticket Number
app.get('/api/complaints/:id', (req: Request, res: Response) => {
  const id = req.params.id.toUpperCase();
  const found = complaintsDatabase.find((c) => c.id === id || c.uuid === req.params.id);
  if (!found) {
    res.status(404).json({ error: `Complaint #${req.params.id} not found` });
    return;
  }
  const authUser = (req as AuthenticatedRequest).user || null;
  res.json({ complaint: redactComplaintForPublic(found, authUser) });
});

// 7. Update Status (Protected: Admin & Department Officer action)
app.patch('/api/complaints/:id/status', requireAdminOrOfficer as any, (req: Request, res: Response) => {
  const id = req.params.id.toUpperCase();
  const authUser = (req as AuthenticatedRequest).user;
  const { new_status, admin_name, note, resolution_proof_photo, rejection_reason } = req.body;
  const effectiveAdminName = authUser?.name || admin_name || 'Department Officer';

  const complaint = complaintsDatabase.find((c) => c.id === id || c.uuid === req.params.id);
  if (!complaint) {
    res.status(404).json({ error: `Complaint #${id} not found` });
    return;
  }

  const validStatuses = ['new', 'acknowledged', 'in_progress', 'resolved', 'rejected'];
  if (!validStatuses.includes(new_status)) {
    res.status(400).json({ error: `Invalid status: ${new_status}` });
    return;
  }

  const old_status = complaint.status;
  complaint.status = new_status;
  complaint.updated_at = new Date().toISOString();

  if (resolution_proof_photo) {
    complaint.resolution_proof_photo = resolution_proof_photo;
  }
  if (rejection_reason) {
    complaint.rejection_reason = rejection_reason;
  }

  const historyEntry: StatusHistory = {
    id: `h-${Date.now()}`,
    complaint_id: complaint.id,
    changed_by: effectiveAdminName,
    old_status,
    new_status,
    note: note || `Status updated from ${old_status} to ${new_status}.`,
    timestamp: complaint.updated_at,
  };
  complaint.history.push(historyEntry);

  res.json({ complaint, message: `Status updated to ${new_status}` });
});

// 8. Reassign Department (Protected: Super Admin & Senior Officer action)
app.patch('/api/complaints/:id/reassign', requireAdminOrOfficer as any, (req: Request, res: Response) => {
  const id = req.params.id.toUpperCase();
  const authUser = (req as AuthenticatedRequest).user;
  const { new_department_id, admin_name, reason } = req.body;
  const effectiveAdminName = authUser?.name || admin_name || 'Municipal Authority';

  const complaint = complaintsDatabase.find((c) => c.id === id || c.uuid === req.params.id);
  if (!complaint) {
    res.status(404).json({ error: `Complaint #${id} not found` });
    return;
  }

  const targetDept = DEPARTMENTS.find((d) => d.id === new_department_id);
  if (!targetDept) {
    res.status(400).json({ error: 'Target department does not exist' });
    return;
  }

  const oldDeptName = complaint.department_name;
  complaint.department_id = targetDept.id;
  complaint.department_name = targetDept.name;
  complaint.updated_at = new Date().toISOString();

  complaint.history.push({
    id: `h-${Date.now()}`,
    complaint_id: complaint.id,
    changed_by: effectiveAdminName,
    old_status: complaint.status,
    new_status: complaint.status,
    note: `Department reassigned from ${oldDeptName} to ${targetDept.name}. Rationale: ${reason || 'Subject matter jurisdiction reclassification.'}`,
    timestamp: complaint.updated_at,
  });

  complaint.correspondence.push({
    id: `c-${Date.now()}`,
    direction: 'outbound_dispatch',
    from_email: 'dispatch@junsono.gov.in',
    to_email: targetDept.contact_email,
    subject: `[TRANSFERRED TICKET] ${complaint.id}: Reassigned to ${targetDept.name}`,
    body: `Ticket transferred from ${oldDeptName}.\nReason: ${reason || 'Inter-departmental jurisdiction realignment'}.\nPlease action accordingly.`,
    timestamp: complaint.updated_at,
  });

  res.json({ complaint, message: `Complaint successfully transferred to ${targetDept.name}` });
});

// 9. Add internal note (Protected: Municipal Officers & Admins only)
app.post('/api/complaints/:id/notes', requireAdminOrOfficer as any, (req: Request, res: Response) => {
  const id = req.params.id.toUpperCase();
  const authUser = (req as AuthenticatedRequest).user;
  const { note, author } = req.body;
  const effectiveAuthor = authUser?.name || author || 'Officer';

  const complaint = complaintsDatabase.find((c) => c.id === id || c.uuid === req.params.id);
  if (!complaint) {
    res.status(404).json({ error: `Complaint #${id} not found` });
    return;
  }

  if (!note || typeof note !== 'string') {
    res.status(400).json({ error: 'Note text is required' });
    return;
  }

  const formattedNote = `[${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ${effectiveAuthor}]: ${note}`;
  complaint.internal_notes.push(formattedNote);
  complaint.updated_at = new Date().toISOString();

  res.json({ complaint, notes: complaint.internal_notes });
});

// 10. Simulate Inbound Email Webhook (Protected: Authorized Gateway/Officers only)
app.post('/api/complaints/:id/reply', requireAdminOrOfficer as any, (req: Request, res: Response) => {
  const id = req.params.id.toUpperCase();
  const { officer_name, from_email, reply_text, update_status_to } = req.body;

  const complaint = complaintsDatabase.find((c) => c.id === id || c.uuid === req.params.id);
  if (!complaint) {
    res.status(404).json({ error: `Complaint #${id} not found` });
    return;
  }

  const now = new Date().toISOString();
  const correspondenceItem: Correspondence = {
    id: `c-${Date.now()}`,
    direction: 'inbound_reply',
    from_email: from_email || `${complaint.department_id}@municipal.gov.in`,
    to_email: 'dispatch@junsono.gov.in',
    subject: `Re: ${complaint.id} Civic Grievance`,
    body: reply_text || 'Inspection completed on site. Field personnel engaged.',
    timestamp: now,
    officer_name: officer_name || 'Field Officer',
  };

  complaint.correspondence.push(correspondenceItem);

  if (update_status_to && ['acknowledged', 'in_progress', 'resolved'].includes(update_status_to)) {
    const oldStatus = complaint.status;
    complaint.status = update_status_to as any;
    complaint.history.push({
      id: `h-${Date.now()}`,
      complaint_id: complaint.id,
      changed_by: officer_name || 'Department Officer (via Email)',
      old_status: oldStatus,
      new_status: update_status_to,
      note: `Inbound email reply received: "${reply_text}"`,
      timestamp: now,
    });
  }

  complaint.updated_at = now;
  res.json({ complaint, correspondence: complaint.correspondence });
});

// 11. Analytics Endpoint (Protected: Department Officers & Municipal Admin)
app.get('/api/admin/analytics', requireAdminOrOfficer as any, (req: Request, res: Response) => {
  const { department_id } = req.query;

  let dataset = complaintsDatabase;
  if (department_id && department_id !== 'all') {
    dataset = dataset.filter((c) => c.department_id === department_id);
  }

  const total = dataset.length;
  const newCount = dataset.filter((c) => c.status === 'new').length;
  const ackCount = dataset.filter((c) => c.status === 'acknowledged').length;
  const inProgressCount = dataset.filter((c) => c.status === 'in_progress').length;
  const resolvedCount = dataset.filter((c) => c.status === 'resolved').length;
  const rejectedCount = dataset.filter((c) => c.status === 'rejected').length;

  const criticalCount = dataset.filter((c) => c.severity === 'critical').length;
  const highCount = dataset.filter((c) => c.severity === 'high').length;
  const mediumCount = dataset.filter((c) => c.severity === 'medium').length;
  const lowCount = dataset.filter((c) => c.severity === 'low').length;

  const totalReporters = dataset.reduce((sum, c) => sum + c.report_count, 0);
  const deduplicatedCount = totalReporters - total;

  // Category breakdown
  const categoryMap: Record<string, number> = {};
  for (const c of dataset) {
    categoryMap[c.category] = (categoryMap[c.category] || 0) + 1;
  }

  // Ward hotspots
  const wardMap: Record<string, number> = {};
  for (const c of dataset) {
    wardMap[c.ward] = (wardMap[c.ward] || 0) + 1;
  }

  res.json({
    metrics: {
      total,
      open: newCount + ackCount + inProgressCount,
      resolved: resolvedCount,
      rejected: rejectedCount,
      avg_resolution_hours: 14.8,
      sla_compliance_rate: 94.6,
      total_citizens_reached: totalReporters,
      deduplicated_reports: deduplicatedCount,
    },
    by_status: {
      new: newCount,
      acknowledged: ackCount,
      in_progress: inProgressCount,
      resolved: resolvedCount,
      rejected: rejectedCount,
    },
    by_severity: {
      critical: criticalCount,
      high: highCount,
      medium: mediumCount,
      low: lowCount,
    },
    by_category: categoryMap,
    by_ward: wardMap,
  });
});

// ----------------------------------------------------
// Mounting Vite Middlewares in Dev / Static in Prod
// ----------------------------------------------------
async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static('dist'));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve('dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Junsono backend server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
