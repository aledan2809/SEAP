import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { Sidebar } from '@/components/dashboard/sidebar';
import { Header } from '@/components/dashboard/header';

const ROLE_LABELS: Record<string, string> = {
  OWNER: 'Proprietar',
  ADMIN: 'Administrator',
  MEMBER: 'Membru',
};

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session) {
    redirect('/login');
  }

  const userId = session.user.id;
  const role = session.user.role;
  const organizationId = session.user.organizationId;
  // Invitations are OWNER/ADMIN-only at the API layer — mirror that in the menu.
  const showTeam = role === 'OWNER' || role === 'ADMIN';

  // Live nav badges + active org name. Same tender scope as /tenders so numbers match.
  const tenderScope = {
    organization: { userOrganizations: { some: { userId } } },
  };
  const now = new Date();
  const in7days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  // Fail-soft: nav badges are decoration — a transient DB error must never take
  // down the shell of every dashboard page. On failure we render without badges.
  let newCount = 0;
  let deadlineCount = 0;
  let toAnalyze = 0;
  let org: { name: string } | null = null;
  try {
    [newCount, deadlineCount, toAnalyze, org] = await Promise.all([
      prisma.tender.count({ where: { ...tenderScope, status: 'NEW' } }),
      prisma.tender.count({
        where: {
          ...tenderScope,
          status: { in: ['NEW', 'REVIEWING', 'PREPARING'] },
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
      organizationId
        ? prisma.organization.findUnique({
            where: { id: organizationId },
            select: { name: true },
          })
        : null,
    ]);
  } catch (err) {
    console.error('[dashboard-layout] badge queries failed, rendering without badges:', err);
  }

  const badges = {
    Licitații: newCount,
    'Analiză AI': toAnalyze,
    Watchdog: deadlineCount,
  };
  const identity = {
    name: session.user.name || session.user.email || 'Utilizator',
    roleLabel: ROLE_LABELS[role] ?? role,
    orgName: org?.name ?? null,
  };

  return (
    <div className="min-h-screen bg-background">
      <Sidebar badges={badges} identity={identity} showTeam={showTeam} />
      <div className="lg:ml-64 flex flex-col min-h-screen">
        <Header user={session.user} showTeam={showTeam} />
        <main id="main-content" className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
