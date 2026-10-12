# Junsono (जनसुनो) — AI-Assisted Civic Grievance Management

**Junsono** is a full-stack civic grievance management prototype that helps citizens submit and track municipal issues while giving department officers tools to triage, prioritize, and manage complaints. It combines a React + TypeScript interface with an Express API, optional Gemini-powered classification, a rule-based NLP fallback, duplicate-report detection, role-aware access controls, and a municipal operations dashboard.

- **Live demo:** https://junsuno-app.vercel.app
- **Repository:** https://github.com/Ankitkumar06102005/Junsuno-app

> **Project status:** Portfolio/prototype application. Review the security and production-readiness notes before using it with real citizens or sensitive data.

## At a glance

| Area | Implementation |
|---|---|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS 4, Lucide React |
| Backend | Node.js, Express 4, TypeScript |
| AI-assisted triage | Google Gemini API when configured; local civic keyword/rule classifier as fallback |
| Complaint matching | Normalized text features, cosine similarity, and approximate geographic proximity |
| Authentication | OTP workflow, HMAC-SHA256-signed JWT sessions, officer login, role/department checks |
| Data storage | Local JSON file (data/database.json) with atomic file replacement |
| Quality checks | TypeScript check, Vite production build, GitHub Actions CI |
| Main use cases | Civic issue reporting, ticket tracking, department queues, status updates, city-level overview |

## Problem and solution

Citizens may struggle to identify the right municipal department, describe an issue in a supported language, or follow its progress. Municipal teams also need a consistent way to prioritize incoming reports and recognize reports that may refer to the same incident.

Junsono provides a unified workflow:

1. **Submit:** A citizen describes a civic issue through the grievance interface.
2. **Triage:** The server classifies the text into a civic category and department, estimates severity, and generates a short summary and confirmation readback.
3. **Check for duplicates:** The application compares the new report with unresolved complaints using text similarity and location proximity.
4. **Create or update a ticket:** A new issue receives a ticket; a likely duplicate can increase the existing report count.
5. **Track progress:** Citizens can look up a ticket and review its current status.
6. **Process work:** Department officers manage their queues and update complaint status; the super-admin view provides a broader operations overview.

## Key features

### Citizen grievance portal
- File and track civic complaints through a responsive React interface.
- Capture issue descriptions, location details, and optional supporting information.
- Use ticket-based lookup to follow a submitted complaint.
- Switch interface language and accessibility preferences, including larger text, high contrast, and dark mode.

### AI-assisted classification and prioritization
- Classify complaints across roads, sanitation, water/sewerage, electricity/street lighting, and public-health categories.
- Use Gemini for classification when GEMINI_API_KEY is configured.
- Fall back to a local keyword-weighted rules engine if Gemini is unavailable or no API key is configured.
- Produce a category, department, severity level, summary, detected keywords, and suggested action.
- Support English and Hindi text patterns in the local civic lexicon, with additional interface translations in the frontend.

### Duplicate-report detection
- Generate normalized, fixed-size text feature vectors and calculate cosine similarity.
- Combine text similarity with approximate latitude/longitude proximity.
- Avoid matching already resolved or rejected complaints.
- Increase the report count on a likely duplicate and adjust severity according to configured thresholds.

**Implementation detail:** The current matcher uses a lightweight hashed bag-of-words-style vector, not a trained embedding model or a vector database. Geographic proximity is an approximate bounding-box check, not a road-network distance calculation.

### Officer operations and access control
- Provide department and super-admin interfaces.
- Use bearer-token authentication for authenticated API requests.
- Apply authorization checks to protected status changes, internal notes, replies, and reassignment workflows.
- Scope department officers to their assigned department where implemented.
- Mask citizen contact details and omit internal notes from public complaint responses.

### API and backend
- Express REST endpoints for authentication, departments, complaint submission and retrieval, AI classification, and complaint management.
- JSON request validation for key input fields and a request-body size limit.
- Baseline HTTP security headers.
- Persistent local JSON storage with a temporary file and rename strategy for writes.

## Architecture

~~~~text
React + TypeScript + Vite
          |
          | HTTP / JSON
          v
Express API (server.ts)
          |
          +--> Authentication and authorization (server-auth.ts)
          |
          +--> Civic triage (server-nlp.ts)
          |       +--> Gemini API (optional)
          |       +--> Local rule-based fallback
          |
          +--> Duplicate matching and complaint persistence (server-db.ts)
                  +--> data/database.json
~~~~

### Main repository structure

~~~~text
.
├── src/
│   ├── components/       # Citizen portal, authentication, admin and super-admin UI
│   ├── context/          # Authentication state
│   ├── i18n/             # Interface translations
│   ├── services/         # Frontend API client
│   ├── types/            # Shared TypeScript types
│   ├── App.tsx
│   ├── index.css
│   └── main.tsx
├── tests/                # Authentication and API verification script
├── data/                 # Local application data
├── server.ts             # Express routes and server setup
├── server-auth.ts        # OTP/JWT and role verification
├── server-db.ts          # JSON persistence and duplicate matching helpers
├── server-nlp.ts         # Gemini and local NLP triage
├── .github/workflows/    # GitHub Actions CI
├── package.json
└── README.md
~~~~

## Getting started

### Requirements
- Node.js 22 recommended (Node.js 18+ may work depending on dependency compatibility)
- npm
- A Gemini API key only if you want to enable Gemini-assisted classification

