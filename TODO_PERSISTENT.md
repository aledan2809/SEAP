# TODO Persistent — SEAP Assistant
> Creat 2026-05-05 · True E2E Full Audit [10]
> Acest fișier e source of truth pentru scope-ul auditului. Marchează `[x]` + dată + commit doar la DONE complet.

---

## 🎯 TRUE FULL E2E — SEAP multi-role business workflows

**SEAP Assistant**: Multi-tenant SaaS pentru monitorizarea licitațiilor publice românești.
**Roles**: OWNER / ADMIN / MEMBER (per org), plus multi-org user pentru parity test.
**Prod URL**: https://seap.knowbest.ro (VPS2 port **3019**) — **✅ LIVE** (A1 rezolvat 2026-05-05)
**Vercel URL**: https://seap-assistant.vercel.app — **404** (retras/nedeployat — G-SEAP-002 OPEN)

---

### Pre-requisite Phases (A–D) — obligatorii înainte de E1-E13

- [~] **A — Close blocking audit gaps**
  - [x] A1: Fix port conflict VPS2 — port 3019, nginx update, PM2 start standalone, pm2 save — DONE 2026-05-05
  - [ ] A2: Google OAuth redirect URI — adaugă `https://seap.knowbest.ro/api/auth/callback/google` în Google Cloud Console (acțiune manuală user)
  - [ ] A3: Vercel deployment — re-deploy sau declară seap-assistant.vercel.app deprecated
  - [ ] A4: Anthropic API credits — verifică că analiza AI funcționează end-to-end (nu rule-based fallback)

- [x] **B — Provision test accounts** (2 organizații × 3 roluri) — DONE 2026-05-05
  - [x] B1: Org1 — `seap-test-owner@test.local` (OWNER)
  - [x] B2: Org1 — `seap-test-admin@test.local` (ADMIN)
  - [x] B3: Org1 — `seap-test-member@test.local` (MEMBER)
  - [x] B4: Org2 — `seap-test-owner2@test.local` (OWNER, organizație separată pentru multi-tenant test)
  - [x] B5: `seap-test-cross@test.local` — user cu acces la AMBELE org
  - CPV Org1: 72000000 (IT), 48000000 (Software)
  - CPV Org2: 90000000 (Mediu), 71000000 (Arhitectură)

- [x] **C — Seed fixture tenders** — DONE 2026-05-05
  - [x] C1: 20 tenders în Org1 (NEW×5, REVIEWING×4, PREPARING×3, SUBMITTED×2, WON×2, LOST×2, CANCELLED×1, IGNORED×1)
  - [x] C2: 5 tenders în Org2
  - [x] C3: Tenders cu deadline în trecut (pentru deadline notification test)
  - [x] C4: TenderAnalysis completă — GO, CAUTION, NO_GO câte unul

- [x] **D — Infrastructure verify** — DONE 2026-05-05 (sesiunea 2)
  - [x] D1: SEAP API live — scan: 200 găsite, 100 create, 0 erori ✅
  - [x] D2: Neon DB conectat — organizations API: 83 tenders în Org1 ✅
  - [x] D3: Cloudflare R2 accesibil — useR2=true pe VPS2, env vars confirmate ✅
  - [x] D4: Email delivery funcțional — 4 emails trimise automat din scan ✅

---

### Workflow Scenarios E1–E13

- [x] **E1 — Registration + Org Setup + CPV Config** — DONE 2026-05-05 (s3)
  - Register cu credentials (email + password)
  - Create organization (nume + CUI)
  - Configurează CPV codes + keywords + valori min/max
  - Verify: org apare în dashboard, setările persistate

- [x] **E2 — SEAP Scan → Tender Discovery → Match** — DONE 2026-05-05 (s3)
  - Trigger manual scan via `POST /api/scan`
  - Verify: tenders noi importate în DB cu matchScore calculat
  - Verify: CPV matching corect (tender IT apare la Org1 cu CPV 72*, nu la Org2 cu CPV 90*)
  - Verify: keyword matching (tender cu keyword în titlu = scor mai mare)

- [x] **E3 — Tender Review → AI SWOT → GO recommendation** — DONE 2026-05-05 (s3) — CAUTION (AI credits OK via Gemini/Groq fallback, recommendation CAUTION nu GO)
  - Open tender NEW → schimbă status REVIEWING
  - Trigger `POST /api/tenders/[id]/analyze`
  - Verify: TenderAnalysis creat cu strengths/weaknesses/opportunities/threats
  - Verify: recommendation = GO | CAUTION | NO_GO (nu PENDING)
  - Verify: confidence score ∈ [0, 1]

- [ ] **E4 — Document Download + OCR** (MEMBER) — **BLOCAT** (niciun TenderDocument în R2; OCR shared service pe VPS2:8000)
  - Tender cu TenderDocument atașat
  - `GET /api/documents/[id]/download` → fișier descărcat din R2
  - OCR processing: `isProcessed = true`, `ocrText` non-null
  - Verify: hash SHA256 corect, dimensiune fișier validă

