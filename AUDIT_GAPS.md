# AUDIT GAPS — SEAP Assistant
> Source of truth pentru gap-uri deschise. Actualizat la fiecare sesiune.
> Status: OPEN | ELIMINATED | PARTIAL | BLOCKED | WONTFIX
> **Last Updated**: 2026-05-05 (sesiunea 2)

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
- **Status**: **PARTIAL** — există 11 fișiere de test, acoperire parțială
- **Severitate**: MEDIUM (downgrade de la HIGH — nu zero teste)
- **Stare actuală 2026-05-05**:
  - `src/__tests__/security/`: 4 fișiere (auth-bypass, csrf-middleware, providers-info, rate-limiting)
  - `src/__tests__/api/`: 7 fișiere (deadline-check, invitations, organizations, pdf-export, scan, tenders-analyze, user-profile)
  - Total: 11 fișiere test, jest.config.js configurat
- **Lipsesc**: teste E2E end-to-end autentificate (invite flow complet, status lifecycle, multi-tenant isolation)
- **Fix propus sesiune viitoare**: rulează `npm test` pe VPS2 + adaugă minimum 3 teste integration pentru fluxuri critice

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
- **Status**: **OPEN** — MEDIUM (nu blochează funcționalitate, dar WCAG 2AA non-conformant)
- **Descoperit**: 2026-05-05 sesiunea 2, axe-core G4 audit
- **/tenders**:
  - CRITICAL `button-name`: butoane icon fără `aria-label` (probabil butoane filter/sort)
  - SERIOUS `color-contrast`: elemente cu contrast insuficient
  - SERIOUS `link-name`: link-uri fără text accesibil
- **/privacy**:
  - SERIOUS `color-contrast`
  - SERIOUS `link-in-text-block`: link-uri nedistinguibile fără culoare
- **/login**: 0 violări ✅
- **Fix propus** (sesiune dedicată, ~1h):
  1. `tenders` page: adaugă `aria-label` pe butoanele icon din lista tenders
  2. Verifică variabilele Tailwind de contrast pe tema dark/light
  3. `privacy` page: adaugă `underline` sau `font-weight:bold` pe link-uri inline

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
