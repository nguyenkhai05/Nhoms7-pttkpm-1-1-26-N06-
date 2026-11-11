import { describe, expect, it } from 'vitest';
import { ReportsService } from './reports.service.js';
import type { ReportsRepository } from './reports.repository.js';

function service() {
  const repository = {
    cashEvents: async () => [
      { localDate:'2026-11-11', kind:'PAYMENT', amount:100000, pitchAmount:600000, serviceAmount:400000, serviceOnly:0 },
      { localDate:'2026-11-11', kind:'PAYMENT', amount:20000, pitchAmount:0, serviceAmount:0, serviceOnly:1 },
      { localDate:'2026-11-11', kind:'REFUND', amount:10000, pitchAmount:600000, serviceAmount:400000, serviceOnly:0 },
    ],
    bookingCounts: async () => ({ confirmed:2, pending:1 }),
    occupancy: async () => ({ filled:1, capacity:2 }),
  } as unknown as ReportsRepository;
  return new ReportsService(repository);
}

describe('UC2.1 reporting', () => {
  it('allocates collected deposits, subtracts paid refunds, and counts occupied slots', async () => {
    const report = await service().summary('2026-11-11','2026-11-11');
    expect(report).toMatchObject({ pitchCollected:60000, serviceCollected:60000, refunded:10000,
      netCollected:110000, confirmedBookings:2, pendingBookings:1, occupancyPercent:50 });
    expect(report.daily[0].net).toBe(110000);
  });
  it('rejects invalid or oversized ranges', async () => {
    await expect(service().summary('2026-02-30','2026-03-01')).rejects.toThrow();
    await expect(service().summary('2026-11-12','2026-11-11')).rejects.toThrow();
    await expect(service().summary('2025-01-01','2026-11-11')).rejects.toThrow();
  });
});
