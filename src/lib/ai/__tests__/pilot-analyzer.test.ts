/**
 * Smoke tests for pilot-analyzer.ts (IM Faza B #3 wiring).
 *
 * Verifies:
 *   - Flag off → routes to analyzeWithClaude (legacy), returns
 *     citations=[] and pilotPath="legacy".
 *   - Flag on  → routes to analyzeWithCitations, returns citations
 *     populated and pilotPath="citations".
 *   - Flag on + sibling fallback (citations.length=0) →
 *     fellBackToLegacy=true.
 *   - Telemetry log shape (single console.log per call, structured JSON).
 *   - Latency measured.
 *
 * No real Anthropic / Files API calls — both downstreams mocked.
 */

jest.mock("../analyzer", () => ({
  __esModule: true,
  analyzeWithClaude: jest.fn(),
}));

jest.mock("../analyzer-with-citations", () => ({
  __esModule: true,
  analyzeWithCitations: jest.fn(),
}));

import { runTenderAnalysis } from "../pilot-analyzer";
import { analyzeWithClaude } from "../analyzer";
import { analyzeWithCitations } from "../analyzer-with-citations";
import type { TenderForAnalysisWithPdfs } from "../analyzer-with-citations";
import type { AnalysisResult } from "../analyzer";

const mockedLegacy = analyzeWithClaude as jest.MockedFunction<typeof analyzeWithClaude>;
const mockedCitations = analyzeWithCitations as jest.MockedFunction<typeof analyzeWithCitations>;

function tenderFixture(): TenderForAnalysisWithPdfs {
  return {
    id: "tender-pilot",
    title: "Test tender",
    description: "Smoke test fixture",
    contractingAuth: "Primăria X",
    contractingAuthCui: "RO123",
    estimatedValue: 100_000,
    currency: "RON",
    cpvCode: "45214",
    cpvDescription: "Lucrări",
    procedureType: "Procedură deschisă",
    contractType: "Lucrări",
    publicationDate: new Date("2026-04-01"),
    submissionDeadline: new Date("2026-05-15"),
    organization: { name: "Org SRL", cui: "RO111", cpvCodes: [], keywords: [] },
    documents: [],
  };
}

function legacyResult(): AnalysisResult {
  return {
    strengths: ["s1"],
    weaknesses: ["w1"],
    opportunities: ["o1"],
    threats: ["t1"],
    recommendation: "CAUTION",
    aiSummary: "summary",
    aiNotes: "notes",
    qualificationReqs: null,
    technicalSpecs: null,
    evaluationCriteria: null,
    keyDates: null,
    modelUsed: "legacy-stub",
    confidence: 0.8,
  };
}

describe("pilot-analyzer — flag off (legacy path)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.SEAP_CITATIONS_PILOT_ENABLED;
  });

  test("invokes analyzeWithClaude when flag is unset", async () => {
    mockedLegacy.mockResolvedValueOnce(legacyResult());
    const result = await runTenderAnalysis(tenderFixture());
    expect(mockedLegacy).toHaveBeenCalledTimes(1);
    expect(mockedCitations).not.toHaveBeenCalled();
    expect(result.pilotPath).toBe("legacy");
    expect(result.citations).toEqual([]);
    expect(result.citedDocuments).toEqual([]);
    expect(result.fellBackToLegacy).toBe(false);
  });

  test("invokes legacy when flag is explicitly disabled (=0)", async () => {
    process.env.SEAP_CITATIONS_PILOT_ENABLED = "0";
    mockedLegacy.mockResolvedValueOnce(legacyResult());
    const result = await runTenderAnalysis(tenderFixture());
    expect(mockedLegacy).toHaveBeenCalledTimes(1);
    expect(mockedCitations).not.toHaveBeenCalled();
    expect(result.pilotPath).toBe("legacy");
  });

  test("propagates legacy errors", async () => {
    mockedLegacy.mockRejectedValueOnce(new Error("legacy failure"));
    await expect(runTenderAnalysis(tenderFixture())).rejects.toThrow("legacy failure");
  });
});

