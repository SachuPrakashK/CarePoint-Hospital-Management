import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
class WebhookNotificationProvider {
    async sendPasswordReset(recipient, resetUrl) { if (!env.NOTIFICATION_WEBHOOK_URL) {
        logger.warn({ event: 'password-reset-delivery-skipped' }, 'Notification provider is not configured');
        return;
    } const response = await fetch(env.NOTIFICATION_WEBHOOK_URL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ template: 'password-reset', recipient, variables: { reset_url: resetUrl } }) }); if (!response.ok)
        throw new Error('Notification provider rejected the request.'); }
}
export const notificationProvider = new WebhookNotificationProvider();
