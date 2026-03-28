import { NextRequest } from 'next/server';

jest.mock('@/lib/db', () => ({
  prisma: {
    user: { update: jest.fn() },
    auditLog: { create: jest.fn() },
  },
}));
jest.mock('@/lib/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/rate-limit', () => ({
  checkRateLimit: jest.fn(() => ({ allowed: true, remaining: 10, resetAt: Date.now() + 60000 })),
  RATE_LIMITS: { api: {}, sensitive: {}, scan: {}, analysis: {}, cron: {}, auth: {}, webhook: {} },
  getClientIp: jest.fn(() => '127.0.0.1'),
}));

import { PATCH } from '@/app/api/user/profile/route';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

const mockAuth = auth as jest.MockedFunction<typeof auth>;
const mockPrisma = prisma as jest.Mocked<typeof prisma>;

describe('/api/user/profile', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('PATCH', () => {
    it('returns 401 when not authenticated', async () => {
      mockAuth.mockResolvedValue(null as any);
      const request = new NextRequest('http://localhost/api/user/profile', {
        method: 'PATCH',
        body: JSON.stringify({ name: 'New Name' }),
      });
      const response = await PATCH(request);
      expect(response.status).toBe(401);
    });

    it('returns 400 for invalid data (name too short)', async () => {
      mockAuth.mockResolvedValue({
        user: { id: 'user-1', email: 'test@test.com' },
      } as any);

      const request = new NextRequest('http://localhost/api/user/profile', {
        method: 'PATCH',
        body: JSON.stringify({ name: 'A' }),
      });
      const response = await PATCH(request);
      expect(response.status).toBe(400);
    });

    it('updates name successfully', async () => {
      mockAuth.mockResolvedValue({
        user: { id: 'user-1', email: 'test@test.com' },
      } as any);

      (mockPrisma.user.update as jest.Mock).mockResolvedValue({
        id: 'user-1',
        name: 'New Name',
        email: 'test@test.com',
      });

      const request = new NextRequest('http://localhost/api/user/profile', {
        method: 'PATCH',
        body: JSON.stringify({ name: 'New Name' }),
      });
      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.user.name).toBe('New Name');
    });
  });
});
