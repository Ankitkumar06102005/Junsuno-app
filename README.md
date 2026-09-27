# 🇮🇳 Junsono — जनसुनो

> **A voice-first, AI-powered civic grievance and municipal triaging platform.**

Junsono turns a citizen's everyday complaint into a structured municipal case — from **voice/text intake and location capture** to **AI classification, severity assessment, department routing, duplicate detection, status tracking, and officer-side resolution workflows**.

> **Citizens should explain the problem naturally. The system should handle the complexity of routing and follow-up.**

---

## ✨ What is Junsono?

Junsono (जनसुनो — *"listen to the people"*) is an integrated civic grievance portal with three connected experiences:

| Experience | Purpose |
|---|---|
| 🧑‍🤝‍🧑 **Citizen Portal** | Report and track civic complaints using voice or text |
| 🏢 **Department Admin** | Triage, filter, assign, update and resolve departmental cases |
| 🛡️ **City Command Center** | Monitor cross-department workload, critical cases and city-wide grievance activity |

It combines **AI-assisted triaging, multilingual interaction, geolocation, duplicate detection, municipal workflows and operational analytics** into one interface.

---

## 🎯 The Problem

Traditional civic grievance systems often force citizens to know:

- which department owns the issue
- what category the issue belongs to
- how to describe it in bureaucratic language
- where to submit it
- how to follow up after submission

Junsono reverses that workflow.

### Citizen thinks

> 🎙️ “There is a huge pothole near the market and bikes are falling.”

### Junsono turns it into

~~~text
Complaint → AI understanding → Category → Severity → Department
→ Location → Ticket → Municipal workflow
~~~

---

# 🧭 Product Flow

~~~text
┌──────────────────┐
│  👤 Citizen      │
│  Voice / Text    │
└────────┬─────────┘
         │
         ▼
┌──────────────────────────┐
│ 🎙️ Speech / Text Intake │
│ Browser speech input     │
└────────────┬─────────────┘
             │
             ▼
┌──────────────────────────┐
│ 🤖 AI Complaint Triage   │
│ Category • Severity      │
│ Department • Summary     │
└────────────┬─────────────┘
             │
             ▼
┌──────────────────────────┐
│ 🧑‍⚖️ Citizen Confirmation│
│ AI reads back what it    │
│ understood               │
└────────────┬─────────────┘
             │
             ▼
┌──────────────────────────┐
│ 📍 Location + Evidence  │
│ GPS • Ward • Photo       │
└────────────┬─────────────┘
             │
             ▼
┌──────────────────────────┐
│ 🔎 Duplicate Detection  │
│ Similarity + clustering  │
└────────────┬─────────────┘
             │
             ▼
┌──────────────────────────┐
│ 🎫 Municipal Ticket     │
│ JSN-XXXX                 │
└────────────┬─────────────┘
             │
             ├─────────────────────┐
             ▼                     ▼
┌──────────────────────┐  ┌─────────────────────┐
│ 🏢 Department Admin  │  │ 👤 Public Tracker   │
│ Queue / Kanban       │  │ Search / Status     │
│ SLA / Notes / Reassign│  │ Map / Updates      │
└────────────┬─────────┘  └─────────────────────┘
             │
             ▼
┌──────────────────────────┐
│ 🔄 Status + Correspondence│
│ Acknowledge → In Progress│
│ → Resolved / Rejected    │
└────────────┬─────────────┘
             │
             ▼
┌──────────────────────────┐
│ 🛡️ City Command Center  │
│ Cross-department audit   │
│ Load + critical cases    │
└──────────────────────────┘
~~~

---

# 🏗️ System Architecture

Junsono is structured as a React/Vite frontend communicating with an Express/TypeScript server. Gemini is used for AI-assisted complaint classification, while the browser provides speech, geolocation and accessibility capabilities.

