/**
 * Integration test: Tender status lifecycle
 * Covers: NEW → REVIEWING → PREPARING → SUBMITTED → WON transitions
 */

import { NextRequest } from 'next/server';

jest.mock('@/lib/db', () => ({
  prisma: {
    tender: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    auditLog: { create: jest.fn() },
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
  AuditActions: { TENDER_UPDATE_STATUS: 'TENDER_UPDATE_STATUS' },
}));

import { PATCH } from '@/app/api/tenders/[id]/status/route';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { logAction } from '@/lib/audit-log';

const mockAuth = auth as jest.MockedFunction<typeof auth>;
const mockPrisma = prisma as jest.Mocked<typeof prisma>;
const mockLogAction = logAction as jest.MockedFunction<typeof logAction>;

const USER_ID = 'user-1';
const TENDER_ID = 'tender-1';
const ORG_ID = 'org-1';

function makeStatusRequest(tenderId: string, status: string) {
  return new NextRequest(`http://localhost/api/tenders/${tenderId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

function mockTender(currentStatus: string) {
  (mockPrisma.tender.findFirst as jest.Mock).mockResolvedValue({
    id: TENDER_ID,
    status: currentStatus,
    organizationId: ORG_ID,
    title: 'Tender Test',
  });
  (mockPrisma.tender.update as jest.Mock).mockImplementation(({ data }) =>
    Promise.resolve({ id: TENDER_ID, status: data.status })
  );
}

describe('Integration: Tender Status Lifecycle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: USER_ID, email: 'user@test.ro' } } as any);
  });

  it('NEW → REVIEWING: analyst starts reviewing a newly discovered tender', async () => {
    mockTender('NEW');

    const res = await PATCH(makeStatusRequest(TENDER_ID, 'REVIEWING'), {
      params: Promise.resolve({ id: TENDER_ID }),
    });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.tender.status).toBe('REVIEWING');
    expect(mockLogAction).toHaveBeenCalledWith(
      expect.objectContaining({ details: { oldStatus: 'NEW', newStatus: 'REVIEWING' } })
    );
  });

  it('REVIEWING → PREPARING: decision to bid moves tender to preparation', async () => {
    mockTender('REVIEWING');

    const res = await PATCH(makeStatusRequest(TENDER_ID, 'PREPARING'), {
      params: Promise.resolve({ id: TENDER_ID }),
    });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.tender.status).toBe('PREPARING');
    expect(mockLogAction).toHaveBeenCalledWith(
      expect.objectContaining({ details: { oldStatus: 'REVIEWING', newStatus: 'PREPARING' } })
    );
  });

  it('PREPARING → SUBMITTED: offer is submitted before deadline', async () => {
    mockTender('PREPARING');

    const res = await PATCH(makeStatusRequest(TENDER_ID, 'SUBMITTED'), {
      params: Promise.resolve({ id: TENDER_ID }),
    });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.tender.status).toBe('SUBMITTED');
  });

  it('SUBMITTED → WON: tender is won after evaluation', async () => {
    mockTender('SUBMITTED');

    const res = await PATCH(makeStatusRequest(TENDER_ID, 'WON'), {
      params: Promise.resolve({ id: TENDER_ID }),
    });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.tender.status).toBe('WON');
  });

  it('Rejects invalid status value with 400', async () => {
    mockTender('NEW');

    const res = await PATCH(makeStatusRequest(TENDER_ID, 'INVALID_STATUS'), {
      params: Promise.resolve({ id: TENDER_ID }),
    });

    expect(res.status).toBe(400);
  });

  it('Returns 404 when tender does not belong to user org', async () => {
    (mockPrisma.tender.findFirst as jest.Mock).mockResolvedValue(null);

    const res = await PATCH(makeStatusRequest('nonexistent', 'REVIEWING'), {
      params: Promise.resolve({ id: 'nonexistent' }),
    });

    expect(res.status).toBe(404);
  });

  it('Returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue(null as any);

    const res = await PATCH(makeStatusRequest(TENDER_ID, 'REVIEWING'), {
      params: Promise.resolve({ id: TENDER_ID }),
    });

    expect(res.status).toBe(401);
  });
});
