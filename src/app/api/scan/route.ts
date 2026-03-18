import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { runFullScan, runQuickScan } from '@/lib/seap/scanner';
import {
  sendDeadlineAlerts,
  sendDailyDigests,
  sendOpportunityReports,
} from '@/lib/email/notifications';
import { logAction, AuditActions } from '@/lib/audit-log';

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
    // Verify Vercel cron secret
    const cronSecret = request.headers.get('authorization');
    const isCron = cronSecret === `Bearer ${process.env.CRON_SECRET}`;

    if (!isCron) {
      // Allow authenticated users too
      const session = await auth();
      if (!session?.user) {
        return NextResponse.json({
          status: 'ok',
          endpoint: 'seap-scanner',
          usage: 'POST { type: "full" | "quick" } or GET with CRON_SECRET',
        });
      }
      if (!ADMIN_ROLES.has(session.user.role || '')) {
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
    const cronSecret = request.headers.get('authorization');
    const isCron = cronSecret === `Bearer ${process.env.CRON_SECRET}`;

    if (!isCron) {
      const session = await auth();
      if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      if (!ADMIN_ROLES.has(session.user.role || '')) {
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
