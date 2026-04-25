/**
 * Smoke tests for analyzer-with-citations.ts. Exercises the pure parsing
 * + transformation helpers and the orchestration path against a mocked
 * fetch. No real Anthropic API calls — those require credits + uploaded
 * PDFs and are deferred to the manual integration session.
 */

// Mock the legacy analyzer at module load time so the orchestration tests
// can drive the fallback path without going through Claude CLI / AIRouter /
// rule-based cascade. Per-test overrides via mockImplementation below.
jest.mock("../analyzer", () => ({
  __esModule: true,
  analyzeWithClaude: jest.fn(),
}));

import {
  _internals,
  analyzeWithCitations,
  type AnalysisResultWithCitations,
  type TenderForAnalysisWithPdfs,
} from "../analyzer-with-citations";
import { analyzeWithClaude } from "../analyzer";

const mockedLegacyAnalyzer = analyzeWithClaude as jest.MockedFunction<typeof analyzeWithClaude>;

const {
  parseAnthropicResponse,
  extractJson,
  buildResultFromParsed,
  buildUserMessageWithDocs,
  validateRecommendation,
} = _internals;

function tenderFixture(): TenderForAnalysisWithPdfs {
  return {
    id: "tender-1",
    title: "Construire grădiniță",
    description: "Construire grădiniță cu 4 grupe în comuna X",
    contractingAuth: "Primăria X",
    contractingAuthCui: "RO12345678",
    estimatedValue: 1_500_000,
    currency: "RON",
    cpvCode: "45214100",
    cpvDescription: "Lucrări de construcții pentru grădinițe",
    procedureType: "Procedură deschisă",
    contractType: "Lucrări",
    publicationDate: new Date("2026-04-01"),
    submissionDeadline: new Date("2026-05-15"),
    organization: {
      name: "ConstructPro SRL",
      cui: "RO11111",
      cpvCodes: ["45214"],
      keywords: ["construcții", "școli", "grădinițe"],
    },
    documents: [
      {
        filename: "fisa-date.pdf",
        docType: "fișa-date",
        ocrText: "OCR fallback text — long…",
        pdfBase64: Buffer.from("fake-pdf-bytes").toString("base64"),
      },
      {
        filename: "caiet-sarcini.pdf",
        docType: "caiet-sarcini",
        ocrText: null,
        pdfUrl: "https://example.com/caiet-sarcini.pdf",
      },
    ],
  };
}

