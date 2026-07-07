import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/db';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ProfileSettings } from '@/components/settings/profile-settings';
import { OrganizationSettings } from '@/components/settings/organization-settings';
import { MonitoringSettings } from '@/components/settings/monitoring-settings';
import { AdminSettings } from '@/components/settings/admin-settings';
import { isAdmin } from '@/lib/settings';

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  // Deep-linkable tabs (?tab=organization|monitoring) — used by the dashboard setup guide.
  const { tab } = await searchParams;
  // 'admin' is intentionally not deep-linkable — its trigger only renders for platform admins.
  const validTabs = ['profile', 'organization', 'monitoring'];
  const initialTab = tab && validTabs.includes(tab) ? tab : 'profile';

  // Fetch user with organizations (many-to-many)
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      organizations: {
        include: {
          organization: {
            include: {
              _count: {
                select: { tenders: true, documents: true },
              },
            },
          },
        },
      },
      activeOrganization: true,
    },
  });

  if (!user) {
    redirect('/login');
  }

  // Transform organizations to include role
  const organizations = user.organizations.map((uo) => ({
    ...uo.organization,
    role: uo.role,
    isActive: uo.organizationId === user.activeOrganizationId,
  }));

  const userIsAdmin = user.email ? await isAdmin(user.email) : false;

  // Find active organization with role
  const activeOrganization = user.activeOrganization
    ? {
        ...user.activeOrganization,
        role: user.organizations.find(
          (uo) => uo.organizationId === user.activeOrganizationId
        )?.role,
      }
    : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Setări</h1>
          <p className="text-muted-foreground mt-1">
            Configurează profilul, organizația și preferințele de monitorizare
          </p>
        </div>
        <Button asChild data-tester-action="cta">
          <Link href="/tenders">Explorează Licitații</Link>
        </Button>
      </div>

      <Tabs defaultValue={initialTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="profile">Profil</TabsTrigger>
          <TabsTrigger value="organization">Organizație</TabsTrigger>
          <TabsTrigger value="monitoring">Monitorizare</TabsTrigger>
          {userIsAdmin && <TabsTrigger value="admin">Admin</TabsTrigger>}
        </TabsList>

        <TabsContent value="profile">
          <ProfileSettings user={user} />
        </TabsContent>

        <TabsContent value="organization">
          <OrganizationSettings
            organizations={organizations}
            activeOrganization={activeOrganization}
          />
        </TabsContent>

        <TabsContent value="monitoring">
          <MonitoringSettings organization={activeOrganization} />
        </TabsContent>

        {userIsAdmin && (
          <TabsContent value="admin">
            <AdminSettings />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
