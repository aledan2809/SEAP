import { NextRequest } from 'next/server';

jest.mock('@/lib/db', () => ({
  prisma: {
    tender: { findFirst: jest.fn(), update: jest.fn() },
    tenderAnalysis: { upsert: jest.fn() },
    auditLog: { create: jest.fn() },
  },
}));
jest.mock('@/lib/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/ai/analyzer', () => ({ analyzeWithClaude: jest.fn() }));
jest.mock('@/lib/rate-limit', () => ({
  checkRateLimit: jest.fn(() => ({ allowed: true, remaining: 10, resetAt: Date.now() + 60000 })),
  RATE_LIMITS: { api: {}, sensitive: {}, scan: {}, analysis: {}, cron: {}, auth: {}, webhook: {} },
  getClientIp: jest.fn(() => '127.0.0.1'),
}));
jest.mock('@/lib/audit-log', () => ({
  logAction: jest.fn(),
  AuditActions: { ANALYSIS_RUN: 'ANALYSIS_RUN' },
}));

import { POST } from '@/app/api/tenders/[id]/analyze/route';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { analyzeWithClaude } from '@/lib/ai/analyzer';

const mockAuth = auth as jest.MockedFunction<typeof auth>;
const mockPrisma = prisma as jest.Mocked<typeof prisma>;
const mockAnalyze = analyzeWithClaude as jest.MockedFunction<typeof analyzeWithClaude>;

const makeRequest = () =>
  new NextRequest('http://localhost/api/tenders/tender-1/analyze', { method: 'POST' });

const makeParams = () => ({ params: Promise.resolve({ id: 'tender-1' }) });

describe('/api/tenders/[id]/analyze', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 401 when not authenticated', async () => {
    mockAuth.mockResolvedValue(null as any);
    const response = await POST(makeRequest(), makeParams());
    expect(response.status).toBe(401);
  });

  it('returns 404 when tender not found or no access', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'user-1', email: 'test@test.com' },
    } as any);
    (mockPrisma.tender.findFirst as jest.Mock).mockResolvedValue(null);

    const response = await POST(makeRequest(), makeParams());
    expect(response.status).toBe(404);
  });

  it('creates mock analysis when ANTHROPIC_API_KEY missing', async () => {
    const originalKey = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;

    mockAuth.mockResolvedValue({
      user: { id: 'user-1', email: 'test@test.com' },
    } as any);

    (mockPrisma.tender.findFirst as jest.Mock).mockResolvedValue({
      id: 'tender-1',
      title: 'Test Tender',
      status: 'NEW',
      organization: { name: 'Test Org', cui: 'RO123' },
      documents: [],
    });

    (mockPrisma.tenderAnalysis.upsert as jest.Mock).mockResolvedValue({
      id: 'analysis-1',
      recommendation: 'CAUTION',
      modelUsed: 'mock',
    });

    const response = await POST(makeRequest(), makeParams());
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.note).toContain('demo');

    process.env.ANTHROPIC_API_KEY = originalKey;
  });

  it('runs AI analysis and saves result', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'user-1', email: 'test@test.com' },
    } as any);

    (mockPrisma.tender.findFirst as jest.Mock).mockResolvedValue({
      id: 'tender-1',
      title: 'Test Tender',
      description: 'A test tender description',
      status: 'NEW',
      organization: { name: 'Test Org', cui: 'RO123', cpvCodes: [], keywords: [] },
      documents: [],
    });

    mockAnalyze.mockResolvedValue({
      strengths: ['Good fit'],
      weaknesses: ['Tight deadline'],
      opportunities: ['New client'],
      threats: ['Competition'],
      recommendation: 'GO',
      aiSummary: 'Looks promising',
      modelUsed: 'claude-sonnet',
      confidence: 0.85,
    } as any);

    (mockPrisma.tenderAnalysis.upsert as jest.Mock).mockResolvedValue({
      id: 'analysis-1',
      recommendation: 'GO',
      modelUsed: 'claude-sonnet',
    });
    (mockPrisma.tender.update as jest.Mock).mockResolvedValue({});

    const response = await POST(makeRequest(), makeParams());
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockPrisma.tender.update).toHaveBeenCalled();
  });
});
