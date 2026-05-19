/**
 * SEAP Scanner — Fetchează licitații recente din SEAP public API
 *
 * NOTĂ: SEAP public API (e-licitatie.ro/api-pub) are limitări:
 * - GetCANoticeList = Contract Award Notices (recent publicate, date 2026)
 * - GetCNoticeList = Contract Notices (date vechi 2019-2020, nefolosibil)
 * - API-ul ignoră filtrele (cpvCode, sysNoticeState, date range)
 * - Returnează max 3000 rezultate sortate după data publicării DESC
 *
 * Strategia: o singură cerere GetCANoticeList → filtrare client-side
 */

import { prisma } from '@/lib/db';
import { Decimal } from '@prisma/client/runtime/library';

const SEAP_API_CA = 'https://e-licitatie.ro/api-pub/NoticeCommon/GetCANoticeList';
const SEAP_API_CN = 'https://e-licitatie.ro/api-pub/NoticeCommon/GetCNoticeList';

export interface SeapTender {
  caNoticeId: number | string;
  noticeNo?: string;
  contractTitle?: string;
  shortDescription?: string;
  contractingAuthorityNameAndFN?: string;
  contractingAuthorityCUI?: string;
  ronContractValue?: number;
  cpvCodeAndName?: string;
  sysAcquisitionContractType?: { text?: string };
  sysProcedureType?: { text?: string };
  sysContractAssigmentType?: { text?: string };
  sysNoticeState?: { text?: string };
  sysProcedureState?: { text?: string };
  noticeStateDate?: string;
  maxTenderReceiptDeadline?: string;
  tenderReceiptDeadlineExport?: string;
  currencyCode?: string;
  isOnline?: boolean;
}

export interface ScanResult {
  success: boolean;
  tendersFound: number;
  tendersCreated: number;
  createdTenderIds: string[];
  errors: string[];
}

/**
 * Fetch from a SEAP API endpoint
 */
async function fetchFromEndpoint(url: string, pageSize: number): Promise<SeapTender[]> {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Referer': 'https://e-licitatie.ro/',
        'Origin': 'https://e-licitatie.ro',
      },
      body: JSON.stringify({ pageSize, pageIndex: 0 }),
    });

    if (!response.ok) {
      console.error(`SEAP API error ${url}: ${response.status}`);
      return [];
    }

    const data = await response.json();
    return Array.isArray(data.items) ? data.items : [];
  } catch (error) {
    console.error(`SEAP fetch error ${url}:`, error);
    return [];
  }
}

/**
 * Fetch recent tenders from SEAP — both CA (awarded) and CN (open) endpoints
 */
async function fetchSeapTenders(pageSize = 500): Promise<SeapTender[]> {
  const [caItems, cnItems] = await Promise.all([
    fetchFromEndpoint(SEAP_API_CA, pageSize),
    fetchFromEndpoint(SEAP_API_CN, pageSize),
  ]);

  // Deduplicate by caNoticeId
  const seen = new Set<string>();
  const all: SeapTender[] = [];
  for (const item of [...caItems, ...cnItems]) {
    const id = String(item.caNoticeId || item.noticeNo);
    if (id && !seen.has(id)) {
      seen.add(id);
      all.push(item);
    }
  }
  console.log(`SEAP: ${caItems.length} CA + ${cnItems.length} CN = ${all.length} unique`);
  return all;
}

/**
 * Extract CPV code from "12345678-9 - Description (Rev.2)" format
 */
function extractCpvCode(cpvCodeAndName?: string): string {
  if (!cpvCodeAndName) return '';
  const match = cpvCodeAndName.match(/^(\d{8}(-\d)?)/);
  return match ? match[1] : '';
}

/**
 * Extract CPV division (first 4 digits) for group matching
 * 2-digit match is too broad (e.g. "30" = all office equipment)
 * 4-digit match is the CPV "group" level — much more precise
 */
function cpvDivision(code: string): string {
  return code.substring(0, 4);
}

/**
 * Check if tender CPV matches any of the organization's CPV codes
 * Priority: exact match > 4-digit division match
 * (2-digit group match removed — too broad, causes false positives)
 */
function cpvMatches(tenderCpv: string, orgCpvCodes: string[]): boolean {
  if (orgCpvCodes.length === 0) return true; // No filter = match all
  const tDiv = cpvDivision(tenderCpv);
  return orgCpvCodes.some(orgCpv => {
    if (tenderCpv === orgCpv) return true;
    // Full 8-digit codes only get 4-digit division match (never prefix match)
    // to avoid "30" short code matching all 30xxxxxx tenders
    if (orgCpv.length >= 8 && cpvDivision(orgCpv) === tDiv) return true;
    return false;
  });
}

