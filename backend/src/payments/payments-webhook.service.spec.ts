import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { BadRequestException, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { PaymentsWebhookService } from './payments-webhook.service.js';
import type { PaymentsRepository } from './payments.repository.js';
import { signWebhook } from './webhook-signature.js';
import type { WebhookEvent } from './dto/payment-webhook.dto.js';

const SECRET = 'a'.repeat(64);
const EVENT: WebhookEvent = { provider: 'DEMO', eventId: 'evt-1', bookingCode: 'BK-1', providerReference: 'REF-1', amount: 120000 };

function setup(options: { bookingId?: number | null; confirmError?: unknown } = {}) {
  const events = new Map<string, string>();
  let confirmCalls = 0;
  const repository = {
    insertEvent: async (e: WebhookEvent) => {
      const key = `${e.provider}:${e.eventId}`;
      if (events.has(key)) return false;
      events.set(key, 'RECEIVED');
      return true;
    },
    findEventStatus: async (p: string, id: string) => events.get(`${p}:${id}`) ?? null,
    markEvent: async (e: WebhookEvent, status: string) => { events.set(`${e.provider}:${e.eventId}`, status); },
    findBookingIdByCode: async () => (options.bookingId === undefined ? 7 : options.bookingId),
    confirmDeposit: async () => {
      confirmCalls++;
      if (options.confirmError) throw options.confirmError;
    },
    findPaymentId: async () => 55,
  } as unknown as PaymentsRepository;
  return { service: new PaymentsWebhookService(repository), events, calls: () => confirmCalls };
}

describe('PaymentsWebhookService', () => {
  beforeEach(() => { process.env.PAYMENT_WEBHOOK_SECRET = SECRET; });
  afterEach(() => { delete process.env.PAYMENT_WEBHOOK_SECRET; });

  const sig = (event = EVENT) => signWebhook(SECRET, event);

  it('xác nhận cọc khi chữ ký đúng', async () => {
    const { service, events } = setup();
    await expect(service.handle(EVENT, sig())).resolves.toMatchObject({ status: 'PROCESSED', bookingId: 7 });
    expect(events.get('DEMO:evt-1')).toBe('PROCESSED');
  });

  it('trả 401 và không lưu sự kiện khi chữ ký sai', async () => {
    const { service, events } = setup();
    await expect(service.handle(EVENT, 'f'.repeat(64))).rejects.toBeInstanceOf(UnauthorizedException);
    expect(events.size).toBe(0);
  });

  it('trả 401 khi sửa số tiền sau khi ký', async () => {
    const { service } = setup();
    await expect(service.handle({ ...EVENT, amount: 1 }, sig())).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('trả 400 khi thiếu trường', async () => {
    const { service } = setup();
    await expect(service.handle({ provider: 'DEMO' }, sig())).rejects.toBeInstanceOf(BadRequestException);
  });

  it('từ chối khi chưa cấu hình bí mật', async () => {
    delete process.env.PAYMENT_WEBHOOK_SECRET;
    await expect(setup().service.handle(EVENT, sig())).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('gửi lặp cùng eventId thì không xử lý lần hai', async () => {
    const { service, calls } = setup();
    await service.handle(EVENT, sig());
    await expect(service.handle(EVENT, sig())).resolves.toMatchObject({ status: 'PROCESSED', duplicate: true });
    expect(calls()).toBe(1);
  });

  it('đánh dấu NEEDS_REVIEW khi procedure từ chối (sai tiền, trễ hạn)', async () => {
    const error = { sqlState: '45000', sqlMessage: 'Late payment, wrong amount or invalid state; manual reconciliation required' };
    const { service, events } = setup({ confirmError: error });
    await expect(service.handle(EVENT, sig())).resolves.toMatchObject({ status: 'NEEDS_REVIEW' });
    expect(events.get('DEMO:evt-1')).toBe('NEEDS_REVIEW');
  });

  it('đánh dấu NEEDS_REVIEW khi không thấy đơn', async () => {
    const { service } = setup({ bookingId: null });
    await expect(service.handle(EVENT, sig())).resolves.toMatchObject({ status: 'NEEDS_REVIEW' });
  });

  it('ném lại lỗi hệ thống (không phải vi phạm quy tắc) để nhà cung cấp gửi lại', async () => {
    const { service } = setup({ confirmError: new Error('mất kết nối') });
    await expect(service.handle(EVENT, sig())).rejects.toThrow('mất kết nối');
  });
});