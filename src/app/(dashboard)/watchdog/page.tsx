import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Bell,
  BellOff,
  Eye,
  ExternalLink,
  Clock,
  AlertTriangle,
  CheckCircle,
  Activity,
} from 'lucide-react';

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

export default async function WatchdogPage() {
  const session = await auth();
  if (!session?.user) {
    redirect('/login');
  }

  // Get all watched tenders
  const watchedTenders = await prisma.tender.findMany({
    where: {
      isWatched: true,
      organization: {
        userOrganizations: {
          some: { userId: session.user.id },
        },
      },
    },
    orderBy: [
      { submissionDeadline: 'asc' },
      { createdAt: 'desc' },
    ],
    include: {
      events: {
        orderBy: { seapDate: 'desc' },
        take: 1,
      },
    },
  });

  // Get stats
  const urgentCount = watchedTenders.filter((t) => {
    if (!t.submissionDeadline) return false;
    const days = Math.ceil(
      (new Date(t.submissionDeadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    return days <= 7 && days > 0;
  }).length;

  const activeCount = watchedTenders.filter(
    (t) => !['WON', 'LOST', 'CANCELLED', 'IGNORED'].includes(t.status)
  ).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Watchdog</h1>
          <p className="text-muted-foreground mt-1">
            Monitorizare activă pentru {watchedTenders.length} licitații
          </p>
        </div>
        <div className="flex gap-2">
          <Badge variant="outline" className="text-sm py-1 px-3">
            <Activity className="mr-2 h-4 w-4 text-green-500" />
            {activeCount} active
          </Badge>
          {urgentCount > 0 && (
            <Badge variant="destructive" className="text-sm py-1 px-3">
              <AlertTriangle className="mr-2 h-4 w-4" />
              {urgentCount} urgente
            </Badge>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Monitorizate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{watchedTenders.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{activeCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Deadline Apropiat
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{urgentCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Câștigate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">
              {watchedTenders.filter((t) => t.status === 'WON').length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Watched Tenders Table */}
      <Card>
        <CardHeader>
          <CardTitle>Licitații Monitorizate</CardTitle>
          <CardDescription>
            Vei primi notificări pentru modificări și termene aproiate
          </CardDescription>
        </CardHeader>
        <CardContent>
          {watchedTenders.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <BellOff className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nu monitorizezi nicio licitație.</p>
              <p className="text-sm mt-2">
                Adaugă licitații la watchdog pentru a primi notificări.
              </p>
              <Button asChild className="mt-4">
                <Link href="/tenders">Explorează Licitații</Link>
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[35%]">Titlu</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Deadline</TableHead>
                  <TableHead>Ultima Activitate</TableHead>
                  <TableHead className="text-right">Acțiuni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {watchedTenders.map((tender) => {
                  const daysUntilDeadline = tender.submissionDeadline
                    ? Math.ceil(
                        (new Date(tender.submissionDeadline).getTime() - Date.now()) /
                          (1000 * 60 * 60 * 24)
                      )
                    : null;

                  const isUrgent =
                    daysUntilDeadline !== null && daysUntilDeadline <= 7 && daysUntilDeadline > 0;
                  const isExpired = daysUntilDeadline !== null && daysUntilDeadline <= 0;

                  return (
                    <TableRow key={tender.id} className={isUrgent ? 'bg-orange-50' : ''}>
                      <TableCell>
                        <Link href={`/tenders/${tender.id}`} className="hover:underline">
                          <div className="font-medium line-clamp-2" title={tender.title}>
                            {tender.title}
                          </div>
                        </Link>
                        <div className="text-xs text-muted-foreground mt-1">
                          {tender.contractingAuth}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={statusColors[tender.status]}>
                          {statusLabels[tender.status]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {tender.submissionDeadline ? (
                          <div
                            className={
                              isExpired
                                ? 'text-red-600 font-medium'
                                : isUrgent
                                ? 'text-orange-600 font-medium'
                                : ''
                            }
                          >
                            {new Date(tender.submissionDeadline).toLocaleDateString('ro-RO')}
                            {!isExpired && daysUntilDeadline !== null && daysUntilDeadline > 0 && (
                              <div className="text-xs text-muted-foreground">
                                {daysUntilDeadline} zile rămase
                              </div>
                            )}
                            {isExpired && (
                              <div className="text-xs text-red-500">Expirat</div>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">N/A</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {tender.events[0] ? (
                          <div className="text-sm">
                            <div className="line-clamp-1">{tender.events[0].title}</div>
                            <div className="text-xs text-muted-foreground">
                              {new Date(tender.events[0].seapDate).toLocaleDateString('ro-RO')}
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
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

      {/* Notification Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Setări Notificări</CardTitle>
          <CardDescription>
            Configurează cum vrei să fii notificat pentru licitațiile monitorizate
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">Notificări Email</div>
              <div className="text-sm text-muted-foreground">
                Primește email când apar modificări
              </div>
            </div>
            <Switch defaultChecked />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">Alerte Deadline</div>
              <div className="text-sm text-muted-foreground">
                Notificări la 7, 3 și 1 zi înainte de deadline
              </div>
            </div>
            <Switch defaultChecked />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">Clarificări</div>
              <div className="text-sm text-muted-foreground">
                Notificări pentru răspunsuri la clarificări
              </div>
            </div>
            <Switch defaultChecked />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">Rezultate</div>
              <div className="text-sm text-muted-foreground">
                Notificări când se publică rezultatele
              </div>
            </div>
            <Switch defaultChecked />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