~~~mermaid
flowchart TB
    C[👤 Citizen] --> UI[React Citizen Portal]
    UI --> VOICE[🎙️ Voice Input]
    UI --> TEXT[⌨️ Text Input]
    UI --> GPS[📍 Browser Geolocation]
    UI --> PHOTO[📷 Photo Evidence]
    VOICE --> API[Express /api]
    TEXT --> API
    API --> AI[Google Gemini]
    AI --> TRIAGE[Category + Severity + Department + Summary]
    TRIAGE --> CONFIRM[Citizen Confirmation]
    CONFIRM --> API
    API --> DEDUPE[Similarity / Duplicate Detection]
    DEDUPE --> TICKET[🎫 Citizen Complaint]
    TICKET --> DB[(In-Memory Complaint Store)]
    DB --> TRACKER[🔎 Public Tracker]
    DB --> ADMIN[🏢 Department Admin]
    DB --> COMMAND[🛡️ Super Admin / Command Center]
    ADMIN --> STATUS[Status Updates]
    ADMIN --> NOTES[Internal Notes]
    ADMIN --> REASSIGN[Department Reassignment]
    ADMIN --> MAIL[Officer Correspondence]
    STATUS --> DB
    NOTES --> DB
    REASSIGN --> DB
    MAIL --> DB
    COMMAND --> ANALYTICS[📊 Municipal Analytics]
    ANALYTICS --> DB
~~~

---

# 🧠 AI Triage Pipeline

The AI workflow is deliberately placed **before final submission**, so the citizen gets a chance to verify what the system understood.

~~~mermaid
sequenceDiagram
    participant Citizen
    participant Browser
    participant Server
    participant Gemini
    participant Ledger
    participant Department

    Citizen->>Browser: Speak / type complaint
    Browser->>Server: Complaint text
    Server->>Gemini: Classify complaint
    Gemini-->>Server: Category + severity + department + summary
    Server-->>Browser: AI interpretation
    Browser-->>Citizen: Read back understanding
    Citizen->>Browser: Confirm
    Browser->>Server: Submit complaint + location + evidence
    Server->>Server: Check similar complaints
    Server->>Ledger: Create / merge grievance
    Ledger-->>Department: Routed municipal case
    Department->>Ledger: Update status / notes
    Ledger-->>Citizen: Trackable ticket state
~~~

---

# 🚀 Core Features

## 🎙️ 1. Voice-First Complaint Filing

Citizens can report a problem naturally instead of navigating complicated forms.

- Browser speech recognition
- Voice or text reporting
- Multilingual interface
- Automatic transcription
- AI-generated understanding
- Spoken AI confirmation/readback
- Text editing before submission

The important UX decision is **confirmation before dispatch**: the citizen can hear what the AI understood and correct it before the complaint enters the municipal workflow.

---

## 🤖 2. AI-Powered Complaint Classification

The backend exposes an AI classification endpoint:

~~~http
POST /api/ai/classify
~~~

The AI-assisted result includes:

- complaint category
- severity
- responsible department
- concise summary
- citizen-facing confirmation
- suggested action

Example:

~~~text
Raw complaint
     ↓
"Road has a huge pothole and bikes are falling"
     ↓
Category
"Pothole & Road Cave-in"
     ↓
Severity
"Critical"
     ↓
Department
"Roads & Infrastructure"
     ↓
Suggested action
"Dispatch field inspection / emergency repair"
~~~

---

## 📍 3. Location-Aware Reporting

A complaint can carry:

- latitude
- longitude
- address text
- landmark
- municipal ward
- interactive map context

The application uses browser geolocation when available and falls back to a municipal location context when location permission is unavailable.

---

## 🔎 4. Duplicate / Similar Complaint Detection

Junsono attempts to identify reports describing the same civic issue.

The server maintains a compact text embedding representation and compares complaints using cosine similarity.

When related reports are detected, the system can surface:

- duplicate relationship
- original ticket
- report count
- other reporters
- increased operational visibility

This helps municipal teams treat **one real-world problem as one operational issue**, rather than blindly processing every citizen report as an unrelated case.

---

## 🎫 5. Public Grievance Tracker

Citizens can search complaints using:

- ticket ID
- phone number
- search query
- status filters

The tracker exposes the operational state of a grievance:

~~~text
NEW
  ↓
ACKNOWLEDGED
  ↓
IN PROGRESS
  ↓
RESOLVED
~~~

Rejected cases are also represented explicitly rather than silently disappearing.

