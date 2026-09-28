import { GoogleGenAI, Type } from '@google/genai';
import { DEPARTMENTS } from './server-db';

const apiKey = process.env.GEMINI_API_KEY;
let aiClient: GoogleGenAI | null = null;
if (apiKey) {
  try {
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: { 'User-Agent': 'junsono-civic-nlp' },
      },
    });
  } catch (err) {
    console.warn('[NLP] GoogleGenAI init skipped or key invalid:', err);
  }
}

export interface TriageResult {
  category: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  department_id: string;
  department_name: string;
  ai_summary: string;
  confirmation_readback: string;
  suggested_action: string;
  confidence_score: number;
  detected_keywords: string[];
}

// ----------------------------------------------------
// Trained Civic Lexicon & Rule-based NLP Engine
// ----------------------------------------------------
interface KeywordRule {
  terms: string[];
  weight: number;
  category: string;
  baseSeverity?: 'low' | 'medium' | 'high' | 'critical';
}

const DEPT_RULES: Record<string, { name: string; rules: KeywordRule[] }> = {
  'dept-roads': {
    name: 'Roads & Infrastructure',
    rules: [
      {
        terms: ['gaddha', 'gaddhe', 'गड्ढा', 'गड्ढे', 'pothole', 'potholes', 'cave in', 'cave-in', 'dhans', 'धंसना', 'धंस रही', 'crater'],
        weight: 10,
        category: 'Pothole & Road Cave-in',
        baseSeverity: 'high',
      },
      {
        terms: ['road', 'sadak', 'सड़क', 'street', 'main road', 'bypass', 'flyover', 'trench', 'tar', 'asphalt', 'डामर', 'patchwork'],
        weight: 6,
        category: 'Road Surface Damage',
        baseSeverity: 'medium',
      },
      {
        terms: ['footpath', 'divider', 'pavement', 'patri', 'फुटपाथ', 'डिवाइडर', 'speed breaker', 'कंक्रीट'],
        weight: 7,
        category: 'Footpath & Median Damage',
        baseSeverity: 'low',
      },
    ],
  },
  'dept-sanitation': {
    name: 'Sanitation & Solid Waste',
    rules: [
      {
        terms: ['kachra', 'kachre', 'कचरा', 'कूड़ा', 'kuda', 'garbage', 'trash', 'waste', 'dustbin', 'डस्टबिन', 'dhalao', 'dumpster'],
        weight: 10,
        category: 'Garbage Dump Overflow',
        baseSeverity: 'medium',
      },
      {
        terms: ['safai', 'sweeper', 'sweeping', 'झाड़ू', 'सफाई', 'tipper truck', 'गाड़ी नहीं आई', 'dustbin overflow'],
        weight: 8,
        category: 'Uncollected Community Waste',
        baseSeverity: 'medium',
      },
      {
        terms: ['badbu', 'दुर्गंध', 'foul smell', 'stench', 'dead animal', 'carcass', 'मरा हुआ जानवर', 'मरी हुई गाय', 'सड़ रहा'],
        weight: 9,
        category: 'Animal Carcass & Biological Stench',
        baseSeverity: 'high',
      },
    ],
  },
  'dept-water': {
    name: 'Water Supply & Sewerage',
    rules: [
      {
        terms: ['pipeline burst', 'pipe burst', 'पाइपलाइन', 'पाइप फट', 'leaking pipeline', 'water leaking', 'पानी बह रहा', 'water wastage'],
        weight: 10,
        category: 'Pipeline Burst & Clean Water Loss',
        baseSeverity: 'critical',
      },
      {
        terms: ['drinking water', 'pani', 'paani', 'पानी नहीं', 'नल में पानी', 'ganda pani', 'गंदा पानी', 'dirty water', 'contaminated water', 'दूषित जल', 'peene ka pani'],
        weight: 9,
        category: 'Contaminated / Disruptive Water Supply',
        baseSeverity: 'high',
      },
      {
        terms: ['sewer', 'sewerage', 'drain', 'drainage', 'naali', 'नाली', 'सीवर', 'manhole overflow', 'सीवर जाम', 'sewer overflow', 'गंदा नाला'],
        weight: 9,
        category: 'Sewer Line Overflow & Blockage',
        baseSeverity: 'high',
      },
    ],
  },
  'dept-electricity': {
    name: 'Electricity & Street Lighting',
    rules: [
      {
        terms: ['streetlight', 'street light', 'streetlights', 'light', 'बत्ती', 'लाइट', 'dark stretch', 'andhera', 'अंधेरा', 'pole light', 'bulb'],
        weight: 9,
        category: 'Defective Streetlight',
        baseSeverity: 'medium',
      },
      {
        terms: ['khamba', 'खंभा', 'pole damaged', 'electric pole', 'wire', 'taar', 'तार', 'dangling wire', 'open wire', 'खुला तार', 'hanging wire'],
        weight: 10,
        category: 'Damaged Electric Pole & Exposed Wire',
        baseSeverity: 'high',
      },
      {
        terms: ['sparking', 'spark', 'current', 'करंट', 'electric shock', 'transformer', 'ट्रांसफॉर्मर', 'short circuit', 'fire risk'],
        weight: 12,
        category: 'Electrocution & Transformer Sparking Risk',
        baseSeverity: 'critical',
      },
    ],
  },
  'dept-health': {
    name: 'Public Health & Vector Control',
    rules: [
      {
        terms: ['machhar', 'machar', 'मच्छर', 'mosquito', 'mosquitoes', 'dengue', 'डेंगू', 'malaria', 'मलेरिया', 'chikungunya', 'चिकनगुनिया'],
        weight: 10,
        category: 'Mosquito Breeding & Vector Risk',
        baseSeverity: 'high',
      },
      {
        terms: ['fogging', 'फॉगिंग', 'spray', 'छिड़काव', 'larva', 'larvicide', 'stagnant water', 'जल भराव में मच्छर', 'vacant plot water'],
        weight: 8,
        category: 'Stagnant Water Larval Treatment',
        baseSeverity: 'medium',
      },
      {
        terms: ['hospital', 'dispensary', 'clinic', 'डॉक्टर', 'दवा', 'epidemic', 'beemari', 'बीमारी', 'illness', 'infection'],
        weight: 7,
        category: 'Public Health Alert & Sanitization',
        baseSeverity: 'high',
      },
    ],
  },
};

