import { NextRequest } from 'next/server';
import { GET } from '@/app/api/invitations/route';
import { POST } from '@/app/api/invitations/accept/route';
import { prisma } from '@/lib/db';

// Mock dependencies
jest.mock('@/lib/db');
jest.mock('@/lib/auth');
jest.mock('@/lib/email/invitation-emails');

import { auth } from '@/lib/auth';
import { sendInvitationAcceptedEmail } from '@/lib/email/invitation-emails';

const mockPrisma = prisma as jest.Mocked<typeof prisma>;
const mockAuth = auth as jest.MockedFunction<typeof auth>;
const mockSendEmail = sendInvitationAcceptedEmail as jest.MockedFunction<typeof sendInvitationAcceptedEmail>;

describe('/api/invitations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/invitations', () => {
    const mockUser = {
      id: 'user-1',
      email: 'test@example.com',
      role: 'MEMBER',
      organizationId: 'org-1',
      name: 'Test User',
      image: null,
    };

    it('should return user invitations', async () => {
      mockAuth.mockResolvedValue({ user: mockUser });

      const mockInvitations = [
        {
          id: 'inv-1',
          token: 'token-1',
          email: 'test@example.com',
          role: 'MEMBER',
          organizationId: 'org-2',
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 1 day from now
          acceptedAt: null,
          createdAt: new Date(),
          organization: {
            id: 'org-2',
            name: 'Another Organization',
            cui: '12345678',
          },
        },
      ];

      mockPrisma.invitation.findMany.mockResolvedValue(mockInvitations as any);

      const request = new NextRequest('http://localhost:3000/api/invitations');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.invitations).toEqual(mockInvitations);
      expect(mockPrisma.invitation.findMany).toHaveBeenCalledWith({
        where: {
          email: 'test@example.com',
          acceptedAt: null,
          expiresAt: { gt: expect.any(Date) },
        },
        include: {
          organization: {
            select: {
              id: true,
              name: true,
              cui: true,
            },
          },
        },
      });
    });

    it('should return 401 for unauthenticated user', async () => {
      mockAuth.mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/invitations');
      const response = await GET(request);

      expect(response.status).toBe(401);
    });

    it('should return empty array when no invitations exist', async () => {
      mockAuth.mockResolvedValue({ user: mockUser });
      mockPrisma.invitation.findMany.mockResolvedValue([]);

      const request = new NextRequest('http://localhost:3000/api/invitations');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.invitations).toEqual([]);
    });
  });

  describe('POST /api/invitations/accept', () => {
    const mockInvitation = {
      id: 'inv-1',
      token: 'valid-token',
      email: 'test@example.com',
      role: 'MEMBER',
      organizationId: 'org-2',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 1 day from now
      acceptedAt: null,
      organization: {
        id: 'org-2',
        name: 'Test Organization',
        cui: '12345678',
      },
    };

    it('should accept valid invitation', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
      };

      mockPrisma.invitation.findUnique.mockResolvedValue(mockInvitation as any);
      mockPrisma.user.findUnique.mockResolvedValue(mockUser as any);
      mockPrisma.userOrganization.create.mockResolvedValue({} as any);
      mockPrisma.invitation.update.mockResolvedValue({
        ...mockInvitation,
        acceptedAt: new Date(),
      } as any);
      mockSendEmail.mockResolvedValue(undefined);

      const request = new NextRequest('http://localhost:3000/api/invitations/accept', {
        method: 'POST',
        body: JSON.stringify({ token: 'valid-token' }),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe('Invitation accepted successfully');
      expect(mockPrisma.userOrganization.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          organizationId: 'org-2',
          role: 'MEMBER',
        },
      });
    });

    it('should return 400 for missing token', async () => {
      const request = new NextRequest('http://localhost:3000/api/invitations/accept', {
        method: 'POST',
        body: JSON.stringify({}),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    it('should return 404 for invalid token', async () => {
      mockPrisma.invitation.findUnique.mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/invitations/accept', {
        method: 'POST',
        body: JSON.stringify({ token: 'invalid-token' }),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const response = await POST(request);

      expect(response.status).toBe(404);
    });

    it('should return 400 for expired invitation', async () => {
      const expiredInvitation = {
        ...mockInvitation,
        expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
      };

      mockPrisma.invitation.findUnique.mockResolvedValue(expiredInvitation as any);

      const request = new NextRequest('http://localhost:3000/api/invitations/accept', {
        method: 'POST',
        body: JSON.stringify({ token: 'valid-token' }),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invitation has expired');
    });

    it('should return 400 for already accepted invitation', async () => {
      const acceptedInvitation = {
        ...mockInvitation,
        acceptedAt: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
      };

      mockPrisma.invitation.findUnique.mockResolvedValue(acceptedInvitation as any);

      const request = new NextRequest('http://localhost:3000/api/invitations/accept', {
        method: 'POST',
        body: JSON.stringify({ token: 'valid-token' }),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invitation has already been accepted');
    });

    it('should handle user creation for new users', async () => {
      mockPrisma.invitation.findUnique.mockResolvedValue(mockInvitation as any);
      mockPrisma.user.findUnique.mockResolvedValue(null); // User doesn't exist

      const newUser = {
        id: 'user-new',
        email: 'test@example.com',
        name: null,
      };

      mockPrisma.user.create.mockResolvedValue(newUser as any);
      mockPrisma.userOrganization.create.mockResolvedValue({} as any);
      mockPrisma.invitation.update.mockResolvedValue({
        ...mockInvitation,
        acceptedAt: new Date(),
      } as any);

      const request = new NextRequest('http://localhost:3000/api/invitations/accept', {
        method: 'POST',
        body: JSON.stringify({ token: 'valid-token' }),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: {
          email: 'test@example.com',
        },
      });
    });
  });
});