/**
 * Full scan: fetch recent SEAP tenders and match to organizations
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
    // 1. Get organizations with CPV codes
    const organizations = await prisma.organization.findMany({
      where: { cpvCodes: { isEmpty: false } },
    });

    if (organizations.length === 0) {
      // If no orgs have CPV codes, fetch for ALL orgs (show everything)
      const allOrgs = await prisma.organization.findMany();
      if (allOrgs.length === 0) {
        result.errors.push('Nu există organizații');
        return result;
      }
      // Use first org as target
      organizations.push(...allOrgs);
    }

    // 2. Single fast SEAP API call (most recent 200 tenders)
    console.log(`Fetching latest tenders from SEAP...`);
    const seapTenders = await fetchSeapTenders(200);

    if (seapTenders.length === 0) {
      result.errors.push('SEAP API nu a returnat rezultate');
      return result;
    }

    result.tendersFound = seapTenders.length;
    console.log(`Fetched ${seapTenders.length} tenders from SEAP`);

    // 3. Process tenders — match to organizations
    for (const tender of seapTenders) {
      const seapId = String(tender.caNoticeId || tender.noticeNo);
      if (!seapId) continue;

      const tenderCpv = extractCpvCode(tender.cpvCodeAndName);
      const title = tender.contractTitle || tender.shortDescription || 'Fără titlu';

      for (const org of organizations) {
        try {
          // Match by CPV code (group level) OR keywords
          const cpvMatch = cpvMatches(tenderCpv, org.cpvCodes);
          const keywordMatch = org.keywords.length > 0 && org.keywords.some(kw =>
            title.toLowerCase().includes(kw.toLowerCase())
          );

          if (!cpvMatch && !keywordMatch) continue;

          // Skip if already exists
          const existing = await prisma.tender.findFirst({
            where: { seapId, organizationId: org.id },
          });
          if (existing) continue;

          // Calculate match score
          const matchScore = calculateMatchScore(tender, org);

          // Parse dates safely
          const pubDate = tender.noticeStateDate ? new Date(tender.noticeStateDate) : null;
          const deadline = tender.maxTenderReceiptDeadline
            ? new Date(tender.maxTenderReceiptDeadline)
            : tender.tenderReceiptDeadlineExport
              ? new Date(tender.tenderReceiptDeadlineExport)
              : null;

          // Create tender
          const created = await prisma.tender.create({
            data: {
              seapId,
              seapUrl: `https://e-licitatie.ro/pub/notices/ca-notice/v2/view/${seapId}`,
              title,
              description: tender.shortDescription || title,
              contractingAuth: tender.contractingAuthorityNameAndFN || 'Necunoscut',
              contractingAuthCui: tender.contractingAuthorityNameAndFN?.match(/^(\d+)/)?.[1] || null,
              estimatedValue: tender.ronContractValue ? new Decimal(tender.ronContractValue) : null,
              currency: tender.currencyCode || 'RON',
              cpvCode: tenderCpv,
              cpvCodes: tenderCpv ? [tenderCpv] : [],
              cpvDescription: tender.cpvCodeAndName || null,
              procedureType: tender.sysProcedureType?.text || 'necunoscut',
              contractType: tender.sysContractAssigmentType?.text || tender.sysAcquisitionContractType?.text || null,
              publicationDate: pubDate,
              submissionDeadline: deadline,
              status: 'NEW',
              matchScore,
              organizationId: org.id,
            },
          });

          result.createdTenderIds.push(created.id);
          result.tendersCreated++;
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          // Skip duplicate key errors silently
          if (!msg.includes('Unique constraint')) {
            result.errors.push(`Tender ${seapId}: ${msg}`);
          }
        }
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

  const tenderCpv = extractCpvCode(tender.cpvCodeAndName);

  // Exact CPV match = +25, 4-digit division match = +15
  if (org.cpvCodes.includes(tenderCpv)) {
    score += 25;
  } else if (org.cpvCodes.some(c => cpvDivision(c) === cpvDivision(tenderCpv))) {
    score += 15;
  }

  // Keyword match
  const title = (tender.contractTitle || '').toLowerCase();
  for (const keyword of org.keywords) {
    if (title.includes(keyword.toLowerCase())) {
      score += 10;
    }
  }

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
 * Quick scan — same as full scan (single API call is already fast)
 */
export async function runQuickScan(): Promise<ScanResult> {
  return runFullScan();
}
