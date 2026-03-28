import { NextRequest } from 'next/server';

jest.mock('@/lib/db', () => ({
  prisma: {
    user: { findUnique: jest.fn(), updateMany: jest.fn() },
    userOrganization: { findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn() },
    invitation: { findMany: jest.fn(), findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
    auditLog: { create: jest.fn() },
    $transaction: jest.fn(),
  },
}));
jest.mock('@/lib/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/email/client', () => ({ sendEmail: jest.fn(() => true) }));
jest.mock('@/lib/email/invitation-template', () => ({ invitationEmail: jest.fn(() => ({ subject: 'Test', html: '<p>Test</p>' })) }));
jest.mock('@/lib/rate-limit', () => ({
  checkRateLimit: jest.fn(() => ({ allowed: true, remaining: 10, resetAt: Date.now() + 60000 })),
  RATE_LIMITS: { api: {}, sensitive: {}, scan: {}, analysis: {}, cron: {}, auth: {}, webhook: {} },
  getClientIp: jest.fn(() => '127.0.0.1'),
}));
jest.mock('@/lib/audit-log', () => ({
  logAction: jest.fn(),
  AuditActions: { ORG_INVITE: 'ORG_INVITE', ORG_INVITE_ACCEPT: 'ORG_INVITE_ACCEPT' },
}));

import { GET, POST as CREATE } from '@/app/api/invitations/route';
import { POST as ACCEPT } from '@/app/api/invitations/accept/route';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

const mockAuth = auth as jest.MockedFunction<typeof auth>;
const mockPrisma = prisma as jest.Mocked<typeof prisma>;

describe('/api/invitations', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('GET /api/invitations', () => {
    it('returns 401 when not authenticated', async () => {
      mockAuth.mockResolvedValue(null as any);
      const request = new NextRequest('http://localhost/api/invitations');
      const response = await GET(request);
      expect(response.status).toBe(401);
    });

    it('returns invitations for admin user', async () => {
      mockAuth.mockResolvedValue({
        user: { id: 'user-1', email: 'admin@test.com' },
      } as any);

      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'user-1',
        email: 'admin@test.com',
        activeOrganizationId: 'org-1',
        activeOrganization: { name: 'Test Org' },
      });

      (mockPrisma.userOrganization.findUnique as jest.Mock).mockResolvedValue({
        role: 'OWNER',
      });

      (mockPrisma.invitation.findMany as jest.Mock).mockResolvedValue([
        { id: 'inv-1', email: 'new@test.com', status: 'pending' },
      ]);

      const request = new NextRequest('http://localhost/api/invitations');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.invitations).toHaveLength(1);
    });
  });

  describe('POST /api/invitations/accept', () => {
    it('returns 401 when not authenticated', async () => {
      mockAuth.mockResolvedValue(null as any);
      const request = new NextRequest('http://localhost/api/invitations/accept', {
        method: 'POST',
        body: JSON.stringify({ token: 'some-token' }),
      });
      const response = await ACCEPT(request);
      expect(response.status).toBe(401);
    });

    it('returns 404 for invalid token', async () => {
      mockAuth.mockResolvedValue({
        user: { id: 'user-1', email: 'test@test.com' },
      } as any);

      (mockPrisma.invitation.findUnique as jest.Mock).mockResolvedValue(null);

      const request = new NextRequest('http://localhost/api/invitations/accept', {
        method: 'POST',
        body: JSON.stringify({ token: 'invalid-token' }),
      });
      const response = await ACCEPT(request);
      expect(response.status).toBe(404);
    });

    it('returns 400 for expired invitation', async () => {
      mockAuth.mockResolvedValue({
        user: { id: 'user-1', email: 'test@test.com' },
      } as any);

      (mockPrisma.invitation.findUnique as jest.Mock).mockResolvedValue({
        id: 'inv-1',
        email: 'test@test.com',
        status: 'pending',
        expiresAt: new Date('2020-01-01'),
        organizationId: 'org-1',
        organization: { name: 'Test Org' },
      });
      (mockPrisma.invitation.update as jest.Mock).mockResolvedValue({});

      const request = new NextRequest('http://localhost/api/invitations/accept', {
        method: 'POST',
        body: JSON.stringify({ token: 'expired-token' }),
      });
      const response = await ACCEPT(request);
      expect(response.status).toBe(400);
    });

    it('accepts valid invitation', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);

      mockAuth.mockResolvedValue({
        user: { id: 'user-1', email: 'test@test.com' },
      } as any);

      (mockPrisma.invitation.findUnique as jest.Mock).mockResolvedValue({
        id: 'inv-1',
        email: 'test@test.com',
        status: 'pending',
        expiresAt: futureDate,
        organizationId: 'org-1',
        role: 'MEMBER',
        organization: { name: 'Test Org' },
      });
      (mockPrisma.userOrganization.findFirst as jest.Mock).mockResolvedValue(null);
      (mockPrisma.$transaction as jest.Mock).mockResolvedValue([]);

      const request = new NextRequest('http://localhost/api/invitations/accept', {
        method: 'POST',
        body: JSON.stringify({ token: 'valid-token' }),
      });
      const response = await ACCEPT(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });
});