---

# 🏢 Department Admin Portal

The department dashboard is the operational workspace for municipal officers.

### Queue Management

- department-scoped complaint queue
- search
- severity filtering
- status filtering
- table view
- Kanban-style workflow
- complaint detail drawer

### Case Actions

Officers can:

- acknowledge a complaint
- move it into progress
- resolve it
- reject it with a reason
- attach resolution proof
- add internal notes
- reassign to another department
- simulate an inbound officer email/reply

### Operational Context

Each complaint contains structured information:

~~~text
Ticket
├── Citizen
├── Contact
├── Language
├── Category
├── Severity
├── Department
├── Location
├── Ward
├── Evidence
├── Duplicate / report count
├── Internal notes
├── Status history
└── Correspondence
~~~

---

# 🛡️ City Command Center

The Super Admin experience provides a city-wide operational view.

It brings together:

- departmental caseload
- open tickets
- critical complaints
- cross-department grievance feed
- SLA-oriented monitoring
- search across departments
- department-level drill-down

### Command hierarchy

~~~text
                 CITY COMMAND
                      │
        ┌─────────────┼─────────────┐
        ▼             ▼             ▼
     ROADS          WATER       SANITATION
        │             │             │
      Cases         Cases         Cases
        │             │             │
        └─────────────┼─────────────┘
                      ▼
              Unified Grievance Ledger
~~~

---

# 🌐 Accessibility & Inclusion

Junsono treats accessibility as part of the product rather than an afterthought.

Available controls include:

- 🌐 multilingual interface
- 🔠 larger text mode
- 👁️ high-contrast mode
- 🌙 dark mode
- 🔊 spoken AI confirmation
- 🎙️ voice-first interaction
- 📱 responsive layouts

The interface uses civic-oriented typography and a restrained visual system built around:

- deep civic green
- warm ochre
- brick red for urgent states
- paper-like neutral surfaces

---

# 🧩 Technology Stack

| Layer | Technology |
|---|---|
| UI | React 19 |
| Language | TypeScript |
| Build | Vite |
| Styling | Tailwind CSS |
| Motion | Motion |
| Icons | Lucide React |
| Maps | Leaflet |
| AI | Google Gemini via @google/genai |
| Server | Express |
| Runtime | Node.js / TSX |
| Speech | Web Speech API |
| Geolocation | Browser Geolocation API |
| State | React state + context |
| Data layer | In-memory TypeScript store |

---

# 📁 Project Structure

~~~text
Junsuno-app/
├── src/
│   ├── components/
│   │   ├── AdminDashboard/
│   │   ├── Auth/
│   │   ├── CitizenPortal/
│   │   ├── Common/
│   │   └── SuperAdmin/
│   ├── context/
│   │   └── AuthContext.tsx
│   ├── i18n/
│   │   └── translations.ts
│   ├── services/
│   │   └── api.ts
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── server.ts
├── index.html
├── vite.config.ts
├── package.json
└── README.md
~~~

---

# 🔌 API Surface

The frontend communicates with the Express server through /api.

### AI

| Method | Endpoint | Purpose |
|---|---|---|
| POST | /api/ai/classify | AI complaint classification |

### Departments

| Method | Endpoint | Purpose |
|---|---|---|
| GET | /api/departments | Fetch municipal departments |

### Complaints

| Method | Endpoint | Purpose |
|---|---|---|
| GET | /api/complaints | Search/filter complaints |
| GET | /api/complaints/:id | Fetch a complaint |
| POST | /api/complaints | Create a grievance |
| PATCH | /api/complaints/:id/status | Change status |
| PATCH | /api/complaints/:id/reassign | Reassign department |
| POST | /api/complaints/:id/notes | Add internal note |
| POST | /api/complaints/:id/reply | Add officer correspondence |

### Analytics

| Method | Endpoint | Purpose |
|---|---|---|
| GET | /api/admin/analytics | Municipal analytics |
| GET | /api/admin/analytics?department_id=... | Department analytics |

---

# ⚡ Getting Started

## 1. Clone

~~~bash
git clone https://github.com/Ankitkumar06102005/Junsuno-app.git
cd Junsuno-app
~~~

