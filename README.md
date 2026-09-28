# Junsono (जनसुनो) — Civic Grievance & Municipal Triaging System

> AI-powered civic grievance lodging and tracking system with multilingual voice triaging, automatic deduplication, severity scoring, cryptographic OTP authentication, and municipal department dashboard.

---

## 🌟 Key Highlights

- **Multilingual Voice & Text Intake:** Supports Indian languages (Hindi, English, Bengali, Tamil, Telugu, Marathi, Gujarati, Kannada) with Gemini STT and voice confirmation readback.
- **Smart AI Triaging:** Automated department classification, category tagging, SLA assignment, and severity assessment (`critical`, `high`, `medium`, `low`).
- **Geotagged Deduplication Engine:** Cosine similarity embedding analysis on incident descriptions + coordinate proximity clustering to prevent duplicate work orders.
- **Cryptographic OTP Authentication:** 6-digit OTP verification with rate-limiting, expiration, brute-force throttling, and signed HMAC-SHA256 JWT sessions.
- **Role-Based Security & PII Protection:** Automatic masking of citizen phone numbers/emails and redaction of internal notes for public viewers; authenticated officers access full audit logs.
- **Municipal Command Dashboard:** Department-scoped grievance queues, status updating with photographic resolution proof, inter-department reassignment, and SLA compliance analytics.

---

## 🔒 Security & Code Audit Assessment

| Threat Vector | Vulnerability Found | Defensive Mitigation Implemented |
|---|---|---|
| **Broken Object-Level Authorization (BOLA)** | Unauthenticated callers could modify grievance status, reassign departments, and append notes. | Enforced `requireAdminOrOfficer` middleware on status, reassign, note, and reply routes with authenticated session tokens. |
| **Sensitive Citizen Data Exposure** | Citizen mobile numbers and emails were publicly readable on `/api/complaints`. | Implemented `redactComplaintForPublic` helper: masks PII (`+91 98*** **820`, `r***@domain.com`) and removes internal notes for unauthenticated users. |
| **Insecure Mocked Client-Side Auth** | Previous prototype accepted any 4-digit code in browser memory. | Implemented server-side 6-digit cryptographic OTP generator (`crypto.randomInt`), 5-minute TTL, max 3 attempts limit, and tamper-proof HMAC-SHA256 JWT tokens. |
| **Denial of Service / AI Quota Abuse** | Unrestricted payload sizes and missing request rate limiting. | Added 30-second cooldown timer on OTP generation, standard security headers (`nosniff`, `SAMEORIGIN`), and structured input validation. |

---

## 📡 REST API Endpoints

### Authentication & Authorization
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/api/auth/send-otp` | Public | Dispatches 6-digit OTP to mobile phone or email (rate-limited). |
| `POST` | `/api/auth/verify-otp` | Public | Verifies OTP and issues signed JWT bearer token. |
| `POST` | `/api/auth/admin-login` | Public | Official municipal credentials login for department officers. |
| `GET` | `/api/auth/me` | Authenticated | Retrieves current authenticated session details. |
| `POST` | `/api/auth/logout` | Authenticated | Terminates active user session. |

### Grievance Management
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/api/departments` | Public | Lists all municipal departments and engineering heads. |
| `POST` | `/api/complaints` | Public / Citizen | Submits new grievance, performs deduplication, and triggers auto-dispatch. |
| `GET` | `/api/complaints` | Public (Masked) / Officer (Full) | Queries complaints with department, status, severity, and search filters. |
| `GET` | `/api/complaints/:id` | Public (Masked) / Officer (Full) | Fetches single complaint by ticket ID (e.g. `JSN-1001`). |
| `PATCH` | `/api/complaints/:id/status` | **Officer / Admin** | Updates status (`acknowledged`, `in_progress`, `resolved`, `rejected`) with proof photo. |
| `PATCH` | `/api/complaints/:id/reassign` | **Super Admin** | Transfers complaint jurisdiction to another department. |
| `POST` | `/api/complaints/:id/notes` | **Officer / Admin** | Appends internal confidential investigation note. |
| `POST` | `/api/complaints/:id/reply` | **Officer / Admin** | Records official email response and updates timeline. |
| `GET` | `/api/admin/analytics` | **Officer / Admin** | Aggregate metrics, SLA compliance, ward distribution, and category counts. |

---

## 🚀 Running Locally

### Prerequisites
- Node.js (v18+)
- npm (v9+)

### Installation & Run

1. Clone or navigate to the repository directory:
   ```bash
   cd "junsuno app"
   ```

2. Install dependencies:
   ```bash
   npm install --legacy-peer-deps
   ```

3. Configure environment variables in `.env`:
   ```env
   PORT=3000
   JWT_SECRET=your_secure_random_secret_key_here
   GEMINI_API_KEY=your_optional_gemini_api_key
   ```

4. Start development server:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your web browser.

5. Run automated security and auth test suite:
   ```bash
   npm test
   ```

6. Build for production:
   ```bash
   npm run build
   ```

---

## 📦 Publishing to GitHub

To publish this repository to your GitHub repo named **Junsuno app**:

1. Create a new repository named `Junsuno-app` or `Junsuno_app` on [GitHub](https://github.com/new).

2. Link your local repository to the remote origin:
   ```bash
   git remote add origin https://github.com/<your-username>/Junsuno-app.git
   ```

3. Push the main branch:
   ```bash
   git branch -M main
   git push -u origin main
   ```

*(Note: Sensitive files such as `.env` and `node_modules/` are strictly ignored by `.gitignore` to prevent any credentials leak).*