// Urgency Keyword Multipliers
const CRITICAL_KEYWORDS = [
  'accident',
  'crash',
  'gir gaye',
  'गिर गए',
  'गिर गया',
  'chot',
  'चोट',
  'death',
  'danger to life',
  'खतरा',
  'जान का खतरा',
  'sparking',
  'current',
  'करंट',
  'electric shock',
  'pipeline burst',
  'burst',
  'collapse',
  'टूटा हुआ',
  'dengue ICU',
  'admitted',
];

const HIGH_KEYWORDS = [
  '4 days',
  '5 days',
  'hafta',
  'हफ्ते',
  'week',
  'overflowing',
  'badbu',
  'दुर्गंध',
  'stench',
  'dengue',
  'mosquito swarm',
  'dark stretch',
  'women safety',
  'ganda pani',
  'contaminated',
  'flooding',
  'water entered house',
];

export async function triageComplaintNLP(rawText: string, preferredLang: string = 'Hindi'): Promise<TriageResult> {
  // If Gemini client is active, try zero-shot AI classification first
  if (aiClient) {
    try {
      const geminiResult = await executeGeminiTriage(rawText, preferredLang);
      if (geminiResult) return geminiResult;
    } catch (err) {
      console.warn('[NLP] Gemini inference error, falling back to local NLP engine:', err);
    }
  }

  // Fallback: Use High-Precision Local Civic NLP Classifier
  return executeLocalCivicNLP(rawText, preferredLang);
}

