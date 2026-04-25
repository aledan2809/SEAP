# SEAP — Romanian Public Procurement Analysis Platform

## Overview
AI-powered tender analysis platform. Scans e-licitatie.ro, generates SWOT analysis, provides bid recommendations (GO/CAUTION/NO_GO).

## Stack
- **Frontend/Backend**: Next.js 16, React 19, Tailwind, TypeScript
- **Database**: Prisma + Neon PostgreSQL
- **Auth**: NextAuth v5
- **Storage**: Cloudflare R2
- **AI**: @anthropic-ai/sdk + ai-router + Claude CLI fallback
- **Deploy**: Vercel + VPS2 (seap.knowbest.ro, PM2)

## Build & Run
```bash
npm run dev        # Dev server
npm run build      # Production build
npm test           # Jest tests
```

## AI Architecture
- 3-tier fallback: Claude CLI → Anthropic API → rule-based analysis
- `src/lib/ai/analyzer.ts` — Core analysis (SWOT + bid recommendation)
- `src/lib/ai-router.ts` — Multi-provider routing

### Optional: Files API + Citations (sibling, opt-in)
- `src/lib/ai/analyzer-with-citations.ts` — sibling of analyzer.ts. Uploads
  tender PDFs to Anthropic Files API and gets back SWOT analysis with exact
  citations (page / paragraph) per finding. Drop-in compatible:
  `analyzeWithCitations(tender)` returns the same `AnalysisResult` shape +
  `citations` and `citedDocuments` arrays. Falls back to the legacy
  `analyzeWithClaude` from analyzer.ts on Files API failure (graceful).
- Caller passes documents with one of: `pdfUrl`, `pdfBase64`, or
  pre-uploaded `fileId`. Docs without any PDF reference go through the
  fallback (OCR-text path in analyzer.ts). NO MODIFICATIONS to analyzer.ts.
- See `src/lib/ai/__tests__/analyzer-with-citations.test.ts` for usage.
- **Pilot wiring (2026-04-25)**: `src/lib/ai/pilot-analyzer.ts` exposes
  `runTenderAnalysis(tender)` which is the single import the route uses.
  Routes to legacy `analyzeWithClaude` by default; flips to
  `analyzeWithCitations` when `SEAP_CITATIONS_PILOT_ENABLED=1`.
  Telemetry emitted as `[seap-citations-pilot] {…json…}` on every call
  (latencyMs / citationCount / citedDocsCount / fellBackToLegacy /
  errorMessage / modelUsed). Optional file sink at `logs/seap-citations-
  pilot.jsonl` (gitignored). Audit log entry on `/api/tenders/[id]/
  analyze` carries the same telemetry into the AuditAction table.
- **Live validation status: DEFERRED** — Anthropic credit + sample
  tenders with PDFs required to verify the citations path end-to-end.
  9/9 jest tests cover the wiring offline (`pilot-analyzer.test.ts`).

## DO NOT MODIFY
- SWOT analysis prompt structure in analyzer.ts
- Auth middleware configuration
- Demo mode logic
- Tender data normalization pipeline


## Governance Reference
See: `Master/knowledge/MASTER_SYSTEM.md` §1-§5. This project follows Master governance; do not duplicate rules.
