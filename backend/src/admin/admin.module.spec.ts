import { describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import { AdminModule } from './admin.module.js';
import { ReportsModule } from '../reports/reports.module.js';
import { AdminService } from './admin.service.js';
import { ReportsService } from '../reports/reports.service.js';
import { MysqlDatabase } from '../database/mysqlDatabase.js';

describe('UC2.1/UC2.6 module wiring', () => {
  it('resolves auth guards and the shared database without opening a connection', async () => {
    const module = await Test.createTestingModule({ imports: [AdminModule, ReportsModule] })
      .overrideProvider(MysqlDatabase)
      .useValue({ rows: async () => [], pool: {} })
      .compile();
    expect(module.get(AdminService)).toBeInstanceOf(AdminService);
    expect(module.get(ReportsService)).toBeInstanceOf(ReportsService);
    await module.close();
  });
});
