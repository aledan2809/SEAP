import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { runFullScan, runQuickScan } from '@/lib/seap/scanner';
import {
  sendDeadlineAlerts,
  sendDailyDigests,
  sendOpportunityReports,
} from '@/lib/email/notifications';
import { logAction, AuditActions } from '@/lib/audit-log';
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rate-limit';
import { prisma } from '@/lib/db';

/**
 * SEAP Scanner + Email Notifications
 * - GET: Vercel Cron (24/7 schedule) — quick scan + opportunity reports
 * - POST: Manual trigger — admin-only scan type from body, optional digest
 */

export const maxDuration = 60;
const ADMIN_ROLES = new Set(['OWNER', 'ADMIN']);
const DIGEST_HOUR_UTC = Number(process.env.DAILY_DIGEST_HOUR_UTC || '8');
const DIGEST_MINUTE_WINDOW = Number(process.env.DAILY_DIGEST_MINUTE_WINDOW || '15');

function isDailyDigestWindow(now: Date): boolean {
  const hour = now.getUTCHours();
  const minute = now.getUTCMinutes();
  return hour === DIGEST_HOUR_UTC && minute < DIGEST_MINUTE_WINDOW;
}

async function executeScan(scanType: 'full' | 'quick', runDailyNotifications: boolean) {
  console.log(`Starting ${scanType} SEAP scan...`);

  // 1. Run SEAP scan
  const result = scanType === 'quick'
    ? await runQuickScan()
    : await runFullScan();

  // 2. Email notifications
  const emailStats = {
    opportunityReportsSent: 0,
    opportunityReportsGenerated: 0,
    deadlinesSent: 0,
    digestsSent: 0,
  };

  if (result.createdTenderIds.length > 0) {
    const reportStats = await sendOpportunityReports(result.createdTenderIds);
    emailStats.opportunityReportsSent = reportStats.sent;
    emailStats.opportunityReportsGenerated = reportStats.reports;
  }

  // 3. Daily notifications are sent once/day in digest window
  if (runDailyNotifications) {
    const deadlineStats = await sendDeadlineAlerts();
    emailStats.deadlinesSent = deadlineStats.sent;

    const digestStats = await sendDailyDigests();
    emailStats.digestsSent = digestStats.sent;
  }

  await logAction({
    action: AuditActions.SCAN_COMPLETE,
    resource: 'scan',
    details: {
      type: scanType,
      tendersFound: result.tendersFound,
      tendersCreated: result.tendersCreated,
      emailsSent:
        emailStats.opportunityReportsSent +
        emailStats.deadlinesSent +
        emailStats.digestsSent,
      opportunityReports: emailStats.opportunityReportsGenerated,
    },
  });

  return {
    ...result,
    emailStats,
    message: `Scanare completă: ${result.tendersFound} găsite, ${result.tendersCreated} noi. Email: ${
      emailStats.opportunityReportsSent + emailStats.deadlinesSent + emailStats.digestsSent
    } trimise.`,
  };
}

// Vercel Cron sends GET requests
export async function GET(request: NextRequest) {
  try {
    // Rate limit scan operations
    const clientIp = getClientIp(request);
    const limit = checkRateLimit(clientIp, RATE_LIMITS.scan);
    if (!limit.allowed) {
      return NextResponse.json(
        { error: 'Prea multe cereri de scanare. Încearcă din nou în curând.' },
        { status: 429 }
      );
    }

    // Verify Vercel cron secret
    const cronSecret = request.headers.get('authorization');
    const isCron = cronSecret === `Bearer ${process.env.CRON_SECRET}`;

    if (!isCron) {
      // Allow authenticated admin users — verify role from DB
      const session = await auth();
      if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      const membership = await prisma.userOrganization.findFirst({
        where: {
          userId: session.user.id,
          role: { in: ['OWNER', 'ADMIN'] },
        },
      });
      if (!membership) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    const response = await executeScan(
      isCron ? 'quick' : 'full',
      isCron ? isDailyDigestWindow(new Date()) : true
    );
    return NextResponse.json(response);
  } catch (error) {
    console.error('Cron scan error:', error);
    return NextResponse.json({ error: 'Scan failed', details: String(error) }, { status: 500 });
  }
}

// Manual trigger
export async function POST(request: NextRequest) {
  try {
    // Rate limit scan operations
    const clientIp = getClientIp(request);
    const limit = checkRateLimit(clientIp, RATE_LIMITS.scan);
    if (!limit.allowed) {
      return NextResponse.json(
        { error: 'Prea multe cereri de scanare. Încearcă din nou în curând.' },
        { status: 429 }
      );
    }

    const cronSecret = request.headers.get('authorization');
    const isCron = cronSecret === `Bearer ${process.env.CRON_SECRET}`;

    if (!isCron) {
      const session = await auth();
      if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      const membership = await prisma.userOrganization.findFirst({
        where: {
          userId: session.user.id,
          role: { in: ['OWNER', 'ADMIN'] },
        },
      });
      if (!membership) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    const body = await request.json().catch(() => ({}));
    const scanType = body.type === 'quick' ? 'quick' : 'full';

    const runDailyNotifications = isCron
      ? isDailyDigestWindow(new Date())
      : Boolean(body.sendDigest);

    const response = await executeScan(scanType, runDailyNotifications);
    return NextResponse.json(response);
  } catch (error) {
    console.error('Scan error:', error);
    return NextResponse.json({ error: 'Scan failed', details: String(error) }, { status: 500 });
  }
}
