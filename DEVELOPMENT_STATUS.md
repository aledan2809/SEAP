# SEAP Assistant - Development Status

**Last Updated:** 2026-05-05
**Status:** LIVE — VPS2 exclusiv (`seap.knowbest.ro`, port 3019, PM2 standalone)
**URLs:**
- https://seap.knowbest.ro ✅ LIVE (VPS2 port 3019)
- ~~seap-assistant.vercel.app~~ — WONTFIX (proiect inexistent în Vercel)

---

## Sesiunea 2026-05-05 — True E2E Full Audit [10]

### Completate
- [x] **G-SEAP-001 ELIMINATED** — Port conflict rezolvat: 3011→3019, nginx updated, PM2 standalone rebuild, `pm2 save`
- [x] **G-SEAP-002 WONTFIX** — Vercel deprecated (`vercel projects ls` confirmă proiect inexistent)
- [x] **G-SEAP-003 OPEN** — Google OAuth: redirect URI `https://seap.knowbest.ro/api/auth/callback/google` lipsește din Google Cloud Console. Client ID: `594240948902-c06c9qlnhui8f8j9ov4ouv06r2fckr25`. Acțiune manuală user necesară.
- [x] **G-SEAP-004 PARTIAL** — 11 fișiere test existente (4 security + 7 API), nu zero
- [x] **G-SEAP-005 ELIMINATED** — `analyzer.ts` refactorizat să folosească AIRouter direct (Gemini/Groq/Mistral → claude-cli fallback). VPS2 are `GEMINI_API_KEY`, `GROQ_API_KEY`, `MISTRAL_API_KEY`. Anthropic credits nu mai sunt blocante.
- [x] **G-SEAP-006 ELIMINATED** — `src/lib/rate-limit.ts` activ pe register (10/min) + scan (3/min) + 5 rute
- [x] **G-SEAP-007 ELIMINATED** — n8n.4pro.io DNS rezolvă, HTTP 200
- [x] **G-SEAP-008 WONTFIX** — Vercel deprecated, OCR = shared ocr-model VPS2
- [x] **G-SEAP-009 ELIMINATED** — CHANGELOG.md actualizat cu entry 2026-05-05
- [x] **Test accounts seeded** (Phase B): 5 useri × 2 organizații, toate cu `Test@2026!`
  - Org1: `seap-test-owner@test.local` (OWNER), `seap-test-admin@test.local` (ADMIN), `seap-test-member@test.local` (MEMBER)
  - Org2: `seap-test-owner2@test.local` (OWNER2)
  - Cross: `seap-test-cross@test.local` (access la ambele orgs)
- [x] **Fixture tenders seeded** (Phase C): 20 tenders Org1 + 5 tenders Org2, cu status distribuite, TenderAnalysis GO/CAUTION/NO_GO
- [x] **E2E scenarios**: `e2e-scenarios/run_scenarios.sh` — **21/22 PASS** (E9 GATED pe G-SEAP-003 Google OAuth)
  - Fix aplicat: PUT→PATCH pe E5/E11/H3 (SEAP routes folosesc PATCH)
  - Fix aplicat: E1 acceptă 400 cu "există" (comportament SEAP pentru duplicate email)
- [x] **Journey audit** ([8]): 6/9 OK, 3 GATED (Dashboard/Watchdog/Setări = onboarding walls, expected)
- [x] **Deploy VPS2**: `analyzer.ts` + `ai-router.ts` (lipsea!) copiate, rebuild Next.js standalone, PM2 restart → HTTP 200 ✅

### Commit final sesiune
- `ce5a7da` — fix(analyzer): use AIRouter fallback chain instead of manual claude-cli call

---

## Stare Curentă

### Infrastructură
| Component | Status | Detalii |
|-----------|--------|---------|
| VPS2 PM2 | ✅ online | port 3019, pid activ |
| nginx | ✅ | proxy_pass 127.0.0.1:3019 |
| Neon PostgreSQL | ✅ | conectat |
| AI Analysis | ✅ | AIRouter: Gemini/Groq/Mistral → claude-cli |
| Rate Limiting | ✅ | src/lib/rate-limit.ts, 7 rute |
| Google OAuth | ⚠️ OPEN | redirect URI lipsește — acțiune manuală user |

### AUDIT_GAPS.md stare finală
| Gap | Status |
|-----|--------|
| G-SEAP-001 Port conflict | ELIMINATED ✅ |
| G-SEAP-002 Vercel 404 | WONTFIX ✅ |
| G-SEAP-003 Google OAuth | **OPEN** ⚠️ |
| G-SEAP-004 Teste | PARTIAL ✅ |
| G-SEAP-005 Anthropic credits | ELIMINATED ✅ |
| G-SEAP-006 Rate limiting | ELIMINATED ✅ |
| G-SEAP-007 n8n DNS | ELIMINATED ✅ |
| G-SEAP-008 OCR | WONTFIX ✅ |
| G-SEAP-009 CHANGELOG | ELIMINATED ✅ |

---

## TODO Sesiune Viitoare

### Prioritate imediată
- [ ] **G-SEAP-003** (user action): adaugă `https://seap.knowbest.ro/api/auth/callback/google` în Google Cloud Console → client `594240948902-*` → Authorized redirect URIs
- [ ] **E9 Google OAuth** — verifică după fix: `curl -L "https://seap.knowbest.ro/api/auth/signin/google"` → trebuie redirect la `accounts.google.com`

### True E2E restant (TODO_PERSISTENT.md)
- [ ] **D — Infrastructure verify**: D1 SEAP API live (e-licitatie.ro scan real), D2 Neon health, D3 R2 bucket, D4 email SMTP
- [ ] **G1-G4 Browser headed** (Playwright): OWNER journey, MEMBER journey, mobile 390x844, a11y
- [ ] **H1 Parity** — declară N/A (Vercel deprecated)
- [ ] **I1 Stress test** — 100+ tenders scan paralel pe prod

### Îmbunătățiri
- [ ] Adaugă `src/lib/ai-router.ts` în deploy rsync (a lipsit și a blocat build-ul)
- [ ] G-SEAP-004: adaugă 3 teste integration (invite flow, status lifecycle, multi-tenant isolation)

---

## Note Tehnice
- **Deploy SEAP VPS2**: NU git repo — rsync/scp manual + build pe VPS2
  ```bash
  scp src/lib/ai/analyzer.ts root@72.62.155.74:/var/www/seap/src/lib/ai/
  ssh root@72.62.155.74 "cd /var/www/seap && npm run build && cp -r .next/static .next/standalone/.next/ && cp -r public/. .next/standalone/public/ && pm2 restart seap"
  ```
- **SEAP routes**: PATCH (nu PUT) pentru `/api/tenders/[id]/status` și `/api/user/profile`
- **Email duplicate**: SEAP returnează 400 (nu 409) pentru email deja existent la register
- **AIRouter pe SEAP**: `"ai-router": "file:../AIRouter/ai-router-1.0.0.tgz"` în package.json
- **Journey audit**: `npx @aledan007/tester@0.3.0 journey-audit --email seap-test-owner@test.local --password "Test@2026!"`
- **Test credentials**: toți userii au parola `Test@2026!`