## 2. Install dependencies

~~~bash
npm install
~~~

## 3. Configure Gemini

Create a .env file:

~~~env
GEMINI_API_KEY=your_gemini_api_key
~~~

The server reads the key from process.env.GEMINI_API_KEY.

## 4. Start development

~~~bash
npm run dev
~~~

The application server uses the configured PORT environment variable and defaults to:

~~~text
http://localhost:3000
~~~

## 5. Production build

~~~bash
npm run build
npm start
~~~

---

# 🧪 Prototype / Implementation Notes

Junsono is currently structured as a **working product prototype**, not a production municipal deployment.

Important implementation details:

- Complaint data is stored in an **in-memory server-side store**.
- Authentication is currently simulated for the prototype.
- Citizen OTP verification uses a generated development code rather than a real SMS provider.
- Officer email replies are represented through a simulation endpoint.
- Browser speech recognition depends on browser support and permissions.
- Gemini functionality requires a valid GEMINI_API_KEY.
- The architecture is organized so the in-memory layer can later be replaced with persistent storage and production identity/integration services.

These constraints are documented intentionally so the demo remains transparent while the architecture stays extensible.

---

# 🔮 Production Evolution

A natural next architecture would replace prototype services with durable infrastructure:

~~~mermaid
flowchart LR
    UI[React / PWA] --> API[API Gateway]
    API --> AUTH[Identity / OTP]
    API --> AI[AI Triage Service]
    API --> DB[(PostgreSQL)]
    API --> VECTOR[(Vector Store)]
    API --> FILES[(Object Storage)]
    API --> QUEUE[Job Queue]
    AI --> LLM[Gemini]
    QUEUE --> NOTIFY[SMS / Email / Push]
    DB --> ANALYTICS[Analytics]
    VECTOR --> DEDUPE[Duplicate Detection]
~~~

Potential production upgrades include:

- PostgreSQL / Supabase persistence
- pgvector for scalable semantic duplicate detection
- real SMS/OTP authentication
- object storage for evidence photos
- role-based authorization
- audit logs
- municipal GIS integration
- SLA timers and escalation workers
- notification delivery
- background job queues
- observability and error tracking

---

# 🏛️ Design Philosophy

Junsono is intentionally designed less like a generic SaaS dashboard and more like a **digital municipal register**.

### Visual language

~~~text
Civic Green   → institutional trust / primary actions
Ochre         → information / civic accents
Brick         → urgent or critical states
Paper Neutrals→ documentation / readability
Serif Headings→ institutional character
Sans UI       → operational clarity
~~~

The goal is to make the product feel **official, calm and operational**, rather than overly futuristic.

---

# 🧑‍💻 Development Scripts

| Command | Description |
|---|---|
| npm run dev | Start the Express + Vite development server |
| npm run build | Build the production frontend |
| npm start | Start the server |
| npm run preview | Preview the Vite build |
| npm run lint | Run TypeScript type checking |
| npm run clean | Remove generated build/server artifacts |

---

# 🌱 Why the Architecture Matters

The important part of Junsono is not simply **"AI reads complaints."**

It creates a connected operational chain:

~~~text
Citizen voice
     ↓
Understanding
     ↓
Verification
     ↓
Evidence
     ↓
Deduplication
     ↓
Routing
     ↓
Municipal action
     ↓
Status history
     ↓
Citizen visibility
     ↓
City-wide accountability
~~~

That makes Junsono a **grievance orchestration platform**, rather than only a complaint submission form.

---

# 📌 Project Status

**Prototype / Demonstration Build**

The current repository demonstrates the complete product experience and its core workflows. Production deployment would require persistent storage, hardened authentication/authorization, real notification infrastructure, stronger semantic retrieval, and municipal-system integrations.

---

## 👤 Author

**Ankit Kumar**

Computer Science & Artificial Intelligence · India

[GitHub](https://github.com/Ankitkumar06102005)

---

<p align="center">
  <strong>जनसुनो — Listen. Understand. Route. Resolve.</strong>
  <br />
  <sub>Built to make civic grievance handling more accessible, structured and transparent.</sub>
</p>
