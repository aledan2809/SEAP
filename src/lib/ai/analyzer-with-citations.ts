/**
 * analyzer-with-citations.ts — SEAP tender analyzer with Anthropic Files API + citations.
 *
 * SIBLING of analyzer.ts. The original analyzer.ts is intentionally NOT modified
 * (CLAUDE.md "DO NOT MODIFY: SWOT analysis prompt structure in analyzer.ts").
 * This module is the new "menu item" — opt-in path that uses Anthropic's Files
 * API to upload tender PDFs natively, then receives back SWOT analysis with
 * exact citations (page / paragraph) instead of opaque "Claude said X".
 *
 * What this adds over analyzer.ts:
 *   - PDF goes directly to Anthropic — no pre-OCR step. Claude reads the PDF
 *     itself, with native fidelity (tables, columns, formatting preserved).
 *   - Returns a `citations` array. Each citation points to the exact page +
 *     phrase Claude used to derive a finding. Critical for tender review where
 *     a procurement officer must justify GO / NO_GO decisions.
 *   - Removes the 10k-char-per-doc OCR truncation in analyzer.ts that loses
 *     context on long technical specs.
 *
 * What stays the same:
 *   - Same `TenderForAnalysis` input shape (extended optionally with PDF refs).
 *   - Same `AnalysisResult` output shape (drop-in compatible).
 *   - Same JSON SWOT structure expected back from Claude.
 *   - Same Romanian language, same recommendation taxonomy (GO / CAUTION / NO_GO).
 *   - Falls back to the original `analyzeWithClaude` from analyzer.ts on any
 *     Files-API-side failure — zero loss of capability vs the old path.
 *
 * Opt-in: callers set `useCitations: true` (or check an env flag) and pass
 * documents with PDF references (URL / base64 / pre-uploaded fileId).
 */

import { analyzeWithClaude } from "./analyzer";
import type { TenderForAnalysis, AnalysisResult } from "./analyzer";

// ── Anthropic Files API constants ────────────────────────────────────────────

const ANTHROPIC_API_VERSION = "2023-06-01";
const ANTHROPIC_FILES_BETA = "files-api-2025-04-14";
const FILES_URL = "https://api.anthropic.com/v1/files";
const MESSAGES_URL = "https://api.anthropic.com/v1/messages";

// ── Public types — extend the analyzer.ts shape ──────────────────────────────

/**
 * One citation block returned by Anthropic when citations are enabled.
 * `_textBlockIndex` is added by us so callers can realign with the
 * containing assistant text block.
 */
export interface TenderCitation {
  type: string;
  cited_text?: string;
  document_index?: number;
  document_title?: string;
  start_page_number?: number;
  end_page_number?: number;
  start_char_index?: number;
  end_char_index?: number;
  start_block_index?: number;
  end_block_index?: number;
  _textBlockIndex?: number;
}

/**
 * Input shape: same as TenderForAnalysis but each document MAY carry one of
 * three PDF references for the Files API. If none are provided for a doc,
 * the doc is skipped (we fall back to the OCR-text path of analyzer.ts).
 */
export interface TenderForAnalysisWithPdfs extends TenderForAnalysis {
  documents: Array<TenderForAnalysis["documents"][number] & {
    pdfUrl?: string;
    pdfBase64?: string;
    fileId?: string;
  }>;
}

export interface AnalysisResultWithCitations extends AnalysisResult {
  citations: TenderCitation[];
  /** Names of files that contributed to the analysis (for traceability). */
  citedDocuments: string[];
}

// ── Citation-aware system prompt ─────────────────────────────────────────────
//
// Mirrors the spirit of analyzer.ts's SYSTEM_PROMPT but instructs Claude to
// READ the attached PDFs natively and to back every finding with a citation.
// Kept local rather than imported so analyzer.ts stays untouched.

const CITATION_SYSTEM_PROMPT = `Ești un expert în achiziții publice din România, specializat în analiza licitațiilor de pe SEAP. Vei primi documentele licitației ca PDF-uri atașate; folosește direct conținutul lor (citatele revin automat). Răspunzi întotdeauna în limba română.

Pentru fiecare punct de analiză (forță, slăbiciune, oportunitate, amenințare, recomandare) bazează-te EXCLUSIV pe text concret din documentele atașate. Nu inventa cifre sau cerințe care nu există în documente. Dacă o informație lipsește, spune explicit "documentația nu menționează".

Analizează cu atenție:
1. Cerințele de calificare (cifra de afaceri, experiență similară, personal)
2. Specificațiile tehnice — restrictive vs deschise, marca/modelul impus vs neutru
3. Termenele limită și fezabilitatea lor
4. Criteriile de atribuire (preț minim vs raport calitate-preț)
5. Riscuri și oportunități legale/comerciale

Răspunzi cu JSON strict, fără markdown sau explicații.`;

