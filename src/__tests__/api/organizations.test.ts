import { NextRequest } from 'next/server';
import { GET, POST } from '@/app/api/organizations/route';
import { prisma } from '@/lib/db';

// Mock the prisma client
jest.mock('@/lib/db');
const mockPrisma = prisma as jest.Mocked<typeof prisma>;

// Mock the auth function
jest.mock('@/lib/auth', () => ({
  auth: jest.fn(),
}));

import { auth } from '@/lib/auth';
const mockAuth = auth as jest.MockedFunction<typeof auth>;

describe('/api/organizations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/organizations', () => {
    it('should return organizations for authenticated user', async () => {
      // Mock authenticated user
      mockAuth.mockResolvedValue({
        user: {
          id: 'user-1',
          email: 'test@example.com',
          role: 'OWNER',
          organizationId: 'org-1',
          name: 'Test User',
          image: null,
        },
      });

      // Mock organizations data
      const mockOrganizations = [
        {
          id: 'org-1',
          name: 'Test Organization',
          cui: '12345678',
          cpvCodes: ['72000000'],
          keywords: ['software'],
          members: [
            {
              user: {
                id: 'user-1',
                email: 'test@example.com',
                name: 'Test User',
              },
              role: 'OWNER',
            },
          ],
        },
      ];

      mockPrisma.organization.findMany.mockResolvedValue(mockOrganizations as any);

      const request = new NextRequest('http://localhost:3000/api/organizations');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({ organizations: mockOrganizations });
      expect(mockPrisma.organization.findMany).toHaveBeenCalledWith({
        where: {
          members: {
            some: {
              userId: 'user-1',
            },
          },
        },
        include: {
          members: {
            include: {
              user: {
                select: {
                  id: true,
                  email: true,
                  name: true,
                },
              },
            },
          },
        },
      });
    });

    it('should return 401 for unauthenticated user', async () => {
      mockAuth.mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/organizations');
      const response = await GET(request);

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/organizations', () => {
    it('should create new organization for authenticated user', async () => {
      mockAuth.mockResolvedValue({
        user: {
          id: 'user-1',
          email: 'test@example.com',
          role: 'OWNER',
          organizationId: null,
          name: 'Test User',
          image: null,
        },
      });

      const newOrg = {
        id: 'org-new',
        name: 'New Organization',
        cui: '87654321',
        cpvCodes: [],
        keywords: [],
      };

      mockPrisma.organization.create.mockResolvedValue(newOrg as any);
      mockPrisma.user.update.mockResolvedValue({} as any);

      const request = new NextRequest('http://localhost:3000/api/organizations', {
        method: 'POST',
        body: JSON.stringify({
          name: 'New Organization',
          cui: '87654321',
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data).toEqual({ organization: newOrg });
      expect(mockPrisma.organization.create).toHaveBeenCalled();
    });

    it('should return 401 for unauthenticated user', async () => {
      mockAuth.mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/organizations', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Test Organization',
          cui: '12345678',
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const response = await POST(request);

      expect(response.status).toBe(401);
    });

    it('should validate required fields', async () => {
      mockAuth.mockResolvedValue({
        user: {
          id: 'user-1',
          email: 'test@example.com',
          role: 'OWNER',
          organizationId: null,
          name: 'Test User',
          image: null,
        },
      });

      const request = new NextRequest('http://localhost:3000/api/organizations', {
        method: 'POST',
        body: JSON.stringify({
          name: '', // Invalid name
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
    });
  });
});