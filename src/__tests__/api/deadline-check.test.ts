import { NextRequest } from 'next/server';
import { POST } from '@/app/api/notifications/deadline-check/route';
import { prisma } from '@/lib/db';

// Mock dependencies
jest.mock('@/lib/db');
jest.mock('@/lib/notifications/email-service');

import { sendDeadlineAlert } from '@/lib/notifications/email-service';

const mockPrisma = prisma as jest.Mocked<typeof prisma>;
const mockSendEmail = sendDeadlineAlert as jest.MockedFunction<typeof sendDeadlineAlert>;

describe('/api/notifications/deadline-check', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/notifications/deadline-check', () => {
    it('should check deadlines and send alerts with valid secret', async () => {
      process.env.CRON_SECRET = 'test-cron-secret';

      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const dayAfter = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);

      const mockTenders = [
        {
          id: 'tender-1',
          title: 'Software Development',
          submissionDeadline: tomorrow,
          contractingAuth: 'Ministry of Digital',
          estimatedValue: 500000,
          currency: 'RON',
          organization: {
            id: 'org-1',
            name: 'Test Company',
            members: [
              {
                user: {
                  email: 'test1@example.com',
                  name: 'User 1',
                },
                role: 'OWNER',
              },
              {
                user: {
                  email: 'test2@example.com',
                  name: 'User 2',
                },
                role: 'ADMIN',
              },
            ],
          },
        },
        {
          id: 'tender-2',
          title: 'IT Consulting',
          submissionDeadline: dayAfter,
          contractingAuth: 'City Hall',
          estimatedValue: 100000,
          currency: 'RON',
          organization: {
            id: 'org-2',
            name: 'Another Company',
            members: [
              {
                user: {
                  email: 'test3@example.com',
                  name: 'User 3',
                },
                role: 'OWNER',
              },
            ],
          },
        },
      ];

      mockPrisma.tender.findMany.mockResolvedValue(mockTenders as any);
      mockSendEmail.mockResolvedValue(undefined);

      const request = new NextRequest('http://localhost:3000/api/notifications/deadline-check', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer test-cron-secret',
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.alertsSent).toBe(3); // 2 emails for tender-1, 1 email for tender-2
      expect(mockSendEmail).toHaveBeenCalledTimes(3);

      // Verify query parameters
      expect(mockPrisma.tender.findMany).toHaveBeenCalledWith({
        where: {
          submissionDeadline: {
            gte: expect.any(Date),
            lte: expect.any(Date),
          },
          status: {
            not: 'EXPIRED',
          },
        },
        include: {
          organization: {
            include: {
              members: {
                include: {
                  user: {
                    select: {
                      email: true,
                      name: true,
                    },
                  },
                },
              },
            },
          },
        },
      });
    });

    it('should return 401 for missing authorization', async () => {
      const request = new NextRequest('http://localhost:3000/api/notifications/deadline-check', {
        method: 'POST',
      });

      const response = await POST(request);

      expect(response.status).toBe(401);
      expect(mockSendEmail).not.toHaveBeenCalled();
    });

    it('should return 401 for invalid secret', async () => {
      process.env.CRON_SECRET = 'test-cron-secret';

      const request = new NextRequest('http://localhost:3000/api/notifications/deadline-check', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer wrong-secret',
        },
      });

      const response = await POST(request);

      expect(response.status).toBe(401);
      expect(mockSendEmail).not.toHaveBeenCalled();
    });

    it('should handle empty results gracefully', async () => {
      process.env.CRON_SECRET = 'test-cron-secret';
      mockPrisma.tender.findMany.mockResolvedValue([]);

      const request = new NextRequest('http://localhost:3000/api/notifications/deadline-check', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer test-cron-secret',
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.alertsSent).toBe(0);
      expect(data.message).toBe('No upcoming deadlines found');
      expect(mockSendEmail).not.toHaveBeenCalled();
    });

    it('should handle email sending errors gracefully', async () => {
      process.env.CRON_SECRET = 'test-cron-secret';

      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const mockTender = [
        {
          id: 'tender-1',
          title: 'Software Development',
          submissionDeadline: tomorrow,
          contractingAuth: 'Ministry of Digital',
          estimatedValue: 500000,
          currency: 'RON',
          organization: {
            id: 'org-1',
            name: 'Test Company',
            members: [
              {
                user: {
                  email: 'invalid@example.com',
                  name: 'User 1',
                },
                role: 'OWNER',
              },
            ],
          },
        },
      ];

      mockPrisma.tender.findMany.mockResolvedValue(mockTender as any);
      mockSendEmail.mockRejectedValue(new Error('Email service unavailable'));

      const request = new NextRequest('http://localhost:3000/api/notifications/deadline-check', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer test-cron-secret',
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.alertsSent).toBe(0);
      expect(data.errors).toBeDefined();
      expect(data.errors.length).toBeGreaterThan(0);
    });

    it('should filter deadlines within correct time window', async () => {
      process.env.CRON_SECRET = 'test-cron-secret';
      process.env.DAILY_DIGEST_HOUR_UTC = '9';
      process.env.DAILY_DIGEST_MINUTE_WINDOW = '15';

      mockPrisma.tender.findMany.mockResolvedValue([]);

      const request = new NextRequest('http://localhost:3000/api/notifications/deadline-check', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer test-cron-secret',
        },
      });

      const response = await POST(request);

      expect(response.status).toBe(200);

      // Verify that the query uses the correct time window (24-72 hours ahead)
      const callArgs = mockPrisma.tender.findMany.mock.calls[0][0];
      const whereClause = callArgs.where;

      expect(whereClause.submissionDeadline.gte).toBeInstanceOf(Date);
      expect(whereClause.submissionDeadline.lte).toBeInstanceOf(Date);

      // Check that the time difference is approximately 48 hours
      const timeDiff = whereClause.submissionDeadline.lte.getTime() - whereClause.submissionDeadline.gte.getTime();
      const expectedDiff = 48 * 60 * 60 * 1000; // 48 hours in milliseconds
      expect(Math.abs(timeDiff - expectedDiff)).toBeLessThan(60 * 60 * 1000); // Allow 1 hour tolerance
    });
  });
});