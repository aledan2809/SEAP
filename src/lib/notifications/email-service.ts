/**
 * Email notification service for tender deadlines
 * Sends alerts 3 days before deadline for monitored tenders
 */

import { prisma } from '@/lib/db';
import { sendDeadlineAlerts } from '@/lib/email/notifications';

interface DeadlineCheckResult {
  checked: number;
  emailsSent: number;
  errors: number;
}

/**
 * Check all watched tenders and send deadline alerts
 * Called from cron job or webhook
 */
export async function checkDeadlinesAndNotify(): Promise<DeadlineCheckResult> {
  const result = await sendDeadlineAlerts();

  return {
    checked: 0, // sendDeadlineAlerts doesn't return this, but we could calculate it
    emailsSent: result.sent,
    errors: result.errors,
  };
}

/**
 * Send deadline alert for a specific tender
 */
export async function notifyTenderDeadline(
  tenderId: string,
  daysRemaining?: number
): Promise<{ success: boolean; emailsSent: number }> {
  const notifications = await import('@/lib/email/notifications');

  const result = await notifications.sendDeadlineAlertForTender(tenderId, daysRemaining);

  return {
    success: result.sent > 0,
    emailsSent: result.sent,
  };
}

/**
 * Get tenders approaching deadline (for manual review)
 */
export async function getUpcomingDeadlines(days: number = 7) {
  const now = new Date();
  const futureDate = new Date(now);
  futureDate.setDate(futureDate.getDate() + days);

  return prisma.tender.findMany({
    where: {
      isWatched: true,
      submissionDeadline: {
        gte: now,
        lte: futureDate,
      },
      status: { notIn: ['WON', 'LOST', 'CANCELLED', 'IGNORED'] },
    },
    include: {
      organization: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: {
      submissionDeadline: 'asc',
    },
  });
}
