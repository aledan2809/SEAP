import { NextRequest } from 'next/server';
import { GET } from '@/app/api/tenders/[id]/pdf/route';
import { prisma } from '@/lib/db';

// Mock dependencies
jest.mock('@/lib/db');
jest.mock('@/lib/auth');
jest.mock('@/lib/pdf/tender-report');

import { auth } from '@/lib/auth';
import { generateTenderReport } from '@/lib/pdf/tender-report';

const mockPrisma = prisma as jest.Mocked<typeof prisma>;
const mockAuth = auth as jest.MockedFunction<typeof auth>;
const mockGenerateReport = generateTenderReport as jest.MockedFunction<typeof generateTenderReport>;

describe('/api/tenders/[id]/pdf', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/tenders/[id]/pdf', () => {
    const mockUser = {
      id: 'user-1',
      email: 'test@example.com',
      role: 'OWNER',
      organizationId: 'org-1',
      name: 'Test User',
      image: null,
    };

    const mockTender = {
      id: 'tender-1',
      title: 'Software Development Services',
      description: 'Development of custom software application',
      contractingAuth: 'Ministry of Digital Affairs',
      contractingAuthCui: '12345678',
      estimatedValue: 500000,
      currency: 'RON',
      cpvCode: '72000000',
      cpvDescription: 'Computer programming services',
      procedureType: 'Open procedure',
      contractType: 'Services',
      publicationDate: new Date('2024-01-01'),
      submissionDeadline: new Date('2024-02-01'),
      organizationId: 'org-1',
      status: 'OPEN',
      organization: {
        id: 'org-1',
        name: 'Test Organization',
        cui: '87654321',
      },
      analysis: {
        id: 'analysis-1',
        strengths: ['CPV match', 'Good value'],
        weaknesses: ['Tight deadline'],
        opportunities: ['Government reference'],
        threats: ['High competition'],
        recommendation: 'GO',
        aiSummary: 'Recommended opportunity',
        confidence: 0.8,
        modelUsed: 'claude-cli',
        createdAt: new Date(),
      },
      documents: [
        {
          id: 'doc-1',
          filename: 'tender-specs.pdf',
          docType: 'TECHNICAL_SPECS',
          fileSize: 1024000,
        },
      ],
    };

    it('should generate PDF report for authorized user', async () => {
      mockAuth.mockResolvedValue({ user: mockUser });
      mockPrisma.tender.findUnique.mockResolvedValue(mockTender as any);

      const mockPdfBuffer = Buffer.from('fake-pdf-content');
      mockGenerateReport.mockResolvedValue(mockPdfBuffer);

      const request = new NextRequest('http://localhost:3000/api/tenders/tender-1/pdf');
      const response = await GET(request, { params: { id: 'tender-1' } });

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('application/pdf');
      expect(response.headers.get('Content-Disposition')).toContain('Software_Development_Services');

      const responseData = await response.arrayBuffer();
      expect(Buffer.from(responseData)).toEqual(mockPdfBuffer);

      expect(mockGenerateReport).toHaveBeenCalledWith(mockTender);
    });

    it('should return 401 for unauthenticated user', async () => {
      mockAuth.mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/tenders/tender-1/pdf');
      const response = await GET(request, { params: { id: 'tender-1' } });

      expect(response.status).toBe(401);
      expect(mockGenerateReport).not.toHaveBeenCalled();
    });

    it('should return 404 for non-existent tender', async () => {
      mockAuth.mockResolvedValue({ user: mockUser });
      mockPrisma.tender.findUnique.mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/tenders/invalid-id/pdf');
      const response = await GET(request, { params: { id: 'invalid-id' } });

      expect(response.status).toBe(404);
      expect(mockGenerateReport).not.toHaveBeenCalled();
    });

    it('should return 403 for unauthorized organization access', async () => {
      mockAuth.mockResolvedValue({
        user: { ...mockUser, organizationId: 'org-2' }, // Different organization
      });
      mockPrisma.tender.findUnique.mockResolvedValue(mockTender as any);

      const request = new NextRequest('http://localhost:3000/api/tenders/tender-1/pdf');
      const response = await GET(request, { params: { id: 'tender-1' } });

      expect(response.status).toBe(403);
      expect(mockGenerateReport).not.toHaveBeenCalled();
    });

    it('should handle PDF generation errors gracefully', async () => {
      mockAuth.mockResolvedValue({ user: mockUser });
      mockPrisma.tender.findUnique.mockResolvedValue(mockTender as any);
      mockGenerateReport.mockRejectedValue(new Error('PDF generation failed'));

      const request = new NextRequest('http://localhost:3000/api/tenders/tender-1/pdf');
      const response = await GET(request, { params: { id: 'tender-1' } });

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe('Failed to generate PDF report');
    });

    it('should include analysis data when available', async () => {
      mockAuth.mockResolvedValue({ user: mockUser });
      mockPrisma.tender.findUnique.mockResolvedValue(mockTender as any);
      mockGenerateReport.mockResolvedValue(Buffer.from('pdf-with-analysis'));

      const request = new NextRequest('http://localhost:3000/api/tenders/tender-1/pdf');
      await GET(request, { params: { id: 'tender-1' } });

      expect(mockGenerateReport).toHaveBeenCalledWith(
        expect.objectContaining({
          analysis: expect.objectContaining({
            recommendation: 'GO',
            confidence: 0.8,
          }),
        })
      );
    });

    it('should work without analysis data', async () => {
      const tenderWithoutAnalysis = { ...mockTender, analysis: null };

      mockAuth.mockResolvedValue({ user: mockUser });
      mockPrisma.tender.findUnique.mockResolvedValue(tenderWithoutAnalysis as any);
      mockGenerateReport.mockResolvedValue(Buffer.from('pdf-no-analysis'));

      const request = new NextRequest('http://localhost:3000/api/tenders/tender-1/pdf');
      const response = await GET(request, { params: { id: 'tender-1' } });

      expect(response.status).toBe(200);
      expect(mockGenerateReport).toHaveBeenCalledWith(
        expect.objectContaining({
          analysis: null,
        })
      );
    });

    it('should sanitize filename for download', async () => {
      const tenderWithSpecialChars = {
        ...mockTender,
        title: 'Software/Development & IT Services: Phase 1',
      };

      mockAuth.mockResolvedValue({ user: mockUser });
      mockPrisma.tender.findUnique.mockResolvedValue(tenderWithSpecialChars as any);
      mockGenerateReport.mockResolvedValue(Buffer.from('pdf'));

      const request = new NextRequest('http://localhost:3000/api/tenders/tender-1/pdf');
      const response = await GET(request, { params: { id: 'tender-1' } });

      expect(response.status).toBe(200);
      const filename = response.headers.get('Content-Disposition');
      expect(filename).toContain('Software_Development___IT_Services__Phase_1');
      expect(filename).not.toContain('/');
      expect(filename).not.toContain('&');
      expect(filename).not.toContain(':');
    });
  });
});