### Install and run

~~~~bash
git clone https://github.com/Ankitkumar06102005/Junsuno-app.git
cd Junsuno-app
npm ci
~~~~

Create a local .env file in the project root:

~~~~env
PORT=3000
GEMINI_API_KEY=replace_with_your_gemini_api_key
JWT_SECRET=replace_with_a_long_random_secret
# Optional live SMS provider configuration:
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=
FAST2SMS_API_KEY=
~~~~

Then start the development server:

~~~~bash
npm run dev
~~~~

Open http://localhost:3000.

### Available scripts

| Command | Purpose |
|---|---|
| npm run dev | Start the Express server with the Vite development middleware |
| npm run build | Build the frontend production assets |
| npm run preview | Preview the Vite production build |
| npm run lint | Run the configured TypeScript check |
| npm test | Run the existing API/auth verification script; the server must already be running on port 3000 |

## API overview

The following routes are implemented in the Express server. Authentication requirements should be checked against the relevant middleware and route handler before integrating another client.

| Method | Endpoint | Purpose |
|---|---|---|
| POST | /api/auth/send-otp | Request an OTP |
| POST | /api/auth/verify-otp | Verify an OTP and issue a session token |
| POST | /api/auth/admin-login | Authenticate a municipal officer |
| GET | /api/auth/me | Read the authenticated session |
| POST | /api/auth/logout | Client-session logout response |
| GET | /api/departments | List configured departments |
| POST | /api/ai/classify | Classify a text complaint |
| POST | /api/ai/transcribe | Prototype transcription endpoint |
| POST | /api/complaints | Submit a complaint and check for likely duplicates |
| GET | /api/complaints | List complaints with role-aware response handling |
| GET | /api/complaints/:id | Retrieve a complaint by ticket ID |
| PATCH | /api/complaints/:id/status | Update complaint status |
| PATCH | /api/complaints/:id/reassign | Reassign a complaint |
| POST | /api/complaints/:id/notes | Add an internal note |
| POST | /api/complaints/:id/reply | Record an official response |
| GET | /api/admin/analytics | Retrieve dashboard analytics |

## Continuous integration

The GitHub Actions workflow in .github/workflows/ci.yml runs on pushes to main and pull requests targeting main. It installs dependencies using npm ci, runs the TypeScript check, and builds the production frontend.

**CI status:** [View workflow runs](https://github.com/Ankitkumar06102005/Junsuno-app/actions).

## Security and production-readiness notes

This repository is a demonstration project and is **not yet a production-ready municipal platform**. Before handling real citizen data:

- Replace the development JWT fallback secret with a required, securely generated environment secret; fail startup if it is missing in production.
- Replace pre-seeded/demo officer credentials and static salts with a managed identity store and a password-hashing algorithm designed for passwords (for example, Argon2id or bcrypt).
- Ensure no OTPs, credentials, tokens, or personal data are written to logs. Configure real OTP delivery and enforce provider-side abuse controls.
- Replace the prototype audio-transcription response with a real speech-to-text provider before describing voice transcription as operational.
- Move from local JSON storage to a transactional database with backups, migrations, access controls, and concurrency-safe writes.
- Add request rate limits, strict schema validation, CORS policy, audit logging, monitoring, and secure secret management.
- Review authorization on every route, object-level access, public ticket lookup, file/photo uploads, and department reassignment.
- Add automated assertions for success and failure cases, authorization boundaries, duplicate detection, PII redaction, and input validation. The current test script logs outcomes but should be strengthened to fail when expectations are not met.
- Configure production HTTPS and review applicable privacy, retention, accessibility, and municipal data-handling requirements.

The local JSON database is suitable for a lightweight prototype, not concurrent multi-instance production deployment. The logout endpoint currently returns a success response; clients must clear their stored token, and token revocation would require additional server-side support.

## Resume-ready project description (ATS-friendly)

**Junsono — AI-Assisted Civic Grievance Management Platform** | React, TypeScript, Node.js, Express.js, Vite, Google Gemini API, REST APIs, JWT, NLP

- Built a full-stack civic grievance management prototype with a React/TypeScript frontend and Express REST API for complaint submission, ticket tracking, department workflows, and municipal operations dashboards.
- Implemented AI-assisted complaint classification using Google Gemini with a rule-based NLP fallback to categorize civic issues, assign departments, estimate severity, and generate summaries.
- Developed duplicate-report detection using cosine similarity over hashed text feature vectors and approximate geographic proximity to group likely related unresolved complaints.
- Implemented OTP-based authentication workflows, HMAC-SHA256-signed JWT sessions, role-aware API access, department-scoped operations, and public-response PII redaction.
- Added GitHub Actions CI to automate TypeScript checks and production frontend builds.

**Resume accuracy note:** Treat these as implementation-focused bullets, not claims of measured impact. Add metrics only after benchmarking. Do not claim production deployment, live speech transcription, trained embeddings, or production-grade security unless those capabilities are implemented and verified.

## Future improvements

- Add integration tests with assertions and run them in CI against a test configuration.
- Migrate persistent data to PostgreSQL and add schema migrations.
- Replace the prototype transcription endpoint with a real multilingual speech-to-text service.
- Add structured request validation, rate limiting, and stronger production authentication.
- Add observability, deployment health checks, and performance/load tests.

## License

No license is currently specified. Contact the repository owner before redistributing or using this project under an assumed open-source license.
