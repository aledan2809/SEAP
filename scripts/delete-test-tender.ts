import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Deleting test tender...');

  // Șterge evenimentele asociate mai întâi
  const events = await prisma.tenderEvent.deleteMany({
    where: {
      tender: {
        seapId: 'TEST-SEAP-2024-001'
      }
    }
  });
  console.log('Deleted events:', events.count);

  // Șterge tender-ul
  const deleted = await prisma.tender.deleteMany({
    where: { seapId: 'TEST-SEAP-2024-001' }
  });
  console.log('Deleted tenders:', deleted.count);

  // Verifică ce mai e
  const remaining = await prisma.tender.count();
  console.log('Remaining tenders:', remaining);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
