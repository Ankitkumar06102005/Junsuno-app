import fs from 'fs';
import path from 'path';
import { CitizenComplaint, Department } from './src/types';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'database.json');

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

// Helper to generate text embeddings for deduplication
export function generateSimpleEmbedding(text: string): number[] {
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
  const mag = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0)) || 1;
  return vector.map((v) => v / mag);
}

export function cosineSimilarity(vecA: number[], vecB: number[]): number {
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
const SEED_COMPLAINTS: CitizenComplaint[] = [
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
        note: 'Triaged via Gemini: Assigned to Roads & Infrastructure with Critical SLA (4 hrs).',
        timestamp: '2026-09-27T07:15:00.000Z',
      },
      {
        id: 'h-2',
        complaint_id: 'JSN-1001',
        changed_by: 'Er. Rajeshwar Sharma (Chief Engineer)',
        old_status: 'new',
        new_status: 'acknowledged',
        note: 'Assigned to Ward 14 Rapid Action Paving Team.',
        timestamp: '2026-09-27T07:30:00.000Z',
      },
      {
        id: 'h-3',
        complaint_id: 'JSN-1001',
        changed_by: 'Er. Rajeshwar Sharma (Chief Engineer)',
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
        body: 'Automated civic grievance JSN-1001 filed by citizen Ramesh Chander. Severity: CRITICAL.',
        timestamp: '2026-09-27T07:15:30.000Z',
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
        changed_by: 'Dr. Sunita Meena (Health Officer)',
        old_status: 'new',
        new_status: 'acknowledged',
        note: 'Tipper truck #RJ14-GC-4412 assigned.',
        timestamp: '2026-09-27T07:45:00.000Z',
      },
    ],
    correspondence: [],
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
    raw_input_text: 'Three consecutive streetlights on the internal colony road are dark since Friday, creating safety issues at night.',
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
    correspondence: [],
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
    reporter_names: ['Govind Swaroop', 'Hitesh Agarwal', 'Sangeeta Roy', 'Manish Sharma'],
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
    ],
    correspondence: [],
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
    raw_input_text: 'खाली प्लॉट में बारिश का गंदा पानी जमा है, बहुत मच्छर हो रहे हैं और कॉलोनी में बच्चों को डेंगू का खतरा है। फोगिंग करवाएं।',
    ai_summary: 'Stagnant rainwater pool in vacant residential plot breeding mosquitoes; dengue risk reported.',
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
    reporter_names: ['Sunita Devi', 'Harish Chandra', 'Praveen Bishnoi'],
    embedding: generateSimpleEmbedding('stagnant water mosquitoes dengue fogging vacant plot health'),
    internal_notes: ['Anti-larval chemical sprayed (Temephos 50% EC). Evening fogging completed.'],
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
        id: 'h-54',
        complaint_id: 'JSN-1005',
        changed_by: 'Dr. Neha Kulkarni (CMO)',
        old_status: 'in_progress',
        new_status: 'resolved',
        note: 'Plot drained, larvicide sprayed and fogging completed.',
        timestamp: '2026-09-27T08:00:00.000Z',
      },
    ],
    correspondence: [],
    created_at: '2026-09-26T09:00:00.000Z',
    updated_at: '2026-09-27T08:00:00.000Z',
    resolution_proof_photo: 'https://images.unsplash.com/photo-1584467735871-8e85353a8413?auto=format&fit=crop&w=800&q=80',
  },
];

interface DatabaseSchema {
  version: number;
  lastUpdated: string;
  nextComplaintNumber: number;
  complaints: CitizenComplaint[];
}

let dbMemory: DatabaseSchema = {
  version: 1,
  lastUpdated: new Date().toISOString(),
  nextComplaintNumber: 1006,
  complaints: [...SEED_COMPLAINTS],
};

// Ensure data directory exists and initialize DB from disk
export function initDatabase(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (fs.existsSync(DB_FILE)) {
      const content = fs.readFileSync(DB_FILE, 'utf8');
      const loaded: DatabaseSchema = JSON.parse(content);
      if (Array.isArray(loaded.complaints) && loaded.complaints.length > 0) {
        dbMemory = loaded;
        console.log(`[Database] Loaded ${dbMemory.complaints.length} grievances from persistent disk storage.`);
        return;
      }
    }

    // Initialize with seeded data
    saveDatabase();
    console.log(`[Database] Initialized new persistent store at ${DB_FILE}`);
  } catch (err) {
    console.error('[Database] Failed to load database from disk, using fallback in-memory state:', err);
  }
}

// Atomic save to disk to prevent corrupted files
export function saveDatabase(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    dbMemory.lastUpdated = new Date().toISOString();
    const tmpFile = `${DB_FILE}.tmp.${Date.now()}`;
    fs.writeFileSync(tmpFile, JSON.stringify(dbMemory, null, 2), 'utf8');
    fs.renameSync(tmpFile, DB_FILE);
  } catch (err) {
    console.error('[Database] Error persisting database to disk:', err);
  }
}

export function getAllComplaints(): CitizenComplaint[] {
  return dbMemory.complaints;
}

export function getComplaintById(id: string): CitizenComplaint | undefined {
  const cleanId = id.toUpperCase();
  return dbMemory.complaints.find((c) => c.id === cleanId || c.uuid === id);
}

export function addComplaint(complaint: CitizenComplaint): void {
  dbMemory.complaints.unshift(complaint);
  dbMemory.nextComplaintNumber += 1;
  saveDatabase();
}

export function updateComplaint(id: string, mutator: (c: CitizenComplaint) => void): CitizenComplaint | null {
  const cleanId = id.toUpperCase();
  const index = dbMemory.complaints.findIndex((c) => c.id === cleanId || c.uuid === id);
  if (index === -1) return null;

  mutator(dbMemory.complaints[index]);
  dbMemory.complaints[index].updated_at = new Date().toISOString();
  saveDatabase();
  return dbMemory.complaints[index];
}

export function getNextTicketNumber(): number {
  return dbMemory.nextComplaintNumber;
}
