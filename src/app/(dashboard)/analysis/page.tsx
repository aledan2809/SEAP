import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Brain,
  ThumbsUp,
  ThumbsDown,
  AlertTriangle,
  TrendingUp,
  ArrowRight,
  BarChart3,
} from 'lucide-react';

const recommendationConfig: Record<
  string,
  { label: string; color: string; icon: React.ReactNode }
> = {
  GO: {
    label: 'Recomandat',
    color: 'bg-green-100 text-green-800',
    icon: <ThumbsUp className="h-4 w-4" />,
  },
  CAUTION: {
    label: 'Cu rezerve',
    color: 'bg-yellow-100 text-yellow-800',
    icon: <AlertTriangle className="h-4 w-4" />,
  },
  NO_GO: {
    label: 'Nu recomandat',
    color: 'bg-red-100 text-red-800',
    icon: <ThumbsDown className="h-4 w-4" />,
  },
  PENDING: {
    label: 'În așteptare',
    color: 'bg-gray-100 text-gray-800',
    icon: <Brain className="h-4 w-4" />,
  },
};

export default async function AnalysisPage() {
  const session = await auth();
  if (!session?.user) {
    redirect('/login');
  }

  // Get tenders with analysis
  const tendersWithAnalysis = await prisma.tender.findMany({
    where: {
      organization: {
        userOrganizations: {
          some: { userId: session.user.id },
        },
      },
      analysis: {
        isNot: null,
      },
    },
    include: {
      analysis: true,
    },
    orderBy: {
      analysis: {
        analyzedAt: 'desc',
      },
    },
    take: 50,
  });

  // Get analysis stats
  const totalAnalyzed = tendersWithAnalysis.length;
  const goCount = tendersWithAnalysis.filter((t) => t.analysis?.recommendation === 'GO').length;
  const cautionCount = tendersWithAnalysis.filter(
    (t) => t.analysis?.recommendation === 'CAUTION'
  ).length;
  const noGoCount = tendersWithAnalysis.filter(
    (t) => t.analysis?.recommendation === 'NO_GO'
  ).length;

  // Tenders without analysis
  const tendersWithoutAnalysis = await prisma.tender.findMany({
    where: {
      organization: {
        userOrganizations: {
          some: { userId: session.user.id },
        },
      },
      analysis: null,
      status: {
        in: ['NEW', 'REVIEWING'],
      },
    },
    orderBy: { submissionDeadline: 'asc' },
    take: 10,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Analiză AI</h1>
          <p className="text-muted-foreground mt-1">
            Vizualizează analizele SWOT și recomandările AI
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Analizate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalAnalyzed}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <ThumbsUp className="h-4 w-4 text-green-600" />
              Recomandate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{goCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              Cu Rezerve
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{cautionCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <ThumbsDown className="h-4 w-4 text-red-600" />
              Nu Recomandate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{noGoCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* Pending Analysis */}
      {tendersWithoutAnalysis.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5" />
              În Așteptare pentru Analiză
            </CardTitle>
            <CardDescription>
              {tendersWithoutAnalysis.length} licitații care nu au fost încă analizate
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {tendersWithoutAnalysis.map((tender) => (
                <div
                  key={tender.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent"
                >
                  <div className="flex-1 min-w-0">
                    <Link href={`/tenders/${tender.id}`} className="hover:underline">
                      <p className="font-medium truncate">{tender.title}</p>
                    </Link>
                    <p className="text-sm text-muted-foreground">{tender.contractingAuth}</p>
                  </div>
                  <Button asChild size="sm">
                    <Link href={`/tenders/${tender.id}`}>
                      Analizează
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Analyzed Tenders */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Analize Recente
          </CardTitle>
          <CardDescription>
            Toate licitațiile care au fost analizate de AI
          </CardDescription>
        </CardHeader>
        <CardContent>
          {tendersWithAnalysis.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Brain className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nu există încă analize AI.</p>
              <p className="text-sm mt-2">
                Accesează o licitație și apasă pe &quot;Analizează cu AI&quot;.
              </p>
              <Button asChild className="mt-4">
                <Link href="/tenders">Explorează Licitații</Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {tendersWithAnalysis.map((tender) => {
                const recConfig =
                  recommendationConfig[tender.analysis?.recommendation || 'PENDING'];

                return (
                  <div
                    key={tender.id}
                    className="p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Link href={`/tenders/${tender.id}`} className="hover:underline">
                            <h3 className="font-medium">{tender.title}</h3>
                          </Link>
                          <Badge className={`${recConfig.color} flex items-center gap-1`}>
                            {recConfig.icon}
                            {recConfig.label}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">
                          {tender.contractingAuth}
                        </p>
                        {tender.analysis?.aiSummary && (
                          <p className="text-sm line-clamp-2">{tender.analysis.aiSummary}</p>
                        )}
                      </div>
                      <div className="text-right text-sm text-muted-foreground">
                        {tender.analysis?.confidence && (
                          <div className="mb-1">
                            Încredere: {Math.round(tender.analysis.confidence * 100)}%
                          </div>
                        )}
                        {tender.analysis?.analyzedAt && (
                          <div>
                            {new Date(tender.analysis.analyzedAt).toLocaleDateString('ro-RO')}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* SWOT Summary */}
                    <div className="grid grid-cols-4 gap-2 mt-3 text-xs">
                      <div className="flex items-center gap-1 text-green-700">
                        <TrendingUp className="h-3 w-3" />
                        {tender.analysis?.strengths.length || 0} forte
                      </div>
                      <div className="flex items-center gap-1 text-red-700">
                        <TrendingUp className="h-3 w-3 rotate-180" />
                        {tender.analysis?.weaknesses.length || 0} slabe
                      </div>
                      <div className="flex items-center gap-1 text-blue-700">
                        <TrendingUp className="h-3 w-3" />
                        {tender.analysis?.opportunities.length || 0} oportunități
                      </div>
                      <div className="flex items-center gap-1 text-orange-700">
                        <AlertTriangle className="h-3 w-3" />
                        {tender.analysis?.threats.length || 0} amenințări
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
