import { describe, expect, it } from 'vitest';
import { PitchService } from './services/pitchService.js';
import { ScheduleService } from './services/scheduleService.js';
import type { PitchRepository } from './repositories/pitchRepository.js';

function services(holiday = false) {
  const pitch = { id: 1, name: 'Sân 7A', type: 7, status: 'ACTIVE', prices: [
    { id: 1, pitchId: 1, dayType: 'WEEKDAY', start: '06:00', end: '22:00', amount: 200000 },
    { id: 2, pitchId: 1, dayType: 'HOLIDAY', start: '06:00', end: '22:00', amount: 300000 },
  ] };
  const repository = {
    search: async (filters: unknown) => filters,
    detail: async () => pitch,
    slots: async () => [1, 2, 3, 4].map(id => ({ id, pitchId: 1, start: ['06:00', '07:30', '09:00', '10:30'][id - 1], end: ['07:30', '09:00', '10:30', '12:00'][id - 1] })),
    occupancy: async () => [{ slotId: 2, state: 'HELD' }, { slotId: 3, state: 'CONFIRMED' }],
    isHoliday: async () => holiday,
    blocks: async () => [{ startsAt: '2026-10-26 10:30:00', endsAt: '2026-10-26 12:00:00' }],
  } as unknown as PitchRepository;
  const pitchService = new PitchService(repository);
  return { pitchService, schedule: new ScheduleService(pitchService, repository) };
}

describe('UC1.2 search and schedule rules', () => {
  it('validates filters before querying the repository', async () => {
    const { pitchService } = services();
    await expect(pitchService.search({ type: '7', district: 'Hà Đông', minPrice: '100000', maxPrice: '400000', amenities: '1,4' }))
      .resolves.toMatchObject({ type: 7, minPrice: 100000, maxPrice: 400000, amenities: [1, 4] });
    expect(() => pitchService.search({ type: '9' })).toThrow();
    expect(() => pitchService.search({ minPrice: '500000', maxPrice: '100000' })).toThrow();
  });

  it('maps available, held, paid and blocked slots to green, yellow and red', async () => {
    const result = await services().schedule.matrix(1, '2026-10-26');
    expect(result.dayType).toBe('WEEKDAY');
    expect(result.slots.map(slot => slot.status)).toEqual(['GREEN', 'YELLOW', 'RED', 'RED']);
    expect(result.slots.map(slot => slot.reason)).toEqual(['AVAILABLE', 'HELD', 'BOOKED', 'UNAVAILABLE']);
    expect(result.slots[0].price).toBe(200000);
  });

  it('uses holiday pricing ahead of weekday pricing', async () => {
    const result = await services(true).schedule.matrix(1, '2026-10-26');
    expect(result.dayType).toBe('HOLIDAY');
    expect(result.slots[0].price).toBe(300000);
  });
});
