import { describe, expect, it } from 'vitest';
import { ConflictException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { PaymentsService } from './payments.service.js';
import type { PaymentsRepository } from './payments.repository.js';
import type { BankAccountRow, DepositBookingRow } from './payments.types.js';

/** Đổi mốc thời gian thành chuỗi UTC dạng "YYYY-MM-DD HH:mm:ss" như MySQL trả về. */
function utcFromNow(ms: number): string {
  return new Date(Date.now() + ms).toISOString().slice(0, 19).replace('T', ' ');
}

const BANK: BankAccountRow = {
  bankCode: 'MB',
  accountNumber: '0123456789',
  accountName: 'CUM SAN PHENIKAA',
  provider: 'DEMO',
};

function setup(options: { booking?: Partial<DepositBookingRow> | null; bank?: BankAccountRow | null } = {}) {
  const booking: DepositBookingRow | null =
    options.booking === null
      ? null
      : {
          bookingId: 1,
          code: 'BK-001',
          status: 'PENDING_DEPOSIT',
          depositDue: 105000,
          expiresAt: utcFromNow(10 * 60 * 1000),
          complexId: 1,
          ...options.booking,
        };
  const repository = {
    // Chỉ khách sở hữu đơn (customerId = 2) mới thấy đơn.
    findBookingForCustomer: async (_bookingId: number, customerId: number) => (customerId === 2 ? booking : null),
    findActiveBankAccount: async () => (options.bank === undefined ? BANK : options.bank),
  } as unknown as PaymentsRepository;
  return new PaymentsService(repository);
}

describe('PaymentsService.getDepositInfo', () => {
  it('trả số tiền cọc, nội dung chuyển khoản là mã đơn và tài khoản nhận', async () => {
    await expect(setup().getDepositInfo(1, 2)).resolves.toMatchObject({
      bookingId: 1,
      amount: 105000,
      transferContent: 'BK-001',
      bank: { accountNumber: '0123456789' },
    });
  });

  it('không lộ secretEnvKey hay trường nhạy cảm của tài khoản ngân hàng', async () => {
    const info = await setup().getDepositInfo(1, 2);
    expect(Object.keys(info.bank).sort()).toEqual(['accountName', 'accountNumber', 'bankCode', 'provider']);
  });

  it('trả 404 khi đơn không tồn tại', async () => {
    await expect(setup({ booking: null }).getDepositInfo(1, 2)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('trả 404 khi đơn của khách khác', async () => {
    await expect(setup().getDepositInfo(1, 99)).rejects.toBeInstanceOf(NotFoundException);
  });

  it.each(['DEPOSIT_PAID', 'CANCELLED', 'EXPIRED', 'COMPLETED'])(
    'trả 409 khi đơn ở trạng thái %s',
    async (status) => {
      await expect(setup({ booking: { status } }).getDepositInfo(1, 2)).rejects.toBeInstanceOf(ConflictException);
    },
  );

  it('trả 409 khi đã quá hạn giữ chỗ', async () => {
    const service = setup({ booking: { expiresAt: utcFromNow(-60 * 1000) } });
    await expect(service.getDepositInfo(1, 2)).rejects.toBeInstanceOf(ConflictException);
  });

  it('trả 503 khi cụm sân chưa có tài khoản nhận tiền', async () => {
    await expect(setup({ bank: null }).getDepositInfo(1, 2)).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});