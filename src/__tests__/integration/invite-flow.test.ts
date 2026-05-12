/**
 * Integration test: Full invite flow end-to-end
 * Covers: invite creation → email dispatch → token acceptance → org membership
 */

import { NextRequest } from 'next/server';

jest.mock('@/lib/db', () => ({
  prisma: {
    user: { findUnique: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
    userOrganization: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    invitation: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    auditLog: { create: jest.fn() },
    $transaction: jest.fn(),
  },
}));
jest.mock('@/lib/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/email/client', () => ({ sendEmail: jest.fn(() => true) }));
jest.mock('@/lib/email/invitation-template', () => ({
  invitationEmail: jest.fn(() => ({ subject: 'Invitație', html: '<p>Invitație</p>' })),
}));
jest.mock('@/lib/rate-limit', () => ({
  checkRateLimit: jest.fn(() => ({ allowed: true, remaining: 10, resetAt: Date.now() + 60000 })),
  RATE_LIMITS: { api: {}, sensitive: {}, scan: {}, analysis: {}, cron: {}, auth: {}, webhook: {} },
  getClientIp: jest.fn(() => '127.0.0.1'),
}));
jest.mock('@/lib/audit-log', () => ({
  logAction: jest.fn(),
  AuditActions: {
    ORG_INVITE: 'ORG_INVITE',
    ORG_INVITE_ACCEPT: 'ORG_INVITE_ACCEPT',
    TENDER_UPDATE_STATUS: 'TENDER_UPDATE_STATUS',
  },
}));

import { POST as CREATE_INVITE } from '@/app/api/invitations/route';
import { POST as ACCEPT_INVITE } from '@/app/api/invitations/accept/route';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/email/client';

const mockAuth = auth as jest.MockedFunction<typeof auth>;
const mockPrisma = prisma as jest.Mocked<typeof prisma>;
const mockSendEmail = sendEmail as jest.MockedFunction<typeof sendEmail>;

describe('Integration: Full Invite Flow', () => {
  const OWNER_ID = 'owner-1';
  const OWNER_EMAIL = 'owner@org.ro';
  const ORG_ID = 'org-1';
  const INVITE_TOKEN = 'secure-token-abc123';
  const INVITEE_EMAIL = 'newmember@example.com';
  const INVITEE_ID = 'user-2';

  beforeEach(() => jest.clearAllMocks());

  it('Step 1: Owner creates invitation and email is dispatched', async () => {
    mockAuth.mockResolvedValue({ user: { id: OWNER_ID, email: OWNER_EMAIL } } as any);

    // First call: resolve session owner; second call: invitee not in org yet
    (mockPrisma.user.findUnique as jest.Mock)
      .mockResolvedValueOnce({
        id: OWNER_ID,
        email: OWNER_EMAIL,
        activeOrganizationId: ORG_ID,
        activeOrganization: { name: 'Test Org' },
      })
      .mockResolvedValueOnce({ id: INVITEE_ID, email: INVITEE_EMAIL, organizations: [] });
    (mockPrisma.userOrganization.findUnique as jest.Mock).mockResolvedValue({ role: 'OWNER' });
    (mockPrisma.invitation.findFirst as jest.Mock).mockResolvedValue(null);
    (mockPrisma.invitation.create as jest.Mock).mockResolvedValue({
      id: 'inv-1',
      token: INVITE_TOKEN,
      email: INVITEE_EMAIL,
      organizationId: ORG_ID,
      status: 'pending',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    const req = new NextRequest('http://localhost/api/invitations', {
      method: 'POST',
      body: JSON.stringify({ email: INVITEE_EMAIL, role: 'MEMBER' }),
    });

    const res = await CREATE_INVITE(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.invitation).toBeDefined();
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
  });

  it('Step 2: Invitee accepts valid invitation and joins organization', async () => {
    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    mockAuth.mockResolvedValue({ user: { id: INVITEE_ID, email: INVITEE_EMAIL } } as any);
    (mockPrisma.invitation.findUnique as jest.Mock).mockResolvedValue({
      id: 'inv-1',
      token: INVITE_TOKEN,
      email: INVITEE_EMAIL,
      status: 'pending',
      expiresAt: futureDate,
      organizationId: ORG_ID,
      role: 'MEMBER',
      organization: { name: 'Test Org' },
    });
    (mockPrisma.userOrganization.findFirst as jest.Mock).mockResolvedValue(null);
    (mockPrisma.$transaction as jest.Mock).mockResolvedValue([]);

    const req = new NextRequest('http://localhost/api/invitations/accept', {
      method: 'POST',
      body: JSON.stringify({ token: INVITE_TOKEN }),
    });

    const res = await ACCEPT_INVITE(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('Step 3: Expired invitation is rejected with 400', async () => {
    mockAuth.mockResolvedValue({ user: { id: INVITEE_ID, email: INVITEE_EMAIL } } as any);
    (mockPrisma.invitation.findUnique as jest.Mock).mockResolvedValue({
      id: 'inv-2',
      token: 'expired-token',
      email: INVITEE_EMAIL,
      status: 'pending',
      expiresAt: new Date('2020-01-01'),
      organizationId: ORG_ID,
      organization: { name: 'Test Org' },
    });
    (mockPrisma.invitation.update as jest.Mock).mockResolvedValue({});

    const req = new NextRequest('http://localhost/api/invitations/accept', {
      method: 'POST',
      body: JSON.stringify({ token: 'expired-token' }),
    });

    const res = await ACCEPT_INVITE(req);
    expect(res.status).toBe(400);
  });

  it('Step 4: Duplicate acceptance of already-accepted invitation is rejected', async () => {
    mockAuth.mockResolvedValue({ user: { id: INVITEE_ID, email: INVITEE_EMAIL } } as any);
    (mockPrisma.invitation.findUnique as jest.Mock).mockResolvedValue({
      id: 'inv-3',
      token: 'already-used',
      email: INVITEE_EMAIL,
      status: 'accepted',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      organizationId: ORG_ID,
      organization: { name: 'Test Org' },
    });

    const req = new NextRequest('http://localhost/api/invitations/accept', {
      method: 'POST',
      body: JSON.stringify({ token: 'already-used' }),
    });

    const res = await ACCEPT_INVITE(req);
    expect(res.status).toBe(400);
  });
});
