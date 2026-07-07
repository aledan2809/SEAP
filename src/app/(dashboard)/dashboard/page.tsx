import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Search,
  FileText,
  AlertTriangle,
  CheckCircle,
  CheckCircle2,
  Clock,
  TrendingUp,
  Sparkles,
  ListChecks,
} from 'lucide-react';

const ACTIVE_STATUSES = ['NEW', 'REVIEWING', 'PREPARING'] as const;

function daysUntil(date: Date, now: Date): number {
  return Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

export default async function DashboardPage() {
  const session = await auth();
  const userId = session?.user?.id;
  const organizationId = session?.user?.organizationId ?? null;

  // Tenders are scoped to ALL orgs the user belongs to — same shape as /tenders,
  // so the dashboard numbers always match the list the user lands on.
  const tenderScope = {
    organization: { userOrganizations: { some: { userId: userId ?? '__none__' } } },
  };

  const now = new Date();
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const in7days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const in3days = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  const [
    org,
    docsCount,
    totalTenders,
    newToday,
    newCount,
    inProgress,
    won,
    deadlineSoon,
    toAnalyze,
    newTenders,
    deadlineAlerts,
    goRecommendations,
  ] = await Promise.all([
    organizationId
      ? prisma.organization.findUnique({
          where: { id: organizationId },
          select: { name: true, cpvCodes: true },
        })
      : null,
    organizationId
      ? prisma.companyDocument.count({ where: { organizationId } })
      : 0,
    prisma.tender.count({ where: tenderScope }),
    prisma.tender.count({ where: { ...tenderScope, createdAt: { gte: dayAgo } } }),
    prisma.tender.count({ where: { ...tenderScope, status: 'NEW' } }),
    prisma.tender.count({
      where: { ...tenderScope, status: { in: ['REVIEWING', 'PREPARING', 'SUBMITTED'] } },
    }),
    prisma.tender.count({ where: { ...tenderScope, status: 'WON' } }),
    prisma.tender.count({
      where: {
        ...tenderScope,
        status: { in: [...ACTIVE_STATUSES] },
        submissionDeadline: { gte: now, lte: in7days },
      },
    }),
    prisma.tender.count({
      where: {
        ...tenderScope,
        status: { in: ['NEW', 'REVIEWING'] },
        analysis: { is: null },
      },
    }),
    prisma.tender.findMany({
      where: { ...tenderScope, status: 'NEW' },
      orderBy: [{ matchScore: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }],
      take: 5,
      select: {
        id: true,
        title: true,
        contractingAuth: true,
        matchScore: true,
        submissionDeadline: true,
      },
    }),
    prisma.tender.findMany({
      where: {
        ...tenderScope,
        status: { in: [...ACTIVE_STATUSES] },
        submissionDeadline: { gte: now, lte: in3days },
      },
      orderBy: { submissionDeadline: 'asc' },
      take: 5,
      select: { id: true, title: true, submissionDeadline: true },
    }),
    prisma.tender.findMany({
      where: {
        ...tenderScope,
        status: { in: ['NEW', 'REVIEWING'] },
        analysis: { is: { recommendation: 'GO' } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 3,
      select: { id: true, title: true },
    }),
  ]);

  // Setup checklist — each step reflects real account state and links to where it's done.
  const setupSteps = [
    {
      done: !!org,
      title: 'Completează datele firmei',
      detail: org
        ? `Organizația „${org.name}" e configurată.`
        : 'CUI, adresă și informații de contact',
      href: '/settings?tab=organization',
      cta: 'Deschide Setări',
    },
    {
      done: (org?.cpvCodes.length ?? 0) > 0,
      title: 'Selectează codurile CPV',
      detail:
        (org?.cpvCodes.length ?? 0) > 0
          ? `${org!.cpvCodes.length} coduri configurate.`
          : 'Alege domeniile de interes (software, hardware, servicii IT)',
      href: '/settings?tab=monitoring',
      cta: 'Configurează CPV',
    },
    {
      done: docsCount > 0,
      title: 'Încarcă documentele firmei',
      detail:
        docsCount > 0
          ? `${docsCount} document(e) încărcate.`
          : 'Certificate, bilanțuri și alte documente necesare',
      href: '/documents',
      cta: 'Încarcă documente',
    },
    {
      done: totalTenders > 0,
      title: 'Monitorizarea rulează',
      detail:
        totalTenders > 0
          ? `Scannerul a găsit ${totalTenders} licitații pentru tine.`
          : 'Scannerul rulează zilnic — licitațiile apar automat după configurarea CPV.',
      href: '/tenders',
      cta: 'Vezi licitațiile',
    },
  ];
  const setupDone = setupSteps.filter((s) => s.done).length;
  const setupComplete = setupDone === setupSteps.length;

  // Daily work queue — shown once setup is complete.
  const workItems = [
    {
      count: newCount,
      label: 'licitații noi de revizuit',
      href: '/tenders?status=NEW',
    },
    {
      count: deadlineSoon,
      label: 'deadline-uri în următoarele 7 zile',
      href: '/watchdog',
    },
    {
      count: toAnalyze,
      label: 'licitații fără analiză AI',
      href: '/tenders?status=NEW',
    },
  ].filter((w) => w.count > 0);

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div>
        <h1 className="text-3xl font-bold">
          Bună ziua, {session?.user?.name || 'utilizator'}!
        </h1>
        <p className="text-muted-foreground mt-1">
          Iată un rezumat al activității tale pe SEAP.
        </p>
      </div>

      {/* Stats Grid — live numbers, each card links to its page */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Link href="/tenders" className="block">
          <Card className="transition-colors hover:border-primary/40">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Licitații Monitorizate</CardTitle>
              <Search className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalTenders}</div>
              <p className="text-xs text-muted-foreground">
                +{newToday} noi în ultimele 24h
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/tenders?status=PREPARING" className="block">
          <Card className="transition-colors hover:border-primary/40">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">În Pregătire</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{inProgress}</div>
              <p className="text-xs text-muted-foreground">
                oferte în lucru (analiză → depunere)
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/watchdog" className="block">
          <Card className="transition-colors hover:border-primary/40">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Deadline Aproape</CardTitle>
              <Clock className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{deadlineSoon}</div>
              <p className="text-xs text-muted-foreground">
                în următoarele 7 zile
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/tenders?status=WON" className="block">
          <Card className="transition-colors hover:border-primary/40">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Câștigate</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{won}</div>
              <p className="text-xs text-muted-foreground">
                în total
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Daily work queue — replaces the setup guide once the account is configured */}
      {setupComplete && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ListChecks className="h-5 w-5" />
              Ce ai de făcut azi
            </CardTitle>
            <CardDescription>
              Prioritățile zilei, calculate din starea licitațiilor tale
            </CardDescription>
          </CardHeader>
          <CardContent>
            {workItems.length === 0 ? (
              <div className="flex items-center gap-3 text-muted-foreground">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                <p>Totul e la zi — nicio acțiune urgentă.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {workItems.map((w) => (
                  <div key={w.label} className="flex items-center justify-between gap-4">
                    <p>
                      <span className="font-bold">{w.count}</span> {w.label}
                    </p>
                    <Button variant="outline" size="sm" asChild>
                      <Link href={w.href}>Deschide</Link>
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Licitații Noi</CardTitle>
            <CardDescription>
              Cele mai relevante licitații nerevizuite, după scor
            </CardDescription>
          </CardHeader>
          <CardContent>
            {newTenders.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nu există licitații noi.</p>
                <p className="text-sm mt-2">
                  {(org?.cpvCodes.length ?? 0) > 0
                    ? 'Licitațiile noi apar aici după fiecare scanare.'
                    : 'Configurează codurile CPV în Setări pentru a primi notificări.'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {newTenders.map((t) => (
                  <Link
                    key={t.id}
                    href={`/tenders/${t.id}`}
                    className="flex items-start justify-between gap-3 rounded-md p-2 -m-2 hover:bg-accent transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{t.title}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {t.contractingAuth}
                      </p>
                    </div>
                    {t.matchScore !== null && (
                      <Badge variant="outline" className="shrink-0">
                        {t.matchScore}%
                      </Badge>
                    )}
                  </Link>
                ))}
                {newCount > newTenders.length && (
                  <Button variant="ghost" size="sm" asChild className="w-full">
                    <Link href="/tenders?status=NEW">
                      Vezi toate ({newCount})
                    </Link>
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Alerte</CardTitle>
            <CardDescription>
              Notificări importante care necesită atenție
            </CardDescription>
          </CardHeader>
          <CardContent>
            {deadlineAlerts.length === 0 && goRecommendations.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <AlertTriangle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nicio alertă momentan.</p>
                <p className="text-sm mt-2">
                  Alertele pentru deadline-uri și recomandările GO vor apărea aici.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {deadlineAlerts.map((t) => {
                  const days = daysUntil(t.submissionDeadline!, now);
                  return (
                    <Link
                      key={`deadline-${t.id}`}
                      href={`/tenders/${t.id}`}
                      className="flex items-start gap-3 rounded-md p-2 -m-2 hover:bg-accent transition-colors"
                    >
                      <AlertTriangle className="h-4 w-4 text-orange-500 mt-0.5 shrink-0" />
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{t.title}</p>
                        <p className="text-xs text-orange-600">
                          Deadline în {days} {days === 1 ? 'zi' : 'zile'}
                        </p>
                      </div>
                    </Link>
                  );
                })}
                {goRecommendations.map((t) => (
                  <Link
                    key={`go-${t.id}`}
                    href={`/tenders/${t.id}`}
                    className="flex items-start gap-3 rounded-md p-2 -m-2 hover:bg-accent transition-colors"
                  >
                    <Sparkles className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{t.title}</p>
                      <p className="text-xs text-green-700">
                        Analiza recomandă GO — decide pasul următor
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Setup Guide — live state per step; disappears once everything is configured */}
      {!setupComplete && (
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Primii Pași
              <Badge variant="secondary" className="ml-2">
                {setupDone}/{setupSteps.length} gata
              </Badge>
            </CardTitle>
            <CardDescription>
              Configurează-ți contul pentru a începe să monitorizezi licitații
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {setupSteps.map((step, i) => (
                <div key={step.title} className="flex items-center gap-4">
                  <Badge
                    variant="outline"
                    className={
                      'w-8 h-8 rounded-full flex items-center justify-center shrink-0' +
                      (step.done ? ' bg-green-100 text-green-700 border-green-300' : '')
                    }
                  >
                    {step.done ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <p className={'font-medium' + (step.done ? ' text-muted-foreground line-through' : '')}>
                      {step.title}
                    </p>
                    <p className="text-sm text-muted-foreground">{step.detail}</p>
                  </div>
                  {!step.done && (
                    <Button variant="outline" size="sm" asChild className="shrink-0">
                      <Link href={step.href}>{step.cta}</Link>
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
