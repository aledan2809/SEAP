# SEAP Assistant - Development Status

**Last Updated:** 2026-02-07
**Status:** DEPLOYED - Production Ready
**URL:** https://seap-assistant.vercel.app

---

## Project Overview

SEAP Assistant este o aplicație SaaS pentru monitorizarea și analiza licitațiilor publice din România (SEAP - Sistemul Electronic de Achiziții Publice).

### Tech Stack
- **Frontend:** Next.js 16 (App Router) + TypeScript + Tailwind CSS + shadcn/ui
- **Backend:** Next.js API Routes + Prisma 5
- **Database:** PostgreSQL (Neon Serverless)
- **Auth:** NextAuth.js v5 (credentials + Google OAuth ready)
- **AI:** Claude API (@anthropic-ai/sdk) pentru analiză SWOT
- **Storage:** Cloudflare R2 / MinIO (S3-compatible)
- **OCR:** External service la C:\Projects\ocr-model (port 8000)
- **Automation:** n8n webhooks pentru SEAP scanning
- **Deploy:** Vercel

---

## Architecture

```
User → Vercel (Next.js) → Neon DB (PostgreSQL)
                       → Claude API (AI Analysis)
                       → R2/MinIO (Document Storage)
                       → OCR Service (Text Extraction)

n8n Workflow → Webhook → Create/Update Tenders
```

---

## Database Schema (Key Models)

### Multi-tenant (Many-to-Many)
```
User ←→ UserOrganization ←→ Organization
         (role: OWNER/ADMIN/MEMBER)
```

### Core Entities
- **Organization** - Firma (CUI, setări monitorizare CPV)
- **Tender** - Licitație din SEAP
- **TenderDocument** - Documente descărcate
- **TenderAnalysis** - Analiză SWOT AI
- **TenderEvent** - Timeline evenimente
- **CompanyDocument** - Documente firmă (certificate, etc.)
- **WebhookLog** - Log webhooks n8n

---

## Completed Features ✅

### Authentication
- [x] Login cu email/parolă
- [x] Înregistrare cu organizație opțională
- [x] JWT sessions
- [x] Protected routes

### Multi-tenant Organizations
- [x] Many-to-many User-Organization
- [x] Role-based access (OWNER, ADMIN, MEMBER)
- [x] Switch între organizații
- [x] Organizație activă per user

### Pages
- [x] Dashboard - Overview stats
- [x] Licitații (/tenders) - Lista cu filtre
- [x] Detalii licitație (/tenders/[id])
- [x] Analiză AI (/analysis) - SWOT analysis
- [x] Documente (/documents) - Tender + Company docs
- [x] Watchdog (/watchdog) - Monitorizare
- [x] Setări (/settings) - Profil, Organizație, Monitorizare

### API Endpoints
- [x] `/api/auth/register` - Înregistrare
- [x] `/api/auth/[...nextauth]` - NextAuth
- [x] `/api/organizations` - CRUD organizații
- [x] `/api/organizations/[id]` - Detalii + switch
- [x] `/api/organizations/[id]/monitoring` - Setări CPV
- [x] `/api/tenders/[id]/analyze` - Trigger AI analysis
- [x] `/api/tenders/[id]/status` - Update status
- [x] `/api/documents/[id]/download` - Signed URLs
- [x] `/api/webhooks/n8n` - Webhook handlers

### AI Integration
- [x] Claude API integration (claude-sonnet-4)
- [x] SWOT analysis pentru licitații
- [x] Recomandări GO/CAUTION/NO_GO
- [x] Fallback la mock când API key lipsește

### n8n Webhooks
- [x] `tender_found` - Tender nou găsit
- [x] `documents_downloaded` - Documente descărcate
- [x] `analysis_complete` - Analiză completă
- [x] `clarification_published` - Clarificare nouă
- [x] `deadline_approaching` - Deadline aproape
- [x] `tender_updated` - Tender actualizat

### Document Handling
- [x] Download din SEAP URLs
- [x] Upload la R2/MinIO
- [x] OCR integration (external service)
- [x] Signed download URLs

