import nodemailer from 'nodemailer';

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = Number(process.env.SMTP_PORT || '587');
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const EMAIL_FROM = process.env.EMAIL_FROM || 'SEAP Assistant <noreply@seap-assistant.ro>';

const smtpConfigured = !!(SMTP_HOST && SMTP_USER && SMTP_PASS);

function getTransport() {
  if (!smtpConfigured) return null;
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
}

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail(options: SendEmailOptions): Promise<boolean> {
  const transport = getTransport();

  if (!transport) {
    console.log(`[EMAIL-CONSOLE] To: ${options.to}`);
    console.log(`[EMAIL-CONSOLE] Subject: ${options.subject}`);
    console.log(`[EMAIL-CONSOLE] Body: ${options.text || '(html only)'}`);
    return true;
  }

  try {
    await transport.sendMail({
      from: EMAIL_FROM,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
    });
    return true;
  } catch (error) {
    console.error('[EMAIL] Send failed:', error);
    return false;
  }
}
