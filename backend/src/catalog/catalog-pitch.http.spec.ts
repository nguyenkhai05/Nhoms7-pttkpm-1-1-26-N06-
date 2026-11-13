import { afterEach, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { CatalogPitchController } from './catalog-pitch.controller.js';
import { CatalogPitchService } from './catalog-pitch.service.js';
import type { CatalogPitchRepository } from './catalog-pitch.repository.js';
import type { CatalogPitch } from './catalog.types.js';
import type { CreatePitchDto, UpdatePitchDto } from './dto/pitch.dto.js';

interface Options {
  upcoming?: number;
  dependents?: { slots: number; prices: number; blocks: number };
  insertError?: unknown;
}

/** Repository giả lưu trong bộ nhớ, đủ để thử hợp đồng HTTP mà không cần MySQL. */
function fakeRepository(options: Options = {}) {
  const rows: CatalogPitch[] = [
    { id: 1, complexId: 1, complexName: 'Cụm sân Phenikaa', name: 'Sân 7A', type: 7, grass: null, lights: null, status: 'ACTIVE', image: null, amenityIds: [1, 2] },
  ];
  let nextId = 2;
  const repository = {
    listAmenities: async () => [{ id: 1, name: 'Bãi xe' }],
    complexExists: async (id: number) => id === 1,
    findAll: async (complexId?: number) => rows.filter((row) => complexId === undefined || row.complexId === complexId),
    findById: async (id: number) => rows.find((row) => row.id === id) ?? null,
    insert: async (dto: CreatePitchDto) => {
      if (options.insertError) throw options.insertError;
      rows.push({ id: nextId, complexName: 'Cụm sân Phenikaa', ...dto });
      return nextId++;
    },
    update: async (id: number, dto: UpdatePitchDto) => {
      Object.assign(rows.find((row) => row.id === id) as CatalogPitch, dto);
    },
    countUpcomingBookings: async () => options.upcoming ?? 0,
    countDependents: async () => options.dependents ?? { slots: 0, prices: 0, blocks: 0 },
    remove: async (id: number) => {
      rows.splice(rows.findIndex((row) => row.id === id), 1);
    },
  };
  return repository as unknown as CatalogPitchRepository;
}

describe('API /api/catalog/pitches', () => {
  let app: INestApplication | undefined;
  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  async function start(repository: CatalogPitchRepository) {
    const module = await Test.createTestingModule({
      controllers: [CatalogPitchController],
      providers: [{ provide: CatalogPitchService, useValue: new CatalogPitchService(repository) }],
    }).compile();
    app = module.createNestApplication();
    await app.init();
    return request(app.getHttpServer());
  }

  it('liệt kê tiện ích và sân, lọc theo cụm sân', async () => {
    const http = await start(fakeRepository());
    expect((await http.get('/api/catalog/amenities').expect(200)).body.data).toHaveLength(1);
    expect((await http.get('/api/catalog/pitches').expect(200)).body.data).toHaveLength(1);
    expect((await http.get('/api/catalog/pitches?complexId=2').expect(200)).body.data).toHaveLength(0);
    await http.get('/api/catalog/pitches?complexId=abc').expect(400);
  });

  it('thêm, sửa, đổi trạng thái và xóa một sân', async () => {
    const http = await start(fakeRepository());
    const created = await http
      .post('/api/catalog/pitches')
      .send({ complexId: 1, name: 'Sân 9A', type: 7, amenityIds: [1] })
      .expect(201);
    const id = created.body.data.id as number;
    expect(created.body.data).toMatchObject({ name: 'Sân 9A', status: 'ACTIVE', amenityIds: [1] });

    const updated = await http
      .patch(`/api/catalog/pitches/${id}`)
      .send({ name: 'Sân 9B', status: 'MAINTENANCE', amenityIds: [] })
      .expect(200);
    expect(updated.body.data).toMatchObject({ name: 'Sân 9B', status: 'MAINTENANCE', amenityIds: [] });

    await http.delete(`/api/catalog/pitches/${id}`).expect(200);
    await http.get(`/api/catalog/pitches/${id}`).expect(404);
  });

  it('báo lỗi rõ ràng với dữ liệu sai', async () => {
    const http = await start(fakeRepository());
    await http.post('/api/catalog/pitches').send({ complexId: 1, name: 'A', type: 6 }).expect(400);
    await http.post('/api/catalog/pitches').send({}).expect(400);
    await http.post('/api/catalog/pitches').expect(400);
    const unknown = await http.post('/api/catalog/pitches').send({ complexId: 99, name: 'A', type: 7 }).expect(400);
    expect(unknown.body.message).toContain('Cụm sân không tồn tại');
    await http.patch('/api/catalog/pitches/1').send({}).expect(400);
    await http.get('/api/catalog/pitches/abc').expect(400);
    await http.get('/api/catalog/pitches/999').expect(404);
    await http.patch('/api/catalog/pitches/999').send({ name: 'x' }).expect(404);
  });

  it('không cho đổi trạng thái khi còn đơn đặt tương lai', async () => {
    const http = await start(fakeRepository({ upcoming: 2 }));
    const response = await http.patch('/api/catalog/pitches/1').send({ status: 'INACTIVE' }).expect(409);
    expect(response.body.message).toContain('đơn đặt');
    await http.patch('/api/catalog/pitches/1').send({ name: 'Sân 7A mới' }).expect(200);
  });

  it('không cho xóa sân đã có ca, giá hoặc lịch bảo trì', async () => {
    const http = await start(fakeRepository({ dependents: { slots: 5, prices: 6, blocks: 0 } }));
    const response = await http.delete('/api/catalog/pitches/1').expect(409);
    expect(response.body.message).toContain('INACTIVE');
    await http.get('/api/catalog/pitches/1').expect(200);
  });

  it('đổi lỗi trùng tên của MySQL thành 409', async () => {
    const http = await start(fakeRepository({ insertError: { errno: 1062 } }));
    const response = await http.post('/api/catalog/pitches').send({ complexId: 1, name: 'Sân 7A', type: 7 }).expect(409);
    expect(response.body.message).toContain('Tên sân đã tồn tại');
  });
});