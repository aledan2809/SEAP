import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Șterge evenimentele asociate mai întâi
  await prisma.tenderEvent.deleteMany({
    where: {
      tender: {
        seapId: 'TEST-SEAP-2024-001'
      }
    }
  });

  // Șterge tender-ul
  await prisma.tender.deleteMany({
    where: { seapId: 'TEST-SEAP-2024-001' }
  });
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
