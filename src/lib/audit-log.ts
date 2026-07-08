import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { getClientIp } from '@/lib/rate-limit';

interface LogOptions {
  userId?: string | null;
  userEmail?: string | null;
  action: string;
  resource?: string;
  resourceId?: string;
  details?: Record<string, unknown>;
  request?: Request;
}

export async function logAction(options: LogOptions): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: options.userId || null,
        userEmail: options.userEmail || null,
        action: options.action,
        resource: options.resource || null,
        resourceId: options.resourceId || null,
        details: (options.details as Prisma.InputJsonValue) || undefined,
        ip: options.request ? getClientIp(options.request) : null,
      },
    });
  } catch (error) {
    // Never let audit logging break the main flow
    console.error('[AuditLog] Failed to write:', error);
  }
}

// Common action constants
export const AuditActions = {
  // Auth
  LOGIN: 'auth.login',
  LOGOUT: 'auth.logout',
  REGISTER: 'auth.register',

  // Organization
  ORG_CREATE: 'organization.create',
  ORG_UPDATE: 'organization.update',
  ORG_SWITCH: 'organization.switch',
  ORG_INVITE: 'organization.invite',
  ORG_INVITE_ACCEPT: 'organization.invite.accept',
  ORG_INVITE_REVOKE: 'organization.invite.revoke',

  // Tender
  TENDER_VIEW: 'tender.view',
  TENDER_UPDATE_STATUS: 'tender.status.update',
  TENDER_EXPORT_PDF: 'tender.export.pdf',

  // Analysis
  ANALYSIS_RUN: 'analysis.run',

  // Documents
  DOC_UPLOAD: 'document.upload',
  DOC_DELETE: 'document.delete',
  DOC_OCR: 'document.ocr',

  // Watchdog
  WATCHDOG_CREATE: 'watchdog.create',
  WATCHDOG_UPDATE: 'watchdog.update',
  WATCHDOG_DELETE: 'watchdog.delete',

  // Settings
  SETTINGS_UPDATE: 'settings.update',
  MONITORING_UPDATE: 'monitoring.update',

  // Scan
  SCAN_RUN: 'scan.run',
  SCAN_COMPLETE: 'scan.complete',
} as const;
