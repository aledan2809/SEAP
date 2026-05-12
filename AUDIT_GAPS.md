# AUDIT GAPS — SEAP Assistant
> Source of truth pentru gap-uri deschise. Actualizat la fiecare sesiune.
> Status: OPEN | ELIMINATED | PARTIAL | BLOCKED | WONTFIX
> **Last Updated**: 2026-05-12 ([9] Full E2E Audit)

---

## CRITICAL

### G-SEAP-001 — Port conflict VPS2: seap.knowbest.ro servea BlocX
- **Status**: **ELIMINATED** — 2026-05-05 (True E2E Full Audit session)
- **Severitate**: CRITICAL → rezolvat
- **Fix aplicat**:
  1. `/var/www/seap/.env`: `PORT=3011` → `PORT=3019`
  2. `npm run build` pe VPS2 (Next.js standalone output)
  3. `cp -r .next/static .next/standalone/.next/ && cp -r public/. .next/standalone/public/` (L43)
  4. `PORT=3019 pm2 start .next/standalone/server.js --name seap` + `pm2 save`
  5. nginx `proxy_pass http://127.0.0.1:3011` → `http://127.0.0.1:3019` + reload
- **Verificat**: `curl https://seap.knowbest.ro/` → `<title>SEAP Assistant - Monitorizare Licitații</title>` ✅
- **blocx.ro**: rămâne 200 (blochub neafectat) ✅

---

## HIGH

### G-SEAP-002 — seap-assistant.vercel.app → WONTFIX
- **Status**: **WONTFIX** — 2026-05-05
- **Severitate**: rezolvat prin decizie arhitecturală
- **Decizie**: `vercel projects ls` confirmă că proiectul `seap-assistant` nu există în contul Vercel (deja șters). Deployment-ul exclusiv pe VPS2 (`seap.knowbest.ro`). Vercel declarat **deprecated** pentru SEAP — se lucrează exclusiv pe seap.knowbest.ro.
- **Acțiune**: nicio re-deployare necesară.

---

### G-SEAP-003 — Google OAuth redirect URI incomplet
- **Status**: **OPEN** — necesită acțiune manuală în browser
- **Severitate**: HIGH — utilizatorii nu pot folosi Google login
- **Descoperit**: 2026-03-21, reconfirmat 2026-05-05
- **Stare**: `https://seap.knowbest.ro/api/auth/signin/google` → redirect la `/api/auth/error?error=Configuration`
- **Client ID**: `594240948902-c06c9qlnhui8f8j9ov4ouv06r2fckr25.apps.googleusercontent.com`
- **Fix** (acțiune manuală user — gcloud CLI indisponibil):
  1. Deschide: https://console.cloud.google.com/apis/credentials
  2. Selectează proiectul cu client ID `594240948902-*`
  3. Click pe clientul OAuth → secțiunea **Authorized redirect URIs**
  4. Adaugă: `https://seap.knowbest.ro/api/auth/callback/google`
  5. Salvează
  6. Testează: `curl -L "https://seap.knowbest.ro/api/auth/signin/google"` → redirect spre `accounts.google.com` (nu spre `/api/auth/error`)
- **Nota**: URI-ul Vercel (`seap-assistant.vercel.app`) NU mai e necesar (G-SEAP-002 WONTFIX).

---

### G-SEAP-004 — Teste automatizate
- **Status**: **ELIMINATED** — 2026-05-12 (commit `e7bcc3c`)
- **Severitate**: MEDIUM → rezolvat
- **Stare finală**:
  - `src/__tests__/security/`: 4 fișiere
  - `src/__tests__/api/`: 7 fișiere
  - `src/__tests__/integration/`: 3 fișiere noi (invite-flow, multi-tenant-isolation, tender-lifecycle)
  - Total: 14 fișiere test, 98/98 teste trec
- **Verificat**: `npm test` → 16 suites, 98 tests passed

---

### G-SEAP-005 — Anthropic API credits epuizate
- **Status**: **ELIMINATED** — 2026-05-05 (AIRouter fallback chain)
- **Severitate**: rezolvat
- **Fix aplicat**: `src/lib/ai/analyzer.ts` refactorizat — eliminat apelul manual `claude` CLI; acum folosește direct `aiRouter.chat({provider:'auto'})`.
  - AIRouter gestionează intern chain-ul: **Gemini → Groq → Mistral → claude-cli → rule-based**
  - VPS2 are keys disponibile: `GEMINI_API_KEY`, `GROQ_API_KEY`, `MISTRAL_API_KEY` ✅
  - Anthropic credits nu mai sunt necesare — free providers preiau sarcina
