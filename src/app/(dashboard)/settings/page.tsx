import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ProfileSettings } from '@/components/settings/profile-settings';
import { OrganizationSettings } from '@/components/settings/organization-settings';
import { MonitoringSettings } from '@/components/settings/monitoring-settings';

export default async function SettingsPage() {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  // Fetch user with organization
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { organization: true },
  });

  if (!user) {
    redirect('/login');
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Setări</h1>
        <p className="text-muted-foreground mt-1">
          Configurează profilul, organizația și preferințele de monitorizare
        </p>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList>
          <TabsTrigger value="profile">Profil</TabsTrigger>
          <TabsTrigger value="organization">Organizație</TabsTrigger>
          <TabsTrigger value="monitoring">Monitorizare</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <ProfileSettings user={user} />
        </TabsContent>

        <TabsContent value="organization">
          <OrganizationSettings
            organization={user.organization}
            userId={user.id}
          />
        </TabsContent>

        <TabsContent value="monitoring">
          <MonitoringSettings organization={user.organization} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
