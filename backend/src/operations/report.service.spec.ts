import { describe, expect, it } from 'vitest';
import { OperationsService } from './operations.service.js';
import type { MysqlDatabase } from '../database/mysqlDatabase.js';
import type { RedisLockService } from '../bookings/redis-lock.service.js';

describe('Dashboard: ca đã hoàn thành và số tiền thực thu', () => {
  it('đếm Booking đã đá xong vào tỷ lệ lấp đầy và phân bổ tiền đã nhận', async () => {
    const queries: string[] = [];
    const responses = [
      [{ grossRevenue: 200000, netRevenue: 180000, totalBookings: 1, pendingBookings: 0 }],
      [{ status: 'COMPLETED', total: 1 }],
      [{ bucket: '2026-11-15', grossRevenue: 200000, payments: 1 }],
      [{ total: 10 }],
      [{ total: 1 }],
      [{ serviceRevenue: 50000 }],
    ];
    const db = { pool: { execute: async (sql: string) => {
      queries.push(sql);
      return [responses.shift() ?? [], []];
    } } } as unknown as MysqlDatabase;
    const report = (await new OperationsService(db, {} as RedisLockService).report('2026-11-15', '2026-11-15', 'day')).data;
    expect(report).toMatchObject({ netRevenue: 180000, grossRevenue: 200000, pitchRevenue: 150000, serviceRevenue: 50000, fillingRate: 10 });
    expect(queries.some(query => query.includes("status IN ('DEPOSIT_PAID','CHECKED_IN','COMPLETED')"))).toBe(true);
    expect(queries.some(query => query.includes('FROM slot_occupancy'))).toBe(false);
  });
});
