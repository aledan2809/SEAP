import { auth } from '@/lib/auth';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Search,
  FileText,
  AlertTriangle,
  CheckCircle,
  Clock,
  TrendingUp,
} from 'lucide-react';

export default async function DashboardPage() {
  const session = await auth();

  // TODO: Fetch real data from database
  const stats = {
    totalTenders: 0,
    newToday: 0,
    inProgress: 0,
    won: 0,
    deadlineSoon: 0,
    totalValue: 0,
  };

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

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Licitații Monitorizate</CardTitle>
            <Search className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalTenders}</div>
            <p className="text-xs text-muted-foreground">
              +{stats.newToday} noi astăzi
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">În Pregătire</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.inProgress}</div>
            <p className="text-xs text-muted-foreground">
              oferte în lucru
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Deadline Aproape</CardTitle>
            <Clock className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.deadlineSoon}</div>
            <p className="text-xs text-muted-foreground">
              în următoarele 7 zile
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Câștigate</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.won}</div>
            <p className="text-xs text-muted-foreground">
              anul acesta
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Licitații Noi</CardTitle>
            <CardDescription>
              Licitații IT găsite în ultimele 24 ore
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-muted-foreground">
              <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nu există licitații noi.</p>
              <p className="text-sm mt-2">
                Configurează codurile CPV în Setări pentru a primi notificări.
              </p>
            </div>
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
            <div className="text-center py-8 text-muted-foreground">
              <AlertTriangle className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nicio alertă momentan.</p>
              <p className="text-sm mt-2">
                Alertele pentru deadline-uri și clarificări vor apărea aici.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Setup Guide for new users */}
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Primii Pași
          </CardTitle>
          <CardDescription>
            Configurează-ți contul pentru a începe să monitorizezi licitații
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <Badge variant="outline" className="w-8 h-8 rounded-full flex items-center justify-center">
                1
              </Badge>
              <div>
                <p className="font-medium">Completează datele firmei</p>
                <p className="text-sm text-muted-foreground">
                  CUI, adresă, și informații de contact
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Badge variant="outline" className="w-8 h-8 rounded-full flex items-center justify-center">
                2
              </Badge>
              <div>
                <p className="font-medium">Selectează codurile CPV</p>
                <p className="text-sm text-muted-foreground">
                  Alege domeniile de interes (software, hardware, servicii IT)
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Badge variant="outline" className="w-8 h-8 rounded-full flex items-center justify-center">
                3
              </Badge>
              <div>
                <p className="font-medium">Încarcă documentele firmei</p>
                <p className="text-sm text-muted-foreground">
                  Certificate, bilanțuri, și alte documente necesare
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Badge variant="outline" className="w-8 h-8 rounded-full flex items-center justify-center">
                4
              </Badge>
              <div>
                <p className="font-medium">Activează monitorizarea</p>
                <p className="text-sm text-muted-foreground">
                  Primește notificări pentru licitații noi
                </p>
              </div>
            </div>
          </div>
          <div className="mt-6">
            <Button asChild data-tester-action="cta">
              <Link href="/settings">Configurează Acum</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
