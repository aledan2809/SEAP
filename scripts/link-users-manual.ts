import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Linking users to organizations...\n');

  // Get all users and organizations
  const users = await prisma.user.findMany();
  const orgs = await prisma.organization.findMany();

  console.log('Users:');
  for (const user of users) {
    console.log(`  - ${user.email} (${user.name})`);
  }

  console.log('\nOrganizations:');
  for (const org of orgs) {
    console.log(`  - ${org.name} (${org.cui})`);
  }

  // Find the real organization (Fabulosos with real CUI)
  const realOrg = orgs.find((o) => o.cui === 'RO33968578');
  if (!realOrg) {
    console.log('\nFabulosos organization not found!');
    return;
  }

  console.log(`\nLinking all users to ${realOrg.name}...`);

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
      console.log(`  Created: ${user.email} -> ${realOrg.name} as ${isOwner ? 'OWNER' : 'MEMBER'}`);
    } else {
      console.log(`  Already linked: ${user.email}`);
    }

    // Set active organization
    await prisma.user.update({
      where: { id: user.id },
      data: { activeOrganizationId: realOrg.id },
    });
    console.log(`  Set activeOrganization: ${user.email} -> ${realOrg.name}`);
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
      console.log(`\nDeleted empty test organization: ${testOrg.name}`);
    } else {
      console.log(`\nTest organization has data, not deleting: ${linkedUsers} users, ${linkedTenders} tenders`);
    }
  }

  console.log('\nDone!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
