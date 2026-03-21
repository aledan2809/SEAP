import { NextRequest } from 'next/server';
import { POST } from '@/app/api/scan/route';

// Mock the scanner module
jest.mock('@/lib/seap/scanner', () => ({
  scanTenders: jest.fn(),
}));

import { scanTenders } from '@/lib/seap/scanner';
const mockScanTenders = scanTenders as jest.MockedFunction<typeof scanTenders>;

describe('/api/scan', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/scan', () => {
    it('should trigger tender scanning with correct secret', async () => {
      process.env.CRON_SECRET = 'test-cron-secret';

      const mockScanResult = {
        success: true,
        message: 'Scan completed successfully',
        newTenders: 5,
        updatedTenders: 2,
        errors: [],
      };

      mockScanTenders.mockResolvedValue(mockScanResult);

      const request = new NextRequest('http://localhost:3000/api/scan', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer test-cron-secret',
          'Content-Type': 'application/json',
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(mockScanResult);
      expect(mockScanTenders).toHaveBeenCalledTimes(1);
    });

    it('should return 401 for missing authorization', async () => {
      const request = new NextRequest('http://localhost:3000/api/scan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const response = await POST(request);

      expect(response.status).toBe(401);
      expect(mockScanTenders).not.toHaveBeenCalled();
    });

    it('should return 401 for incorrect secret', async () => {
      process.env.CRON_SECRET = 'test-cron-secret';

      const request = new NextRequest('http://localhost:3000/api/scan', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer wrong-secret',
          'Content-Type': 'application/json',
        },
      });

      const response = await POST(request);

      expect(response.status).toBe(401);
      expect(mockScanTenders).not.toHaveBeenCalled();
    });

    it('should handle scanner errors gracefully', async () => {
      process.env.CRON_SECRET = 'test-cron-secret';

      const mockError = new Error('SEAP API unavailable');
      mockScanTenders.mockRejectedValue(mockError);

      const request = new NextRequest('http://localhost:3000/api/scan', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer test-cron-secret',
          'Content-Type': 'application/json',
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to scan tenders');
      expect(mockScanTenders).toHaveBeenCalledTimes(1);
    });

    it('should handle cron job scheduling format', async () => {
      process.env.CRON_SECRET = 'test-cron-secret';

      const mockScanResult = {
        success: true,
        message: 'Scheduled scan completed',
        newTenders: 3,
        updatedTenders: 1,
        errors: [],
      };

      mockScanTenders.mockResolvedValue(mockScanResult);

      // Simulate Vercel cron request with specific headers
      const request = new NextRequest('http://localhost:3000/api/scan', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer test-cron-secret',
          'User-Agent': 'Vercel-Cron/1.0',
          'Content-Type': 'application/json',
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockScanTenders).toHaveBeenCalledTimes(1);
    });
  });
});