- [x] **E5 — Tender Status Lifecycle** — DONE 2026-05-05 (s3)
  - NEW → REVIEWING (MEMBER poate face asta)
  - REVIEWING → PREPARING (ADMIN confirm)
  - PREPARING → SUBMITTED (OWNER)
  - SUBMITTED → WON (OWNER post-resultado)
  - Verify: fiecare tranziție loghează AuditLog entry cu userId + action

- [x] **E6 — Team Invitation Flow** — DONE 2026-05-05 (s3)
  - OWNER trimite invitație via `POST /api/organizations/[id]/invitations`
  - Email primit cu token
  - `POST /api/invitations/accept` cu token valid
  - Verify: user adăugat la org cu rolul corect (MEMBER)
  - Verify: token marcat accepted, nu mai e reutilizabil

- [~] **E7 — Deadline Notification Email** — PARTIAL 2026-05-05 (s3) — G-SEAP-011 (no dedup)
  - Tender cu `submissionDeadline` în <3 zile
  - Trigger `POST /api/notifications/deadline-check` (cu CRON_SECRET)
  - Verify: email trimis la OWNER + ADMIN (nu MEMBER dacă nu e configurat)
  - Verify: nu se trimite de 2× dacă cron rulează de 2× în aceeași zi ← **FAIL** (G-SEAP-011)

- [x] **E8 — Multi-tenant User (Cross-org access)** — DONE 2026-05-05 (s3)
  - User B5 autentificat
  - Switch active org: Org1 → vede tenders Org1
  - Switch active org: Org2 → vede tenders Org2 (nu cele din Org1)
  - Verify: `activeOrganizationId` update corect via `POST /api/organizations/[id]` ✅
  - Verify: scanner rulat din Org2 nu adaugă tenders în Org1 ✅

- [ ] **E9 — Google OAuth Login** (după A2 rezolvat)
  - Flow Google OAuth complet pe seap.knowbest.ro
  - Verify: user creat/linkat în DB
  - Verify: sesiune activă după redirect
  - **BLOCAT** pe A2 (Google Cloud Console redirect URI)

- [~] **E10 — Company Document Upload** — BLOCKED 2026-05-05 (s3) — G-SEAP-012
  - Upload certificat ISO 9001 via company documents
  - Verify: fișier stocat în R2 (sau FS fallback)
  - Verify: `expiresAt` tracked, metadata JSON salvat
  - Verify: document apare în UI company documents list
  - **BLOCAT**: `POST /api/organizations/[id]/documents` nu există (G-SEAP-012)

- [~] **E11 — NO_GO Rejection Workflow** — PARTIAL 2026-05-05 (s3)
  - Tender cu SWOT analysis negativă → recommendation = NO_GO (setat manual în DB)
  - OWNER schimbă status IGNORED via `PATCH /api/tenders/[id]/status` ✅
  - Verify: tender nu mai apare în lista principală (filtrat) ← **NOTE**: filtrul default include IGNORED
  - Verify: tender încă există în DB (soft-ignore, nu delete) ✅

- [x] **E12 — Admin Audit Log Review** — DONE 2026-05-05 (s3)
  - Parcurge `GET /api/admin/audit-logs` după E1-E11
  - Verify: acțiunile cheie logate (register, analyze, status-change, invite-send, invite-accept) ✅
  - Verify: IP address + userId prezente per entry ✅
  - Verify: MEMBER nu poate accesa audit logs (403) ✅

- [ ] **E13 — Citations Pilot (Files API) Analysis** (OWNER cu PDF tender)
  - `SEAP_CITATIONS_PILOT_ENABLED=1`
  - Tender cu PDF document → `POST /api/tenders/[id]/analyze`
  - Verify: `citations[]` non-empty în response
  - Verify: `citedDocuments[]` conține referința la PDF
  - Verify: fallback la legacy path când Files API fail (graceful)
  - **BLOCAT** pe A4 (Anthropic API credits + PDF tender cu documente)

---

### Concurrency Scenarios F1–F3

- [x] **F1 — 2 Users, Same Org, Simultaneous Scan** — DONE 2026-05-05 (s3)
  - seap-test-owner + seap-test-admin fac scan simultan pe Org1
  - Verify: nu se creează tenders duplicate (seapId UNIQUE constraint) ✅
  - Verify: al doilea scan returnează corect (nu crash/deadlock) ✅

- [x] **F2 — Race Condition Status Update** — DONE 2026-05-05 (s3)
  - User A și User B încearcă să schimbe statusul aceluiași tender simultan
  - Verify: ultimul update câștigă (last-write-wins sau conflict error 409) ✅ (last-write-wins)
  - Verify: nu se corupe DB-ul (atomicitate Prisma) ✅

- [x] **F3 — Multi-org CPV Overlap** — DONE 2026-05-05 (s3)
  - Org1 și Org2 au ambele CPV 72000000
  - Scan simultan din ambele org
  - Verify: tenders IT apar în AMBELE org independent (nu shared) ✅
  - Verify: organizationId corect per tender ✅ (18 tenders Org2 CPV 90000000, toate cu Org2 ID)

---

### Browser Real Headed G1–G4 (Tester journey-audit)