describe("pilot-analyzer — flag on (citations path)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.SEAP_CITATIONS_PILOT_ENABLED = "1";
  });

  afterEach(() => {
    delete process.env.SEAP_CITATIONS_PILOT_ENABLED;
  });

  test("invokes analyzeWithCitations and populates citations + citedDocuments", async () => {
    mockedCitations.mockResolvedValueOnce({
      ...legacyResult(),
      citations: [
        { _textBlockIndex: 0, page_location: { document_index: 0, start_page_number: 1, end_page_number: 1 } } as never,
      ],
      citedDocuments: ["fisa-date.pdf"],
    });
    const result = await runTenderAnalysis(tenderFixture());
    expect(mockedCitations).toHaveBeenCalledTimes(1);
    expect(mockedLegacy).not.toHaveBeenCalled();
    expect(result.pilotPath).toBe("citations");
    expect(result.citations.length).toBe(1);
    expect(result.citedDocuments).toEqual(["fisa-date.pdf"]);
    expect(result.fellBackToLegacy).toBe(false);
  });

  test("detects fellBackToLegacy when sibling returns empty citations", async () => {
    mockedCitations.mockResolvedValueOnce({
      ...legacyResult(),
      citations: [],
      citedDocuments: [],
    });
    const result = await runTenderAnalysis(tenderFixture());
    expect(result.pilotPath).toBe("citations");
    expect(result.fellBackToLegacy).toBe(true);
  });

  test("propagates hard failure when sibling throws", async () => {
    mockedCitations.mockRejectedValueOnce(new Error("API exhausted"));
    await expect(runTenderAnalysis(tenderFixture())).rejects.toThrow("API exhausted");
  });

  test("calls sibling with fallbackOnFailure=true (graceful default)", async () => {
    mockedCitations.mockResolvedValueOnce({
      ...legacyResult(),
      citations: [],
      citedDocuments: [],
    });
    await runTenderAnalysis(tenderFixture());
    expect(mockedCitations).toHaveBeenCalledWith(
      expect.objectContaining({ id: "tender-pilot" }),
      expect.objectContaining({ fallbackOnFailure: true }),
    );
  });
});

describe("pilot-analyzer — telemetry shape", () => {
  let logSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.SEAP_CITATIONS_PILOT_ENABLED;
    logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  test("emits one structured log line per legacy run", async () => {
    mockedLegacy.mockResolvedValueOnce(legacyResult());
    await runTenderAnalysis(tenderFixture());
    expect(logSpy).toHaveBeenCalledTimes(1);
    const logged = logSpy.mock.calls[0][0] as string;
    expect(logged).toContain("[seap-citations-pilot]");
    const json = JSON.parse(logged.replace("[seap-citations-pilot] ", ""));
    expect(json).toMatchObject({
      tenderId: "tender-pilot",
      path: "legacy",
      citationCount: 0,
      citedDocsCount: 0,
      fellBackToLegacy: false,
    });
    expect(typeof json.latencyMs).toBe("number");
    expect(typeof json.ts).toBe("string");
  });

  test("emits one structured log line per citations run", async () => {
    process.env.SEAP_CITATIONS_PILOT_ENABLED = "1";
    mockedCitations.mockResolvedValueOnce({
      ...legacyResult(),
      citations: [{ foo: "bar" } as never],
      citedDocuments: ["doc.pdf"],
    });
    await runTenderAnalysis(tenderFixture());
    expect(logSpy).toHaveBeenCalledTimes(1);
    const logged = logSpy.mock.calls[0][0] as string;
    const json = JSON.parse(logged.replace("[seap-citations-pilot] ", ""));
    expect(json).toMatchObject({
      tenderId: "tender-pilot",
      path: "citations",
      citationCount: 1,
      citedDocsCount: 1,
      fellBackToLegacy: false,
    });
  });
});
