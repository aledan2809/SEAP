import { prisma } from '@/lib/db';
import { NextRequest } from 'next/server';

interface LogOptions {
  userId?: string | null;
  userEmail?: string | null;
  action: string;
  resource?: string;
  resourceId?: string;
  details?: Record<string, unknown>;
  request?: NextRequest;
}

function getClientIp(request?: NextRequest): string | null {
  if (!request) return null;
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    null
  );
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
        details: options.details || undefined,
        ip: getClientIp(options.request),
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
