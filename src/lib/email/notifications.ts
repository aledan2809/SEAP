/**
 * Email notification triggers — called from scan/cron jobs
 */

import { prisma } from '@/lib/db';
import { sendEmail } from './client';
import {
  deadlineAlertEmail,
  newTenderEmail,
  dailyDigestEmail,
  opportunityReportEmail,
} from './templates';

const APP_URL = process.env.NEXTAUTH_URL || 'https://seap-assistant.vercel.app';
const ADMIN_ROLES = new Set(['OWNER', 'ADMIN']);

type OrganizationUserLink = {
  role: string;
  user: {
    email: string;
  };
};

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function getNotificationRecipients(userOrganizations: OrganizationUserLink[]): string[] {
  const adminEmails = userOrganizations
    .filter((uo) => ADMIN_ROLES.has(uo.role))
    .map((uo) => uo.user.email)
    .filter(Boolean);

  if (adminEmails.length > 0) {
    return unique(adminEmails);
  }

  return unique(
    userOrganizations
      .map((uo) => uo.user.email)
      .filter(Boolean)
  );
}

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
              select: {
                role: true,
                user: {
                  select: { email: true },
                },
              },
            },
          },
        },
      },
    });

    for (const tender of tenders) {
      const emails = getNotificationRecipients(
        tender.organization.userOrganizations as OrganizationUserLink[]
      );

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
 * Send deadline alerts for a specific tender.
 */
export async function sendDeadlineAlertForTender(
  tenderId: string,
  daysRemaining?: number
): Promise<{ sent: number; errors: number }> {
  const stats = { sent: 0, errors: 0 };
  const tender = await prisma.tender.findUnique({
    where: { id: tenderId },
    include: {
      organization: {
        include: {
          userOrganizations: {
            select: {
              role: true,
              user: {
                select: { email: true },
              },
            },
          },
        },
      },
    },
  });

  if (!tender || !tender.submissionDeadline) {
    return stats;
  }

  const now = new Date();
  const computedDaysRemaining = Math.ceil(
    (new Date(tender.submissionDeadline).getTime() - now.getTime()) /
      (1000 * 60 * 60 * 24)
  );
  const remaining = daysRemaining ?? computedDaysRemaining;

  if (remaining <= 0) {
    return stats;
  }

  const emails = getNotificationRecipients(
    tender.organization.userOrganizations as OrganizationUserLink[]
  );
  const template = deadlineAlertEmail({
    title: tender.title,
    seapId: tender.seapId,
    contractingAuth: tender.contractingAuth,
    estimatedValue: tender.estimatedValue
      ? `${Number(tender.estimatedValue).toLocaleString('ro-RO')} ${tender.currency}`
      : undefined,
    submissionDeadline: new Date(tender.submissionDeadline).toLocaleDateString('ro-RO', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }),
    daysRemaining: remaining,
    seapUrl: tender.seapUrl,
    appUrl: `${APP_URL}/tenders/${tender.id}`,
  });

  for (const email of emails) {
    const ok = await sendEmail({ to: email, ...template });
    if (ok) stats.sent++;
    else stats.errors++;
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
            select: {
              role: true,
              user: {
                select: { email: true },
              },
            },
          },
        },
      },
    },
  });

  for (const tender of tenders) {
    const now = new Date();
    const emails = getNotificationRecipients(
      tender.organization.userOrganizations as OrganizationUserLink[]
    );

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
        ? Math.ceil(
            (new Date(tender.submissionDeadline).getTime() - now.getTime()) /
              (1000 * 60 * 60 * 24)
          )
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
 * Send grouped opportunity reports to organization admins/owners.
 */
export async function sendOpportunityReports(
  tenderIds: string[]
): Promise<{ sent: number; reports: number }> {
  const stats = { sent: 0, reports: 0 };
  if (tenderIds.length === 0) return stats;

  const tenders = await prisma.tender.findMany({
    where: { id: { in: tenderIds } },
    include: {
      organization: {
        include: {
          userOrganizations: {
            select: {
              role: true,
              user: {
                select: { email: true },
              },
            },
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  const groups = new Map<
    string,
    {
      organizationName: string;
      recipients: string[];
      opportunities: Array<{
        title: string;
        seapId: string;
        contractingAuth: string;
        estimatedValue?: string;
        submissionDeadline: string;
        matchScore?: number;
        appUrl: string;
        seapUrl: string;
      }>;
    }
  >();

  for (const tender of tenders) {
    const existing = groups.get(tender.organizationId);
    const recipients = getNotificationRecipients(
      tender.organization.userOrganizations as OrganizationUserLink[]
    );
    const opportunity = {
      title: tender.title,
      seapId: tender.seapId,
      contractingAuth: tender.contractingAuth,
      estimatedValue: tender.estimatedValue
        ? `${Number(tender.estimatedValue).toLocaleString('ro-RO')} ${tender.currency}`
        : undefined,
      submissionDeadline: tender.submissionDeadline
        ? new Date(tender.submissionDeadline).toLocaleDateString('ro-RO')
        : 'N/A',
      matchScore: tender.matchScore ?? undefined,
      seapUrl: tender.seapUrl,
      appUrl: `${APP_URL}/tenders/${tender.id}`,
    };

    if (existing) {
      existing.opportunities.push(opportunity);
      existing.recipients = unique([...existing.recipients, ...recipients]);
      continue;
    }

    groups.set(tender.organizationId, {
      organizationName: tender.organization.name,
      recipients,
      opportunities: [opportunity],
    });
  }

  for (const group of groups.values()) {
    if (group.recipients.length === 0 || group.opportunities.length === 0) {
      continue;
    }

    const template = opportunityReportEmail(
      group.organizationName,
      group.opportunities,
      APP_URL
    );

    let atLeastOneSent = false;
    for (const email of group.recipients) {
      const ok = await sendEmail({ to: email, ...template });
      if (ok) {
        stats.sent++;
        atLeastOneSent = true;
      }
    }

    if (atLeastOneSent) {
      stats.reports++;
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
              userOrganizations: {
                select: {
                  role: true,
                  user: {
                    select: { id: true, email: true },
                  },
                },
              },
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
    const isAdminForAtLeastOneOrg = user.organizations.some((uo) =>
      uo.organization.userOrganizations.some(
        (membership) =>
          membership.user.id === user.id && ADMIN_ROLES.has(membership.role)
      )
    );
    if (!isAdminForAtLeastOneOrg) continue;

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
