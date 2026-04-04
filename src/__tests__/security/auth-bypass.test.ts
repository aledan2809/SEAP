import { NextRequest } from 'next/server';

jest.mock('@/lib/db', () => ({
  prisma: {
    auditLog: { create: jest.fn() },
    userOrganization: { findMany: jest.fn(), findUnique: jest.fn() },
    user: { findUnique: jest.fn() },
    organization: { findUnique: jest.fn() },
    tender: { findUnique: jest.fn() },
    systemSettings: { findMany: jest.fn() },
  },
}));
jest.mock('@/lib/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/rate-limit', () => ({
  checkRateLimit: jest.fn(() => ({ allowed: true, remaining: 10, resetAt: Date.now() + 60000 })),
  RATE_LIMITS: { api: {}, sensitive: {}, scan: {}, analysis: {}, cron: {}, auth: {}, webhook: {} },
  getClientIp: jest.fn(() => '127.0.0.1'),
}));
jest.mock('@/lib/audit-log', () => ({
  logAction: jest.fn(),
  AuditActions: {
    SETTINGS_UPDATE: 'SETTINGS_UPDATE',
    TENDER_STATUS_UPDATE: 'TENDER_STATUS_UPDATE',
    ORG_CREATE: 'ORG_CREATE',
  },
}));
jest.mock('@/lib/settings', () => ({
  getSettings: jest.fn(() => ({})),
  setSettings: jest.fn(),
  isAdmin: jest.fn(() => false),
  SETTING_KEYS: {},
}));

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

const mockAuth = auth as jest.MockedFunction<typeof auth>;
const mockPrisma = prisma as any;

describe('Auth Bypass Protection', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('Admin endpoints require admin role', () => {
    it('GET /api/admin/audit-logs returns 401 without auth', async () => {
      mockAuth.mockResolvedValue(null as any);
      const { GET } = await import('@/app/api/admin/audit-logs/route');
      const request = new NextRequest('http://localhost/api/admin/audit-logs');
      const response = await GET(request);
      expect(response.status).toBe(401);
    });

    it('GET /api/admin/settings returns 403 without auth (combined auth+admin check)', async () => {
      mockAuth.mockResolvedValue(null as any);
      const { GET } = await import('@/app/api/admin/settings/route');
      const request = new NextRequest('http://localhost/api/admin/settings');
      const response = await GET(request);
      expect(response.status).toBe(403);
    });

    it('GET /api/admin/audit-logs returns 403 for non-admin user', async () => {
      mockAuth.mockResolvedValue({
        user: { id: 'user-1', email: 'test@test.com', role: 'MEMBER', organizationId: 'org-1' },
      } as any);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        activeOrganizationId: 'org-1',
        organizations: [{ role: 'MEMBER', organizationId: 'org-1' }],
      });
      mockPrisma.userOrganization.findUnique.mockResolvedValue({ role: 'MEMBER' });

      const { GET } = await import('@/app/api/admin/audit-logs/route');
      const request = new NextRequest('http://localhost/api/admin/audit-logs');
      const response = await GET(request);
      expect(response.status).toBe(403);
    });
  });

  describe('Organization endpoints enforce membership', () => {
    it('PATCH /api/organizations/[id] returns 401 without auth', async () => {
      mockAuth.mockResolvedValue(null as any);
      const { PATCH } = await import('@/app/api/organizations/[id]/route');
      const request = new NextRequest('http://localhost/api/organizations/org-1', {
        method: 'PATCH',
        body: JSON.stringify({ name: 'Hacked' }),
      });
      const response = await PATCH(request, { params: Promise.resolve({ id: 'org-1' }) });
      expect(response.status).toBe(401);
    });

    it('PATCH /api/organizations/[id] returns 403 for non-member', async () => {
      mockAuth.mockResolvedValue({
        user: { id: 'user-1', email: 'test@test.com', role: 'MEMBER', organizationId: 'org-2' },
      } as any);
      mockPrisma.userOrganization.findUnique.mockResolvedValue(null);

      const { PATCH } = await import('@/app/api/organizations/[id]/route');
      const request = new NextRequest('http://localhost/api/organizations/org-1', {
        method: 'PATCH',
        body: JSON.stringify({ name: 'Hacked' }),
      });
      const response = await PATCH(request, { params: Promise.resolve({ id: 'org-1' }) });
      expect(response.status).toBe(403);
    });
  });

  describe('Tender endpoints enforce org access', () => {
    it('PATCH /api/tenders/[id]/status returns 401 without auth', async () => {
      mockAuth.mockResolvedValue(null as any);
      const { PATCH } = await import('@/app/api/tenders/[id]/status/route');
      const request = new NextRequest('http://localhost/api/tenders/t1/status', {
        method: 'PATCH',
        body: JSON.stringify({ status: 'won' }),
      });
      const response = await PATCH(request, { params: Promise.resolve({ id: 't1' }) });
      expect(response.status).toBe(401);
    });
  });

  describe('Cron endpoints require CRON_SECRET', () => {
    it('POST /api/notifications/deadline-check returns 401 without secret', async () => {
      const { POST } = await import('@/app/api/notifications/deadline-check/route');
      const request = new NextRequest('http://localhost/api/notifications/deadline-check', {
        method: 'POST',
      });
      const response = await POST(request);
      expect(response.status).toBe(401);
    });
  });

  describe('User profile requires auth', () => {
    it('PATCH /api/user/profile returns 401 without auth', async () => {
      mockAuth.mockResolvedValue(null as any);
      const { PATCH } = await import('@/app/api/user/profile/route');
      const request = new NextRequest('http://localhost/api/user/profile', {
        method: 'PATCH',
        body: JSON.stringify({ name: 'Hacker' }),
      });
      const response = await PATCH(request);
      expect(response.status).toBe(401);
    });
  });
});
