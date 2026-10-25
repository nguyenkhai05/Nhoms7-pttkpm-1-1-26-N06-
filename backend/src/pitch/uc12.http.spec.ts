import { afterEach, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { PitchController } from './controllers/pitchController.js';
import { ScheduleController } from './controllers/scheduleController.js';
import { PitchService } from './services/pitchService.js';
import { ScheduleService } from './services/scheduleService.js';
import type { PitchRepository } from './repositories/pitchRepository.js';

describe('UC1.2 HTTP contract consumed by React', () => {
  let app: INestApplication | undefined;
  afterEach(async () => { await app?.close(); app = undefined; });

  it('serves search, detail and daily schedule; rejects an invalid date', async () => {
    const pitch = { id: 1, name: 'Sân 7A', type: 7, complexName: 'Cụm sân Phenikaa', district: 'Hà Đông', address: 'Yên Nghĩa, Hà Nội', grass: 'Cỏ nhân tạo', lights: 'Đèn LED', status: 'ACTIVE', image: '', startingPrice: 200000,
      amenities: [{ id: 1, name: 'Bãi xe' }], prices: [{ id: 1, pitchId: 1, dayType: 'WEEKDAY', start: '06:00', end: '17:00', amount: 200000 }] };
    const fake = {
      search: async () => [pitch], detail: async () => pitch,
      slots: async () => [{ id: 1, pitchId: 1, start: '06:00', end: '07:30' }],
      occupancy: async () => [], isHoliday: async () => false, blocks: async () => [],
    } as unknown as PitchRepository;
    const pitchService = new PitchService(fake);
    const scheduleService = new ScheduleService(pitchService, fake);
    const module = await Test.createTestingModule({ controllers: [PitchController, ScheduleController], providers: [
      { provide: PitchService, useValue: pitchService }, { provide: ScheduleService, useValue: scheduleService },
    ] }).compile();
    app = module.createNestApplication(); await app.init();
    const server = app.getHttpServer();
    const search = await request(server).get('/api/pitches?type=7&district=H%C3%A0%20%C4%90%C3%B4ng').expect(200);
    expect(search.body.data[0]).toMatchObject({ id: 1, name: 'Sân 7A', startingPrice: 200000 });
    const detail = await request(server).get('/api/pitches/1').expect(200);
    expect(detail.body.data).toMatchObject({ id: 1, amenities: [{ name: 'Bãi xe' }] });
    const matrix = await request(server).get('/api/pitches/1/schedule?date=2026-10-26').expect(200);
    expect(matrix.body.data.slots[0]).toMatchObject({ status: 'GREEN', price: 200000 });
    await request(server).get('/api/pitches/1/schedule?date=2026-02-30').expect(400);
  });
});
