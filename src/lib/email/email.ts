import { getEnv } from '@/lib/env';
import { logger } from '@/lib/logging/logger';

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

async function sendViaResend(input: SendEmailInput): Promise<void> {
  const env = getEnv();
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: env.EMAIL_FROM,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Resend API error (${response.status}): ${body}`);
  }
}

async function sendViaSmtp(input: SendEmailInput): Promise<void> {
  const env = getEnv();
  const nodemailer = await import('nodemailer');
  const transport = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE ?? false,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD },
  });

  await transport.sendMail({
    from: env.EMAIL_FROM,
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
  });
}

/** Central email send path — every outbound email (Better Auth's + our own notifications) goes through this. */
export async function sendEmail(input: SendEmailInput): Promise<void> {
  const env = getEnv();

  if (env.EMAIL_DRIVER === 'console') {
    logger.info('Email not sent (EMAIL_DRIVER=console)', { to: input.to, subject: input.subject });
    return;
  }

  try {
    if (env.EMAIL_DRIVER === 'resend') {
      await sendViaResend(input);
    } else {
      await sendViaSmtp(input);
    }
    logger.info('Email sent', { to: input.to, subject: input.subject, driver: env.EMAIL_DRIVER });
  } catch (error) {
    logger.error('Failed to send email', {
      to: input.to,
      subject: input.subject,
      driver: env.EMAIL_DRIVER,
      message: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
