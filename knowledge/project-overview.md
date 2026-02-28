# SEAP Assistant - Tender Monitoring Platform

## Overview
Multi-tenant SaaS for monitoring IT tenders from Romanian SEAP (Public Procurement System).

## Business Context

### Purpose
Automated monitoring and AI-powered analysis of Romanian government IT tenders to help companies win more public contracts.

### Target Users
- IT companies bidding on government contracts
- Business development managers
- Sales teams targeting public sector
- Procurement specialists

### Problem Solved
Romanian SEAP portal publishes thousands of tenders, but manually monitoring for relevant opportunities is time-consuming. Companies miss valuable contracts because they discover them too late or lack resources for proper analysis.

### Business Goals
- Never miss a relevant tender opportunity
- Reduce tender monitoring time by 90%
- Improve bid quality with AI-powered SWOT analysis
- Increase win rate on public contracts
- Provide competitive intelligence on market trends

## Architecture
- **Stack**: Next.js 16 + Prisma 5 + PostgreSQL (Neon)
- **Auth**: NextAuth
- **AI**: Claude integration for SWOT analysis
- **OCR**: External service (port 8000)

## Key Features
- Tender monitoring and alerts
- SWOT analysis with AI
- Document OCR processing
- Multi-tenant architecture

## Deployment
- **URL**: https://seap-assistant.vercel.app
- **Status**: Production

## Important Files
- `/src/app` - Next.js App Router
- `/prisma` - Database schema
- `/src/lib` - Utilities and AI integration

## Lifecycle

**Status**: 🔵 Production/Stable
**Last Active**: 2026-02-07
**Next Milestone**: v2.0 - Enhanced analytics

Status Legend:
- 🟢 Active Development
- 🟡 Maintenance Mode
- 🔵 Production/Stable
- 🔴 Deprecated

## Quick Start (Developer Onboarding)

### Prerequisites
- Node.js 18+
- Git

### Setup Steps
1. [ ] Clone repository
2. [ ] Copy `.env.example` to `.env.local` (or load from Master)
3. [ ] Install dependencies: `npm install`
4. [ ] Run database migrations: `npx prisma migrate dev`
5. [ ] Start development server: `npm run dev`
6. [ ] Verify: Open http://localhost:3000

**Note**: Production is already deployed at https://seap-assistant.vercel.app

### Key Files to Read First
- `CLAUDE.md` - Autonomy rules
- `knowledge/project-overview.md` - This file
- `README.md` - Project readme (if exists)

### Common Issues
- Port already in use: Check if another project is running on port 3000
- Database connection: Verify DATABASE_URL in .env

## Changelog
- [2026-02-07] v1.1: Added Lifecycle Status and Quick Start sections
- [2026-02-07] v1.0: Added business context (purpose, target users, problem solved, business goals)
