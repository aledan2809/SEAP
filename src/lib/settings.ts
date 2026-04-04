/**
 * System Settings — Key/Value store in database
 *
 * Adapted from eProfit pattern. Uses raw SQL with system_settings table.
 * Table is auto-created on first access (no Prisma model needed).
 */

import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';

// All allowed setting keys
const SETTING_KEYS = [
  // Email
  'email_provider',          // 'smtp' | 'console'
  'smtp_host',
  'smtp_port',
  'smtp_user',
  'smtp_pass',
  'email_from',

  // Storage
  'storage_mode',            // 'local' | 'r2'
  'storage_local_path',
  'r2_account_id',
  'r2_access_key',
  'r2_secret_key',
  'r2_bucket',

  // Scanner
  'scanner_enabled',         // 'true' | 'false'
  'scanner_interval_hours',  // e.g. '24'
  'scanner_max_pages',       // e.g. '5'

  // AI Analysis
  'ai_provider',             // 'anthropic' | 'mock'
  'ai_auto_analyze',         // 'true' | 'false'

  // Platform
  'maintenance_mode',        // 'true' | 'false'
  'registration_enabled',    // 'true' | 'false'

  // Admin
  'admin_emails',            // comma-separated list of admin emails
] as const;

type SettingKey = typeof SETTING_KEYS[number];

const DEFAULTS: Partial<Record<SettingKey, string>> = {
  email_provider: 'console',
  storage_mode: 'local',
  storage_local_path: './uploads',
  scanner_enabled: 'true',
  scanner_interval_hours: '24',
  scanner_max_pages: '5',
  ai_provider: 'anthropic',
  ai_auto_analyze: 'false',
  maintenance_mode: 'false',
  registration_enabled: 'true',
  admin_emails: '',
};

let tableCreated = false;

/**
 * Ensure system_settings table exists
 */
async function ensureTable(): Promise<void> {
  if (tableCreated) return;

  try {
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS seap_system_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_by TEXT,
        updated_at TIMESTAMP DEFAULT NOW(),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;
    tableCreated = true;
  } catch {
    tableCreated = true;
  }
}

/**
 * Get a single setting value
 */
export async function getSetting(key: SettingKey): Promise<string | null> {
  await ensureTable();

  const rows = await prisma.$queryRaw<{ value: string }[]>(
    Prisma.sql`SELECT value FROM seap_system_settings WHERE key = ${key}`
  );

  if (rows.length > 0) return rows[0].value;
  return DEFAULTS[key] ?? null;
}

/**
 * Get multiple settings at once
 */
export async function getSettings(keys?: SettingKey[]): Promise<Record<string, string>> {
  await ensureTable();

  const targetKeys = keys || [...SETTING_KEYS];

  const rows = await prisma.$queryRaw<{ key: string; value: string }[]>(
    Prisma.sql`SELECT key, value FROM seap_system_settings WHERE key = ANY(${targetKeys}::text[])`
  );

  const result: Record<string, string> = {};

  // Apply defaults first
  for (const key of targetKeys) {
    const defaultVal = DEFAULTS[key as SettingKey];
    if (defaultVal !== undefined) {
      result[key] = defaultVal;
    }
  }

  // Override with DB values
  for (const row of rows) {
    result[row.key] = row.value;
  }

  return result;
}

/**
 * Set a single setting value
 */
export async function setSetting(
  key: SettingKey,
  value: string,
  updatedBy?: string
): Promise<void> {
  if (!SETTING_KEYS.includes(key)) {
    throw new Error(`Invalid setting key: ${key}`);
  }

  await ensureTable();

  const byUser = updatedBy || null;
  await prisma.$executeRaw`
    INSERT INTO seap_system_settings (key, value, updated_by, updated_at)
    VALUES (${key}, ${value}, ${byUser}, NOW())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = NOW()
  `;
}

/**
 * Set multiple settings at once
 */
export async function setSettings(
  settings: Record<string, string>,
  updatedBy?: string
): Promise<void> {
  await ensureTable();

  const byUser = updatedBy || null;
  for (const [key, value] of Object.entries(settings)) {
    if (!SETTING_KEYS.includes(key as SettingKey)) continue;

    await prisma.$executeRaw`
      INSERT INTO seap_system_settings (key, value, updated_by, updated_at)
      VALUES (${key}, ${value}, ${byUser}, NOW())
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = NOW()
    `;
  }
}

/**
 * Check if a user email is an admin
 */
export async function isAdmin(email: string): Promise<boolean> {
  const adminEmails = await getSetting('admin_emails');
  if (!adminEmails) return false;
  return adminEmails.split(',').map(e => e.trim().toLowerCase()).includes(email.toLowerCase());
}

export { SETTING_KEYS };
export type { SettingKey };