---

## Environment Variables

```env
# Database (Neon)
DATABASE_URL="postgresql://..."
DIRECT_URL="postgresql://..."

# Auth
AUTH_SECRET="..."
AUTH_TRUST_HOST=true
NEXTAUTH_URL="https://seap-assistant.vercel.app"

# AI
ANTHROPIC_API_KEY="sk-ant-..."

# Storage (R2/MinIO)
R2_ENDPOINT="..."
R2_ACCESS_KEY="..."
R2_SECRET_KEY="..."
R2_BUCKET_NAME="seap-documents"

# OCR (external)
OCR_SERVICE_URL="http://localhost:8000"

# Optional: Google OAuth
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."
```

---

## Current Database State

### Users (2)
1. alexdanciulescu@gmail.com (Alex Danciulescu) - OWNER
2. test10@example.com (Test User) - MEMBER

### Organizations (1)
1. Fabulosos (RO33968578) - Real company

### UserOrganization Links
- Both users linked to Fabulosos

---

## Pending/TODO

### High Priority
- [ ] Configurare n8n workflow real (SEAP scraper)
- [ ] Test Claude API cu licitație reală
- [ ] Setup R2 credentials pentru document storage
- [ ] Pornire OCR service și test

### Medium Priority
- [ ] Email notifications pentru deadline-uri
- [ ] Mobile responsive sidebar (collapsible)
- [ ] CPV code autocomplete în settings
- [ ] Export rapoarte PDF

### Low Priority
- [ ] Google OAuth activation
- [ ] Invitații membri în organizație
- [ ] Audit log pentru acțiuni
- [ ] Dark mode

---

## File Structure

```
C:\Projects\SEAP\
├── prisma/
│   └── schema.prisma          # Database schema
├── src/
│   ├── app/
│   │   ├── (auth)/            # Login, Register
│   │   ├── (dashboard)/       # Protected pages
│   │   └── api/               # API routes
│   ├── components/
│   │   ├── ui/                # shadcn components
│   │   ├── dashboard/         # Sidebar, Header
│   │   ├── settings/          # Settings components
│   │   └── tenders/           # Tender components
│   └── lib/
│       ├── ai/                # Claude integration
│       ├── auth/              # NextAuth config
│       ├── db/                # Prisma client
│       ├── ocr/               # OCR client
│       ├── seap/              # SEAP downloader
│       └── storage/           # R2/MinIO client
├── scripts/
│   ├── migrate-users-orgs.ts  # Migration helper
│   └── link-users-manual.ts   # Manual linking
└── n8n-workflows/
    └── 01-seap-scanner.json   # n8n workflow definition
```

---

## Recent Changes (2026-02-07)

1. **Schema Update**: Changed from one-to-many to many-to-many User-Organization
2. **New Table**: UserOrganization junction table with role per org
3. **Auth Update**: Uses activeOrganizationId + organizations relation
4. **Settings Update**: Support multiple organizations, switch between them
5. **API Updates**: All endpoints use userOrganizations for access check
6. **Data Migration**: Linked existing users to Fabulosos organization
7. **Deploy**: Successfully deployed to Vercel

---

## Commands

```bash
# Development
npm run dev                    # Start dev server (port 3000)

# Database
npx prisma generate           # Generate Prisma client
npx prisma db push            # Push schema to DB
npx prisma studio             # Open Prisma Studio

# Deploy
vercel --prod                 # Deploy to production

# Scripts
npx tsx scripts/link-users-manual.ts  # Link users to orgs
```

---

## Contacts & Resources

- **Vercel Dashboard:** https://vercel.com/alex-danciulescus-projects/seap-assistant
- **Neon Console:** https://console.neon.tech
- **SEAP:** https://e-licitatie.ro
- **n8n:** Self-hosted or cloud

---

## Notes

- OCR service must be running locally for document processing
- Claude API key required for real AI analysis (falls back to mock)
- R2 credentials needed for document storage
- n8n workflow needs to be imported and configured
