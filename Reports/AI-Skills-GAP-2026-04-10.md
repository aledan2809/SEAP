# AI Skills GAP Analysis — SEAP
**Data**: 2026-04-10
**Proiect**: SEAP (Romanian Public Procurement Analysis Platform)
**Stack**: Next.js 16, React 19, Tailwind, Prisma, Neon PostgreSQL, Cloudflare R2
**Deploy**: Vercel + VPS2 (seap.knowbest.ro, PM2)
**AI**: @anthropic-ai/sdk + ai-router + Claude CLI fallback

---

## 1. AI Skills Existente

| Skill | Status | Detalii |
|-------|--------|---------|
| Claude API direct | DA — ACTIV | `@anthropic-ai/sdk` v0.73.0 |
| Claude CLI fallback | DA — ACTIV | execSync Claude CLI → cost savings |
| AI Router | DA — ACTIV | `src/lib/ai-router.ts` |
| SWOT Analysis AI | DA — ACTIV | Analiză SWOT tender cu prompt RO optimizat |
| Bid recommendation AI | DA — ACTIV | GO/CAUTION/NO_GO per licitație |
| 3-tier fallback | DA | CLI → API → rule-based |
| CLAUDE.md | GENERIC | Template necustomizat |

**Total AI skills existente: 7/10**

---

## 2. AI Skills Necesare

| # | Skill AI | Prioritate | Complexitate | Impact |
|---|----------|-----------|--------------|--------|
| 1 | CLAUDE.md customizat | **MEDIE** | Mică | Context proiect |
| 2 | Tender similarity detection | **ÎNALTĂ** | Medie | Detectare oportunități similare |
| 3 | Historical win/loss analysis | MEDIE | Mare | ML pe istoric licitații |
| 4 | Document extraction AI | MEDIE | Medie | Extragere automată din caiet de sarcini |
| 5 | Competitor analysis | OPȚIONAL | Mare | Profil concurenți din istoric |

---

## 3. Scor AI Readiness

| Criteriu | Scor | Max |
|----------|------|-----|
| CLAUDE.md prezent | 0.5 | 2 |
| AI Router integrat | 2 | 2 |
| AI features implementate | 2.5 | 3 |
| Teste | 1 | 2 |
| Documentație AI | 0.5 | 1 |
| **TOTAL** | **6.5/10** | 10 |

**Verdict**: AI activ și funcțional (SWOT, bid recommendation, 3-tier fallback). Gap principal: CLAUDE.md generic + lipsa tender similarity detection.
