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
    head_officer: 'Nodal Officer (Roads & Infrastructure)',
    municipal_zone: 'Zone 4 - Central & North',
    color: '#15803D',
  },
  {
    id: 'dept-sanitation',
    name: 'Sanitation & Solid Waste',
    short_code: 'SWM',
    contact_email: 'sanitation@municipal.gov.in',
    phone: '+91 141 2740022',
    head_officer: 'Chief Health & Sanitation Officer',
    municipal_zone: 'City-wide All Wards',
    color: '#059669',
  },
  {
    id: 'dept-water',
    name: 'Water Supply & Sewerage',
    short_code: 'WSS',
    contact_email: 'watersupply@municipal.gov.in',
    phone: '+91 141 2740033',
    head_officer: 'Executive Engineer (Water Supply & Drainage)',
    municipal_zone: 'Zone 2 & Zone 3',
    color: '#0284C7',
  },
  {
    id: 'dept-electricity',
    name: 'Electricity & Street Lighting',
    short_code: 'ELEC',
    contact_email: 'streetlighting@municipal.gov.in',
    phone: '+91 141 2740044',
    head_officer: 'Executive Engineer (Electricity & Lighting)',
    municipal_zone: 'City-wide High-mast & Feeder Lines',
    color: '#D97706',
  },
  {
    id: 'dept-health',
    name: 'Public Health & Vector Control',
    short_code: 'PHVC',
    contact_email: 'publichealth@municipal.gov.in',
    phone: '+91 141 2740055',
    head_officer: 'Chief Medical Officer (Public Health)',
    municipal_zone: 'Ward 10 to Ward 35',
    color: '#16A34A',
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

// Clean production database schema - starts with 0 complaints
interface DatabaseSchema {
  version: number;
  lastUpdated: string;
  nextComplaintNumber: number;
  complaints: CitizenComplaint[];
}

let dbMemory: DatabaseSchema = {
  version: 1,
  lastUpdated: new Date().toISOString(),
  nextComplaintNumber: 1001,
  complaints: [],
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
      if (Array.isArray(loaded.complaints)) {
        dbMemory = loaded;
        console.log(`[Database] Loaded ${dbMemory.complaints.length} live grievances from persistent disk storage.`);
        return;
      }
    }

    // Initialize clean persistent file
    saveDatabase();
    console.log(`[Database] Initialized clean persistent store at ${DB_FILE}`);
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
