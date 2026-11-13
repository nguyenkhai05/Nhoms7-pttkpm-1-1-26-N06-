import { BadRequestException } from '@nestjs/common';

export interface WebhookEvent {
  provider: string;
  eventId: string;
  bookingCode: string;
  providerReference: string;
  amount: number;
}

// Cấm dấu "|" vì nó là ký tự ngăn cách khi tính chữ ký.
const TOKEN = /^[A-Za-z0-9._:-]+$/;

function token(input: Record<string, unknown>, key: string, label: string, max: number): string {
  const value = input[key];
  if (typeof value !== 'string' || value.length === 0 || value.length > max || !TOKEN.test(value)) {
    throw new BadRequestException(`${label} không hợp lệ`);
  }
  return value;
}

export function parseWebhookEvent(body: unknown): WebhookEvent {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new BadRequestException('Dữ liệu webhook không hợp lệ');
  }
  const input = body as Record<string, unknown>;
  const amount = input.amount;
  if (typeof amount !== 'number' || !Number.isSafeInteger(amount) || amount < 1) {
    throw new BadRequestException('Số tiền phải là số nguyên dương');
  }
  return {
    provider: token(input, 'provider', 'Nhà cung cấp', 50),
    eventId: token(input, 'eventId', 'Mã sự kiện', 120),
    bookingCode: token(input, 'bookingCode', 'Mã đơn', 50),
    providerReference: token(input, 'providerReference', 'Mã giao dịch', 120),
    amount,
  };
}