describe("analyzer-with-citations — internals", () => {
  test("validateRecommendation accepts valid values", () => {
    expect(validateRecommendation("GO")).toBe("GO");
    expect(validateRecommendation("CAUTION")).toBe("CAUTION");
    expect(validateRecommendation("NO_GO")).toBe("NO_GO");
  });

  test("validateRecommendation defaults to CAUTION on garbage", () => {
    expect(validateRecommendation("MAYBE")).toBe("CAUTION");
    expect(validateRecommendation(null)).toBe("CAUTION");
    expect(validateRecommendation(42)).toBe("CAUTION");
  });

  test("extractJson handles fenced code block", () => {
    const out = extractJson("Some prose\n```json\n{\"a\":1}\n```\nmore prose");
    expect(out).toEqual({ a: 1 });
  });

  test("extractJson handles raw object span", () => {
    const out = extractJson("preamble {\"a\":1,\"b\":[2,3]} suffix");
    expect(out).toEqual({ a: 1, b: [2, 3] });
  });

  test("extractJson returns null on no JSON", () => {
    expect(extractJson("hello world")).toBeNull();
    expect(extractJson("")).toBeNull();
  });

  test("parseAnthropicResponse flattens text + collects citations with block index", () => {
    const data = {
      content: [
        {
          type: "text",
          text: "Punct tare 1: ",
          citations: [
            { type: "page_location", cited_text: "art. 5", document_index: 0, document_title: "fisa-date.pdf", start_page_number: 2 },
          ],
        },
        { type: "tool_use", id: "x", name: "y", input: {} },
        {
          type: "text",
          text: "punct tare 2.",
          citations: [{ type: "page_location", cited_text: "alin (2)" }],
        },
      ],
      usage: { input_tokens: 500, output_tokens: 80, cache_read_input_tokens: 200 },
      stop_reason: "end_turn",
    };
    const parsed = parseAnthropicResponse(data);
    expect(parsed.text).toBe("Punct tare 1: punct tare 2.");
    expect(parsed.citations).toHaveLength(2);
    expect(parsed.citations[0]._textBlockIndex).toBe(0);
    expect(parsed.citations[1]._textBlockIndex).toBe(2);
    expect(parsed.tokens).toEqual({ input: 500, output: 80, cacheRead: 200, cacheCreation: 0 });
    expect(parsed.stopReason).toBe("end_turn");
  });

  test("parseAnthropicResponse handles missing/empty content", () => {
    expect(parseAnthropicResponse({}).text).toBe("");
    expect(parseAnthropicResponse({ content: "not array" }).citations).toEqual([]);
  });

  test("buildUserMessageWithDocs assembles metadata + document blocks", () => {
    const tender = tenderFixture();
    const blocks = buildUserMessageWithDocs(tender, [
      { fileId: "file_1", filename: "fisa-date.pdf", docType: "fișa-date" },
      { fileId: "file_2", filename: "caiet-sarcini.pdf", docType: "caiet-sarcini" },
    ]);
    expect(blocks[0]).toMatchObject({ type: "text" });
    expect((blocks[0] as { text: string }).text).toContain(tender.title);
    expect((blocks[0] as { text: string }).text).toContain("ConstructPro SRL");
    expect(blocks[1]).toMatchObject({ type: "document", source: { type: "file", file_id: "file_1" } });
    expect((blocks[1] as { citations: { enabled: boolean } }).citations.enabled).toBe(true);
    expect(blocks[2]).toMatchObject({ type: "document", source: { type: "file", file_id: "file_2" } });
    expect(blocks[blocks.length - 1]).toMatchObject({ type: "text" });
  });

  test("buildResultFromParsed produces drop-in compatible AnalysisResult shape", () => {
    const out = buildResultFromParsed(
      {
        strengths: ["a"],
        weaknesses: ["b"],
        opportunities: ["c"],
        threats: ["d"],
        recommendation: "GO",
        aiSummary: "ok",
        aiNotes: "notes",
        confidence: 0.9,
      },
      "claude-sonnet-4-5"
    );
    expect(out.recommendation).toBe("GO");
    expect(out.confidence).toBe(0.9);
    expect(out.modelUsed).toBe("claude-sonnet-4-5");
    expect(out.qualificationReqs).toBeNull();
  });

  test("buildResultFromParsed clamps confidence to [0,1]", () => {
    expect(buildResultFromParsed({ confidence: 5 }, "m").confidence).toBe(1);
    expect(buildResultFromParsed({ confidence: -0.5 }, "m").confidence).toBe(0);
  });
});

