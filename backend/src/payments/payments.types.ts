export interface DepositBookingRow {
  bookingId: number;
  code: string;
  status: string;
  depositDue: number;
  expiresAt: string | null;
  complexId: number;
}

export interface BankAccountRow {
  bankCode: string;
  accountNumber: string;
  accountName: string;
  provider: string;
}

export interface DepositInfo {
  bookingId: number;
  code: string;
  amount: number;
  expiresAt: string;
  transferContent: string;
  bank: BankAccountRow;
}
