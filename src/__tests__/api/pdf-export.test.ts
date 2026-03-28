import { NextRequest } from 'next/server';

jest.mock('@/lib/db', () => ({
  prisma: {
    tender: { findFirst: jest.fn() },
    auditLog: { create: jest.fn() },
  },
}));
jest.mock('@/lib/auth', () => ({ auth: jest.fn() }));
jest.mock('@react-pdf/renderer', () => ({
  renderToBuffer: jest.fn(() => Buffer.from('fake-pdf-content')),
}));
jest.mock('@/lib/pdf/tender-report', () => ({
  TenderPDFDocument: jest.fn(() => null),
}));
jest.mock('@/lib/rate-limit', () => ({
  checkRateLimit: jest.fn(() => ({ allowed: true, remaining: 10, resetAt: Date.now() + 60000 })),
  RATE_LIMITS: { api: {}, sensitive: {}, scan: {}, analysis: {}, cron: {}, auth: {}, webhook: {} },
  getClientIp: jest.fn(() => '127.0.0.1'),
}));
jest.mock('@/lib/audit-log', () => ({
  logAction: jest.fn(),
  AuditActions: { TENDER_EXPORT_PDF: 'TENDER_EXPORT_PDF' },
}));

import { GET } from '@/app/api/tenders/[id]/pdf/route';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

const mockAuth = auth as jest.MockedFunction<typeof auth>;
const mockPrisma = prisma as jest.Mocked<typeof prisma>;

const makeRequest = () => new NextRequest('http://localhost/api/tenders/tender-1/pdf');
const makeContext = () => ({ params: Promise.resolve({ id: 'tender-1' }) });

describe('/api/tenders/[id]/pdf', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 401 when not authenticated', async () => {
    mockAuth.mockResolvedValue(null as any);
    const response = await GET(makeRequest(), makeContext());
    expect(response.status).toBe(401);
  });

  it('returns 404 when tender not found', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'user-1', email: 'test@test.com' },
    } as any);
    (mockPrisma.tender.findFirst as jest.Mock).mockResolvedValue(null);

    const response = await GET(makeRequest(), makeContext());
    expect(response.status).toBe(404);
  });

  it('generates PDF for authorized user', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'user-1', email: 'test@test.com' },
    } as any);

    (mockPrisma.tender.findFirst as jest.Mock).mockResolvedValue({
      id: 'tender-1',
      seapId: 'SEAP-12345',
      title: 'Test Tender',
      analysis: { recommendation: 'GO' },
      organization: { name: 'Test Org' },
    });

    const response = await GET(makeRequest(), makeContext());

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('application/pdf');
    expect(response.headers.get('Content-Disposition')).toContain('SEAP-12345');
  });
});
