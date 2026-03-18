import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Get all users and organizations
  const users = await prisma.user.findMany();
  const orgs = await prisma.organization.findMany();

  // Find the real organization (Fabulosos with real CUI)
  const realOrg = orgs.find((o) => o.cui === 'RO33968578');
  if (!realOrg) {
    throw new Error('Fabulosos organization not found');
  }

  for (let i = 0; i < users.length; i++) {
    const user = users[i];
    const isOwner = i === 0; // First user is owner

    // Check if link exists
    const existing = await prisma.userOrganization.findUnique({
      where: {
        userId_organizationId: {
          userId: user.id,
          organizationId: realOrg.id,
        },
      },
    });

    if (!existing) {
      await prisma.userOrganization.create({
        data: {
          userId: user.id,
          organizationId: realOrg.id,
          role: isOwner ? 'OWNER' : 'MEMBER',
        },
      });
    }

    // Set active organization
    await prisma.user.update({
      where: { id: user.id },
      data: { activeOrganizationId: realOrg.id },
    });
  }

  // Delete the test organization if it's empty
  const testOrg = orgs.find((o) => o.cui === '99887766');
  if (testOrg) {
    const linkedUsers = await prisma.userOrganization.count({
      where: { organizationId: testOrg.id },
    });
    const linkedTenders = await prisma.tender.count({
      where: { organizationId: testOrg.id },
    });

    if (linkedUsers === 0 && linkedTenders === 0) {
      await prisma.organization.delete({ where: { id: testOrg.id } });
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