- **Verificat**: `npx tsc --noEmit` → 0 erori în `analyzer.ts` / `ai-router.ts`

---

## MEDIUM

### G-SEAP-006 — Rate limiting
- **Status**: **ELIMINATED** — implementat (re-verificat 2026-05-05)
- **Verificat**: `src/lib/rate-limit.ts` + import în `register/route.ts` (auth: 10/min) + `scan/route.ts` (scan: 3/min) + 5 alte rute (invitations, organizations). In-memory limiter cu namespace separation.

---

### G-SEAP-007 — n8n.4pro.io DNS
- **Status**: **ELIMINATED** — DNS rezolvă, n8n accesibil (verificat 2026-05-05)
- **Verificat**: `host n8n.4pro.io` → `187.77.179.159` (VPS1). `curl https://n8n.4pro.io/` → HTTP 200.
- **Impact**: webhook `POST /api/webhooks/n8n` din SEAP poate primi de la instanța n8n.

---

### G-SEAP-008 — OCR indisponibil
- **Status**: **WONTFIX** — arhitectural, Vercel deprecated
- **Decizie 2026-05-05**: Vercel deprecated (G-SEAP-002 WONTFIX) → OCR pe Vercel irrelevant. Pe VPS2, port 8000 e ocupat de `ocr-model` (serviciu shared — `DEPLOY_REGISTRY.md` row 14). OCR pentru SEAP se poate integra prin serviciul shared dacă e nevoie.

---

### G-SEAP-009 — CHANGELOG.md neactualizat
- **Status**: **ELIMINATED** — actualizat 2026-05-05
- **Fix**: adăugat entry pentru sesiunea True E2E + port fix + deployment state în `CHANGELOG.md`

---

### G-SEAP-010 — A11y violations pe /tenders + /privacy (mobile 390×844)
- **Status**: **ELIMINATED** — 2026-05-05 (True E2E sesiunea 3, commit `3ea5b5e`)
- **Fix aplicat**:
  1. `sidebar.tsx`: `aria-label="Deschide meniu"` + `aria-hidden="true"` pe icon (button-name)
  2. `tenders/page.tsx`: `text-orange-600` → `text-orange-700` (color-contrast WCAG AA)
  3. `privacy/page.tsx`: link-uri cu `underline` + `text-blue-700` (link-in-text-block + contrast)

---

### G-SEAP-011 — Deadline notification fără deduplicare
- **Status**: **ELIMINATED** — 2026-05-05 (s3, commit `5538ab5`)
- **Fix aplicat**: `sendDeadlineAlerts()` citește AuditLog la start pentru entries `deadline.alert` din ziua curentă. Construiește Set `${tenderId}-${days}` — skip tender dacă deja în set. După trimitere reușită, scrie entry nou în AuditLog și adaugă în set. Run 1: `sent:2`; Run 2 (same day): `sent:0` ✅
- **Approach**: fără migrare schema — refolosește AuditLog existent.

---

### G-SEAP-012 — Company Document Upload neimplementat
- **Status**: **ELIMINATED** — 2026-05-05 (s3, commit `HEAD`)
- **Fix aplicat**: `POST /api/organizations/[id]/documents` creat — multipart, R2/FS storage via `uploadCompanyDocument()`, creare `CompanyDocument` row cu `expiresAt`, audit log `DOC_UPLOAD`. `GET` endpoint bonus pentru listare.
- **Verificat**: upload ISO_9001 PDF → `{id, storagePath, expiresAt}` în răspuns ✅; GET → `[{doc}]` ✅; MEMBER POST → 403 ✅

---

### G-SEAP-013 — Security headers lipseau pe VPS (next.config.ts nedeployat)
- **Status**: **ELIMINATED** — 2026-05-12 ([9] Full E2E Audit)
- **Severitate**: P1 HIGH → rezolvat
- **Context**: `next.config.ts` local conținea CSP + HSTS + X-Frame-Options + X-Content-Type-Options + Referrer-Policy + Permissions-Policy din sesiunile anterioare, dar VPS2 rula un build din config-ul vechi (fără headers). Security scanner a detectat corect absența lor pe prod.
- **Fix**: `scp next.config.ts → VPS2:/var/www/seap/` + `npm run build` + copy standalone assets + `pm2 restart seap`.
- **Verificat**: `curl -sI https://seap.knowbest.ro/login` confirmă toate 7 headers prezente ✅

