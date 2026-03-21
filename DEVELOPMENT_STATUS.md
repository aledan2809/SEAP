# SEAP Assistant - Development Status

**Last Updated:** 2026-03-19 22:30
**Status:** DEPLOYED — Vercel + VPS2 (dual deployment)
**URLs:**
- https://seap-assistant.vercel.app (Vercel, serverless)
- https://seap.knowbest.ro (VPS2, PM2 port 3011, SSL)

---

## Sesiune 2026-03-19

### Completate
- [x] **Git commit** — 46 fișiere, Phase 1-3 comise (`3d3d181`)
- [x] **Cloudflare R2** — bucket `seap-documents` creat (Eastern Europe, Standard)
  - API Token: Object Read & Write, specific bucket only
  - Account ID: `7c9cd0106833ea908263631071ffbe1e`
  - Access Key + Secret Key configurate în .env + Vercel + Master credentials
- [x] **n8n on VPS1** — descoperit Docker container activ pe 187.77.179.159:5678
  - nginx conf exista dar DNS-ul nu rezolva → adăugat IP-ul direct în server_name
  - Accesibil pe `http://187.77.179.159` cu Host header
  - TODO: configurează subdomain n8n.4pro.io cu DNS A record
- [x] **Deploy VPS2** — SEAP live la seap.knowbest.ro
  - tar.gz upload (nu git clone — repo privat)
  - PM2 `seap` process, port 3011
  - nginx reverse proxy + SSL (certbot)
  - DNS A record: seap.knowbest.ro → 72.62.155.74
- [x] **R2 env vars on Vercel** — R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME

### Sesiune anterioară (2026-03-18)
- [x] Claude CLI fallback — analyzer folosește `claude -p` când API-ul nu are credit
- [x] Cron fix — scan la 7 AM UTC zilnic + deadline check la 9 AM UTC
- [x] Google OAuth — credentials adăugate în .env + Vercel env vars
- [x] Vercel env vars complete
- [x] Deploy Vercel — build success, LIVE
- [x] OCR service — pornit pe localhost:8000
- [x] SEAP scanner — 319 licitații în DB
- [x] Claude analysis test — CLI fallback verificat pe licitație reală

### Phase 1-3 (sesiuni anterioare)
- [x] Mobile responsive sidebar, CPV autocomplete, email notifications, PDF export
- [x] Audit log API, Invitations API
- [x] Dark mode, Invitations page, Cron deadline notifications, n8n webhook improvements

---

## Acțiuni rămase

### Necesită acțiune manuală
- [ ] **Google Cloud Console** — adaugă redirect URI: `https://seap.knowbest.ro/api/auth/callback/google` + `https://seap-assistant.vercel.app/api/auth/callback/google`
- [ ] **n8n.4pro.io DNS** — adaugă A record `n8n` → `187.77.179.159` la registrarul 4pro.io
- [ ] **Anthropic API credits** — reîncarcă pentru analiza API pe Vercel (CLI nu există pe serverless)

### Nice to have
- [ ] **SEAP în AI Pipeline** — adaugă SEAP la project-router.js pentru mesh visibility
- [ ] **n8n workflow** — configurează workflow SEAP scraper pe instanța VPS1
- [ ] **OCR pe VPS** — deploy ocr-model pe VPS2 pentru document processing remote

---

## Stare curentă

### Funcțional
- **Scanner SEAP** — direct API call la e-licitatie.ro, CPV + keyword matching
- **AI Analysis** — Claude CLI (gratuit) cu fallback la API; SWOT, recommendation GO/CAUTION/NO_GO
- **Email notifications** — opportunity reports, deadline alerts, daily digests
- **PDF export** — /api/tenders/[id]/pdf
- **Dark mode** — next-themes
- **Cron jobs** — scan zilnic 7 AM UTC, deadline check 9 AM UTC
- **Google OAuth** — cod complet, credentials configurate (lipsește redirect URI în Console)
- **OCR** — serviciu local FastAPI pe port 8000
- **R2 Storage** — bucket `seap-documents` activ, credentials complete
- **Dual deploy** — Vercel (serverless) + VPS2 seap.knowbest.ro (PM2)

---

## Technical Notes

### Architecture
- **Scanner**: `src/lib/seap/scanner.ts` — single POST to SEAP API, client-side CPV/keyword filtering
- **Analyzer**: `src/lib/ai/analyzer.ts` — Claude CLI first, then API fallback
- **Storage**: `src/lib/storage/index.ts` — R2 with local filesystem fallback
- **Auth**: NextAuth v5 + PrismaAdapter, JWT sessions, Credentials + Google OAuth
- **DB**: Neon PostgreSQL, 319 tenders, 1 organization

### VPS2 Deploy
- **Path**: `/var/www/seap`
- **PM2**: `seap` process, port 3011
- **nginx**: `/etc/nginx/sites-enabled/seap` → proxy_pass http://127.0.0.1:3011
- **SSL**: Let's Encrypt via certbot, expires 2026-06-17
- **NEXTAUTH_URL**: `https://seap.knowbest.ro`
- **Deploy method**: tar.gz upload (no git on VPS for this project)

### n8n on VPS1
- **Docker**: `n8n-n8n-1` container, port 5678 (127.0.0.1 only)
- **nginx**: `/etc/nginx/sites-enabled/n8n.conf` → proxy_pass http://127.0.0.1:5678
- **server_name**: `n8n.4pro.io n8n.srv1423263.hstgr.cloud 187.77.179.159`
- **Status**: Running, accessible via IP

### Vercel Config
- Hobby plan: 2 daily crons max
- Env vars: DATABASE_URL, DIRECT_URL, AUTH_SECRET, AUTH_TRUST_HOST, NEXTAUTH_URL, ANTHROPIC_API_KEY, N8N_API_KEY, N8N_WEBHOOK_URL, CRON_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, DAILY_DIGEST_HOUR_UTC, DAILY_DIGEST_MINUTE_WINDOW, R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME

### R2 Credentials
- Account ID: `7c9cd0106833ea908263631071ffbe1e`
- Bucket: `seap-documents` (EU, Standard)
- API Token: Object Read & Write, specific bucket only, TTL Forever
- Stored in: .env, Vercel env vars, Master credentials

### Git Status
- All committed, latest: `3d3d181` — Phase 1-3 complete
