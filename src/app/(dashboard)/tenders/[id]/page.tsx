import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  ArrowLeft,
  ExternalLink,
  Building2,
  Calendar,
  Banknote,
  FileText,
  Clock,
  Target,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Download,
  Lightbulb,
} from 'lucide-react';
import { TenderStatusSelect } from '@/components/tenders/tender-status-select';
import { TenderTimeline } from '@/components/tenders/tender-timeline';
import { TenderAnalysis } from '@/components/tenders/tender-analysis';

const statusColors: Record<string, string> = {
  NEW: 'bg-blue-100 text-blue-800',
  REVIEWING: 'bg-yellow-100 text-yellow-800',
  PREPARING: 'bg-purple-100 text-purple-800',
  SUBMITTED: 'bg-green-100 text-green-800',
  WON: 'bg-green-500 text-white',
  LOST: 'bg-red-100 text-red-800',
  CANCELLED: 'bg-gray-100 text-gray-800',
  IGNORED: 'bg-gray-50 text-gray-500',
};

const statusLabels: Record<string, string> = {
  NEW: 'Nou',
  REVIEWING: 'În analiză',
  PREPARING: 'În pregătire',
  SUBMITTED: 'Depus',
  WON: 'Câștigat',
  LOST: 'Pierdut',
  CANCELLED: 'Anulat',
  IGNORED: 'Ignorat',
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function TenderDetailPage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user) {
    redirect('/login');
  }

  const { id } = await params;

  const tender = await prisma.tender.findFirst({
    where: {
      id,
      organization: {
        userOrganizations: {
          some: { userId: session.user.id },
        },
      },
    },
    include: {
      documents: {
        orderBy: { createdAt: 'desc' },
      },
      analysis: true,
      events: {
        orderBy: { seapDate: 'desc' },
      },
      organization: true,
    },
  });

  if (!tender) {
    notFound();
  }

  const now = new Date();
  const daysUntilDeadline = tender.submissionDeadline
    ? Math.ceil(
        (new Date(tender.submissionDeadline).getTime() - now.getTime()) /
          (1000 * 60 * 60 * 24)
      )
    : null;

  // Guided next step — makes the status lifecycle visible as a flow instead of
  // a mute dropdown. Derived from status + AI recommendation; purely advisory.
  const recommendation = tender.analysis?.recommendation;
  let nextStep: { text: string; href?: string; cta?: string } | null = null;
  if (tender.status === 'NEW') {
    if (!tender.analysis || recommendation === 'PENDING') {
      nextStep = {
        text: 'Rulează analiza AI ca să primești recomandarea GO / CAUTION / NO-GO.',
        href: '#ai-analysis',
        cta: 'Mergi la analiză',
      };
    } else if (recommendation === 'GO') {
      nextStep = {
        text: 'Analiza recomandă GO — marchează „În Analiză" și începe evaluarea cu echipa.',
      };
    } else if (recommendation === 'CAUTION') {
      nextStep = {
        text: 'Analiza recomandă prudență — citește punctele slabe din analiză înainte de a decide.',
        href: '#ai-analysis',
        cta: 'Vezi analiza',
      };
    } else if (recommendation === 'NO_GO') {
      nextStep = {
        text: 'Analiza recomandă NO-GO — dacă ești de acord, marchează licitația „Ignorat".',
      };
    }
  } else if (tender.status === 'REVIEWING') {
    nextStep =
      !tender.analysis || recommendation === 'PENDING'
        ? {
            text: 'Rulează analiza AI ca să susții decizia GO / NO-GO.',
            href: '#ai-analysis',
            cta: 'Mergi la analiză',
          }
        : {
            text: 'Decizie luată? Treci licitația „În Pregătire" și începe dosarul ofertei.',
          };
  } else if (tender.status === 'PREPARING') {
    nextStep = {
      text: 'Pregătește documentele dosarului; când depui oferta, marchează „Depusă".',
      href: '/documents',
      cta: 'Documente firmă',
    };
  } else if (tender.status === 'SUBMITTED') {
    nextStep = {
      text: 'Ofertă depusă — după publicarea rezultatului, marchează „Câștigată" sau „Pierdută".',
    };
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Link href="/tenders">
              <Button variant="ghost" size="icon" aria-label="Înapoi la licitații">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <Badge className={statusColors[tender.status]}>
              {statusLabels[tender.status]}
            </Badge>
            {tender.matchScore && (
              <Badge
                variant="outline"
                className={
                  tender.matchScore >= 80
                    ? 'border-green-500 text-green-700'
                    : tender.matchScore >= 60
                    ? 'border-yellow-500 text-yellow-700'
                    : 'border-gray-500 text-gray-700'
                }
              >
                Scor: {tender.matchScore}%
              </Badge>
            )}
          </div>
          <h1 className="text-2xl font-bold">{tender.title}</h1>
          <p className="text-sm text-muted-foreground font-mono">
            {tender.seapId}
          </p>
        </div>

        <div className="flex gap-2">
          <TenderStatusSelect tenderId={tender.id} currentStatus={tender.status} />
          <Button variant="outline" asChild>
            <a href={`/api/tenders/${tender.id}/pdf`} download>
              <Download className="mr-2 h-4 w-4" />
              PDF
            </a>
          </Button>
          <Button variant="outline" asChild>
            <a
              href={tender.seapUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              Vezi pe SEAP
            </a>
          </Button>
        </div>
      </div>

      {/* Guided next step */}
      {nextStep && (
        <div className="flex items-center gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <Lightbulb className="h-5 w-5 text-blue-600 shrink-0" aria-hidden="true" />
          <span className="text-sm text-blue-900 flex-1">
            <span className="font-semibold">Pas următor:</span> {nextStep.text}
          </span>
          {nextStep.href && (
            <Button variant="outline" size="sm" asChild className="shrink-0">
              <a href={nextStep.href}>{nextStep.cta}</a>
            </Button>
          )}
        </div>
      )}

      {/* Deadline Alert */}
      {daysUntilDeadline !== null && daysUntilDeadline <= 7 && daysUntilDeadline > 0 && (
        <div className="flex items-center gap-2 p-4 bg-orange-50 border border-orange-200 rounded-lg">
          <AlertTriangle className="h-5 w-5 text-orange-500" />
          <span className="font-medium text-orange-800">
            Deadline în {daysUntilDeadline} {daysUntilDeadline === 1 ? 'zi' : 'zile'}!
          </span>
        </div>
      )}

      {daysUntilDeadline !== null && daysUntilDeadline <= 0 && (
        <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-lg">
          <XCircle className="h-5 w-5 text-red-500" />
          <span className="font-medium text-red-800">
            Termenul de depunere a expirat
          </span>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Details Card */}
          <Card>
            <CardHeader>
              <CardTitle>Detalii Licitație</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {tender.description && (
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-1">
                    Descriere
                  </h4>
                  <p className="text-sm">{tender.description}</p>
                </div>
              )}

              <Separator />

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex items-start gap-3">
                  <Building2 className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <h4 className="text-sm font-medium">Autoritate Contractantă</h4>
                    <p className="text-sm text-muted-foreground">
                      {tender.contractingAuth}
                    </p>
                    {tender.contractingAuthCui && (
                      <p className="text-xs text-muted-foreground">
                        CUI: {tender.contractingAuthCui}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Banknote className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <h4 className="text-sm font-medium">Valoare Estimată</h4>
                    <p className="text-sm text-muted-foreground">
                      {tender.estimatedValue
                        ? `${Number(tender.estimatedValue).toLocaleString('ro-RO')} ${tender.currency}`
                        : 'Nedisponibilă'}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Target className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <h4 className="text-sm font-medium">Cod CPV</h4>
                    <p className="text-sm font-mono">{tender.cpvCode}</p>
                    {tender.cpvDescription && (
                      <p className="text-xs text-muted-foreground">
                        {tender.cpvDescription}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <h4 className="text-sm font-medium">Tip Procedură</h4>
                    <p className="text-sm text-muted-foreground">
                      {tender.procedureType}
                    </p>
                    {tender.contractType && (
                      <p className="text-xs text-muted-foreground">
                        {tender.contractType}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <Separator />

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="flex items-start gap-3">
                  <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <h4 className="text-sm font-medium">Data Publicării</h4>
                    <p className="text-sm text-muted-foreground">
                      {tender.publicationDate
                        ? new Date(tender.publicationDate).toLocaleDateString('ro-RO')
                        : 'N/A'}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Clock className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <h4 className="text-sm font-medium">Termen Depunere</h4>
                    <p className="text-sm text-muted-foreground">
                      {tender.submissionDeadline
                        ? new Date(tender.submissionDeadline).toLocaleDateString('ro-RO', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : 'N/A'}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <h4 className="text-sm font-medium">Data Deschiderii</h4>
                    <p className="text-sm text-muted-foreground">
                      {tender.openingDate
                        ? new Date(tender.openingDate).toLocaleDateString('ro-RO')
                        : 'N/A'}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* AI Analysis */}
          <div id="ai-analysis" className="scroll-mt-20">
            <TenderAnalysis analysis={tender.analysis} tenderId={tender.id} />
          </div>

          {/* Documents */}
          <Card>
            <CardHeader>
              <CardTitle>Documente ({tender.documents.length})</CardTitle>
              <CardDescription>
                Documentele atașate acestei licitații
              </CardDescription>
            </CardHeader>
            <CardContent>
              {tender.documents.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nu există documente descărcate.</p>
                  <p className="text-sm mt-2">
                    Documentele vor fi descărcate automat de n8n.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {tender.documents.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent"
                    >
                      <div className="flex items-center gap-3">
                        <FileText className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">{doc.filename}</p>
                          <p className="text-xs text-muted-foreground">
                            {doc.docType} • {(doc.fileSize / 1024).toFixed(1)} KB
                          </p>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm">
                        Descarcă
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Timeline */}
          <TenderTimeline events={tender.events} />

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Acțiuni Rapide</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button className="w-full" variant="outline">
                <FileText className="mr-2 h-4 w-4" />
                Generează Ofertă
              </Button>
              <Button className="w-full" variant="outline">
                <Target className="mr-2 h-4 w-4" />
                Analizează cu AI
              </Button>
              <Button className="w-full" variant="outline">
                {tender.isWatched ? (
                  <>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Monitorizat
                  </>
                ) : (
                  <>
                    <Clock className="mr-2 h-4 w-4" />
                    Adaugă la Watchdog
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
