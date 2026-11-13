import { afterEach, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { CatalogHolidayController } from './catalog-holiday.controller.js';
import { CatalogHolidayService } from './catalog-holiday.service.js';
import type { CatalogHolidayRepository, Holiday } from './catalog-holiday.repository.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/guards/permissions.guard.js';

/** Repository giả lưu trong bộ nhớ, đủ để thử hợp đồng HTTP mà không cần MySQL. */
function fakeRepository(options: { insertError?: unknown } = {}) {
  const rows: Holiday[] = [{ date: '2026-09-02', name: 'Quốc khánh' }];
  const repository = {
    list: async () => rows,
    findByDate: async (date: string) => rows.find((row) => row.date === date) ?? null,
    insert: async (dto: Holiday) => {
      if (options.insertError) throw options.insertError;
      rows.push(dto);
    },
    remove: async (date: string) => {
      rows.splice(rows.findIndex((row) => row.date === date), 1);
    },
  };
  return repository as unknown as CatalogHolidayRepository;
}

describe('API /api/catalog/holidays', () => {
  let app: INestApplication | undefined;
  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  async function start(repository: CatalogHolidayRepository) {
    const module = await Test.createTestingModule({
      controllers: [CatalogHolidayController],
      providers: [{ provide: CatalogHolidayService, useValue: new CatalogHolidayService(repository) }],
    })
      .overrideGuard(JwtAuthGuard).useValue({ canActivate: () => true })
      .overrideGuard(PermissionsGuard).useValue({ canActivate: () => true })
      .compile();
    app = module.createNestApplication();
    await app.init();
    return request(app.getHttpServer());
  }

  it('xem, thêm và xóa một ngày lễ', async () => {
    const http = await start(fakeRepository());
    expect((await http.get('/api/catalog/holidays').expect(200)).body.data).toHaveLength(1);

    const created = await http.post('/api/catalog/holidays').send({ date: '2027-01-01', name: 'Tết Dương lịch' }).expect(201);
    expect(created.body.data).toEqual({ date: '2027-01-01', name: 'Tết Dương lịch' });
    expect((await http.get('/api/catalog/holidays').expect(200)).body.data).toHaveLength(2);

    await http.delete('/api/catalog/holidays/2027-01-01').expect(200);
    expect((await http.get('/api/catalog/holidays').expect(200)).body.data).toHaveLength(1);
  });

  it('báo lỗi rõ ràng với dữ liệu sai', async () => {
    const http = await start(fakeRepository());
    await http.post('/api/catalog/holidays').send({ date: '2026-02-30', name: 'A' }).expect(400);
    await http.post('/api/catalog/holidays').send({ date: '2027-01-01' }).expect(400);
    await http.post('/api/catalog/holidays').expect(400);
    await http.delete('/api/catalog/holidays/abc').expect(400);
    await http.delete('/api/catalog/holidays/2030-05-05').expect(404);
  });

  it('đổi lỗi trùng ngày của MySQL thành 409', async () => {
    const http = await start(fakeRepository({ insertError: { errno: 1062 } }));
    const response = await http.post('/api/catalog/holidays').send({ date: '2026-09-02', name: 'Quốc khánh' }).expect(409);
    expect(response.body.message).toContain('đã có trong danh sách ngày lễ');
  });
});