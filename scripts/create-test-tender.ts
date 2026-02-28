import { PrismaClient } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

const prisma = new PrismaClient();

async function main() {
  console.log('Creating test tender from real SEAP data...\n');

  // Get the Fabulosos organization
  const org = await prisma.organization.findUnique({
    where: { cui: 'RO33968578' },
  });

  if (!org) {
    console.error('Organization Fabulosos not found!');
    return;
  }

  console.log(`Found organization: ${org.name} (${org.id})`);

  // Check if test tender already exists
  const existingTender = await prisma.tender.findFirst({
    where: { seapId: 'TEST-SEAP-2024-001' },
  });

  if (existingTender) {
    console.log(`Test tender already exists: ${existingTender.id}`);
    console.log(`\nYou can test AI analysis at:`);
    console.log(`https://seap-assistant.vercel.app/tenders/${existingTender.id}`);
    return;
  }

  // Create a realistic test tender based on real SEAP structure
  const tender = await prisma.tender.create({
    data: {
      seapId: 'TEST-SEAP-2024-001',
      seapUrl: 'https://e-licitatie.ro/pub/notices/c-notice/v2/view/100000001',
      title: 'Servicii de dezvoltare și mentenanță aplicații software pentru sistemul informatic integrat',
      description: `Obiectul contractului constă în prestarea de servicii de dezvoltare, implementare și mentenanță a aplicațiilor software pentru sistemul informatic integrat al autorității contractante.

Serviciile includ:
1. Dezvoltare aplicații web și mobile
2. Integrare cu sisteme existente (ERP, CRM)
3. Mentenanță corectivă și evolutivă
4. Suport tehnic și training utilizatori
5. Documentație tehnică și de utilizare

Cerințe tehnice:
- Experiență minimă 3 ani în proiecte similare
- Certificări ISO 9001, ISO 27001
- Echipă minimă: 2 dezvoltatori senior, 1 PM, 1 QA
- Tehnologii: .NET, React, PostgreSQL, Docker

Criterii de atribuire:
- Preț: 40%
- Calitate tehnică: 40%
- Experiență similară: 20%`,
      contractingAuth: 'Ministerul Digitalizării',
      contractingAuthCui: 'RO12345678',
      estimatedValue: new Decimal(2500000),
      currency: 'RON',
      cpvCode: '72000000-5',
      cpvDescription: 'Servicii IT: consultanță, dezvoltare de software, internet și asistență',
      cpvCodes: ['72000000-5', '72200000-7', '72300000-8'],
      procedureType: 'licitatie_deschisa',
      contractType: 'servicii',
      publicationDate: new Date('2024-01-15'),
      submissionDeadline: new Date('2024-02-28'),
      status: 'NEW',
      organizationId: org.id,
    },
  });

  console.log(`\nCreated test tender: ${tender.id}`);
  console.log(`Title: ${tender.title}`);
  console.log(`Value: ${tender.estimatedValue} ${tender.currency}`);
  console.log(`CPV: ${tender.cpvCode}`);

  // Create a tender event
  await prisma.tenderEvent.create({
    data: {
      tenderId: tender.id,
      eventType: 'PUBLISHED',
      title: 'Licitație publicată în SEAP',
      details: 'Licitația a fost publicată în Sistemul Electronic de Achiziții Publice',
      seapDate: new Date('2024-01-15'),
    },
  });

  console.log(`\nCreated publication event`);

  console.log(`\n===========================================`);
  console.log(`TEST TENDER CREATED SUCCESSFULLY!`);
  console.log(`===========================================`);
  console.log(`\nTo test AI analysis, go to:`);
  console.log(`https://seap-assistant.vercel.app/tenders/${tender.id}`);
  console.log(`\nOr locally:`);
  console.log(`http://localhost:3000/tenders/${tender.id}`);
  console.log(`\nThen click "Analizează cu AI" button.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
