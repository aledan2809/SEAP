# Changelog — SEAP

## [Unreleased]

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
