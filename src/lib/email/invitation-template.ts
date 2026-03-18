/**
 * Email template for organization invitations
 */

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

export function invitationEmail(params: {
  organizationName: string;
  invitedByName: string;
  acceptUrl: string;
  expiresAt: string;
}): { subject: string; html: string; text: string } {
  return {
    subject: `Invitație în ${params.organizationName} - SEAP Assistant`,
    html: baseLayout(`
      <div style="padding:12px 16px;background:#dbeafe;border-left:4px solid #3b82f6;border-radius:4px;margin-bottom:24px;">
        <strong style="color:#1d4ed8;">Ai fost invitat să te alături unei organizații</strong>
      </div>
      <h2 style="margin:0 0 16px;font-size:18px;">Bine ai venit!</h2>
      <p style="margin:0 0 16px;color:#666;line-height:1.6;">
        <strong>${params.invitedByName}</strong> te-a invitat să te alături organizației
        <strong>${params.organizationName}</strong> pe platforma SEAP Assistant.
      </p>
      <p style="margin:0 0 24px;color:#666;line-height:1.6;">
        Prin acceptarea acestei invitații, vei avea acces la monitorizarea licitațiilor,
        analiză AI și alte funcționalități colaborative.
      </p>
      <div style="margin-top:24px;text-align:center;">
        <a href="${params.acceptUrl}" style="display:inline-block;padding:14px 32px;background:#1a1a1a;color:#fff;text-decoration:none;border-radius:6px;font-size:15px;font-weight:500;">Acceptă Invitația</a>
      </div>
      <p style="margin:24px 0 0;color:#888;font-size:13px;text-align:center;">
        Această invitație este valabilă până la ${params.expiresAt}
      </p>
    `),
    text: `${params.invitedByName} te-a invitat în ${params.organizationName} pe SEAP Assistant.\n\nAcceptă invitația: ${params.acceptUrl}\n\nValabilă până la: ${params.expiresAt}`,
  };
}
