import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting migration...');

  // Get all users
  const users = await prisma.user.findMany();
  console.log(`Found ${users.length} users`);

  // Get all organizations
  const orgs = await prisma.organization.findMany();
  console.log(`Found ${orgs.length} organizations`);

  // Get existing UserOrganization links
  const existingLinks = await prisma.userOrganization.findMany();
  console.log(`Found ${existingLinks.length} existing UserOrganization links`);

  // If there's exactly one org and users without links, connect them
  if (orgs.length === 1 && users.length > 0) {
    const org = orgs[0];
    console.log(`\nWill link all users to organization: ${org.name} (${org.cui})`);

    for (const user of users) {
      // Check if link already exists
      const existingLink = existingLinks.find(
        (l) => l.userId === user.id && l.organizationId === org.id
      );

      if (!existingLink) {
        // Create link - first user is OWNER, rest are MEMBERs
        const isFirstUser = users.indexOf(user) === 0;
        const role = isFirstUser ? 'OWNER' : 'MEMBER';

        const link = await prisma.userOrganization.create({
          data: {
            userId: user.id,
            organizationId: org.id,
            role: role,
          },
        });
        console.log(`  Created link: ${user.email} -> ${org.name} as ${role}`);

        // Also set activeOrganizationId
        await prisma.user.update({
          where: { id: user.id },
          data: { activeOrganizationId: org.id },
        });
        console.log(`  Set activeOrganization for ${user.email}`);
      } else {
        console.log(`  Link already exists for ${user.email}`);
      }
    }
  } else if (orgs.length > 1) {
    console.log('\nMultiple organizations found. Manual intervention needed.');
    for (const org of orgs) {
      console.log(`  - ${org.name} (${org.cui})`);
    }
  } else if (orgs.length === 0) {
    console.log('\nNo organizations found. Users need to create one in Settings.');
  }

  console.log('\nMigration complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
