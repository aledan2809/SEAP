import { NextRequest, NextResponse } from 'next/server';
import { sendDeadlineAlerts } from '@/lib/email/notifications';

/**
 * API Route: /api/notifications/deadline-check
 *
 * Checks for tenders with approaching deadlines (1, 3, or 7 days)
 * and sends email notifications to organization users.
 *
 * Should be called daily via:
 * - Vercel Cron Job (vercel.json)
 * - n8n webhook trigger
 * - Manual trigger
 *
 * Authentication: Bearer token from env
 */
export async function POST(request: NextRequest) {
  try {
    // Verify cron secret for security
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[DEADLINE-CHECK] Starting deadline alert check...');
    const stats = await sendDeadlineAlerts();

    console.log(`[DEADLINE-CHECK] Completed. Sent: ${stats.sent}, Errors: ${stats.errors}`);

    return NextResponse.json({
      success: true,
      sent: stats.sent,
      errors: stats.errors,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[DEADLINE-CHECK] Failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint for manual testing/health check
 */
export async function GET() {
  return NextResponse.json({
    service: 'deadline-check',
    status: 'ready',
    description: 'Use POST to trigger deadline check',
  });
}