// ── Auth helper ──────────────────────────────────────────────────────────────

function getAnthropicKey(): string | null {
  return process.env.ANTHROPIC_API_KEY || null;
}

// ── PDF upload — three input modes ───────────────────────────────────────────

interface UploadResult {
  fileId: string;
  filename: string;
  // Original doc reference for citation back-mapping.
  docType: string;
}

async function uploadOneDoc(
  doc: TenderForAnalysisWithPdfs["documents"][number],
  apiKey: string
): Promise<UploadResult | null> {
  if (doc.fileId) {
    return { fileId: doc.fileId, filename: doc.filename, docType: doc.docType };
  }

  let blob: Blob;
  let mime = "application/pdf";

  if (doc.pdfBase64) {
    const bytes = Uint8Array.from(atob(doc.pdfBase64), (c) => c.charCodeAt(0));
    blob = new Blob([bytes], { type: mime });
  } else if (doc.pdfUrl) {
    const res = await fetch(doc.pdfUrl);
    if (!res.ok) throw new Error(`fetch ${doc.pdfUrl}: ${res.status}`);
    const buf = await res.arrayBuffer();
    mime = res.headers.get("content-type") || mime;
    blob = new Blob([buf], { type: mime });
  } else {
    return null; // No PDF reference — caller did not provide one.
  }

  const form = new FormData();
  form.append("file", blob, doc.filename);

  const upload = await fetch(FILES_URL, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": ANTHROPIC_API_VERSION,
      "anthropic-beta": ANTHROPIC_FILES_BETA,
    },
    body: form,
  });
  if (!upload.ok) {
    const text = await upload.text();
    throw new Error(`Files API upload ${upload.status}: ${text.slice(0, 300)}`);
  }
  const data = (await upload.json()) as { id: string };
  return { fileId: data.id, filename: doc.filename, docType: doc.docType };
}

// ── Build the user message: tender metadata + document references ────────────

function buildUserMessageWithDocs(
  tender: TenderForAnalysisWithPdfs,
  uploads: UploadResult[]
): Array<Record<string, unknown>> {
  // Tender metadata block — same fields the original prompt surfaces.
  const deadline = tender.submissionDeadline
    ? new Date(tender.submissionDeadline).toLocaleDateString("ro-RO")
    : "Necunoscut";
  const daysRemaining = tender.submissionDeadline
    ? Math.ceil(
        (new Date(tender.submissionDeadline).getTime() - Date.now()) /
          (1000 * 60 * 60 * 24)
      )
    : null;

  const metadataText = `Analizează această licitație pentru firma "${tender.organization.name}" (CUI: ${tender.organization.cui}).

## Informații Licitație
- Titlu: ${tender.title}
- Descriere: ${tender.description || "N/A"}
- Autoritate Contractantă: ${tender.contractingAuth}${tender.contractingAuthCui ? ` (CUI: ${tender.contractingAuthCui})` : ""}
- Valoare Estimată: ${tender.estimatedValue ? `${tender.estimatedValue} ${tender.currency}` : "Nedefinită"}
- Cod CPV: ${tender.cpvCode}${tender.cpvDescription ? ` — ${tender.cpvDescription}` : ""}
- Tip Procedură: ${tender.procedureType}
- Tip Contract: ${tender.contractType || "N/A"}
- Termen Depunere: ${deadline}${daysRemaining !== null ? ` (${daysRemaining} zile rămase)` : ""}

## Profilul Firmei Noastre
- Coduri CPV de activitate: ${tender.organization.cpvCodes.join(", ") || "Nespecificate"}
- Cuvinte cheie de interes: ${tender.organization.keywords.join(", ") || "Nespecificate"}

## Instrucțiuni
Citește documentele atașate (vezi blocurile document de mai jos) și produci răspuns cu această structură JSON exactă:

{
  "strengths": ["..."],
  "weaknesses": ["..."],
  "opportunities": ["..."],
  "threats": ["..."],
  "recommendation": "GO" | "CAUTION" | "NO_GO",
  "aiSummary": "Rezumat 2-3 propoziții.",
  "aiNotes": "Note adiționale.",
  "qualificationReqs": { "cifraAfaceri": "...", "experientaSimilara": "...", "personal": "..." },
  "technicalSpecs": { "descriere": "...", "restrictive": true|false },
  "evaluationCriteria": { "tip": "pret_minim" | "calitate_pret", "ponderi": {} },
  "keyDates": { "depunere": "...", "deschidere": null, "altele": [] },
  "confidence": 0.0-1.0
}`;

  const blocks: Array<Record<string, unknown>> = [
    { type: "text", text: metadataText },
  ];

  for (const u of uploads) {
    blocks.push({
      type: "document",
      source: { type: "file", file_id: u.fileId },
      title: u.filename,
      context: u.docType,
      citations: { enabled: true },
    });
  }

  blocks.push({
    type: "text",
    text: "Răspunde acum cu JSON-ul descris mai sus, citând explicit pasajele din documente pentru fiecare punct.",
  });

  return blocks;
}

