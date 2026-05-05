# Changelog — SEAP

## [Unreleased]

## [2026-05-05] — True E2E Full Audit + Port Fix + VPS2 Stabilizare
- **Critical fix**: Port conflict rezolvat — SEAP mutat de pe 3011 (conflict cu BlocHub) la **port 3019**
- **Deploy**: Next.js standalone rebuild pe VPS2, static/public assets copiate (L43 pattern), nginx `proxy_pass` actualizat la `127.0.0.1:3019`, PM2 restart + `pm2 save`
- **Vercel deprecated**: seap-assistant.vercel.app declarat WONTFIX — proiect inexistent în cont, deployment exclusiv pe `seap.knowbest.ro`
- **Test accounts seeded**: 5 useri × 2 organizații (OWNER, ADMIN, MEMBER, OWNER2, CROSS) cu credențiale `Test@2026!`
- **Fixture tenders seeded**: 20 tenders Org1 (status distribuite: NEW/REVIEWING/PREPARING/SUBMITTED/WON/LOST/CANCELLED/IGNORED) + 5 tenders Org2
- **Rate limiting verified**: `src/lib/rate-limit.ts` confirmat activ pe register (10/min), scan (3/min) + 5 alte rute
- **n8n.4pro.io DNS**: Rezolvă la 187.77.179.159 (VPS1), HTTP 200 confirmat
- **True E2E audit**: 19/22 scenarii PASS (E1-E8/E10-E13/F1-F3/H2-H3/I2) — E9 blocat pe G-SEAP-003, E5/E11/H3 script corect (PUT→PATCH)
- **Journey audit**: 6/9 OK (Dashboard/Watchdog/Setări = GATED prin onboarding walls, expected)
- **Open gaps**: G-SEAP-003 (Google OAuth redirect URI — acțiune manuală user) + G-SEAP-005 (Anthropic API credits)
- **AUDIT_GAPS.md**: Actualizat cu stări finale G-SEAP-001→009

## [2026-03-28] — P1 Audit Fixes (Accessibility, Security, Error Handling)
- **Accessibility**: Added aria-labels to all icon buttons across header, sidebar, tenders, documents, watchdog pages
- **Accessibility**: Added `scope="col"` to table header component for screen reader support
- **Accessibility**: Associated form error messages with input fields via `aria-describedby` and `role="alert"` on login/register
- **Accessibility**: Added text labels alongside color-only indicators (match score badges, urgent deadlines)
- **Accessibility**: Added aria-labels to search input, filter select, clear buttons in tender filters
- **Accessibility**: Marked decorative SVGs (Google logo) with `aria-hidden="true"`, improved avatar alt text fallback
- **Accessibility**: Added `aria-current="page"` to active sidebar navigation links
- **Accessibility**: Added `aria-hidden="true"` to all decorative nav/logo icons in sidebar
- **Accessibility**: Added `aria-label` to theme toggle button (was only using `title`)
- **Accessibility**: Added `aria-label="Meniu utilizator"` to user avatar dropdown trigger
- **Security**: Added webhook timestamp validation to prevent replay attacks (5-minute max age)
- **Security**: Upgraded `/api/scan` to verify admin role from DB (`userOrganization` table) instead of session-only check
- **Security**: Added rate limiting to 5 previously unprotected routes (GET/DELETE invitations, GET/POST org, GET org invitations)
- **UX**: Added password requirements hint on registration form
- **Docs**: Updated CHANGELOG.md and STRATEGY.md with current project state

## [2026-03-19] — Production Deployment (Dual)
- **Major**: Dual deployment active — Vercel + VPS2 (seap.knowbest.ro)
- **Storage**: Cloudflare R2 bucket `seap-documents` configured (EU region)
- **VPS Deploy**: PM2 process on VPS2, nginx reverse proxy, SSL certificate
- **n8n Integration**: Docker container on VPS1, nginx configuration complete
- **Git**: 46 files committed, Phase 1-3 finalized
- **Monitoring**: 319 licitații active în production database

## [2026-03-18] — Core Features & Vercel Deploy
- **AI Fallback**: Claude CLI fallback when API credits exhausted
- **Cron Jobs**: Daily scan (7 AM UTC) + deadline check (9 AM UTC) fixed
- **Google OAuth**: Full credentials configuration (redirect URIs pending)
- **Vercel**: Live deployment successful with all environment variables
- **OCR Service**: FastAPI service running on localhost:8000
- **Scanner**: 319 licitații imported from SEAP API
- **Testing**: Claude AI analysis verified on real tender data

## [2026-02-15] — Governance Setup
- Added MASTER governance files (SESSION_BOOT, STRATEGY, CONTEXT, DECISIONS, GUARDRAILS, CHANGELOG)
