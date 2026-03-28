import { NextRequest } from 'next/server';

jest.mock('@/lib/db', () => {
  const mockPrisma = {
    organization: { findUnique: jest.fn(), create: jest.fn() },
    userOrganization: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn() },
    user: { findUnique: jest.fn(), update: jest.fn() },
    auditLog: { create: jest.fn() },
    $transaction: jest.fn(),
  };
  return { prisma: mockPrisma };
});
jest.mock('@/lib/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/rate-limit', () => ({
  checkRateLimit: jest.fn(() => ({ allowed: true, remaining: 10, resetAt: Date.now() + 60000 })),
  RATE_LIMITS: { api: {}, sensitive: {}, scan: {}, analysis: {}, cron: {}, auth: {}, webhook: {} },
  getClientIp: jest.fn(() => '127.0.0.1'),
}));
jest.mock('@/lib/audit-log', () => ({
  logAction: jest.fn(),
  AuditActions: { ORG_CREATE: 'ORG_CREATE' },
}));

import { GET, POST } from '@/app/api/organizations/route';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

const mockAuth = auth as jest.MockedFunction<typeof auth>;
const mockPrisma = prisma as any;

describe('/api/organizations', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('GET', () => {
    it('returns 401 when not authenticated', async () => {
      mockAuth.mockResolvedValue(null as any);
      const request = new NextRequest('http://localhost/api/organizations');
      const response = await GET(request);
      expect(response.status).toBe(401);
    });

    it('returns organizations for authenticated user', async () => {
      mockAuth.mockResolvedValue({
        user: { id: 'user-1', email: 'test@test.com', role: 'OWNER', organizationId: 'org-1' },
      } as any);

      mockPrisma.userOrganization.findMany.mockResolvedValue([
        {
          role: 'OWNER',
          organizationId: 'org-1',
          organization: { id: 'org-1', name: 'Test Org', cui: 'RO12345', _count: { tenders: 5, documents: 3 } },
        },
      ]);
      mockPrisma.user.findUnique.mockResolvedValue({ activeOrganizationId: 'org-1' });

      const request = new NextRequest('http://localhost/api/organizations');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.organizations).toHaveLength(1);
      expect(data.organizations[0].name).toBe('Test Org');
    });
  });

  describe('POST', () => {
    it('returns 401 when not authenticated', async () => {
      mockAuth.mockResolvedValue(null as any);
      const request = new NextRequest('http://localhost/api/organizations', {
        method: 'POST',
        body: JSON.stringify({ name: 'Test', cui: 'RO123' }),
      });
      const response = await POST(request);
      expect(response.status).toBe(401);
    });

    it('returns 400 for invalid data (missing CUI)', async () => {
      mockAuth.mockResolvedValue({
        user: { id: 'user-1', email: 'test@test.com' },
      } as any);
      const request = new NextRequest('http://localhost/api/organizations', {
        method: 'POST',
        body: JSON.stringify({ name: 'Test Org' }),
      });
      const response = await POST(request);
      expect(response.status).toBe(400);
    });

    it('creates organization successfully', async () => {
      mockAuth.mockResolvedValue({
        user: { id: 'user-1', email: 'test@test.com' },
      } as any);

      mockPrisma.$transaction.mockImplementation(async (cb: Function) => {
        const tx = {
          organization: {
            findUnique: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockResolvedValue({ id: 'org-new', name: 'New Org', cui: 'RO99999' }),
          },
          userOrganization: { create: jest.fn().mockResolvedValue({}) },
          user: { update: jest.fn().mockResolvedValue({}) },
        };
        return cb(tx);
      });

      const request = new NextRequest('http://localhost/api/organizations', {
        method: 'POST',
        body: JSON.stringify({ name: 'New Org', cui: 'RO99999' }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.organization.name).toBe('New Org');
    });
  });
});
