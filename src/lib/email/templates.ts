/**
 * Email templates for SEAP Assistant — Romanian language
 */

import { escapeHtml } from '@/lib/utils';

interface TenderInfo {
  title: string;
  seapId: string;
  contractingAuth: string;
  estimatedValue?: string;
  submissionDeadline: string;
  daysRemaining: number;
  seapUrl: string;
  appUrl: string;
}

interface OpportunityReportItem {
  title: string;
  seapId: string;
  contractingAuth: string;
  estimatedValue?: string;
  submissionDeadline: string;
  matchScore?: number;
  appUrl: string;
  seapUrl: string;
}

function baseLayout(content: string): string {
  return `<!DOCTYPE html>
<html lang="ro">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f5f5f5;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#fff;">
<tr><td style="padding:24px 32px;background:#1a1a1a;text-align:center;">
  <h1 style="margin:0;color:#fff;font-size:20px;">SEAP Assistant</h1>
</td></tr>
<tr><td style="padding:32px;">${content}</td></tr>
<tr><td style="padding:16px 32px;background:#f9f9f9;text-align:center;font-size:12px;color:#888;">
  SEAP Assistant &mdash; Monitorizare Licitații Publice
</td></tr>
</table>
</body></html>`;
}

export function deadlineAlertEmail(tender: TenderInfo): { subject: string; html: string; text: string } {
  const urgencyColor = tender.daysRemaining <= 1 ? '#dc2626' : tender.daysRemaining <= 3 ? '#ea580c' : '#d97706';
  const urgencyLabel = tender.daysRemaining <= 1 ? 'URGENT' : tender.daysRemaining <= 3 ? 'Aproape' : 'Atenție';
  const safeTitle = escapeHtml(tender.title);
  const safeSeapId = escapeHtml(tender.seapId);
  const safeAuth = escapeHtml(tender.contractingAuth);
  const safeValue = tender.estimatedValue ? escapeHtml(tender.estimatedValue) : undefined;
  const safeDeadline = escapeHtml(tender.submissionDeadline);

  return {
    subject: `[${urgencyLabel}] Deadline în ${tender.daysRemaining} ${tender.daysRemaining === 1 ? 'zi' : 'zile'}: ${tender.title.substring(0, 60).replace(/[\r\n\t]/g, ' ')}`,
    html: baseLayout(`
      <div style="padding:12px 16px;background:${urgencyColor}10;border-left:4px solid ${urgencyColor};border-radius:4px;margin-bottom:24px;">
        <strong style="color:${urgencyColor};">Deadline în ${tender.daysRemaining} ${tender.daysRemaining === 1 ? 'zi' : 'zile'}!</strong>
      </div>
      <h2 style="margin:0 0 8px;font-size:18px;">${safeTitle}</h2>
      <p style="margin:0 0 4px;color:#666;font-size:14px;">${safeSeapId}</p>
      <table style="width:100%;margin:16px 0;font-size:14px;" cellpadding="4">
        <tr><td style="color:#888;width:140px;">Autoritate:</td><td>${safeAuth}</td></tr>
        ${safeValue ? `<tr><td style="color:#888;">Valoare estimată:</td><td>${safeValue}</td></tr>` : ''}
        <tr><td style="color:#888;">Termen depunere:</td><td><strong style="color:${urgencyColor};">${safeDeadline}</strong></td></tr>
      </table>
      <div style="margin-top:24px;text-align:center;">
        <a href="${tender.appUrl}" style="display:inline-block;padding:12px 24px;background:#1a1a1a;color:#fff;text-decoration:none;border-radius:6px;font-size:14px;">Vezi Detalii</a>
        <a href="${tender.seapUrl}" style="display:inline-block;padding:12px 24px;margin-left:8px;border:1px solid #ddd;color:#333;text-decoration:none;border-radius:6px;font-size:14px;">Vezi pe SEAP</a>
      </div>
    `),
    text: `[${urgencyLabel}] Deadline în ${tender.daysRemaining} zile: ${tender.title}\nAutoritate: ${tender.contractingAuth}\nTermen: ${tender.submissionDeadline}\n${tender.appUrl}`,
  };
}

export function newTenderEmail(tender: TenderInfo): { subject: string; html: string; text: string } {
  const safeTitle = escapeHtml(tender.title);
  const safeSeapId = escapeHtml(tender.seapId);
  const safeAuth = escapeHtml(tender.contractingAuth);
  const safeValue = tender.estimatedValue ? escapeHtml(tender.estimatedValue) : undefined;
  const safeDeadline = escapeHtml(tender.submissionDeadline);

  return {
    subject: `Licitație nouă: ${tender.title.substring(0, 70)}`,
    html: baseLayout(`
      <div style="padding:12px 16px;background:#dbeafe;border-left:4px solid #3b82f6;border-radius:4px;margin-bottom:24px;">
        <strong style="color:#1d4ed8;">Licitație Nouă Găsită</strong>
      </div>
      <h2 style="margin:0 0 8px;font-size:18px;">${safeTitle}</h2>
      <p style="margin:0 0 4px;color:#666;font-size:14px;">${safeSeapId}</p>
      <table style="width:100%;margin:16px 0;font-size:14px;" cellpadding="4">
        <tr><td style="color:#888;width:140px;">Autoritate:</td><td>${safeAuth}</td></tr>
        ${safeValue ? `<tr><td style="color:#888;">Valoare estimată:</td><td>${safeValue}</td></tr>` : ''}
        <tr><td style="color:#888;">Termen depunere:</td><td>${safeDeadline}</td></tr>
      </table>
      <div style="margin-top:24px;text-align:center;">
        <a href="${tender.appUrl}" style="display:inline-block;padding:12px 24px;background:#1a1a1a;color:#fff;text-decoration:none;border-radius:6px;font-size:14px;">Analizează</a>
      </div>
    `),
    text: `Licitație nouă: ${tender.title}\nAutoritate: ${tender.contractingAuth}\nTermen: ${tender.submissionDeadline}\n${tender.appUrl}`,
  };
}

