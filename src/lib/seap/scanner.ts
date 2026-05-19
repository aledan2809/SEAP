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
  tendersSkipped: number;
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

  // Deduplicate by caNoticeId or noticeNo
  const seen = new Set<string>();
  const all: SeapTender[] = [];
  for (const item of [...caItems, ...cnItems]) {
    const rawId = item.caNoticeId || item.noticeNo;
    if (!rawId) continue;
    const id = String(rawId);
    if (!seen.has(id)) {
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
 * Short codes (1-3 digits) are excluded — too broad (e.g. "30" = all office equipment).
 * 4-digit division codes (e.g. "7220") are valid and supported.
 */
function cpvMatches(tenderCpv: string, orgCpvCodes: string[]): boolean {
  if (orgCpvCodes.length === 0) return true; // No filter = match all
  if (!tenderCpv) return false; // Tender has no CPV — cannot match any filter
  const tDiv = cpvDivision(tenderCpv);
  return orgCpvCodes.some(orgCpv => {
    if (tenderCpv === orgCpv) return true;
    // 4-digit division codes are the minimum precision allowed (CPV group level)
    // Shorter codes (1-3 chars) are excluded — too broad
    if (orgCpv.length >= 4 && cpvDivision(orgCpv) === tDiv) return true;
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
    tendersSkipped: 0,
    createdTenderIds: [],
    errors: [],
  };

  try {
    // 1. Get organizations with CPV codes
    const organizations = await prisma.organization.findMany({
      where: { cpvCodes: { isEmpty: false } },
    });

    if (organizations.length === 0) {
      // No orgs have CPV codes configured — use first org without filter
      // (cpvMatches with empty codes returns true = match all tenders)
      // Pushing ALL orgs would create duplicate tenders per org; use only first.
      const firstOrg = await prisma.organization.findFirst({ orderBy: { createdAt: 'asc' } });
      if (!firstOrg) {
        result.errors.push('Nu există organizații');
        return result;
      }
      organizations.push(firstOrg);
    }

    // 2. Single fast SEAP API call (most recent 1000 tenders)
    console.log(`Fetching latest tenders from SEAP...`);
    const seapTenders = await fetchSeapTenders(1000);

    if (seapTenders.length === 0) {
      result.errors.push('SEAP API nu a returnat rezultate');
      return result;
    }

    result.tendersFound = seapTenders.length;
    console.log(`Fetched ${seapTenders.length} tenders from SEAP`);

    // Pre-fetch existing seapIds per org to avoid N+1 queries inside the loop
    const existingByOrg = new Map<string, Set<string>>();
    for (const org of organizations) {
      const rows = await prisma.tender.findMany({
        where: { organizationId: org.id },
        select: { seapId: true },
      });
      existingByOrg.set(org.id, new Set(rows.map(r => r.seapId)));
    }

    // 3. Process tenders — match to organizations
    for (const tender of seapTenders) {
      const rawId = tender.caNoticeId || tender.noticeNo;
      if (!rawId) continue;
      const seapId = String(rawId);

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

          // Skip if already exists (O(1) lookup via pre-fetched set)
          if (existingByOrg.get(org.id)?.has(seapId)) {
            result.tendersSkipped++;
            continue;
          }

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
              seapUrl: tender.caNoticeId
                ? `https://e-licitatie.ro/pub/notices/ca-notice/v2/view/${seapId}`
                : `https://e-licitatie.ro/pub/notices/c-notice/v2/view/${seapId}`,
              title,
              description: tender.shortDescription || title,
              contractingAuth: tender.contractingAuthorityNameAndFN || 'Necunoscut',
              contractingAuthCui: tender.contractingAuthorityCUI || tender.contractingAuthorityNameAndFN?.match(/^(\d+)/)?.[1] || null,
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
          existingByOrg.get(org.id)?.add(seapId);
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
  if (!tenderCpv) return score; // no CPV to score on

  // Exact CPV match = +25, 4-digit division match = +15 (mirrors cpvMatches guard)
  if (org.cpvCodes.includes(tenderCpv)) {
    score += 25;
  } else if (org.cpvCodes.some(c => c.length >= 4 && cpvDivision(c) === cpvDivision(tenderCpv))) {
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
