import { NextRequest } from 'next/server';

jest.mock('@/lib/db', () => ({
  prisma: { auditLog: { create: jest.fn() } },
}));
jest.mock('@/lib/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/seap/scanner', () => ({
  runFullScan: jest.fn(),
  runQuickScan: jest.fn(),
}));
jest.mock('@/lib/email/notifications', () => ({
  sendOpportunityReports: jest.fn(() => ({ sent: 0, reports: 0 })),
  sendDeadlineAlerts: jest.fn(() => ({ sent: 0, errors: 0 })),
  sendDailyDigests: jest.fn(() => ({ sent: 0 })),
}));
jest.mock('@/lib/rate-limit', () => ({
  checkRateLimit: jest.fn(() => ({ allowed: true, remaining: 10, resetAt: Date.now() + 60000 })),
  RATE_LIMITS: { api: {}, sensitive: {}, scan: {}, analysis: {}, cron: {}, auth: {}, webhook: {} },
  getClientIp: jest.fn(() => '127.0.0.1'),
}));
jest.mock('@/lib/audit-log', () => ({
  logAction: jest.fn(),
  AuditActions: { SCAN_COMPLETE: 'SCAN_COMPLETE' },
}));

import { POST, GET } from '@/app/api/scan/route';
import { auth } from '@/lib/auth';
import { runFullScan, runQuickScan } from '@/lib/seap/scanner';

const mockAuth = auth as jest.MockedFunction<typeof auth>;
const mockRunFullScan = runFullScan as jest.MockedFunction<typeof runFullScan>;
const mockRunQuickScan = runQuickScan as jest.MockedFunction<typeof runQuickScan>;

describe('/api/scan', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('POST', () => {
    it('returns 401 without authorization', async () => {
      mockAuth.mockResolvedValue(null as any);
      const request = new NextRequest('http://localhost/api/scan', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      const response = await POST(request);
      expect(response.status).toBe(401);
    });

    it('accepts cron secret bearer token', async () => {
      mockRunFullScan.mockResolvedValue({
        tendersFound: 10,
        tendersCreated: 3,
        createdTenderIds: [],
      } as any);

      const request = new NextRequest('http://localhost/api/scan', {
        method: 'POST',
        body: JSON.stringify({}),
        headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.tendersFound).toBe(10);
    });

    it('returns 500 when scanner throws', async () => {
      mockRunFullScan.mockRejectedValue(new Error('SEAP API down'));

      const request = new NextRequest('http://localhost/api/scan', {
        method: 'POST',
        body: JSON.stringify({}),
        headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
      });
      const response = await POST(request);
      expect(response.status).toBe(500);
    });
  });

  describe('GET', () => {
    it('returns 401 without authorization', async () => {
      mockAuth.mockResolvedValue(null as any);
      const request = new NextRequest('http://localhost/api/scan');
      const response = await GET(request);
      expect(response.status).toBe(401);
    });

    it('accepts cron secret and runs quick scan', async () => {
      mockRunQuickScan.mockResolvedValue({
        tendersFound: 5,
        tendersCreated: 1,
        createdTenderIds: [],
      } as any);

      const request = new NextRequest('http://localhost/api/scan', {
        headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
      });
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.tendersFound).toBe(5);
    });
  });
});
