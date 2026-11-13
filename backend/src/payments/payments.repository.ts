import { Inject, Injectable } from '@nestjs/common';
import { MysqlDatabase } from '../database/mysqlDatabase.js';
import type { BankAccountRow, DepositBookingRow } from './payments.types.js';

/** Chỉ chứa câu SQL của thanh toán; không có quy tắc nghiệp vụ. */
@Injectable()
export class PaymentsRepository {
  constructor(@Inject(MysqlDatabase) private readonly db: MysqlDatabase) {}

  async findBookingForCustomer(bookingId: number, customerId: number): Promise<DepositBookingRow | null> {
    const [row] = await this.db.rows<DepositBookingRow>(
      'SELECT b.id AS bookingId,b.code,b.status,b.depositDue,b.expiresAt,p.complexId ' +
        'FROM bookings b JOIN pitches p ON p.id=b.pitchId WHERE b.id=? AND b.customerId=?',
      [bookingId, customerId],
    );
    return row ?? null;
  }

  // Cố ý không chọn secretEnvKey để không bao giờ lộ ra API.
  async findActiveBankAccount(complexId: number): Promise<BankAccountRow | null> {
    const [row] = await this.db.rows<BankAccountRow>(
      'SELECT bankCode,accountNumber,accountName,provider FROM bank_accounts ' +
        'WHERE complexId=? AND active=TRUE ORDER BY id LIMIT 1',
      [complexId],
    );
    return row ?? null;
  }
}