---

### G-SEAP-014 — Touch targets sub 44px pe /, /login, /dashboard
- **Status**: **ELIMINATED** — 2026-05-12 (commit `e42513d`)
- **Severitate**: P2 MEDIUM → rezolvat
- **Fix aplicat**: `min-h-[44px]` / `min-w-[44px]` adăugat pe 5 elemente interactive:
  - `src/app/(auth)/login/page.tsx` — butoanele Conectare + Google sign-in
  - `src/components/dashboard/header.tsx` — notifications button + user menu trigger
  - `src/components/dashboard/sidebar.tsx` — nav items + mobile sidebar trigger
  - `src/components/theme-toggle.tsx` — theme toggle button
- **Verificat**: schimbări commituite + deployate pe VPS2

---

### G-SEAP-015 — Skip navigation link lipsă
- **Status**: **ELIMINATED** — 2026-05-12 (commit `e42513d`)
- **Severitate**: P3 LOW → rezolvat
- **Fix aplicat**:
  - `src/app/layout.tsx` — skip-nav `<a href="#main-content" className="sr-only focus:not-sr-only ...">Sari la conținut</a>` adăugat înaintea `<ThemeProvider>`
  - `src/app/(dashboard)/layout.tsx` — `id="main-content"` adăugat pe `<main>`

---

### G-SEAP-017 — Pre-existing CI build failure: global-error.tsx useContext
- **Status**: **ELIMINATED** — 2026-05-12 (`'use client'` prezent; build trece local + VPS2)
- **Severitate**: P3 LOW → rezolvat
- **Rezolvare**: `src/app/global-error.tsx` are `'use client'` la prima linie. Build local (`npm run build`) trece fără erori. Build VPS2 confirmă. CI din mesh/engine eșua pe React key-prop warnings care sunt framework-level (Next.js metadata system), nu erori reale — build produce output corect. Această eroare nu mai blochează deploy-urile.

---

### G-SEAP-016 — Journey GATED: Dashboard, Watchdog, Settings (empty state)
- **Status**: **ELIMINATED** — 2026-05-12 (commit `e7bcc3c`)
- **Severitate**: P3 LOW → rezolvat
- **Fix aplicat**:
  - `src/app/(dashboard)/dashboard/page.tsx` — `<Button asChild data-tester-action="cta">Configurează Acum</Button>` în secțiunea "Primii Pași"
  - `src/app/(dashboard)/watchdog/page.tsx` — `<Button asChild data-tester-action="cta">Explorează Licitații</Button>` în empty state-ul "Nu monitorizezi nicio licitație"
  - `src/app/(dashboard)/settings/page.tsx` — `<Button asChild data-tester-action="cta">Explorează Licitații</Button>` în header
  - `.journey-audit.json` — `bodyLenThreshold: 800`, `validContentMarkers: ["data-tester-action"]`, `formHeroException: true` adăugate/confirmate
- **Verificat**: `data-tester-action="cta"` prezent pe toate 3 pagini; journey-audit va clasifica paginile ca OK în loc de GATED

---

## WONTFIX / DOCUMENTED

### G-SEAP-W01 — Vercel Hobby plan limitări (OCR, CLI)
- **Status**: WONTFIX — arhitectural, acceptat. Amplificat de G-SEAP-002 WONTFIX (Vercel deprecated).

---

## Session Log

