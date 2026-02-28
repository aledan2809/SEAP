import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Search, RefreshCw, ExternalLink, Eye } from 'lucide-react';
import { TenderFilters } from '@/components/tenders/tender-filters';

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
  searchParams: Promise<{
    status?: string;
    search?: string;
  }>;
}

export default async function TendersPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user) {
    redirect('/login');
  }

  const params = await searchParams;

  // Build where clause
  const whereClause: Record<string, unknown> = {
    organization: {
      userOrganizations: {
        some: { userId: session.user.id },
      },
    },
  };

  if (params.status && params.status !== 'all') {
    whereClause.status = params.status;
  }

  if (params.search) {
    whereClause.OR = [
      { title: { contains: params.search, mode: 'insensitive' } },
      { contractingAuth: { contains: params.search, mode: 'insensitive' } },
      { seapId: { contains: params.search, mode: 'insensitive' } },
    ];
  }

  const tenders = await prisma.tender.findMany({
    where: whereClause,
    orderBy: [
      { submissionDeadline: 'asc' },
      { createdAt: 'desc' },
    ],
    take: 100,
  });

  // Get stats
  const stats = await prisma.tender.groupBy({
    by: ['status'],
    where: {
      organization: {
        userOrganizations: {
          some: { userId: session.user.id },
        },
      },
    },
    _count: true,
  });

  const totalCount = stats.reduce((acc, s) => acc + s._count, 0);
  const newCount = stats.find((s) => s.status === 'NEW')?._count || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Licitații</h1>
          <p className="text-muted-foreground mt-1">
            {totalCount} licitații monitorizate • {newCount} noi
          </p>
        </div>
        <Button variant="outline">
          <RefreshCw className="mr-2 h-4 w-4" />
          Sincronizează
        </Button>
      </div>

      {/* Filters */}
      <TenderFilters currentStatus={params.status} currentSearch={params.search} />

      {/* Tenders Table */}
      <Card>
        <CardHeader>
          <CardTitle>Licitații</CardTitle>
          <CardDescription>
            {tenders.length === 0
              ? 'Nu există licitații care să corespundă filtrelor'
              : `${tenders.length} licitații găsite`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {tenders.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nu există licitații.</p>
              <p className="text-sm mt-2">
                {session.user.organizationId
                  ? 'Licitațiile vor apărea automat când n8n le găsește pe SEAP.'
                  : 'Configurează organizația și codurile CPV în Setări.'}
              </p>
              <Button asChild className="mt-4">
                <Link href="/settings">Configurează Setări</Link>
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[35%]">Titlu</TableHead>
                  <TableHead>Autoritate</TableHead>
                  <TableHead>Valoare</TableHead>
                  <TableHead>CPV</TableHead>
                  <TableHead>Deadline</TableHead>
                  <TableHead>Scor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Acțiuni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tenders.map((tender) => {
                  const daysUntilDeadline = tender.submissionDeadline
                    ? Math.ceil(
                        (new Date(tender.submissionDeadline).getTime() - Date.now()) /
                          (1000 * 60 * 60 * 24)
                      )
                    : null;

                  return (
                    <TableRow key={tender.id}>
                      <TableCell>
                        <Link
                          href={`/tenders/${tender.id}`}
                          className="hover:underline"
                        >
                          <div
                            className="font-medium line-clamp-2"
                            title={tender.title}
                          >
                            {tender.title}
                          </div>
                        </Link>
                        <div className="text-xs text-muted-foreground mt-1">
                          {tender.seapId}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[150px]">
                        <div className="truncate" title={tender.contractingAuth}>
                          {tender.contractingAuth}
                        </div>
                      </TableCell>
                      <TableCell>
                        {tender.estimatedValue ? (
                          <div className="font-medium whitespace-nowrap">
                            {Number(tender.estimatedValue).toLocaleString('ro-RO')}{' '}
                            {tender.currency}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">N/A</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="text-xs font-mono">{tender.cpvCode}</div>
                      </TableCell>
                      <TableCell>
                        {tender.submissionDeadline ? (
                          <div
                            className={
                              daysUntilDeadline !== null && daysUntilDeadline <= 3
                                ? 'text-red-600 font-medium'
                                : daysUntilDeadline !== null && daysUntilDeadline <= 7
                                ? 'text-orange-600'
                                : ''
                            }
                          >
                            {new Date(tender.submissionDeadline).toLocaleDateString(
                              'ro-RO'
                            )}
                            {daysUntilDeadline !== null && daysUntilDeadline > 0 && (
                              <div className="text-xs text-muted-foreground">
                                {daysUntilDeadline} zile
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">N/A</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {tender.matchScore !== null ? (
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
                            {tender.matchScore}%
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge className={statusColors[tender.status]}>
                          {statusLabels[tender.status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" asChild>
                            <Link href={`/tenders/${tender.id}`}>
                              <Eye className="h-4 w-4" />
                            </Link>
                          </Button>
                          <Button variant="ghost" size="icon" asChild>
                            <a
                              href={tender.seapUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
