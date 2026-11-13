import { afterEach, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { CatalogSlotController } from './catalog-slot.controller.js';
import { CatalogSlotService } from './catalog-slot.service.js';
import type { CatalogSlot, CatalogSlotRepository } from './catalog-slot.repository.js';
import type { PriceWindow } from './catalog-slot.coverage.js';
import type { CreateSlotDto } from './dto/slot.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/guards/permissions.guard.js';

interface Options {
  usage?: number;
  insertError?: unknown;
  removeError?: unknown;
}

const windows: PriceWindow[] = [
  { dayType: 'WEEKDAY', start: '06:00', end: '17:00' },
  { dayType: 'WEEKDAY', start: '17:00', end: '22:00' },
  { dayType: 'WEEKEND', start: '06:00', end: '22:00' },
  { dayType: 'HOLIDAY', start: '06:00', end: '22:00' },
];

/** Repository giả lưu trong bộ nhớ, đủ để thử hợp đồng HTTP mà không cần MySQL. */
function fakeRepository(options: Options = {}) {
  const rows: CatalogSlot[] = [{ id: 1, pitchId: 1, start: '06:00', end: '07:30' }];
  let nextId = 2;
  const repository = {
    pitchExists: async (id: number) => id === 1,
    list: async (pitchId: number) => rows.filter((row) => row.pitchId === pitchId),
    findById: async (pitchId: number, slotId: number) => rows.find((row) => row.id === slotId && row.pitchId === pitchId) ?? null,
    priceWindows: async () => windows,
    insert: async (pitchId: number, dto: CreateSlotDto) => {
      if (options.insertError) throw options.insertError;
      rows.push({ id: nextId, pitchId, ...dto });
      return nextId++;
    },
    countUsage: async () => options.usage ?? 0,
    remove: async (_pitchId: number, slotId: number) => {
      if (options.removeError) throw options.removeError;
      rows.splice(rows.findIndex((row) => row.id === slotId), 1);
    },
  };
  return repository as unknown as CatalogSlotRepository;
}

describe('API /api/catalog/pitches/:id/slots', () => {
  let app: INestApplication | undefined;
  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  async function start(repository: CatalogSlotRepository) {
    const module = await Test.createTestingModule({
      controllers: [CatalogSlotController],
      providers: [{ provide: CatalogSlotService, useValue: new CatalogSlotService(repository) }],
    })
      .overrideGuard(JwtAuthGuard).useValue({ canActivate: () => true })
      .overrideGuard(PermissionsGuard).useValue({ canActivate: () => true })
      .compile();
    app = module.createNestApplication();
    await app.init();
    return request(app.getHttpServer());
  }

  it('xem, thêm và xóa ca giờ, kèm báo loại ngày thiếu giá', async () => {
    const http = await start(fakeRepository());
    const listed = await http.get('/api/catalog/pitches/1/slots').expect(200);
    expect(listed.body.data).toEqual([{ id: 1, pitchId: 1, start: '06:00', end: '07:30', uncoveredDayTypes: [] }]);

    const ok = await http.post('/api/catalog/pitches/1/slots').send({ start: '17:00', end: '18:30' }).expect(201);
    expect(ok.body.data).toMatchObject({ start: '17:00', end: '18:30', uncoveredDayTypes: [] });

    const crossing = await http.post('/api/catalog/pitches/1/slots').send({ start: '16:00', end: '17:30' }).expect(201);
    expect(crossing.body.data.uncoveredDayTypes).toEqual(['WEEKDAY']);

    await http.delete(`/api/catalog/pitches/1/slots/${crossing.body.data.id}`).expect(200);
    expect((await http.get('/api/catalog/pitches/1/slots').expect(200)).body.data).toHaveLength(2);
  });

  it('báo lỗi rõ ràng với dữ liệu sai', async () => {
    const http = await start(fakeRepository());
    await http.post('/api/catalog/pitches/1/slots').send({ start: '8:00', end: '09:00' }).expect(400);
    await http.post('/api/catalog/pitches/1/slots').send({ start: '09:00', end: '08:00' }).expect(400);
    await http.post('/api/catalog/pitches/1/slots').expect(400);
    await http.get('/api/catalog/pitches/abc/slots').expect(400);
    await http.get('/api/catalog/pitches/99/slots').expect(404);
    await http.post('/api/catalog/pitches/99/slots').send({ start: '08:00', end: '09:00' }).expect(404);
    await http.delete('/api/catalog/pitches/1/slots/99').expect(404);
    await http.delete('/api/catalog/pitches/1/slots/abc').expect(400);
  });

  it('đổi lỗi của sp_add_slot thành mã HTTP phù hợp', async () => {
    const overlap = { sqlMessage: 'Overlapping slots', code: 'ER_SIGNAL_EXCEPTION', errno: 1644 };
    const http = await start(fakeRepository({ insertError: overlap }));
    const response = await http.post('/api/catalog/pitches/1/slots').send({ start: '06:30', end: '08:00' }).expect(409);
    expect(response.body.message).toContain('trùng');

    await app?.close();
    const invalid = await start(fakeRepository({ insertError: { sqlMessage: 'Invalid pitch or time' } }));
    await invalid.post('/api/catalog/pitches/1/slots').send({ start: '06:30', end: '08:00' }).expect(400);
  });

  it('không cho xóa ca đã có đơn đặt hoặc lịch sử giữ chỗ', async () => {
    const http = await start(fakeRepository({ usage: 3 }));
    const response = await http.delete('/api/catalog/pitches/1/slots/1').expect(409);
    expect(response.body.message).toContain('không thể xóa');
    await http.get('/api/catalog/pitches/1/slots').expect(200);
  });

  it('đổi lỗi khóa ngoại của MySQL khi xóa thành 409', async () => {
    const http = await start(fakeRepository({ removeError: { errno: 1451 } }));
    await http.delete('/api/catalog/pitches/1/slots/1').expect(409);
  });
});