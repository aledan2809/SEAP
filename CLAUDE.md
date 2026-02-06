# CLAUDE.md - Autonomous Development Template
# Copy this to your project root as CLAUDE.md

## Project Setup

### Database
- **Type**: [neon/supabase/prisma]
- **Connection**: See `.env` for DATABASE_URL

### Stack
- **Frontend**: [Next.js/React/Angular/Vue]
- **Backend**: [NestJS/Fastify/Express/.NET]
- **Port**: [port number]

---

## MANDATORY RULES (ALWAYS FOLLOW)

### 1. PROJECT LOCATION
- ALL projects MUST be created in `C:\Projects\` only
- Structure: `C:\Projects\ProjectName\` with subfolders inside
- NEVER create projects elsewhere

### 2. TODO LIST - ALWAYS START WITH THIS
- Every session MUST begin by reading or creating a TODO list
- Use TodoWrite tool to track all tasks
- Update TODO with every new instruction or completed work
- Mark tasks complete immediately when done
- Add new tasks as they are discovered

### 3. STATUS BACKUP (Prevent Data Loss)
Commands:
- `backup status` → Save current session state to DEVELOPMENT_STATUS.md
- `update status` or `status update` → Restore from DEVELOPMENT_STATUS.md

**AUTO-BACKUP TRIGGERS** (Do automatically, no user request needed):
- After EVERY completed TODO item
- After any file creation/major edit
- After successful build/test
- Before any risky operation
- Minimum: every 30 minutes of active work

**LOGGING** (For monitoring):
After each backup, append to `C:\Projects\backup-log.md`:
```
[2026-02-06 14:30] | ProjectName | TODO completed | ✅ OK
```

DEVELOPMENT_STATUS.md format:
```markdown
# Project Status - [Project Name]
Last Updated: [timestamp]

## Current State
- [what's working]
- [what's in progress]

## TODO
- [ ] Task 1
- [ ] Task 2

## Recent Changes
- [date]: [change description]

## Technical Notes
- [important decisions, gotchas, etc.]
```

### 4. GLOBAL MEMORY ACCESS
- Global instructions: `~/.claude/projects/*/memory/MEMORY.md`
- When improving something applicable to ALL projects, update global memory
- Check global memory for reusable patterns before implementing

### 5. MASTER CREDENTIAL REPOSITORY
**Path**: `C:\Projects\Master`
**Purpose**: Central storage for ALL credentials across ALL projects

**SYNC RULES** (MANDATORY):
1. **At project start**: Request common API keys from Master:
   - OpenAI, Anthropic, Google Cloud, Azure keys
   - Check `C:\Projects\Master\credentials\` for existing .env files

2. **During development**: When obtaining NEW credentials:
   - Database URLs (Neon, Supabase, etc.)
   - API keys, tokens, secrets
   - Service URLs
   → Immediately sync to Master: `C:\Projects\Master\credentials\[project-name].env`

3. **Format for Master credentials**:
   ```env
   # Project: [ProjectName]
   # Last Updated: [date]
   DATABASE_URL=...
   API_KEY=...
   ```

4. **Master backup responsibility**:
   - Master creates regular backups of all projects
   - Log: `C:\Projects\master-backup-log.md`

---

## Claude Code Autonomy Rules

### ALWAYS DO (No Permission Needed)
- Read any file in the project
- Run `npm install`, `npm run dev`, `npm run build`
- Run tests: `npm test`, `npx jest`, `npx vitest`
- Git operations: `status`, `diff`, `log`, `add`, `commit`
- Run linters: `npm run lint`, `npx eslint`, `npx prettier`
- Database migrations: `npx prisma migrate dev`, `npx prisma generate`
- Type checking: `npx tsc --noEmit`
- Update TODO list
- Backup status when requested

### EXECUTE SQL DIRECTLY
Use CLI instead of copy/paste to browser:

```bash
# Neon - execute SQL directly
neonctl sql --project-id $NEON_PROJECT_ID -- "CREATE TABLE users (...)"
neonctl sql --project-id $NEON_PROJECT_ID -f migrations/001_init.sql

# Supabase - execute SQL directly
npx supabase db execute --db-url $DATABASE_URL -f migrations/001_init.sql
npx supabase db push
```

### ENVIRONMENT VARIABLES
Claude can create/update `.env` files. Required vars:
```
DATABASE_URL=
NEON_PROJECT_ID=
# Add project-specific vars below
```

### ERROR HANDLING
When errors occur:
1. Read full error message
2. Check relevant files
3. Fix and retry automatically (max 3 attempts)
4. If still failing, ask user

### TESTING WORKFLOW
Before marking task complete:
1. Run `npm run build` - must pass
2. Run `npm test` - must pass (or skip if no tests)
3. Run `npm run lint` - fix any issues

---

## CLI Quick Reference

### Neon CLI
```bash
# Login (one-time)
neonctl auth

# List projects
neonctl projects list

# Execute SQL
neonctl sql --project-id <id> -- "SELECT * FROM users"
neonctl sql --project-id <id> -f script.sql

# Get connection string
neonctl connection-string --project-id <id>
```

### Supabase CLI
```bash
# Login (one-time)
npx supabase login

# Link to project
npx supabase link --project-ref <ref>

# Execute SQL
npx supabase db execute -f script.sql

# Push migrations
npx supabase db push

# Generate types
npx supabase gen types typescript --linked > types/supabase.ts
```

---

## Project-Specific Instructions
<!-- Add your project rules below -->

