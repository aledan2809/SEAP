import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getSettings, setSettings, isAdmin, SETTING_KEYS } from '@/lib/settings';
import { logAction, AuditActions } from '@/lib/audit-log';
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rate-limit';
import { z } from 'zod';

/**
 * GET /api/admin/settings — returns all system settings
 * POST /api/admin/settings — updates system settings (admin only)
 */

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.email) {
    return null;
  }
  // First user is always admin, or check admin_emails list
  const adminCheck = await isAdmin(session.user.email);
  if (!adminCheck) {
    return null;
  }
  return session;
}

export async function GET(request: NextRequest) {
  try {
    const clientIp = getClientIp(request);
    const limit = checkRateLimit(clientIp, RATE_LIMITS.sensitive);
    if (!limit.allowed) {
      return NextResponse.json({ error: 'Prea multe cereri' }, { status: 429 });
    }

    const session = await requireAdmin();
    if (!session) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const settings = await getSettings();

    // Mask sensitive values
    const masked = { ...settings };
    const sensitiveKeys = ['smtp_pass', 'r2_secret_key', 'r2_access_key'];
    for (const key of sensitiveKeys) {
      if (masked[key]) {
        masked[key] = '••••••••';
      }
    }

    return NextResponse.json({ settings: masked });
  } catch (error) {
    console.error('[Settings GET] Error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const clientIp = getClientIp(request);
    const limit = checkRateLimit(clientIp, RATE_LIMITS.sensitive);
    if (!limit.allowed) {
      return NextResponse.json({ error: 'Prea multe cereri' }, { status: 429 });
    }

    const session = await requireAdmin();
    if (!session) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();

    const settingsPayloadSchema = z.object({
      settings: z.record(z.string(), z.string().max(2000, 'Setting value too long')),
    });

    const parsed = settingsPayloadSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid payload', details: parsed.error.issues[0]?.message }, { status: 400 });
    }

    const { settings } = parsed.data;

    // Filter only valid keys, skip masked values
    const validSettings: Record<string, string> = {};
    for (const [key, value] of Object.entries(settings)) {
      if (SETTING_KEYS.includes(key as typeof SETTING_KEYS[number]) && value !== '••••••••') {
        validSettings[key] = String(value);
      }
    }

    if (Object.keys(validSettings).length === 0) {
      return NextResponse.json({ error: 'No valid settings to update' }, { status: 400 });
    }

    await setSettings(validSettings, session.user.email || undefined);

    await logAction({
      userId: session.user.id,
      userEmail: session.user.email,
      action: AuditActions.SETTINGS_UPDATE,
      resource: 'system_settings',
      details: { keys: Object.keys(validSettings) },
      request,
    });

    return NextResponse.json({ success: true, updated: Object.keys(validSettings).length });
  } catch (error) {
    console.error('[Settings POST] Error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
