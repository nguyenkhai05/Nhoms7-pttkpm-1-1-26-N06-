import { afterEach, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { CatalogController } from './catalog.controller.js';
import { CatalogService } from './catalog.service.js';
import type { CatalogRepository } from './catalog.repository.js';
import type { Complex } from './catalog.types.js';

/** Repository giả lưu trong bộ nhớ, đủ để thử hợp đồng HTTP mà không cần MySQL. */
function fakeRepository(options: { pitchCounts?: Record<number, number>; removeError?: unknown } = {}) {
  const rows: Complex[] = [
    { id: 1, name: 'Cụm sân Phenikaa', address: 'Yên Nghĩa, Hà Nội', district: 'Hà Đông', contact: null, image: null, description: null },
  ];
  let nextId = 2;
  const repository = {
    findAll: async () => rows,
    findById: async (id: number) => rows.find((row) => row.id === id) ?? null,
    insert: async (dto: Omit<Complex, 'id'>) => {
      rows.push({ id: nextId, ...dto });
      return nextId++;
    },
    update: async (id: number, dto: Partial<Complex>) => {
      Object.assign(rows.find((row) => row.id === id) as Complex, dto);
    },
    countPitches: async (id: number) => options.pitchCounts?.[id] ?? 0,
    remove: async (id: number) => {
      if (options.removeError) throw options.removeError;
      rows.splice(rows.findIndex((row) => row.id === id), 1);
    },
  };
  return repository as unknown as CatalogRepository;
}

describe('API /api/catalog/complexes', () => {
  let app: INestApplication | undefined;
  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  async function start(repository: CatalogRepository) {
    const module = await Test.createTestingModule({
      controllers: [CatalogController],
      providers: [{ provide: CatalogService, useValue: new CatalogService(repository) }],
    }).compile();
    app = module.createNestApplication();
    await app.init();
    return request(app.getHttpServer());
  }

  it('thêm, xem, sửa và xóa một cụm sân', async () => {
    const http = await start(fakeRepository({ pitchCounts: { 1: 3 } }));

    const created = await http
      .post('/api/catalog/complexes')
      .send({ name: 'Cụm sân Mới', address: '1 Đường A', district: 'Cầu Giấy' })
      .expect(201);
    const id = created.body.data.id as number;
    expect(created.body.data).toMatchObject({ name: 'Cụm sân Mới', contact: null });

    expect((await http.get('/api/catalog/complexes').expect(200)).body.data).toHaveLength(2);

    const updated = await http.patch(`/api/catalog/complexes/${id}`).send({ contact: '0911111111' }).expect(200);
    expect(updated.body.data).toMatchObject({ name: 'Cụm sân Mới', contact: '0911111111' });

    await http.delete(`/api/catalog/complexes/${id}`).expect(200);
    await http.get(`/api/catalog/complexes/${id}`).expect(404);
  });

  it('báo lỗi rõ ràng với dữ liệu sai', async () => {
    const http = await start(fakeRepository({ pitchCounts: { 1: 3 } }));
    await http.post('/api/catalog/complexes').send({ name: '' }).expect(400);
    await http.post('/api/catalog/complexes').expect(400);
    await http.patch('/api/catalog/complexes/1').send({}).expect(400);
    await http.get('/api/catalog/complexes/abc').expect(400);
    await http.get('/api/catalog/complexes/999').expect(404);
    await http.patch('/api/catalog/complexes/999').send({ contact: 'x' }).expect(404);
  });

  it('không cho xóa cụm sân còn sân', async () => {
    const http = await start(fakeRepository({ pitchCounts: { 1: 3 } }));
    const response = await http.delete('/api/catalog/complexes/1').expect(409);
    expect(response.body.message).toContain('vẫn còn sân');
    await http.get('/api/catalog/complexes/1').expect(200);
  });

  it('đổi lỗi khóa ngoại của MySQL thành 409', async () => {
    const http = await start(fakeRepository({ removeError: { errno: 1451 } }));
    await http.delete('/api/catalog/complexes/1').expect(409);
  });
});