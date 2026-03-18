import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getSettings, setSettings, isAdmin, SETTING_KEYS } from '@/lib/settings';
import { logAction, AuditActions } from '@/lib/audit-log';

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

export async function GET() {
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
}

export async function POST(request: NextRequest) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const { settings } = body;

  if (!settings || typeof settings !== 'object') {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  // Filter only valid keys, skip masked values
  const validSettings: Record<string, string> = {};
  for (const [key, value] of Object.entries(settings)) {
    if (SETTING_KEYS.includes(key as typeof SETTING_KEYS[number]) && value !== '••••••••') {
      validSettings[key] = String(value);
    }
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
}