// ── Response parsing — text + citations + JSON extraction ────────────────────

interface ParsedResponse {
  text: string;
  citations: TenderCitation[];
  tokens: { input: number; output: number; cacheRead: number; cacheCreation: number };
  stopReason: string | null;
}

function parseAnthropicResponse(data: Record<string, unknown>): ParsedResponse {
  const content = Array.isArray(data.content) ? (data.content as Array<Record<string, unknown>>) : [];
  const parts: string[] = [];
  const citations: TenderCitation[] = [];
  for (let i = 0; i < content.length; i++) {
    const block = content[i];
    if (block?.type === "text") {
      const t = typeof block.text === "string" ? block.text : "";
      parts.push(t);
      const cs = Array.isArray(block.citations) ? (block.citations as TenderCitation[]) : [];
      for (const c of cs) citations.push({ ...c, _textBlockIndex: i });
    }
  }
  const usage = (data.usage as Record<string, number>) || {};
  return {
    text: parts.join(""),
    citations,
    tokens: {
      input: usage.input_tokens || 0,
      output: usage.output_tokens || 0,
      cacheRead: usage.cache_read_input_tokens || 0,
      cacheCreation: usage.cache_creation_input_tokens || 0,
    },
    stopReason: typeof data.stop_reason === "string" ? data.stop_reason : null,
  };
}

function extractJson(text: string): Record<string, unknown> | null {
  if (!text) return null;
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonText = fence ? fence[1].trim() : text;
  // Try a curly-brace span if no fence
  const candidate = jsonText.match(/\{[\s\S]*\}/);
  if (!candidate) return null;
  try {
    return JSON.parse(candidate[0]);
  } catch {
    return null;
  }
}

// ── Validators (mirror analyzer.ts contract) ─────────────────────────────────

function validateRecommendation(value: unknown): "GO" | "CAUTION" | "NO_GO" {
  if (value === "GO" || value === "CAUTION" || value === "NO_GO") return value;
  return "CAUTION";
}

function buildResultFromParsed(
  parsed: Record<string, unknown>,
  modelUsed: string
): AnalysisResult {
  return {
    strengths: Array.isArray(parsed.strengths) ? (parsed.strengths as string[]) : [],
    weaknesses: Array.isArray(parsed.weaknesses) ? (parsed.weaknesses as string[]) : [],
    opportunities: Array.isArray(parsed.opportunities) ? (parsed.opportunities as string[]) : [],
    threats: Array.isArray(parsed.threats) ? (parsed.threats as string[]) : [],
    recommendation: validateRecommendation(parsed.recommendation),
    aiSummary: typeof parsed.aiSummary === "string" ? parsed.aiSummary : "Analiză finalizată.",
    aiNotes: typeof parsed.aiNotes === "string" ? parsed.aiNotes : null,
    qualificationReqs:
      parsed.qualificationReqs && typeof parsed.qualificationReqs === "object"
        ? (parsed.qualificationReqs as Record<string, unknown>)
        : null,
    technicalSpecs:
      parsed.technicalSpecs && typeof parsed.technicalSpecs === "object"
        ? (parsed.technicalSpecs as Record<string, unknown>)
        : null,
    evaluationCriteria:
      parsed.evaluationCriteria && typeof parsed.evaluationCriteria === "object"
        ? (parsed.evaluationCriteria as Record<string, unknown>)
        : null,
    keyDates:
      parsed.keyDates && typeof parsed.keyDates === "object"
        ? (parsed.keyDates as Record<string, unknown>)
        : null,
    confidence:
      typeof parsed.confidence === "number" ? Math.min(1, Math.max(0, parsed.confidence)) : 0.75,
    modelUsed,
  };
}

