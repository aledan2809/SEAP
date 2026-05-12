/**
 * Integration test: Multi-tenant data isolation
 * Validates that tenant A cannot access or modify tenant B's data
 */

import { NextRequest } from 'next/server';

jest.mock('@/lib/db', () => ({
  prisma: {
    tender: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    userOrganization: {
      findUnique: jest.fn(),
    },
    organization: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    auditLog: { create: jest.fn() },
    $transaction: jest.fn(),
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
    TENDER_UPDATE_STATUS: 'TENDER_UPDATE_STATUS',
    ORG_UPDATE: 'ORG_UPDATE',
  },
}));

import { PATCH as PATCH_TENDER_STATUS } from '@/app/api/tenders/[id]/status/route';
import { PATCH as PATCH_ORG } from '@/app/api/organizations/[id]/route';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

const mockAuth = auth as jest.MockedFunction<typeof auth>;
const mockPrisma = prisma as jest.Mocked<typeof prisma>;

// Tenant A
const TENANT_A_USER_ID = 'user-a';
const TENANT_A_EMAIL = 'usera@compania.ro';
const TENANT_A_ORG_ID = 'org-a';

// Tenant B
const TENANT_B_USER_ID = 'user-b';
const TENANT_B_EMAIL = 'userb@alta-firma.ro';
const TENANT_B_ORG_ID = 'org-b';

const TENANT_B_TENDER_ID = 'tender-b-1';

describe('Integration: Multi-Tenant Data Isolation', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('Tender access isolation', () => {
    it('Tenant A cannot update status of a tender belonging to Tenant B', async () => {
      // User A is authenticated
      mockAuth.mockResolvedValue({
        user: { id: TENANT_A_USER_ID, email: TENANT_A_EMAIL },
      } as any);

      // Prisma returns null because the tender does NOT belong to Tenant A's org
      (mockPrisma.tender.findFirst as jest.Mock).mockResolvedValue(null);

      const req = new NextRequest(
        `http://localhost/api/tenders/${TENANT_B_TENDER_ID}/status`,
        {
          method: 'PATCH',
          body: JSON.stringify({ status: 'REVIEWING' }),
        }
      );

      const res = await PATCH_TENDER_STATUS(req, {
        params: Promise.resolve({ id: TENANT_B_TENDER_ID }),
      });

      expect(res.status).toBe(404);
      // Tender.update must NOT have been called — data must remain untouched
      expect(mockPrisma.tender.update).not.toHaveBeenCalled();
    });

    it('Tenant A can update status of its own tender', async () => {
      mockAuth.mockResolvedValue({
        user: { id: TENANT_A_USER_ID, email: TENANT_A_EMAIL },
      } as any);

      const TENANT_A_TENDER_ID = 'tender-a-1';

      // Prisma returns the tender because it belongs to Tenant A's org
      (mockPrisma.tender.findFirst as jest.Mock).mockResolvedValue({
        id: TENANT_A_TENDER_ID,
        status: 'NEW',
        organizationId: TENANT_A_ORG_ID,
        title: 'Licitație Tenant A',
      });
      (mockPrisma.tender.update as jest.Mock).mockResolvedValue({
        id: TENANT_A_TENDER_ID,
        status: 'REVIEWING',
      });

      const req = new NextRequest(
        `http://localhost/api/tenders/${TENANT_A_TENDER_ID}/status`,
        {
          method: 'PATCH',
          body: JSON.stringify({ status: 'REVIEWING' }),
        }
      );

      const res = await PATCH_TENDER_STATUS(req, {
        params: Promise.resolve({ id: TENANT_A_TENDER_ID }),
      });

      expect(res.status).toBe(200);
      expect(mockPrisma.tender.update).toHaveBeenCalledTimes(1);
    });
  });

  describe('Organization data isolation', () => {
    it('Tenant A cannot update Tenant B organization details', async () => {
      // User A is authenticated
      mockAuth.mockResolvedValue({
        user: { id: TENANT_A_USER_ID, email: TENANT_A_EMAIL },
      } as any);

      // UserOrganization lookup returns null — User A has no membership in Org B
      (mockPrisma.userOrganization.findUnique as jest.Mock).mockResolvedValue(null);

      const req = new NextRequest(
        `http://localhost/api/organizations/${TENANT_B_ORG_ID}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ name: 'Hacked Name' }),
        }
      );

      const res = await PATCH_ORG(req, {
        params: Promise.resolve({ id: TENANT_B_ORG_ID }),
      });

      expect(res.status).toBe(403);
      expect(mockPrisma.organization.update).not.toHaveBeenCalled();
    });

    it('Tenant A owner can update its own organization', async () => {
      mockAuth.mockResolvedValue({
        user: { id: TENANT_A_USER_ID, email: TENANT_A_EMAIL },
      } as any);

      // User A is OWNER of Org A
      (mockPrisma.userOrganization.findUnique as jest.Mock).mockResolvedValue({
        userId: TENANT_A_USER_ID,
        organizationId: TENANT_A_ORG_ID,
        role: 'OWNER',
      });
      (mockPrisma.organization.update as jest.Mock).mockResolvedValue({
        id: TENANT_A_ORG_ID,
        name: 'Updated Name',
      });

      const req = new NextRequest(
        `http://localhost/api/organizations/${TENANT_A_ORG_ID}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ name: 'Updated Name' }),
        }
      );

      const res = await PATCH_ORG(req, {
        params: Promise.resolve({ id: TENANT_A_ORG_ID }),
      });

      expect(res.status).toBe(200);
      expect(mockPrisma.organization.update).toHaveBeenCalledTimes(1);
    });

    it('Tenant B member cannot update Tenant A organization even if authenticated', async () => {
      // User B is authenticated
      mockAuth.mockResolvedValue({
        user: { id: TENANT_B_USER_ID, email: TENANT_B_EMAIL },
      } as any);

      // User B has no membership in Org A
      (mockPrisma.userOrganization.findUnique as jest.Mock).mockResolvedValue(null);

      const req = new NextRequest(
        `http://localhost/api/organizations/${TENANT_A_ORG_ID}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ name: 'Unauthorized Change' }),
        }
      );

      const res = await PATCH_ORG(req, {
        params: Promise.resolve({ id: TENANT_A_ORG_ID }),
      });

      expect(res.status).toBe(403);
      expect(mockPrisma.organization.update).not.toHaveBeenCalled();
    });
  });
});
