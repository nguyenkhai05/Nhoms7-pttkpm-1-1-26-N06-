import { describe, expect, it } from 'vitest';
import { PitchRepository } from './repositories/pitchRepository.js';
import type { MysqlDatabase } from '../database/mysqlDatabase.js';

describe('UC1.2 search price filtering', () => {
  it('matches a pitch when any one of its price rules is inside the selected range', async () => {
    let sql = '';
    let values: unknown[] = [];
    const database = {
      rows: async (query: string, params: unknown[] = []) => {
        sql = query;
        values = params;
        return [];
      },
    } as unknown as MysqlDatabase;

    await new PitchRepository(database).search({
      type: null,
      district: '',
      minPrice: 200000,
      maxPrice: 400000,
      amenities: [],
    });

    expect(sql).toContain('EXISTS(SELECT 1 FROM prices r');
    expect(sql).toContain('r.amount>=?');
    expect(sql).toContain('r.amount<=?');
    expect(values).toEqual([200000, 400000]);
  });
});