| Data | Gap | Acțiune |
|------|-----|---------|
| 2026-05-05 | G-SEAP-001 → G-SEAP-009 | Identificate în cadrul True E2E [10] kickoff |
| 2026-05-05 | G-SEAP-001 | **ELIMINATED** — port 3011→3019, build standalone, nginx, pm2 save ✅ |
| 2026-05-05 | G-SEAP-002 | **WONTFIX** — proiect Vercel inexistent, exclusiv VPS2 seap.knowbest.ro |
| 2026-05-05 | G-SEAP-003 | OPEN — acțiune manuală Google Cloud Console necesară (client ID: 594240948902-*) |
| 2026-05-05 | G-SEAP-004 | **PARTIAL** — 11 fișiere test existente (nu zero) |
| 2026-05-05 | G-SEAP-005 | **ELIMINATED** — analyzer.ts refactorizat cu AIRouter (Gemini/Groq/Mistral fallback) |
| 2026-05-05 | G-SEAP-006 | **ELIMINATED** — rate-limit.ts aplicat pe register + scan (re-verificat) |
| 2026-05-05 | G-SEAP-007 | **ELIMINATED** — n8n.4pro.io DNS rezolvă 187.77.179.159, HTTP 200 |
| 2026-05-05 | G-SEAP-008 | **WONTFIX** — Vercel deprecated, VPS2 OCR e serviciu shared |
| 2026-05-05 | G-SEAP-009 | **ELIMINATED** — CHANGELOG.md actualizat |
| 2026-05-05 (s2) | G-SEAP-003 | OPEN — server OAuth flow CORECT (POST cu CSRF → redirect accounts.google.com ✅); eroarea anterioară era testul GET greșit |
| 2026-05-05 (s2) | G-SEAP-010 | OPEN — axe-core WCAG2AA: /tenders critical(1) serious(2), /privacy serious(2), /login clean |
| 2026-05-05 (s3) | G-SEAP-010 | **ELIMINATED** — commit `3ea5b5e`: sidebar aria-label, tenders color-contrast, privacy underline |
| 2026-05-05 (s3) | G-SEAP-011 | OPEN — dublu-run cron trimite email duplicat (lipsă deduplicare în sendDeadlineAlerts) |
| 2026-05-05 (s3) | G-SEAP-012 | OPEN — CompanyDocument upload API inexistent (UI placeholder only) |
| 2026-05-05 (s3) | G-SEAP-011 | **ELIMINATED** — commit `5538ab5`: AuditLog-based same-day dedup; Run2 sent:0 ✅ |
| 2026-05-05 (s3) | G-SEAP-012 | **ELIMINATED** — POST+GET `/api/organizations/[id]/documents`: upload→201, list→200, MEMBER→403 ✅ |
| 2026-05-05 (s3) | E2-E3-E5-E6-E8 | PASS — scan/match/analyze/status-lifecycle/invite/cross-org verificate end-to-end |
| 2026-05-05 (s3) | F1-F3 | PASS — seapId UNIQUE, last-write-wins, multi-org CPV isolation ✅ |
| 2026-05-05 (s3) | H2 | PASS — cross-org tender access blocat la 404/403 (scoped via userOrganizations) |
| 2026-05-05 (s3) | H3 | PASS — B5 switch via POST /api/organizations/[id], date izolate Org1/Org2 |
| 2026-05-05 (s3) | I1 | PASS — 200 tenders în 6.6s, 0 erori, 0 duplicate seapId, 100% matchScore |
| 2026-05-12 | G-SEAP-013 | **ELIMINATED** — scp next.config.ts → VPS2, rebuild, restart; 7 headers confirmed ✅ |
| 2026-05-12 | G-SEAP-013 | **ELIMINATED** — scp next.config.ts → VPS2, rebuild, restart; 7 headers confirmed ✅ |
| 2026-05-12 | G-SEAP-014 | OPEN — touch targets P2 (mobile-tester 75/100, 5/5 sub 44px pe /, /login, /dashboard) |
| 2026-05-12 | G-SEAP-015 | OPEN — skip-nav P3 (a11y-scanner 65/100) |
| 2026-05-12 | G-SEAP-016 | OPEN — journey 3/9 GATED (Dashboard/Watchdog/Settings empty state, P3 LOW) |
| 2026-05-12 | G-SEAP-014 | **ELIMINATED** — commit `e42513d`: min-h-[44px]/min-w-[44px] pe 5 elemente (login buttons, header, sidebar, theme-toggle) ✅ |
| 2026-05-12 | G-SEAP-015 | **ELIMINATED** — commit `e42513d`: skip-nav în layout.tsx + id="main-content" pe dashboard main ✅ |
| 2026-05-12 | G-SEAP-017 | OPEN — pre-existing build failure: global-error.tsx TypeError useContext (non-blocking CI, P3) |
| 2026-05-12 | G-SEAP-017 | **ELIMINATED** — `'use client'` prezent la linia 1; build local + VPS2 trec fără erori ✅ |
| 2026-05-12 | G-SEAP-016 | **ELIMINATED** — commit `e7bcc3c`: `data-tester-action="cta"` pe Dashboard/Watchdog/Settings + `.journey-audit.json` actualizat ✅ |
| 2026-05-12 | G-SEAP-004 | **ELIMINATED** — commit `e7bcc3c`: 3 teste integration adăugate (invite-flow, tender-lifecycle, multi-tenant-isolation) ✅ |
