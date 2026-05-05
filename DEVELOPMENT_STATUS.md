# SEAP Assistant - Development Status

**Last Updated:** 2026-05-05 (sesiunea 3 continuare — final)
**Status:** LIVE — VPS2 exclusiv (`seap.knowbest.ro`, port 3019, PM2 standalone)
**GitHub HEAD:** `cba452e` (branch `master`)

---

## Deploy

- **URL**: https://seap.knowbest.ro
- **VPS2**: `ssh root@72.62.155.74`, `/var/www/seap`, PM2 id=13
- **Deploy workflow**: `rsync <fișier> root@72.62.155.74:/var/www/seap/<path>` → `npm run build` → `cp -r .next/static .next/standalone/.next/ && cp -r public/. .next/standalone/public/` → `pm2 restart seap`
- **NOTĂ**: git pe VPS nu are commits locale — `git pull` eșuează cu "untracked files". Deploy exclusiv via rsync.

---

## Ce funcționează (testat E2E — sesiunile 1-3)

- Auth: register + credentials login (NextAuth v5) ✅
- Scan SEAP → tender discovery + CPV matching + matchScore ✅
- Tender status lifecycle (NEW→REVIEWING→PREPARING→SUBMITTED→WON) ✅
- AI SWOT analyze via AIRouter (Gemini/Groq fallback, fără credite Anthropic) ✅
- Team invitation flow (OWNER trimite, token accept, rol MEMBER) ✅
- Deadline notification email + **deduplicare same-day** (G-SEAP-011 ELIMINATED) ✅
- Multi-tenant isolation: cross-org → 404/403 ✅
- Cross-org user switch via `POST /api/organizations/[id]` ✅
- Audit log complet (register, analyze, status-change, invite, deadline.alert) ✅
- **Company Document upload** — POST+GET `/api/organizations/[id]/documents` (G-SEAP-012 ELIMINATED) ✅
- A11y WCAG2AA (sidebar aria-label, tenders contrast, privacy underline) ✅
- Concurrency: seapId UNIQUE, last-write-wins, multi-org CPV isolation ✅
- Stress: 200 tenders în 6.6s, 0 erori, 0 duplicate ✅

---

## TODO sesiune viitoare

### Deblocabile (fără dependențe externe)
- [ ] **E13 — Citations Pilot**: `SEAP_CITATIONS_PILOT_ENABLED=1` pe VPS2 + atașează PDF real la un tender existent în DB + `POST /api/tenders/[id]/analyze` → verify `citations[]` non-empty. **A4 NU mai e blocker** — AIRouter are Claude CLI fallback (fără credite Anthropic).
- [ ] **I2 — Audit log completeness**: sweep complet după toate scenariile E1-E13, verifică fiecare acțiune sensibilă are entry în AuditLog, verifică nu există acțiuni fără log.
- [ ] **E4** — necesită TenderDocument real uploadat în R2 (extern, blocat)

### Necesită acțiune manuală user
- [ ] **A2 / E9** — Google Cloud Console: adaugă `https://seap.knowbest.ro/api/auth/callback/google` la Authorized Redirect URIs (client ID: `594240948902-c06c9qlnhui8f8j9ov4ouv06r2fckr25.apps.googleusercontent.com`)

### WONTFIX
- H1 — Vercel seap-assistant.vercel.app deprecated (G-SEAP-002)

---

## Conturi test (active în Neon)

| User | Parola | Org | Rol | Cookie jar (local) |
|------|--------|-----|-----|--------------------|
| seap-test-owner@test.local | Test123! | Org1 (TechTest SRL) | OWNER | /tmp/seap-owner-e2.jar |
| seap-test-admin@test.local | Test123! | Org1 | ADMIN | /tmp/seap-admin-e3.jar |
| seap-test-member@test.local | Test123! | Org1 | MEMBER | — |
| seap-test-owner2@test.local | Test123! | Org2 (EcoTest SA) | OWNER | — |
| seap-test-cross@test.local | Test123! | Org1+Org2 | MEMBER | /tmp/seap-cross-e8.jar |

- **Org1 ID**: `cmos7wftx0000szn7cpkq4q2o` (CPV 72000000 + 48000000)
- **Org2 ID**: `cmos7wfuy0001szn7zd8gmh2y` (CPV 90000000 + 71000000)
- **CRON_SECRET**: `seap-cron-secret-2026`

---

## Gap-uri deschise (OPEN)

| Gap | Status | Acțiune |
|-----|--------|---------|
| G-SEAP-003 | OPEN | Google OAuth redirect URI — manual în Google Cloud Console |
| G-SEAP-004 | PARTIAL | 11 fișiere test, lipsesc teste E2E autentificate (invite flow, status lifecycle) |

---

## Recent Changes (sesiunile 1-3)

| Commit | Descriere |
|--------|-----------|
| `3ea5b5e` | fix(a11y): sidebar aria-label, tenders orange-700, privacy underline+blue-700 |
| `5538ab5` | fix(notifications): same-day dedup în sendDeadlineAlerts via AuditLog |
| `1c395cf` | feat(documents): POST/GET /api/organizations/[id]/documents |
| `cba452e` | docs(todo): E13 deblocat — AIRouter Claude CLI fallback |

---

## Technical Notes

- **Prisma**: rulează din `/Users/danciulescu/Projects/SEAP` (nu din home dir)
- **Neon DB**: `ep-spring-grass-agaupxl8-pooler.c-2.eu-central-1.aws.neon.tech/neondb`
- **AIRouter chain**: Gemini → Groq → Mistral → claude-cli → rule-based
- **Storage**: Cloudflare R2 configurat pe VPS2 (useR2=true, R2_BUCKET=seap-documents)
- **Zod v4**: `z.record()` necesită 2 args; `z.nativeEnum(PrismaEnum)` pentru enum-uri Prisma
- **AuditLog `deadline.alert`**: cheie dedup = `${tenderId}-${days}`, scris după fiecare send reușit
