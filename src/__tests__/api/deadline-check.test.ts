import { NextRequest } from 'next/server';

jest.mock('@/lib/db', () => ({
  prisma: { auditLog: { create: jest.fn() } },
}));
jest.mock('@/lib/email/notifications', () => ({
  sendDeadlineAlerts: jest.fn(),
}));
jest.mock('@/lib/rate-limit', () => ({
  checkRateLimit: jest.fn(() => ({ allowed: true, remaining: 10, resetAt: Date.now() + 60000 })),
  RATE_LIMITS: { api: {}, sensitive: {}, scan: {}, analysis: {}, cron: {}, auth: {}, webhook: {} },
  getClientIp: jest.fn(() => '127.0.0.1'),
}));

import { POST, GET } from '@/app/api/notifications/deadline-check/route';
import { sendDeadlineAlerts } from '@/lib/email/notifications';

const mockSendAlerts = sendDeadlineAlerts as jest.MockedFunction<typeof sendDeadlineAlerts>;

describe('/api/notifications/deadline-check', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('POST', () => {
    it('returns 401 without authorization', async () => {
      const request = new NextRequest('http://localhost/api/notifications/deadline-check', {
        method: 'POST',
      });
      const response = await POST(request);
      expect(response.status).toBe(401);
    });

    it('returns 401 with wrong secret', async () => {
      const request = new NextRequest('http://localhost/api/notifications/deadline-check', {
        method: 'POST',
        headers: { Authorization: 'Bearer wrong-secret' },
      });
      const response = await POST(request);
      expect(response.status).toBe(401);
    });

    it('processes deadline check with valid cron secret', async () => {
      mockSendAlerts.mockResolvedValue({ sent: 3, errors: 0 });

      const request = new NextRequest('http://localhost/api/notifications/deadline-check', {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.sent).toBe(3);
    });

    it('returns 500 when email service fails', async () => {
      mockSendAlerts.mockRejectedValue(new Error('SMTP down'));

      const request = new NextRequest('http://localhost/api/notifications/deadline-check', {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
      });
      const response = await POST(request);
      expect(response.status).toBe(500);
    });
  });

  describe('GET', () => {
    it('returns health check status', async () => {
      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.service).toBe('deadline-check');
      expect(data.status).toBe('ready');
    });
  });
});
