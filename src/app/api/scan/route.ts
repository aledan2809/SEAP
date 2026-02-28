import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { runFullScan, runQuickScan } from '@/lib/seap/scanner';
import { sendDeadlineAlerts, sendNewTenderNotifications, sendDailyDigests } from '@/lib/email/notifications';
import { logAction, AuditActions } from '@/lib/audit-log';

/**
 * SEAP Scanner + Email Notifications
 * - GET: Vercel Cron (daily 08:00 UTC) — runs full scan + all notifications
 * - POST: Manual trigger — runs scan type from body, optional notifications
 */

export const maxDuration = 60;

async function executeScan(scanType: 'full' | 'quick', sendDigest: boolean) {
  console.log(`Starting ${scanType} SEAP scan...`);

  // 1. Run SEAP scan
  const result = scanType === 'quick'
    ? await runQuickScan()
    : await runFullScan();

  // 2. Email notifications
  const emailStats = { newTendersSent: 0, deadlinesSent: 0, digestsSent: 0 };

  if (result.createdTenderIds.length > 0) {
    const newStats = await sendNewTenderNotifications(result.createdTenderIds);
    emailStats.newTendersSent = newStats.sent;
  }

  // 3. Deadline alerts (1, 3, 7 days before)
  const deadlineStats = await sendDeadlineAlerts();
  emailStats.deadlinesSent = deadlineStats.sent;

  // 4. Daily digest
  if (sendDigest) {
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
      emailsSent: emailStats.newTendersSent + emailStats.deadlinesSent + emailStats.digestsSent,
    },
  });

  return {
    ...result,
    emailStats,
    message: `Scanare completă: ${result.tendersFound} găsite, ${result.tendersCreated} noi. Email: ${emailStats.newTendersSent + emailStats.deadlinesSent + emailStats.digestsSent} trimise.`,
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
    }

    const response = await executeScan('full', true);
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
    }

    const body = await request.json().catch(() => ({}));
    const scanType = body.type === 'quick' ? 'quick' : 'full';

    const response = await executeScan(scanType, isCron);
    return NextResponse.json(response);
  } catch (error) {
    console.error('Scan error:', error);
    return NextResponse.json({ error: 'Scan failed', details: String(error) }, { status: 500 });
  }
}
