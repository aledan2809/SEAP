// Re-seed the True E2E / persona-walk test accounts (idempotent upserts).
// The original May-2026 accounts stopped authenticating on prod (CredentialsSignin,
// found during the 2026-07-07 /pa audit) — this script restores them deterministically.
//
// Usage (local):  npx tsx scripts/seed-test-accounts.ts
// Usage (VPS2):   DATABASE_URL=<prod url> npx tsx scripts/seed-test-accounts.ts
//
// Accounts (password for all: Test123!):
//   seap-test-owner@test.local   → Org1 (TechTest SRL)  OWNER
//   seap-test-admin@test.local   → Org1                 ADMIN
//   seap-test-member@test.local  → Org1                 MEMBER
//   seap-test-owner2@test.local  → Org2 (EcoTest SA)    OWNER
//   seap-test-cross@test.local   → Org1 + Org2          MEMBER (multi-org parity)

import { PrismaClient, UserRole } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

const PASSWORD = 'Test123!';

const ORGS = [
  {
    key: 'org1',
    name: 'TechTest SRL',
    cui: 'RO-TEST-0001',
    cpvCodes: ['72000000-5', '48000000-8'],
  },
  {
    key: 'org2',
    name: 'EcoTest SA',
    cui: 'RO-TEST-0002',
    cpvCodes: ['90000000-7', '71000000-8'],
  },
] as const;

const USERS: Array<{
  email: string;
  name: string;
  memberships: Array<{ org: 'org1' | 'org2'; role: UserRole }>;
}> = [
  { email: 'seap-test-owner@test.local', name: 'Test Owner', memberships: [{ org: 'org1', role: 'OWNER' }] },
  { email: 'seap-test-admin@test.local', name: 'Test Admin', memberships: [{ org: 'org1', role: 'ADMIN' }] },
  { email: 'seap-test-member@test.local', name: 'Test Member', memberships: [{ org: 'org1', role: 'MEMBER' }] },
  { email: 'seap-test-owner2@test.local', name: 'Test Owner Two', memberships: [{ org: 'org2', role: 'OWNER' }] },
  {
    email: 'seap-test-cross@test.local',
    name: 'Test Cross Org',
    memberships: [
      { org: 'org1', role: 'MEMBER' },
      { org: 'org2', role: 'MEMBER' },
    ],
  },
];

async function main() {
  const hashedPassword = await hash(PASSWORD, 12);

  const orgIds: Record<string, string> = {};
  for (const org of ORGS) {
    const row = await prisma.organization.upsert({
      where: { cui: org.cui },
      update: {},
      create: {
        name: org.name,
        cui: org.cui,
        cpvCodes: [...org.cpvCodes],
      },
    });
    orgIds[org.key] = row.id;
    console.log(`[seed] org: ${org.name} (${row.id})`);
  }

  for (const u of USERS) {
    const primaryOrgId = orgIds[u.memberships[0].org];
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: { password: hashedPassword, name: u.name, activeOrganizationId: primaryOrgId },
      create: {
        email: u.email,
        name: u.name,
        password: hashedPassword,
        activeOrganizationId: primaryOrgId,
      },
    });
    for (const m of u.memberships) {
      await prisma.userOrganization.upsert({
        where: {
          userId_organizationId: { userId: user.id, organizationId: orgIds[m.org] },
        },
        update: { role: m.role },
        create: { userId: user.id, organizationId: orgIds[m.org], role: m.role },
      });
    }
    console.log(`[seed] user: ${u.email} → ${u.memberships.map((m) => `${m.org}:${m.role}`).join(', ')}`);
  }

  console.log('[seed] done — all test accounts authenticate with Test123!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
