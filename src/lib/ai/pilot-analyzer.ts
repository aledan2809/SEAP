/**
 * Pilot adapter — wraps analyzer.ts (legacy) and analyzer-with-citations.ts
 * (Files API + citations) behind a feature flag, with structured telemetry.
 *
 * Flag: SEAP_CITATIONS_PILOT_ENABLED=1 → route to citations path.
 * Default off → legacy analyzeWithClaude path (zero behavioral change).
 *
 * Telemetry: logged via console.log as structured JSON (survives in Vercel
 * + PM2 logs) and optionally appended to <SEAP>/logs/seap-citations-pilot.jsonl
 * when the file path is writable. Telemetry fields:
 *
 *   {
 *     ts, tenderId, path: "legacy"|"citations",
 *     latencyMs,
 *     citationCount,
 *     citedDocsCount,
 *     fellBackToLegacy: boolean,
 *     errorMessage?: string,
 *     modelUsed
 *   }
 *
 * Cost considerations (Files API path adds):
 *   - per upload: ~$0.05 / 10MB PDF (one-time per file)
 *   - per messages.create: same Sonnet/Opus cost as legacy
 *   - net: ~$0.05-$0.10 extra per tender depending on doc volume
 *
 * Live validation status: DEFERRED — requires Anthropic credit + sample
 * tenders with PDF documents. The wiring is opt-in via env flag, so
 * production stays on legacy path until the operator flips the flag.
 *
 * Closes IM Faza B item #3 wiring (consumer route + telemetry).
 */

import { analyzeWithClaude } from "./analyzer";
import type { TenderForAnalysis, AnalysisResult } from "./analyzer";
import {
  analyzeWithCitations,
  type AnalysisResultWithCitations,
  type TenderForAnalysisWithPdfs,
} from "./analyzer-with-citations";
import fs from "fs";
import path from "path";

export interface PilotAnalyzerResult extends AnalysisResult {
  /** Empty array on legacy path; populated on citations path. */
  citations: AnalysisResultWithCitations["citations"];
  /** Empty array on legacy path; populated on citations path. */
  citedDocuments: string[];
  /** Which path actually executed (after fallback resolution). */
  pilotPath: "legacy" | "citations";
  /** True when citations path attempted but fell back to legacy. */
  fellBackToLegacy: boolean;
}

interface TelemetryRecord {
  ts: string;
  tenderId: string;
  path: "legacy" | "citations";
  latencyMs: number;
  citationCount: number;
  citedDocsCount: number;
  fellBackToLegacy: boolean;
  errorMessage?: string;
  modelUsed: string;
}

const TELEMETRY_FILE = path.resolve(process.cwd(), "logs", "seap-citations-pilot.jsonl");

function isPilotEnabled(): boolean {
  return process.env.SEAP_CITATIONS_PILOT_ENABLED === "1";
}

function emitTelemetry(record: TelemetryRecord): void {
  // Always log structured JSON (Vercel + PM2 capture stdout).
  console.log(`[seap-citations-pilot] ${JSON.stringify(record)}`);
  // Best-effort append to local file (skip on Vercel where fs is read-only).
  try {
    const dir = path.dirname(TELEMETRY_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(TELEMETRY_FILE, JSON.stringify(record) + "\n", "utf8");
  } catch {
    // Vercel / read-only fs — console output is the durable record.
  }
}

/**
 * Run analysis through the pilot-aware path.
 *
 * - Flag off → analyzeWithClaude (legacy), citations=[], citedDocuments=[]
 * - Flag on  → analyzeWithCitations (Files API). On internal fallback,
 *   `fellBackToLegacy=true` and citations may still be empty if the
 *   sibling never reached the API.
 */
export async function runTenderAnalysis(
  tender: TenderForAnalysisWithPdfs,
): Promise<PilotAnalyzerResult> {
  const start = Date.now();

  if (!isPilotEnabled()) {
    // Legacy path — preserve existing behavior exactly.
    let result: AnalysisResult;
    let errorMessage: string | undefined;
    try {
      result = await analyzeWithClaude(tender);
    } catch (err) {
      errorMessage = (err as Error)?.message;
      throw err;
    } finally {
      emitTelemetry({
        ts: new Date().toISOString(),
        tenderId: tender.id,
        path: "legacy",
        latencyMs: Date.now() - start,
        citationCount: 0,
        citedDocsCount: 0,
        fellBackToLegacy: false,
        errorMessage,
        modelUsed: "legacy",
      });
    }
    return {
      ...result!,
      citations: [],
      citedDocuments: [],
      pilotPath: "legacy",
      fellBackToLegacy: false,
    };
  }

  // Pilot path — citations enabled.
  let citations: AnalysisResultWithCitations;
  let errorMessage: string | undefined;
  try {
    citations = await analyzeWithCitations(tender, { fallbackOnFailure: true });
  } catch (err) {
    errorMessage = (err as Error)?.message;
    // Bubble — sibling's fallbackOnFailure=true means this is a hard fail.
    emitTelemetry({
      ts: new Date().toISOString(),
      tenderId: tender.id,
      path: "citations",
      latencyMs: Date.now() - start,
      citationCount: 0,
      citedDocsCount: 0,
      fellBackToLegacy: false,
      errorMessage,
      modelUsed: "unknown",
    });
    throw err;
  }

  // Detect whether the sibling fell back to legacy internally — its
  // contract is to return citations=[] when no Files API call succeeded.
  // citedDocuments may still be populated if uploads succeeded but the
  // messages.create failed; so we treat citations.length>0 as "real
  // citations path executed".
  const fellBack = citations.citations.length === 0;

  emitTelemetry({
    ts: new Date().toISOString(),
    tenderId: tender.id,
    path: "citations",
    latencyMs: Date.now() - start,
    citationCount: citations.citations.length,
    citedDocsCount: citations.citedDocuments.length,
    fellBackToLegacy: fellBack,
    errorMessage,
    modelUsed: citations.modelUsed,
  });

  return {
    ...citations,
    pilotPath: "citations",
    fellBackToLegacy: fellBack,
  };
}

// Re-exports so consumers can import everything from one place.
export { analyzeWithClaude } from "./analyzer";
export type { TenderForAnalysis, AnalysisResult } from "./analyzer";
export type { TenderForAnalysisWithPdfs } from "./analyzer-with-citations";
