import { NextRequest } from 'next/server';
import { POST } from '@/app/api/tenders/[id]/analyze/route';
import { prisma } from '@/lib/db';

// Mock dependencies
jest.mock('@/lib/db');
jest.mock('@/lib/auth');
jest.mock('@/lib/ai/analyzer');

import { auth } from '@/lib/auth';
import { analyzeWithClaude } from '@/lib/ai/analyzer';

const mockPrisma = prisma as jest.Mocked<typeof prisma>;
const mockAuth = auth as jest.MockedFunction<typeof auth>;
const mockAnalyzeWithClaude = analyzeWithClaude as jest.MockedFunction<typeof analyzeWithClaude>;

describe('/api/tenders/[id]/analyze', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/tenders/[id]/analyze', () => {
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
      organization: {
        name: 'Test Organization',
        cui: '87654321',
        cpvCodes: ['72000000'],
        keywords: ['software', 'development'],
      },
      documents: [],
    };

    const mockAnalysisResult = {
      strengths: ['CPV match with company profile', 'Reasonable deadline'],
      weaknesses: ['High competition expected'],
      opportunities: ['Government contract reference', 'Long-term partnership potential'],
      threats: ['Complex technical requirements'],
      recommendation: 'GO' as const,
      aiSummary: 'Good opportunity for our company with manageable risks.',
      aiNotes: 'Consider forming a partnership for enhanced competitiveness.',
      qualificationReqs: { cifraAfaceri: '1000000 RON', experientaSimilara: '3 years' },
      technicalSpecs: { descriere: 'Modern web application', restrictive: false },
      evaluationCriteria: { tip: 'calitate_pret', ponderi: { technical: 0.7, price: 0.3 } },
      keyDates: { depunere: '2024-02-01', deschidere: '2024-02-05' },
      confidence: 0.85,
      modelUsed: 'claude-cli',
    };

    it('should analyze tender successfully for authorized user', async () => {
      mockAuth.mockResolvedValue({ user: mockUser });
      mockPrisma.tender.findUnique.mockResolvedValue(mockTender as any);
      mockAnalyzeWithClaude.mockResolvedValue(mockAnalysisResult);
      mockPrisma.tenderAnalysis.create.mockResolvedValue({
        id: 'analysis-1',
        tenderId: 'tender-1',
        ...mockAnalysisResult,
      } as any);

      const request = new NextRequest('http://localhost:3000/api/tenders/tender-1/analyze', {
        method: 'POST',
      });

      const response = await POST(request, { params: { id: 'tender-1' } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.analysis).toBeDefined();
      expect(data.analysis.recommendation).toBe('GO');
      expect(mockAnalyzeWithClaude).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'tender-1',
          title: 'Software Development Services',
        })
      );
    });

    it('should return 401 for unauthenticated user', async () => {
      mockAuth.mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/tenders/tender-1/analyze', {
        method: 'POST',
      });

      const response = await POST(request, { params: { id: 'tender-1' } });

      expect(response.status).toBe(401);
      expect(mockAnalyzeWithClaude).not.toHaveBeenCalled();
    });

    it('should return 404 for non-existent tender', async () => {
      mockAuth.mockResolvedValue({ user: mockUser });
      mockPrisma.tender.findUnique.mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/tenders/invalid-id/analyze', {
        method: 'POST',
      });

      const response = await POST(request, { params: { id: 'invalid-id' } });

      expect(response.status).toBe(404);
      expect(mockAnalyzeWithClaude).not.toHaveBeenCalled();
    });

    it('should return 403 for unauthorized organization access', async () => {
      mockAuth.mockResolvedValue({
        user: { ...mockUser, organizationId: 'org-2' }, // Different organization
      });
      mockPrisma.tender.findUnique.mockResolvedValue(mockTender as any);

      const request = new NextRequest('http://localhost:3000/api/tenders/tender-1/analyze', {
        method: 'POST',
      });

      const response = await POST(request, { params: { id: 'tender-1' } });

      expect(response.status).toBe(403);
      expect(mockAnalyzeWithClaude).not.toHaveBeenCalled();
    });

    it('should handle AI analysis errors gracefully', async () => {
      mockAuth.mockResolvedValue({ user: mockUser });
      mockPrisma.tender.findUnique.mockResolvedValue(mockTender as any);
      mockAnalyzeWithClaude.mockRejectedValue(new Error('AI service unavailable'));

      const request = new NextRequest('http://localhost:3000/api/tenders/tender-1/analyze', {
        method: 'POST',
      });

      const response = await POST(request, { params: { id: 'tender-1' } });

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe('Failed to analyze tender');
    });

    it('should update existing analysis if already exists', async () => {
      mockAuth.mockResolvedValue({ user: mockUser });
      mockPrisma.tender.findUnique.mockResolvedValue(mockTender as any);
      mockAnalyzeWithClaude.mockResolvedValue(mockAnalysisResult);

      // Mock existing analysis
      mockPrisma.tenderAnalysis.create.mockRejectedValue({ code: 'P2002' }); // Unique constraint error
      mockPrisma.tenderAnalysis.update.mockResolvedValue({
        id: 'analysis-1',
        tenderId: 'tender-1',
        ...mockAnalysisResult,
      } as any);

      const request = new NextRequest('http://localhost:3000/api/tenders/tender-1/analyze', {
        method: 'POST',
      });

      const response = await POST(request, { params: { id: 'tender-1' } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(mockPrisma.tenderAnalysis.update).toHaveBeenCalled();
    });
  });
});