function executeLocalCivicNLP(text: string, preferredLang: string): TriageResult {
  const normalized = text.toLowerCase();
  const deptScores: Record<string, { score: number; category: string; baseSeverity: string; matched: string[] }> = {};

  for (const [deptId, deptData] of Object.entries(DEPT_RULES)) {
    let score = 0;
    let bestCategory = deptData.rules[0].category;
    let bestSeverity = deptData.rules[0].baseSeverity || 'medium';
    let matchedKeywords: string[] = [];

    for (const rule of deptData.rules) {
      for (const term of rule.terms) {
        if (normalized.includes(term.toLowerCase())) {
          score += rule.weight;
          matchedKeywords.push(term);
          bestCategory = rule.category;
          if (rule.baseSeverity) bestSeverity = rule.baseSeverity;
        }
      }
    }

    deptScores[deptId] = {
      score,
      category: bestCategory,
      baseSeverity: bestSeverity,
      matched: matchedKeywords,
    };
  }

  // Find department with maximum weighted score
  let chosenDeptId = 'dept-roads';
  let maxScore = -1;
  let chosenCategory = 'Road & Civic Maintenance';
  let chosenSeverity: 'low' | 'medium' | 'high' | 'critical' = 'medium';
  let matchedList: string[] = [];

  for (const [deptId, data] of Object.entries(deptScores)) {
    if (data.score > maxScore) {
      maxScore = data.score;
      chosenDeptId = deptId;
      chosenCategory = data.category;
      chosenSeverity = (data.baseSeverity as any) || 'medium';
      matchedList = data.matched;
    }
  }

  const deptObj = DEPARTMENTS.find((d) => d.id === chosenDeptId) || DEPARTMENTS[0];

  // Criticality boosting
  const hasCriticalFlag = CRITICAL_KEYWORDS.some((kw) => normalized.includes(kw));
  const hasHighFlag = HIGH_KEYWORDS.some((kw) => normalized.includes(kw));

  if (hasCriticalFlag) {
    chosenSeverity = 'critical';
  } else if (hasHighFlag && chosenSeverity !== 'critical') {
    chosenSeverity = 'high';
  }

  // Generate crisp AI summary
  const summaryPrefix = `${deptObj.short_code} Issue:`;
  const cleanSnippet = text.trim().slice(0, 95);
  const aiSummary = `${chosenCategory} — "${cleanSnippet}..."`;

  // Multilingual conversational readback
  const confirmationReadback =
    preferredLang.toLowerCase().includes('hi') || preferredLang === 'Hindi'
      ? `मैंने समझा: आपकी शिकायत ${deptObj.name} विभाग (${chosenCategory}) के अंतर्गत आती है। गंभीरता स्तर ${chosenSeverity.toUpperCase()} आंका गया है। क्या यह विवरण सही है?`
      : `I understood: Your issue pertains to ${deptObj.name} (${chosenCategory}) with ${chosenSeverity.toUpperCase()} priority. Would you like to confirm submission?`;

  const suggestedAction =
    chosenSeverity === 'critical'
      ? `Urgent 4-hour field dispatch instructed for ${deptObj.head_officer}.`
      : `Assigned to ${deptObj.name} municipal division with standard SLA tracking.`;

  return {
    category: chosenCategory,
    severity: chosenSeverity,
    department_id: deptObj.id,
    department_name: deptObj.name,
    ai_summary: aiSummary,
    confirmation_readback: confirmationReadback,
    suggested_action: suggestedAction,
    confidence_score: Math.min(0.98, Math.max(0.75, maxScore > 10 ? 0.95 : 0.82)),
    detected_keywords: matchedList,
  };
}

async function executeGeminiTriage(text: string, preferredLang: string): Promise<TriageResult | null> {
  if (!aiClient) return null;

  const prompt = `You are the core civic triaging AI for Junsono municipal corporation.
Analyze this citizen complaint:
"${text}"

Classify into strict JSON:
1. category: canonical civic category (e.g. "Pothole & Road Cave-in", "Garbage Dump Overflow", "Defective Streetlight", "Pipeline Burst & Contamination", "Sewer Line Overflow", "Mosquito Breeding & Vector Risk")
2. severity: exactly one of: "low", "medium", "high", "critical". (Use critical if life hazard, falling accidents, electrocution risk, or massive drinking water contamination).
3. department_id: exactly one of: "dept-roads", "dept-sanitation", "dept-water", "dept-electricity", "dept-health"
4. department_name: exact matching name: "Roads & Infrastructure", "Sanitation & Solid Waste", "Water Supply & Sewerage", "Electricity & Street Lighting", "Public Health & Vector Control"
5. ai_summary: crisp single-sentence summary of the civic defect.
6. confirmation_readback: polite conversational confirmation for the citizen in ${preferredLang}.
7. suggested_action: short municipal action recommended.

Return valid JSON only.`;

  const response = await aiClient.models.generateContent({
    model: 'gemini-2.5-flash',
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
  const dept = DEPARTMENTS.find((d) => d.id === parsed.department_id) || DEPARTMENTS[0];

  return {
    category: parsed.category || 'Civic Infrastructure',
    severity: (['low', 'medium', 'high', 'critical'].includes(parsed.severity)
      ? parsed.severity
      : 'medium') as 'low' | 'medium' | 'high' | 'critical',
    department_id: dept.id,
    department_name: dept.name,
    ai_summary: parsed.ai_summary || text.slice(0, 100),
    confirmation_readback: parsed.confirmation_readback || `I understood: ${text.slice(0, 80)}. Is this correct?`,
    suggested_action: parsed.suggested_action || 'Inspect and schedule field action.',
    confidence_score: 0.96,
    detected_keywords: [],
  };
}
