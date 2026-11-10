import { describe, expect, it } from 'vitest';
import { ConflictException } from '@nestjs/common';
import { CatalogPriceService } from './catalog-price.service.js';
import type { CatalogPriceRepository } from './catalog-price.repository.js';

function setup(overlap = false) {
  const rows = new Map<number, any>();
  let nextId = 1;
  const repository = {
    list: async () => [...rows.values()],
    findById: async (id: number) => rows.get(id) ?? null,
    pitchExists: async (id: number) => id === 1,
    hasOverlap: async (_dto: unknown, exceptId?: number) => overlap && exceptId !== 1,
    insert: async (dto: any) => {
      const id = nextId++;
      rows.set(id, { id, pitchName: 'Sân 7A', complexName: 'Cụm A', ...dto });
      return id;
    },
    update: async (id: number, dto: any) => rows.set(id, { ...rows.get(id), ...dto }),
    remove: async (id: number) => rows.delete(id),
  } as unknown as CatalogPriceRepository;
  return new CatalogPriceService(repository);
}

describe('CatalogPriceService', () => {
  it('creates a valid price and defaults deposit to 30 percent', async () => {
    const service = setup();
    await expect(service.create({ pitchId: 1, dayType: 'WEEKDAY', start: '06:00', end: '10:00', amount: 200000 }))
      .resolves.toMatchObject({ pitchId: 1, amount: 200000, depositPercent: 30 });
  });

  it('rejects invalid time ranges and unknown pitches', async () => {
    const service = setup();
    await expect(service.create({ pitchId: 1, dayType: 'WEEKDAY', start: '10:00', end: '06:00', amount: 200000 })).rejects.toThrow();
    await expect(service.create({ pitchId: 99, dayType: 'WEEKDAY', start: '06:00', end: '10:00', amount: 200000 })).rejects.toThrow('Sân không tồn tại');
  });

  it('rejects overlapping ranges', async () => {
    const service = setup(true);
    await expect(service.create({ pitchId: 1, dayType: 'WEEKDAY', start: '06:00', end: '10:00', amount: 200000 }))
      .rejects.toBeInstanceOf(ConflictException);
  });

  it('updates and deletes a price', async () => {
    const service = setup();
    const created = await service.create({ pitchId: 1, dayType: 'WEEKDAY', start: '06:00', end: '10:00', amount: 200000 });
    await expect(service.update(created.id, { amount: 250000 })).resolves.toMatchObject({ amount: 250000 });
    await service.delete(created.id);
    await expect(service.update(created.id, { amount: 300000 })).rejects.toThrow('Không tìm thấy dòng bảng giá');
  });
});
