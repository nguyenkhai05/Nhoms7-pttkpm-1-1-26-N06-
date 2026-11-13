import { describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import { PitchModule } from './pitch.module.js';
import { PitchService } from './services/pitchService.js';
import { MysqlDatabase } from '../database/mysqlDatabase.js';

describe('PitchModule dependency wiring', () => {
  it('receives the shared database provider from DatabaseModule', async () => {
    const module = await Test.createTestingModule({ imports: [PitchModule] })
      .overrideProvider(MysqlDatabase).useValue({ rows: async () => [] }).compile();
    expect(module.get(PitchService)).toBeInstanceOf(PitchService);
    await module.close();
  });
});