describe("analyzer-with-citations — orchestration via mocked fetch", () => {
  const realFetch = global.fetch;
  const realKey = process.env.ANTHROPIC_API_KEY;

  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-test";
  });

  afterEach(() => {
    global.fetch = realFetch;
    if (realKey === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = realKey;
    jest.restoreAllMocks();
  });

  test("happy path: 2 docs upload then messages.create returns SWOT + citations", async () => {
    const calls: Array<{ url: string; init: RequestInit | undefined }> = [];
    global.fetch = jest.fn(async (url: unknown, init?: RequestInit) => {
      calls.push({ url: String(url), init });
      const u = String(url);
      if (u.includes("/v1/files")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ id: `file_${calls.length}`, type: "file", filename: "x.pdf" }),
          text: async () => "",
        } as Response;
      }
      if (u.includes("example.com")) {
        return {
          ok: true,
          status: 200,
          headers: { get: (_h: string) => "application/pdf" } as unknown as Headers,
          arrayBuffer: async () => new ArrayBuffer(8),
          text: async () => "",
          json: async () => ({}),
        } as Response;
      }
      // messages
      return {
        ok: true,
        status: 200,
        json: async () => ({
          content: [
            {
              type: "text",
              text: "```json\n{\"strengths\":[\"CPV match\"],\"weaknesses\":[],\"opportunities\":[],\"threats\":[],\"recommendation\":\"GO\",\"aiSummary\":\"OK\",\"confidence\":0.85}\n```",
              citations: [
                { type: "page_location", cited_text: "art. 5", document_index: 0, document_title: "fisa-date.pdf", start_page_number: 2 },
              ],
            },
          ],
          stop_reason: "end_turn",
          usage: { input_tokens: 1000, output_tokens: 100 },
        }),
        text: async () => "",
      } as Response;
    }) as unknown as typeof fetch;

    const result = await analyzeWithCitations(tenderFixture());

    expect(result.recommendation).toBe("GO");
    expect(result.strengths).toEqual(["CPV match"]);
    expect(result.confidence).toBe(0.85);
    expect(result.citations).toHaveLength(1);
    expect(result.citations[0].cited_text).toBe("art. 5");
    expect(result.citedDocuments).toEqual(["fisa-date.pdf", "caiet-sarcini.pdf"]);
    // 1 upload (base64 doc) + 1 fetch-PDF-from-URL + 1 upload (URL doc) + 1 messages
    expect(calls).toHaveLength(4);
    expect(calls.filter((c) => c.url.includes("/v1/files"))).toHaveLength(2);
    expect(calls.filter((c) => c.url.includes("/v1/messages"))).toHaveLength(1);
  });

  test("falls back to legacy analyzeWithClaude when ANTHROPIC_API_KEY missing", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    mockedLegacyAnalyzer.mockResolvedValueOnce({
      strengths: ["fallback"],
      weaknesses: [],
      opportunities: [],
      threats: [],
      recommendation: "CAUTION",
      aiSummary: "fb",
      aiNotes: null,
      qualificationReqs: null,
      technicalSpecs: null,
      evaluationCriteria: null,
      keyDates: null,
      confidence: 0.5,
      modelUsed: "rule-based",
    });
    const result = await analyzeWithCitations(tenderFixture());
    expect(result.recommendation).toBe("CAUTION");
    expect(result.modelUsed).toBe("rule-based");
    expect(result.citations).toEqual([]);
    expect(result.citedDocuments).toEqual([]);
    expect(mockedLegacyAnalyzer).toHaveBeenCalledTimes(1);
  });

  test("falls back when all uploads fail", async () => {
    global.fetch = jest.fn(async (url: unknown) => {
      if (String(url).includes("/v1/files")) {
        return { ok: false, status: 500, text: async () => "upload boom", json: async () => ({}) } as Response;
      }
      return { ok: true, status: 200, text: async () => "", json: async () => ({}) } as Response;
    }) as unknown as typeof fetch;

    mockedLegacyAnalyzer.mockResolvedValueOnce({
      strengths: [], weaknesses: [], opportunities: [], threats: [],
      recommendation: "NO_GO",
      aiSummary: "fallback after upload failure",
      aiNotes: null, qualificationReqs: null, technicalSpecs: null,
      evaluationCriteria: null, keyDates: null,
      confidence: 0.3, modelUsed: "rule-based-after-upload-fail",
    });
    // Tender with only pdfUrl docs so they MUST go through the upload path.
    const tender = tenderFixture();
    tender.documents.forEach((d) => { d.fileId = undefined; });
    const result = await analyzeWithCitations(tender);
    expect(result.modelUsed).toBe("rule-based-after-upload-fail");
    expect(result.citations).toEqual([]);
  });
});
