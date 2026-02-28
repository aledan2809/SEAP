/**
 * SEAP Scanner - Căutare directă licitații
 * Înlocuiește necesitatea n8n pentru proiecte simple
 */

import { prisma } from '@/lib/db';
import { Decimal } from '@prisma/client/runtime/library';

// SEAP Public API endpoints
const SEAP_API_BASE = 'https://e-licitatie.ro/api-pub';
const SEAP_NOTICE_LIST = `${SEAP_API_BASE}/NoticeCommon/GetCANoticeList`;

export interface SeapTender {
  caNoticeId: string;
  noticeNo?: string;
  contractTitle?: string;
  shortDescription?: string;
  contractingAuthorityNameAndFN?: string;
  contractingAuthorityCUI?: string;
  ronContractValue?: number;
  cpvCode?: string;
  cpvCodeAndName?: string;
  contractingType?: string;
  sysContractAssigmentType?: string;
  publicationDate?: string;
  tenderReceiptDeadline?: string;
  sysNoticeState?: string;
}

export interface SeapSearchResult {
  items?: SeapTender[];
  searchResult?: { items?: SeapTender[] };
  totalCount?: number;
}

export interface ScanResult {
  success: boolean;
  tendersFound: number;
  tendersCreated: number;
  createdTenderIds: string[];
  errors: string[];
}

/**
 * Caută licitații pe SEAP după cod CPV
 * SEAP API necesită POST, nu GET
 */
export async function searchSeapByCpv(cpvCode: string, pageSize = 50): Promise<SeapTender[]> {
  try {
    // SEAP API necesită POST cu body JSON și Referer header
    const response = await fetch(SEAP_NOTICE_LIST, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://e-licitatie.ro/',
        'Origin': 'https://e-licitatie.ro',
      },
      body: JSON.stringify({
        cpvCode,
        pageSize,
        pageIndex: 0,
        // Alte filtre posibile
        sysNoticeState: 'PUBLISHED', // Doar publicate
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`SEAP API error for CPV ${cpvCode}:`, response.status, errorText);
      return [];
    }

    const data = await response.json() as SeapSearchResult;

    // SEAP returnează în diferite formate
    const items = data.items || data.searchResult?.items || [];

    return Array.isArray(items) ? items : [];
  } catch (error) {
    console.error(`Error searching SEAP for CPV ${cpvCode}:`, error);
    return [];
  }
}

/**
 * Scanează SEAP pentru toate organizațiile configurate
 */
export async function runFullScan(): Promise<ScanResult> {
  const result: ScanResult = {
    success: true,
    tendersFound: 0,
    tendersCreated: 0,
    createdTenderIds: [],
    errors: [],
  };

  try {
    // Obține toate organizațiile cu codurile lor CPV
    const organizations = await prisma.organization.findMany({
      where: {
        cpvCodes: { isEmpty: false },
      },
    });

    if (organizations.length === 0) {
      result.errors.push('Nu există organizații cu coduri CPV configurate');
      return result;
    }

    // Colectează toate codurile CPV unice
    const allCpvCodes = new Set<string>();
    organizations.forEach(org => {
      org.cpvCodes.forEach(cpv => allCpvCodes.add(cpv));
    });

    console.log(`Scanning SEAP for ${allCpvCodes.size} CPV codes...`);

    // Caută pentru fiecare cod CPV
    const allTenders: SeapTender[] = [];

    for (const cpvCode of allCpvCodes) {
      const tenders = await searchSeapByCpv(cpvCode);
      allTenders.push(...tenders);

      // Rate limiting - nu supraîncărcăm SEAP
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Deduplică după seapId
    const uniqueTenders = new Map<string, SeapTender>();
    for (const tender of allTenders) {
      const id = tender.caNoticeId || tender.noticeNo;
      if (id && !uniqueTenders.has(id)) {
        uniqueTenders.set(id, tender);
      }
    }

    result.tendersFound = uniqueTenders.size;
    console.log(`Found ${result.tendersFound} unique tenders`);

    // Procesează fiecare tender
    for (const [seapId, tender] of uniqueTenders) {
      try {
        // Verifică dacă e activ (nu expirat)
        if (tender.tenderReceiptDeadline) {
          const deadline = new Date(tender.tenderReceiptDeadline);
          if (deadline < new Date()) {
            continue; // Skip expired
          }
        }

        // Găsește organizațiile care monitorizează acest CPV
        const cpvCode = tender.cpvCode || tender.cpvCodeAndName?.split(' - ')[0] || '';
        const matchingOrgs = organizations.filter(org =>
          org.cpvCodes.includes(cpvCode) || org.cpvCodes.length === 0
        );

        for (const org of matchingOrgs) {
          // Verifică dacă tender-ul există deja
          const existing = await prisma.tender.findFirst({
            where: { seapId, organizationId: org.id },
          });

          if (existing) continue;

          // Calculează scor de potrivire
          const matchScore = calculateMatchScore(tender, org);

          // Creează tender-ul
          const created = await prisma.tender.create({
            data: {
              seapId,
              seapUrl: `https://e-licitatie.ro/pub/notices/c-notice/v2/view/${seapId}`,
              title: tender.contractTitle || tender.shortDescription || 'Fără titlu',
              description: tender.shortDescription,
              contractingAuth: tender.contractingAuthorityNameAndFN || 'Necunoscut',
              contractingAuthCui: tender.contractingAuthorityCUI,
              estimatedValue: tender.ronContractValue ? new Decimal(tender.ronContractValue) : null,
              currency: 'RON',
              cpvCode,
              cpvCodes: cpvCode ? [cpvCode] : [],
              cpvDescription: tender.cpvCodeAndName,
              procedureType: tender.contractingType || 'unknown',
              contractType: tender.sysContractAssigmentType,
              publicationDate: tender.publicationDate ? new Date(tender.publicationDate) : null,
              submissionDeadline: tender.tenderReceiptDeadline ? new Date(tender.tenderReceiptDeadline) : null,
              status: 'NEW',
              matchScore,
              organizationId: org.id,
            },
          });

          result.createdTenderIds.push(created.id);
          result.tendersCreated++;
        }
      } catch (error) {
        result.errors.push(`Error processing tender ${seapId}: ${error}`);
      }
    }

    console.log(`Created ${result.tendersCreated} new tenders`);

  } catch (error) {
    result.success = false;
    result.errors.push(`Scan error: ${error}`);
  }

  return result;
}

function calculateMatchScore(
  tender: SeapTender,
  org: { cpvCodes: string[]; keywords: string[]; minValue: unknown; maxValue: unknown }
): number {
  let score = 50;

  // CPV match
  const cpvCode = tender.cpvCode || tender.cpvCodeAndName?.split(' - ')[0] || '';
  if (org.cpvCodes?.includes(cpvCode)) {
    score += 20;
  }

  // Keyword match
  const title = (tender.contractTitle || '').toLowerCase();
  org.keywords?.forEach(keyword => {
    if (title.includes(keyword.toLowerCase())) {
      score += 10;
    }
  });

  // Value range match
  if (tender.ronContractValue && org.minValue && org.maxValue) {
    const value = tender.ronContractValue;
    const min = Number(org.minValue);
    const max = Number(org.maxValue);
    if (value >= min && value <= max) {
      score += 10;
    }
  }

  return Math.min(score, 100);
}

/**
 * Scanare rapidă - caută doar licitații noi din ultima săptămână
 */
export async function runQuickScan(): Promise<ScanResult> {
  // Pentru acum, folosește scanarea completă
  // În viitor poate fi optimizat cu filtrare pe dată
  return runFullScan();
}
