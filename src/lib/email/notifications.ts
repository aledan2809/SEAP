/**
 * Email notification triggers — called from scan/cron jobs
 */

import { prisma } from '@/lib/db';
import { sendEmail } from './client';
import { deadlineAlertEmail, newTenderEmail, dailyDigestEmail } from './templates';

const APP_URL = process.env.NEXTAUTH_URL || 'https://seap-assistant.vercel.app';

/**
 * Send deadline alerts for watched tenders approaching deadline
 * Called from /api/scan cron job
 */
export async function sendDeadlineAlerts(): Promise<{ sent: number; errors: number }> {
  const stats = { sent: 0, errors: 0 };

  // Find watched tenders with deadlines in 1, 3, or 7 days
  const now = new Date();
  const alertDays = [1, 3, 7];

  for (const days of alertDays) {
    const targetDate = new Date(now);
    targetDate.setDate(targetDate.getDate() + days);
    const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0));
    const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999));

    const tenders = await prisma.tender.findMany({
      where: {
        isWatched: true,
        submissionDeadline: {
          gte: startOfDay,
          lte: endOfDay,
        },
        status: { notIn: ['WON', 'LOST', 'CANCELLED', 'IGNORED'] },
      },
      include: {
        organization: {
          include: {
            userOrganizations: {
              include: { user: true },
            },
          },
        },
      },
    });

    for (const tender of tenders) {
      const emails = tender.organization.userOrganizations
        .map((uo) => uo.user.email)
        .filter(Boolean) as string[];

      const template = deadlineAlertEmail({
        title: tender.title,
        seapId: tender.seapId,
        contractingAuth: tender.contractingAuth,
        estimatedValue: tender.estimatedValue
          ? `${Number(tender.estimatedValue).toLocaleString('ro-RO')} ${tender.currency}`
          : undefined,
        submissionDeadline: tender.submissionDeadline
          ? new Date(tender.submissionDeadline).toLocaleDateString('ro-RO', {
              day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
            })
          : 'N/A',
        daysRemaining: days,
        seapUrl: tender.seapUrl,
        appUrl: `${APP_URL}/tenders/${tender.id}`,
      });

      for (const email of emails) {
        const ok = await sendEmail({ to: email, ...template });
        if (ok) stats.sent++;
        else stats.errors++;
      }
    }
  }

  return stats;
}

/**
 * Send notification for newly discovered tenders
 */
export async function sendNewTenderNotifications(tenderIds: string[]): Promise<{ sent: number }> {
  const stats = { sent: 0 };
  if (tenderIds.length === 0) return stats;

  const tenders = await prisma.tender.findMany({
    where: { id: { in: tenderIds } },
    include: {
      organization: {
        include: {
          userOrganizations: {
            include: { user: true },
          },
        },
      },
    },
  });

  for (const tender of tenders) {
    const emails = tender.organization.userOrganizations
      .map((uo) => uo.user.email)
      .filter(Boolean) as string[];

    const template = newTenderEmail({
      title: tender.title,
      seapId: tender.seapId,
      contractingAuth: tender.contractingAuth,
      estimatedValue: tender.estimatedValue
        ? `${Number(tender.estimatedValue).toLocaleString('ro-RO')} ${tender.currency}`
        : undefined,
      submissionDeadline: tender.submissionDeadline
        ? new Date(tender.submissionDeadline).toLocaleDateString('ro-RO')
        : 'N/A',
      daysRemaining: tender.submissionDeadline
        ? Math.ceil((new Date(tender.submissionDeadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        : 0,
      seapUrl: tender.seapUrl,
      appUrl: `${APP_URL}/tenders/${tender.id}`,
    });

    for (const email of emails) {
      const ok = await sendEmail({ to: email, ...template });
      if (ok) stats.sent++;
    }
  }

  return stats;
}

/**
 * Send daily digest to all users
 */
export async function sendDailyDigests(): Promise<{ sent: number }> {
  const stats = { sent: 0 };
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);

  // Get all users with organizations
  const users = await prisma.user.findMany({
    where: {
      organizations: { some: {} },
    },
    include: {
      organizations: {
        include: {
          organization: {
            include: {
              tenders: {
                where: {
                  OR: [
                    { createdAt: { gte: yesterday } },
                    {
                      isWatched: true,
                      submissionDeadline: {
                        gte: now,
                        lte: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
                      },
                      status: { notIn: ['WON', 'LOST', 'CANCELLED', 'IGNORED'] },
                    },
                  ],
                },
              },
            },
          },
        },
      },
    },
  });

  for (const user of users) {
    if (!user.email) continue;

    let newCount = 0;
    const urgentDeadlines: { title: string; daysRemaining: number }[] = [];

    for (const uo of user.organizations) {
      for (const tender of uo.organization.tenders) {
        if (tender.createdAt >= yesterday) newCount++;
        if (tender.isWatched && tender.submissionDeadline) {
          const days = Math.ceil(
            (new Date(tender.submissionDeadline).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
          );
          if (days > 0 && days <= 7) {
            urgentDeadlines.push({ title: tender.title, daysRemaining: days });
          }
        }
      }
    }

    // Skip if nothing to report
    if (newCount === 0 && urgentDeadlines.length === 0) continue;

    urgentDeadlines.sort((a, b) => a.daysRemaining - b.daysRemaining);

    const template = dailyDigestEmail(user.name || 'utilizator', newCount, urgentDeadlines, APP_URL);
    const ok = await sendEmail({ to: user.email, ...template });
    if (ok) stats.sent++;
  }

  return stats;
}
