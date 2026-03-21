# Changelog — SEAP

## [Unreleased]

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
