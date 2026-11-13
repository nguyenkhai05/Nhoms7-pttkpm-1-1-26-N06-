import { createHmac, timingSafeEqual } from 'node:crypto';
import type { WebhookEvent } from './dto/payment-webhook.dto.js';

export function signWebhook(secret: string, event: WebhookEvent): string {
  const text = [event.provider, event.eventId, event.bookingCode, event.providerReference, String(event.amount)].join('|');
  return createHmac('sha256', secret).update(text).digest('hex');
}

export function verifyWebhookSignature(secret: string, event: WebhookEvent, signature: string | undefined): boolean {
  if (!signature || !/^[0-9a-f]{64}$/i.test(signature)) return false;
  const expected = Buffer.from(signWebhook(secret, event), 'hex');
  const given = Buffer.from(signature, 'hex');
  return given.length === expected.length && timingSafeEqual(given, expected);
}