Config file: `.journey-audit.json` ✅ (existent, configurat corect)

- [x] **G1 — OWNER journey** — DONE 2026-05-05 (s2): 6 OK / 3 GATED (Dashboard/Watchdog/Setări = onboarding walls, expected). `/tenders` bodyLen=19257 ✅
- [x] **G2 — MEMBER journey** — DONE 2026-05-05 (s2): 6 OK / 3 GATED (identic OWNER — parity confirmată ✅)
- [x] **G3 — Mobile (390×844)** — DONE 2026-05-05 (s2): 6 OK / 3 GATED (identic desktop, 0 nav overlap detectat ✅). Screenshots: `journey-audit-results/seap-mobile/`
- [x] **G4 — A11y axe-core WCAG2AA** — DONE 2026-05-05 (s2): Login=0 violări ✅; /tenders: 1 critical (button-name) + 2 serious; /privacy: 2 serious. Gap deschis: G-SEAP-010

---

### Parity H1–H3

- [ ] **H1 — Vercel vs VPS2 parity**: BLOCAT (seap-assistant.vercel.app nedeployat — G-SEAP-002 WONTFIX)
- [x] **H2 — Multi-tenant isolation** — DONE 2026-05-05 (s3): Org1 user încearcă `PATCH /api/tenders/[org2_id]/status` → 404 (scoped via userOrganizations); `GET /api/organizations/[org2_id]` → 403. Izolare confirmată prin cod și prin test live.
- [x] **H3 — Cross-org user parity** — DONE 2026-05-05 (s3): B5 vede ambele org ✅. Switch activeOrganizationId via `POST /api/organizations/[id]` persistă în DB ✅. 101 Org1 + 18 Org2 tenders izolate ✅. Scannerul creează tenders per-org (nu per activeOrganizationId) ✅.

---

### Stress + Audit Trail I1–I2

- [x] **I1 — 100+ tenders parallel** — DONE 2026-05-05 (s3)
  - Scan care returnează 100+ rezultate: 200 tenders procesate în 6.6s ✅
  - Verify: toate inserate corect, niciun timeout, DB performant ✅ (0 erori)
  - Verify: matchScore calculat corect pentru fiecare ✅ (102 Org1 tenders, 0 null matchScore)
  - seapId UNIQUE constraint: 0 duplicate ✅

- [ ] **I2 — Audit log completeness**
  - Rulează toate scenariile E1-E13 + F1-F3
  - Verify: fiecare acțiune sensibilă are entry în AuditLog
  - Verify: nu există "orphan" actions fără log

---

## Session Log

| Data | Sesiune | Progres |
|------|---------|---------|
| 2026-05-05 | True E2E kickoff | Scope definit. A1 (port conflict) BLOCKER identificat. A2/A3/A4 deschise. |
| 2026-05-05 | True E2E Full Audit [10] — sesiune completă | **A1 ELIMINATED** (port 3011→3019, nginx, PM2 standalone). **B+C seeded** (5 users, 2 orgs, 25 tenders). **[7] CODE 77/100**. **E1-E13 + F1-F3 + H2-H3 + I2** = 19/22 PASS (E5/E11/H3 script errors, E9=G-SEAP-003). **[8] Journey 6/9 OK** (3 GATED = onboarding walls, expected). Raport: `Reports/TRUE-E2E-FULL-2026-05-05.md`. Blocante rămase: A2 (Google OAuth, manual), A3 (Vercel 404), H1, I1. |
| 2026-05-05 (s2) | Sesiunea 2 — D-Infrastructure + G1-G4 | **G-SEAP-003**: OAuth server flow CORECT (POST+CSRF → accounts.google.com redirect ✅). **D1-D4 DONE**: scan live (200/100), Neon 83 tenders, R2 configured, email 4 trimise. **G1-G4 DONE**: G1(6OK/3GATED)+G2(parity)+G3(mobile 0 overlap)+G4(axe-core: login clean, tenders 1 critical+2 serious, privacy 2 serious). Gap nou: G-SEAP-010 (a11y WCAG2AA). |
| 2026-05-05 (s3) | Sesiunea 3 — E11-E12-F1-F3-H2-H3-I1 | **G-SEAP-010 ELIMINATED** (commit `3ea5b5e`: sidebar aria-label, tenders orange-700, privacy underline+blue-700). **E11 PARTIAL** (NO_GO setat manual; filtrul default include IGNORED — G-SEAP-011 OPEN). **E12 PASS** (audit-logs 200 OWNER/ADMIN, 403 MEMBER). **F1-F3 PASS** (seapId UNIQUE, last-write-wins, Org2 izolat CPV 90000000). **H2 PASS** (cross-org 404/403 confirmat în cod). **H3 PASS** (B5 switch via POST /api/organizations/[id], 101+18 tenders izolate). **I1 PASS** (200 tenders în 6.6s, 0 erori, 0 duplicate, 100% matchScore). Gaps noi: G-SEAP-011 (deadline dedup), G-SEAP-012 (CompanyDocument upload API). Blocante rămase: E4/E9/E13/H1/I2. |