// ── Public API ───────────────────────────────────────────────────────────────

export interface AnalyzeWithCitationsOptions {
  /**
   * Override the default Sonnet 4.5 model. Citations require Sonnet 3.5+
   * or Opus 4.x.
   */
  model?: string;
  /** Max tokens for the assistant response. */
  maxTokens?: number;
  /** Optional pre-uploaded file IDs keyed by filename, to skip re-uploads. */
  preUploadedFileIds?: Record<string, string>;
  /**
   * If true, when Files API is unavailable, fall back silently to the
   * legacy analyzer.ts. Default true. Set false to bubble errors.
   */
  fallbackOnFailure?: boolean;
}

const DEFAULT_MODEL = "claude-sonnet-4-5-20250929";

export async function analyzeWithCitations(
  tender: TenderForAnalysisWithPdfs,
  options: AnalyzeWithCitationsOptions = {}
): Promise<AnalysisResultWithCitations> {
  const apiKey = getAnthropicKey();
  if (!apiKey) {
    if (options.fallbackOnFailure !== false) {
      const fallback = await analyzeWithClaude(tender);
      return { ...fallback, citations: [], citedDocuments: [] };
    }
    throw new Error("ANTHROPIC_API_KEY not set; cannot use Files API path.");
  }

  // Step 1: upload (or reuse) every document that has a PDF reference.
  const uploads: UploadResult[] = [];
  for (const doc of tender.documents) {
    try {
      // Honor pre-uploaded IDs if the caller cached them.
      const cachedId = options.preUploadedFileIds?.[doc.filename];
      const docInput = cachedId ? { ...doc, fileId: cachedId } : doc;
      const u = await uploadOneDoc(docInput, apiKey);
      if (u) uploads.push(u);
    } catch (err) {
      console.error(`[analyzer-with-citations] upload failed for ${doc.filename}:`, err);
      // Continue with the docs we have — partial coverage is better than none.
    }
  }

  if (uploads.length === 0) {
    // No PDFs uploaded successfully — fall back to original analyzer (it has
    // its own OCR-text path and rule-based fallback).
    if (options.fallbackOnFailure !== false) {
      const fallback = await analyzeWithClaude(tender);
      return { ...fallback, citations: [], citedDocuments: [] };
    }
    throw new Error("No documents could be uploaded to Files API; aborting.");
  }

  // Step 2: messages.create with documents + citations enabled.
  const body = {
    model: options.model || DEFAULT_MODEL,
    max_tokens: options.maxTokens || 4096,
    system: CITATION_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: buildUserMessageWithDocs(tender, uploads),
      },
    ],
  };

  let parsed: ParsedResponse;
  try {
    const res = await fetch(MESSAGES_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": ANTHROPIC_API_VERSION,
        "anthropic-beta": ANTHROPIC_FILES_BETA,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Anthropic messages ${res.status}: ${errText.slice(0, 300)}`);
    }
    parsed = parseAnthropicResponse((await res.json()) as Record<string, unknown>);
  } catch (err) {
    console.error("[analyzer-with-citations] messages.create failed:", err);
    if (options.fallbackOnFailure !== false) {
      const fallback = await analyzeWithClaude(tender);
      return { ...fallback, citations: [], citedDocuments: uploads.map((u) => u.filename) };
    }
    throw err;
  }

  // Step 3: extract JSON from the response, build AnalysisResult, attach citations.
  const json = extractJson(parsed.text);
  if (!json) {
    if (options.fallbackOnFailure !== false) {
      const fallback = await analyzeWithClaude(tender);
      return {
        ...fallback,
        citations: parsed.citations,
        citedDocuments: uploads.map((u) => u.filename),
      };
    }
    throw new Error("Citations path returned no parseable JSON; cannot derive AnalysisResult.");
  }

  const base = buildResultFromParsed(json, options.model || DEFAULT_MODEL);
  return {
    ...base,
    citations: parsed.citations,
    citedDocuments: uploads.map((u) => u.filename),
  };
}

// ── Internals exposed for tests ──────────────────────────────────────────────

export const _internals = {
  parseAnthropicResponse,
  extractJson,
  buildResultFromParsed,
  buildUserMessageWithDocs,
  validateRecommendation,
  CITATION_SYSTEM_PROMPT,
  DEFAULT_MODEL,
};
