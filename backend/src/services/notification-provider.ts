import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

export type DeliveryAcceptance = { provider: 'smtp' | 'webhook'; messageId?: string };

export interface NotificationProvider {
  sendPasswordReset(recipient: string, resetUrl: string): Promise<DeliveryAcceptance>;
}

const subject = 'Reset Your MediCare+ Password';
const escapeHtml = (value: string) =>
  value.replace(
    /[&<>'"]/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]!,
  );

export const passwordResetMessage = (resetUrl: string) => {
  const safeUrl = escapeHtml(resetUrl);
  return {
    subject,
    text: `Reset your MediCare+ password using this link: ${resetUrl}\n\nThis link expires in 30 minutes and can be used once. If you did not request this reset, you can ignore this email.`,
    html: `<div style="font-family:Arial,sans-serif;color:#17324d;max-width:560px;margin:auto"><h1 style="color:#0f4c75">MediCare+</h1><h2>Reset your password</h2><p>We received a request to reset your MediCare+ account password.</p><p style="margin:28px 0"><a href="${safeUrl}" style="background:#0f4c75;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:700">Reset Password</a></p><p>This link expires in 30 minutes and can be used only once.</p><p>If you did not request this reset, you can safely ignore this email.</p></div>`,
  };
};

class ConfiguredNotificationProvider implements NotificationProvider {
  async sendPasswordReset(recipient: string, resetUrl: string): Promise<DeliveryAcceptance> {
    const message = passwordResetMessage(resetUrl);
    if (env.SMTP_HOST) {
      if (!env.SMTP_FROM) throw new Error('SMTP_FROM is required when SMTP_HOST is configured.');
      const transporter = nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        secure: env.SMTP_SECURE,
        ...(env.SMTP_USER && env.SMTP_PASSWORD
          ? { auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } }
          : {}),
      });
      const accepted = await transporter.sendMail({
        from: env.SMTP_FROM,
        to: recipient,
        ...message,
      });
      if (!accepted.accepted.includes(recipient))
        throw new Error('SMTP provider did not accept the recipient.');
      return { provider: 'smtp', messageId: accepted.messageId };
    }
    if (env.NOTIFICATION_WEBHOOK_URL) {
      const response = await fetch(env.NOTIFICATION_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          template: 'password-reset',
          recipient,
          subject: message.subject,
          html: message.html,
          text: message.text,
          variables: { reset_url: resetUrl, expires_in_minutes: 30 },
        }),
      });
      if (!response.ok)
        throw new Error(`Notification webhook rejected the request (${response.status}).`);
      return { provider: 'webhook' };
    }
    throw new Error('No password reset email provider is configured.');
  }
}

export const notificationProvider: NotificationProvider = new ConfiguredNotificationProvider();
