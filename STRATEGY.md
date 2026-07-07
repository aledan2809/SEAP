# Strategy — SEAP
Last Updated: 2026-07-07

## Vision
Become the leading automated monitoring platform for Romanian government IT tenders, helping companies win more public contracts through intelligent AI-powered analysis and never miss relevant opportunities.

## Product Principles

### Proactive step-by-step UX, per role
The app must proactively guide every user through a normal flow, step by step — never
leaving them to discover the process through menus or support. Concretely:
- **The dashboard is a live cockpit, not a brochure**: every number reflects real DB
  state; the setup guide tracks per-step completion and disappears when done, replaced
  by a daily work queue ("what to do today").
- **Every role sees intuitively everything it needs**: navigation mirrors API
  permissions (no menu items that dead-end in 403), the signed-in role and active
  organization are always visible, and actions reserved for another role are shown
  disabled with an explanation rather than failing after the click.
- **The tender lifecycle is a visible flow**: at every status, the UI suggests the
  natural next step (NEW → run AI analysis; GO → prepare; PREPARING → submit; …).
- Codified from the /pa persona-walk audit 2026-07-07
  (`Reports/pa-ux-audit-2026-07-07/audit.html`).

## Scope

### In Scope
- Romanian SEAP (Sistemul Electronic de Achiziții Publice) IT tender monitoring
- Multi-tenant SaaS architecture for IT companies
- AI-powered SWOT analysis and recommendations
- Document OCR processing and analysis
- Email notifications and deadline alerts
- Competitive intelligence and market trends

### Current Scope (Production)
- Core tender scanning and monitoring (319 tenders active)
- Claude AI analysis with fallback mechanisms
- Multi-organization support with role-based access
- PDF export and document storage (Cloudflare R2)
- Dual deployment (Vercel serverless + VPS dedicated)

## Key Goals

### Completed ✅
- [x] **Production Deployment** — Dual active deployment (Vercel + VPS2)
- [x] **SEAP Scanner** — Automated daily scanning at 7 AM UTC
- [x] **AI Analysis** — Claude integration with 3-tier fallback
- [x] **Multi-tenancy** — Organizations, invitations, role management
- [x] **Storage Solution** — Cloudflare R2 with local fallback
- [x] **Email Notifications** — Opportunities, deadlines, daily digest

### In Progress 🟡
- [ ] **Google OAuth** — Code complete, redirect URIs pending manual setup
- [ ] **OCR Service** — Active on VPS, need Vercel serverless solution
- [ ] **n8n Integration** — Workflow ready, DNS configuration pending

### Completed (v1.1 Audit) ✅
- [x] **Accessibility Audit Fixes** — ARIA labels, form associations, color-independent indicators
- [x] **Security Hardening** — Webhook replay protection, DB-verified admin checks
- [x] **UX Improvements** — Password hint, form error associations

### Next Milestone (v2.0) 🎯
- [ ] **Enhanced Analytics** — Market trends, competitor analysis
- [ ] **API Documentation** — Swagger/OpenAPI implementation
- [ ] **Test Coverage** — Unit, integration, and E2E tests
- [ ] **Performance Monitoring** — Error tracking, uptime alerts

## Business Goals
- **Never miss a relevant tender** — 100% coverage of IT contracts in SEAP
- **Reduce monitoring time by 90%** — From manual daily checks to automated alerts
- **Improve bid quality** — AI SWOT analysis with GO/CAUTION/NO_GO recommendations
- **Increase win rate** — Better preparation through early opportunity discovery
- **Competitive intelligence** — Market trends and competitor activity tracking

## Constraints

### Technical
- **Vercel Hobby Plan** — Limited to 2 daily cron jobs
- **SEAP API Limits** — External API dependency, no official rate limits
- **AI Credits** — Anthropic API credits need monitoring and management
- **OCR Service** — Local FastAPI service, not serverless compatible

### Business
- **Romanian Market Focus** — Limited to Romanian government contracts
- **IT Sector Primary** — Main focus on IT/technology tenders
- **Multi-tenant Architecture** — Must support multiple organizations securely

### Operational
- **Dual Deployment** — Maintain both Vercel and VPS deployments
- **Manual Configuration** — Some services require manual setup (Google OAuth, DNS)

## Out of Scope

### Current Release
- Non-Romanian tender systems (EU, other countries)
- Non-IT tender categories (construction, medical, etc.)
- Bid submission automation
- Direct SEAP portal integration (authentication)
- Real-time tender updates (limited to daily scans)

### Future Considerations
- Mobile native applications
- Enterprise single-tenant deployments
- Advanced NLP for contract analysis
- Automated bid generation
- Integration with accounting/CRM systems

## Success Metrics
- **User Adoption**: Active organizations using the platform
- **Tender Coverage**: Percentage of relevant IT tenders captured
- **Response Time**: Time from tender publication to user notification
- **Analysis Quality**: Accuracy of AI recommendations vs. actual outcomes
- **System Uptime**: Availability across both deployment environments