export function dailyDigestEmail(
  userName: string,
  newTenders: number,
  urgentDeadlines: { title: string; daysRemaining: number }[],
  appUrl: string
): { subject: string; html: string; text: string } {
  const safeUserName = escapeHtml(userName);
  const urgentHtml = urgentDeadlines.length > 0
    ? urgentDeadlines.map((t) =>
        `<li style="margin-bottom:8px;"><strong>${escapeHtml(t.title.substring(0, 60))}</strong> — ${t.daysRemaining} ${t.daysRemaining === 1 ? 'zi' : 'zile'} rămase</li>`
      ).join('')
    : '<li style="color:#888;">Niciun deadline urgent</li>';

  return {
    subject: `Rezumat zilnic: ${newTenders} licitații noi, ${urgentDeadlines.length} deadline-uri`,
    html: baseLayout(`
      <h2 style="margin:0 0 16px;">Bună, ${safeUserName}!</h2>
      <p style="margin:0 0 24px;color:#666;">Iată rezumatul activității tale pe SEAP:</p>
      <div style="display:flex;gap:16px;margin-bottom:24px;">
        <div style="flex:1;padding:16px;background:#f0fdf4;border-radius:8px;text-align:center;">
          <div style="font-size:28px;font-weight:bold;color:#16a34a;">${newTenders}</div>
          <div style="font-size:13px;color:#666;">Licitații noi</div>
        </div>
        <div style="flex:1;padding:16px;background:#fff7ed;border-radius:8px;text-align:center;">
          <div style="font-size:28px;font-weight:bold;color:#ea580c;">${urgentDeadlines.length}</div>
          <div style="font-size:13px;color:#666;">Deadline-uri urgente</div>
        </div>
      </div>
      ${urgentDeadlines.length > 0 ? `<h3 style="margin:0 0 8px;">Deadline-uri Apropiate:</h3><ul style="padding-left:20px;">${urgentHtml}</ul>` : ''}
      <div style="margin-top:24px;text-align:center;">
        <a href="${appUrl}/dashboard" style="display:inline-block;padding:12px 24px;background:#1a1a1a;color:#fff;text-decoration:none;border-radius:6px;font-size:14px;">Deschide Dashboard</a>
      </div>
    `),
    text: `Rezumat zilnic: ${newTenders} licitații noi, ${urgentDeadlines.length} deadline-uri urgente.`,
  };
}

export function opportunityReportEmail(
  organizationName: string,
  opportunities: OpportunityReportItem[],
  appUrl: string
): { subject: string; html: string; text: string } {
  const safeOrgName = escapeHtml(organizationName);
  const rows = opportunities
    .map((item) => `
      <tr>
        <td style="padding:10px;border-bottom:1px solid #eee;">
          <div style="font-weight:600;margin-bottom:4px;">${escapeHtml(item.title)}</div>
          <div style="font-size:12px;color:#666;">${escapeHtml(item.seapId)} • ${escapeHtml(item.contractingAuth)}</div>
        </td>
        <td style="padding:10px;border-bottom:1px solid #eee;font-size:13px;">
          ${item.estimatedValue ? escapeHtml(item.estimatedValue) : '-'}
        </td>
        <td style="padding:10px;border-bottom:1px solid #eee;font-size:13px;">
          ${item.submissionDeadline}
        </td>
        <td style="padding:10px;border-bottom:1px solid #eee;font-size:13px;text-align:center;">
          ${typeof item.matchScore === 'number' ? `${item.matchScore}%` : '-'}
        </td>
      </tr>
    `)
    .join('');

  return {
    subject: `Raport oportunități: ${opportunities.length} licitații noi (${organizationName})`,
    html: baseLayout(`
      <div style="padding:12px 16px;background:#ecfdf5;border-left:4px solid #16a34a;border-radius:4px;margin-bottom:24px;">
        <strong style="color:#166534;">Au fost identificate ${opportunities.length} oportunități noi.</strong>
      </div>
      <h2 style="margin:0 0 8px;font-size:18px;">${safeOrgName}</h2>
      <p style="margin:0 0 16px;color:#666;">Raportul conține licitațiile noi potrivite profilului de monitorizare.</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <thead>
          <tr style="background:#f8fafc;">
            <th style="padding:10px;text-align:left;border-bottom:1px solid #e2e8f0;">Licitație</th>
            <th style="padding:10px;text-align:left;border-bottom:1px solid #e2e8f0;">Valoare</th>
            <th style="padding:10px;text-align:left;border-bottom:1px solid #e2e8f0;">Termen</th>
            <th style="padding:10px;text-align:center;border-bottom:1px solid #e2e8f0;">Scor</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <div style="margin-top:24px;text-align:center;">
        <a href="${appUrl}/tenders" style="display:inline-block;padding:12px 24px;background:#1a1a1a;color:#fff;text-decoration:none;border-radius:6px;font-size:14px;">Deschide Oportunitățile</a>
      </div>
    `),
    text: `Raport oportunități ${organizationName}: ${opportunities.length} licitații noi. Vezi în aplicație: ${appUrl}/tenders`,
  };
}
