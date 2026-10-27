import { describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import { CatalogModule } from './catalog.module.js';
import { CatalogService } from './catalog.service.js';
import { MysqlDatabase } from '../database/mysqlDatabase.js';

describe('CatalogModule dependency wiring', () => {
  it('nhận kết nối MySQL dùng chung từ DatabaseModule', async () => {
    const module = await Test.createTestingModule({ imports: [CatalogModule] })
      .overrideProvider(MysqlDatabase)
      .useValue({ rows: async () => [], pool: {} })
      .compile();
    expect(module.get(CatalogService)).toBeInstanceOf(CatalogService);
    await module.close();
  });
});