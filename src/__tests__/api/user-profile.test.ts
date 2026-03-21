import { NextRequest } from 'next/server';
import { PUT } from '@/app/api/user/profile/route';
import { prisma } from '@/lib/db';

// Mock dependencies
jest.mock('@/lib/db');
jest.mock('@/lib/auth');
jest.mock('@/lib/audit-log');

import { auth } from '@/lib/auth';
import { logAction } from '@/lib/audit-log';

const mockPrisma = prisma as jest.Mocked<typeof prisma>;
const mockAuth = auth as jest.MockedFunction<typeof auth>;
const mockLogAction = logAction as jest.MockedFunction<typeof logAction>;

describe('/api/user/profile', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('PUT /api/user/profile', () => {
    const mockUser = {
      id: 'user-1',
      email: 'test@example.com',
      role: 'OWNER',
      organizationId: 'org-1',
      name: 'Test User',
      image: null,
    };

    it('should update user profile successfully', async () => {
      mockAuth.mockResolvedValue({ user: mockUser });

      const updatedUser = {
        id: 'user-1',
        email: 'test@example.com',
        name: 'Updated Name',
        image: null,
        activeOrganizationId: 'org-2',
      };

      mockPrisma.user.update.mockResolvedValue(updatedUser as any);
      mockLogAction.mockResolvedValue(undefined);

      const request = new NextRequest('http://localhost:3000/api/user/profile', {
        method: 'PUT',
        body: JSON.stringify({
          name: 'Updated Name',
          activeOrganizationId: 'org-2',
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.user).toEqual(updatedUser);

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: {
          name: 'Updated Name',
          activeOrganizationId: 'org-2',
        },
        select: {
          id: true,
          email: true,
          name: true,
          image: true,
          activeOrganizationId: true,
        },
      });

      expect(mockLogAction).toHaveBeenCalledWith({
        userId: 'user-1',
        userEmail: 'test@example.com',
        action: 'PROFILE_UPDATE',
        resource: 'user',
        details: { updatedFields: ['name', 'activeOrganizationId'] },
      });
    });

    it('should return 401 for unauthenticated user', async () => {
      mockAuth.mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/user/profile', {
        method: 'PUT',
        body: JSON.stringify({
          name: 'Updated Name',
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const response = await PUT(request);

      expect(response.status).toBe(401);
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });

    it('should validate input data', async () => {
      mockAuth.mockResolvedValue({ user: mockUser });

      const request = new NextRequest('http://localhost:3000/api/user/profile', {
        method: 'PUT',
        body: JSON.stringify({
          name: '', // Invalid empty name
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const response = await PUT(request);

      expect(response.status).toBe(400);
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });

    it('should handle partial updates', async () => {
      mockAuth.mockResolvedValue({ user: mockUser });

      const updatedUser = {
        id: 'user-1',
        email: 'test@example.com',
        name: 'Only Name Updated',
        image: null,
        activeOrganizationId: 'org-1',
      };

      mockPrisma.user.update.mockResolvedValue(updatedUser as any);

      const request = new NextRequest('http://localhost:3000/api/user/profile', {
        method: 'PUT',
        body: JSON.stringify({
          name: 'Only Name Updated',
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: {
          name: 'Only Name Updated',
        },
        select: {
          id: true,
          email: true,
          name: true,
          image: true,
          activeOrganizationId: true,
        },
      });
    });

    it('should handle database errors gracefully', async () => {
      mockAuth.mockResolvedValue({ user: mockUser });

      mockPrisma.user.update.mockRejectedValue(new Error('Database connection failed'));

      const request = new NextRequest('http://localhost:3000/api/user/profile', {
        method: 'PUT',
        body: JSON.stringify({
          name: 'Updated Name',
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to update profile');
    });

    it('should validate organization membership for activeOrganizationId', async () => {
      mockAuth.mockResolvedValue({ user: mockUser });

      // Mock organization check to return null (user not member)
      mockPrisma.userOrganization.findFirst.mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/user/profile', {
        method: 'PUT',
        body: JSON.stringify({
          activeOrganizationId: 'org-unauthorized',
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('not a member');
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });

    it('should accept null activeOrganizationId', async () => {
      mockAuth.mockResolvedValue({ user: mockUser });

      const updatedUser = {
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        image: null,
        activeOrganizationId: null,
      };

      mockPrisma.user.update.mockResolvedValue(updatedUser as any);

      const request = new NextRequest('http://localhost:3000/api/user/profile', {
        method: 'PUT',
        body: JSON.stringify({
          activeOrganizationId: null,
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.user.activeOrganizationId).toBeNull();
    });

    it('should handle malformed JSON gracefully', async () => {
      mockAuth.mockResolvedValue({ user: mockUser });

      const request = new NextRequest('http://localhost:3000/api/user/profile', {
        method: 'PUT',
        body: 'invalid json',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const response = await PUT(request);

      expect(response.status).toBe(400);
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });
  });
});